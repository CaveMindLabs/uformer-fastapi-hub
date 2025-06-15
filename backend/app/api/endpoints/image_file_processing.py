# noctura-uformer/backend/app/api/endpoints/image_file_processing.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import Response
from PIL import Image, ImageOps
from typing import Dict, Any, Tuple
import io
import torch
import cv2
import numpy as np
from PIL import Image
import os
import time
import uuid
import traceback
import rawpy

# Import the dependency to get our loaded Uformer model
from app.api.dependencies import get_uformer_model

router = APIRouter()

# Helper function for image padding
def pad_image_to_multiple(image_np: np.ndarray, multiple: int, mode='reflect') -> Tuple[np.ndarray, Tuple[int, int]]:
    """
    Pads an image to ensure its height and width are multiples of 'multiple'.
    Returns the padded image and the original dimensions (h, w).
    """
    original_h, original_w, c = image_np.shape

    pad_h = (multiple - (original_h % multiple)) % multiple
    pad_w = (multiple - (original_w % multiple)) % multiple

    if pad_h == 0 and pad_w == 0:
        return image_np, (original_h, original_w)

    padded_image = np.pad(image_np, ((0, pad_h), (0, pad_w), (0, 0)), mode=mode)
    return padded_image, (original_h, original_w)


@router.post("/api/generate_preview", tags=["image_file_processing"])
async def generate_preview(image_file: UploadFile = File(...)):
    """
    Takes an uploaded image (especially RAW), and returns a standard,
    resized JPEG preview that browsers can display.
    """
    contents = await image_file.read()
    
    try:
        # For RAW files
        if image_file.filename.lower().endswith(('.arw', '.nef', '.cr2', '.dng')):
            with rawpy.imread(io.BytesIO(contents)) as raw:
                # Use postprocess to get a displayable sRGB image
                rgb_array = raw.postprocess(use_camera_wb=True, output_color=rawpy.ColorSpace.sRGB, no_auto_bright=True)
            img = Image.fromarray(rgb_array)
        # For standard images that might be huge
        else:
            img = Image.open(io.BytesIO(contents))

        # Create a reasonably sized thumbnail for preview
        img.thumbnail((800, 800), Image.Resampling.LANCZOS)
        
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=85)
        buf.seek(0)
        
        return Response(content=buf.getvalue(), media_type="image/jpeg")
    
    except Exception as e:
        print(f"Error generating preview: {e}")
        raise HTTPException(status_code=500, detail="Could not generate preview from file.")

@router.post("/api/process_image")
async def process_image(
    image_file: UploadFile = File(...),
    use_patch_processing: bool = Form(True), # The new toggle switch
    models: Dict[str, Any] = Depends(get_uformer_model)
):
    """
    Accepts an image file, processes it using the Uformer model, and returns the enhanced image.
    Supports standard image formats and Sony .ARW RAW files.
    Allows toggling between patch-based (high quality) and resize (high speed) processing.
    """
    uformer_model = models["uformer_model"]
    device = models["device"]
    patch_size = 256

    if uformer_model is None:
        raise HTTPException(status_code=503, detail="Uformer model is not loaded or failed to initialize.")

    try:
        print(f"--- [IMAGE_PROCESSOR] New Job ---")
        print(f"[IMAGE_PROCESSOR] Processing image: {image_file.filename}")
        print(f"[IMAGE_PROCESSOR] Patch processing enabled: {use_patch_processing}")
        
        contents = await image_file.read()
        
        # --- Handle different image types (.ARW vs standard) ---
        if image_file.filename.lower().endswith('.arw'):
            print("[IMAGE_PROCESSOR] Detected .ARW RAW file.")
            with rawpy.imread(io.BytesIO(contents)) as raw:
                # Post-process to get a 16-bit RGB image, disabling auto-brightness
                rgb_16bit = raw.postprocess(gamma=(1, 1), no_auto_bright=True, output_bps=16)
            # Normalize from [0, 65535] to [0, 1] for the model
            input_full_res_np = (rgb_16bit / 65535.0).astype(np.float32)
        else:
            print("[IMAGE_PROCESSOR] Detected standard image file (JPG/PNG).")
            # --- FIX: Save original uploaded file ---
            unique_id = f"{int(time.time())}_{uuid.uuid4().hex[:8]}"
            image_upload_dir = os.path.join("temp", "images", "uploads")
            os.makedirs(image_upload_dir, exist_ok=True)
            original_filename = f"{unique_id}_original_fullres_{image_file.filename}"
            original_filepath = os.path.join(image_upload_dir, original_filename)
            with open(original_filepath, "wb") as f:
                f.write(contents)
            print(f"[IMAGE_PROCESSOR] Saved original full-res image to: {original_filepath}")
            
            image_pil = Image.open(io.BytesIO(contents)).convert("RGB")
            # Convert to float and normalize to [0,1]
            input_full_res_np = (np.array(image_pil) / 255.0).astype(np.float32)

        original_h, original_w, _ = input_full_res_np.shape
        print(f"[IMAGE_PROCESSOR] Original dimensions: {original_w}x{original_h}")

        final_enhanced_image_np = None

        # --- Toggleable Processing Logic ---
        if use_patch_processing:
            # --- HIGH QUALITY (SLOW) - PATCH-BASED PIPELINE ---
            print("[IMAGE_PROCESSOR] Using high-quality patch-based pipeline.")
            padded_input_np, _ = pad_image_to_multiple(input_full_res_np, patch_size)
            padded_h, padded_w, _ = padded_input_np.shape
            padded_output_np = np.zeros_like(padded_input_np)
            
            # total_patches = (padded_h // patch_size) * (padded_w // patch_size)
            for i, y in enumerate(range(0, padded_h, patch_size)):
                for j, x in enumerate(range(0, padded_w, patch_size)):
                    patch_np = padded_input_np[y:y+patch_size, x:x+patch_size, :]
                    patch_tensor = torch.from_numpy(patch_np).permute(2, 0, 1).unsqueeze(0).to(device)
                    
                    with torch.no_grad():
                        restored_patch_tensor = uformer_model(patch_tensor)
                    
                    restored_patch_np = restored_patch_tensor.squeeze(0).permute(1, 2, 0).clamp(0.0, 1.0).cpu().numpy()
                    padded_output_np[y:y+patch_size, x:x+patch_size, :] = restored_patch_np
            
            final_enhanced_image_np = padded_output_np[0:original_h, 0:original_w, :]

        else:
            # --- HIGH SPEED (LOW QUALITY) - RESIZE PIPELINE ---
            print("[IMAGE_PROCESSOR] Using high-speed resize pipeline.")
            resized_input_np = cv2.resize(input_full_res_np, (patch_size, patch_size), interpolation=cv2.INTER_LANCZOS4)
            input_tensor = torch.from_numpy(resized_input_np).permute(2, 0, 1).unsqueeze(0).to(device)
            
            with torch.no_grad():
                restored_tensor = uformer_model(input_tensor)

            restored_resized_np = restored_tensor.squeeze(0).permute(1, 2, 0).clamp(0.0, 1.0).cpu().numpy()
            
            # Upscale back to original dimensions as requested
            final_enhanced_image_np = cv2.resize(restored_resized_np, (original_w, original_h), interpolation=cv2.INTER_LANCZOS4)

        print("[IMAGE_PROCESSOR] All processing complete. Preparing response.")

        # Convert final float[0,1] numpy array to uint8[0,255] for saving
        output_image_uint8 = (final_enhanced_image_np * 255.0).astype(np.uint8)
        pil_output_image = Image.fromarray(output_image_uint8)
        
        img_byte_arr = io.BytesIO()
        pil_output_image.save(img_byte_arr, format='JPEG', quality=95)
        
        # --- Save final processed file for debugging ---
        unique_id = f"{int(time.time())}_{uuid.uuid4().hex[:8]}"
        image_processed_dir = os.path.join("temp", "images", "processed")
        os.makedirs(image_processed_dir, exist_ok=True)
        processed_filename_base = os.path.splitext(image_file.filename)[0]
        processed_filename = f"{unique_id}_processed_{processed_filename_base}.jpg"
        processed_filepath = os.path.join(image_processed_dir, processed_filename)
        with open(processed_filepath, "wb") as f:
            f.write(img_byte_arr.getvalue())
        print(f"[IMAGE_PROCESSOR] Saved processed image to: {processed_filepath}")

        img_byte_arr.seek(0)
        return Response(content=img_byte_arr.getvalue(), media_type="image/jpeg")

    except Exception as e:
        print(f"[IMAGE_PROCESSOR] ERROR: Failed to process image: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process image: {e}")
    