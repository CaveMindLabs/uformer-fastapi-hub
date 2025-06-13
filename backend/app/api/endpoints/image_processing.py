# noctura-uformer/backend/app/api/endpoints/image_processing.py
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import Response
from typing import Dict, Any
import io
import torch
import cv2
import numpy as np
from PIL import Image
import os
import time # For logging timestamp if needed
import uuid

# Import the dependency to get our loaded Uformer model
from app.api.dependencies import get_uformer_model

router = APIRouter()

# Helper function for image padding (copied from video_processing.py)
def pad_image_to_multiple(image_np: np.ndarray, multiple: int = 8):
    """
    Pads an image to ensure its height and width are multiples of 'multiple'.
    Returns the padded image and the padding amounts (top, bottom, left, right).
    """
    h, w, c = image_np.shape
    pad_h = (multiple - (h % multiple)) % multiple
    pad_w = (multiple - (w % multiple)) % multiple

    if pad_h == 0 and pad_w == 0:
        return image_np, (0, 0, 0, 0) # No padding needed

    padded_image = np.pad(image_np, 
                          ((0, pad_h), (0, pad_w), (0, 0)), 
                          mode='reflect') # 'reflect' or 'edge' are good for image borders
    return padded_image, (0, pad_h, 0, pad_w) # Returns (top, bottom, left, right) padding

@router.post("/api/process_image")
async def process_image(
    image_file: UploadFile = File(...),
    models: Dict[str, Any] = Depends(get_uformer_model)
):
    """
    Accepts an image file, processes it using the Uformer model, and returns the enhanced image.
    Also saves intermediate images for debugging.
    """
    uformer_model = models["uformer_model"]
    device = models["device"]

    if uformer_model is None:
        raise HTTPException(status_code=503, detail="Uformer model is not loaded or failed to initialize.")

    # Define temporary directories
    # Use os.path.join for cross-platform compatibility
    current_time = int(time.time())
    unique_id = f"{current_time}_{uuid.uuid4().hex[:8]}" # Add a unique ID to avoid overwriting

    image_upload_dir = os.path.join("temp", "images", "uploads")
    image_processed_dir = os.path.join("temp", "images", "processed")
    
    # Ensure directories exist
    os.makedirs(image_upload_dir, exist_ok=True)
    os.makedirs(image_processed_dir, exist_ok=True)

    try:
        print(f"[IMAGE_PROCESSOR] Processing image: {image_file.filename}")
        # 1. Read and decode image
        contents = await image_file.read()
        image_pil = Image.open(io.BytesIO(contents)).convert("RGB")
        
        # Keep original dimensions for upscaling later
        original_h, original_w = image_pil.height, image_pil.width
        print(f"[IMAGE_PROCESSOR] Original dimensions: {original_w}x{original_h}")

        # 2. Resize to model's expected input size (256x256)
        image_pil_resized_256 = image_pil.resize((256, 256), Image.Resampling.LANCZOS)
        
        # Convert PIL Image to numpy array (HWC, RGB)
        input_image_np_rgb_256 = np.array(image_pil_resized_256)
        print(f"[IMAGE_PROCESSOR] Resized to 256x256 for model input.")

        # --- DEBUGGING: Save the 256x256 original input image ---
        original_input_filename = f"{unique_id}_original_256x256_{image_file.filename}"
        original_input_filepath = os.path.join(image_upload_dir, original_input_filename)
        Image.fromarray(input_image_np_rgb_256).save(original_input_filepath)
        print(f"[IMAGE_PROCESSOR] Saved original (resized) image to: {original_input_filepath}")


        # 3. Pad image to a multiple of Uformer's window size (8)
        padded_image_np_rgb, (pad_t, pad_b, pad_l, pad_r) = pad_image_to_multiple(input_image_np_rgb_256, multiple=8)
        print(f"[IMAGE_PROCESSOR] Padding applied: (T:{pad_t}, B:{pad_b}, L:{pad_l}, R:{pad_r})")
        
        # Normalize to [0, 1] and convert to PyTorch tensor (CHW, float32)
        input_tensor = torch.from_numpy(padded_image_np_rgb.astype(np.float32) / 255.0).permute(2, 0, 1).unsqueeze(0).to(device)
        print(f"[IMAGE_PROCESSOR] Input tensor prepared, shape: {input_tensor.shape}, device: {device}")

        # 4. Perform Enhancement with Uformer
        print(f"[IMAGE_PROCESSOR] Running Uformer inference...")
        with torch.no_grad():
            enhanced_tensor = uformer_model(input_tensor)
        print(f"[IMAGE_PROCESSOR] Uformer inference complete.")

        # 5. Post-process enhanced image
        # Move to CPU, remove batch dimension, permute to HWC, scale back to [0, 255]
        enhanced_image_np_rgb_256 = (enhanced_tensor.squeeze(0).permute(1, 2, 0).clamp(0.0, 1.0).cpu().numpy() * 255.0).astype(np.uint8)

        # Remove padding (if any was applied, though unlikely for 256x256 input)
        if pad_b > 0 or pad_r > 0:
            enhanced_image_np_rgb_256 = enhanced_image_np_rgb_256[:256 - pad_b, :256 - pad_r, :]
        print(f"[IMAGE_PROCESSOR] Post-processing to 256x256 numpy array.")

        # --- DEBUGGING: Save the 256x256 processed output image ---
        processed_output_filename_256 = f"{unique_id}_processed_256x256_{image_file.filename}"
        processed_output_filepath_256 = os.path.join(image_processed_dir, processed_output_filename_256)
        Image.fromarray(enhanced_image_np_rgb_256).save(processed_output_filepath_256)
        print(f"[IMAGE_PROCESSOR] Saved processed (256x256) image to: {processed_output_filepath_256}")


        # 6. Upscale back to original image dimensions for display/download
        final_enhanced_image_np_rgb = cv2.resize(enhanced_image_np_rgb_256, (original_w, original_h), interpolation=cv2.INTER_LANCZOS4)
        print(f"[IMAGE_PROCESSOR] Upscaled to original dimensions: {original_w}x{original_h}")


        # 7. Encode image to JPEG for response
        pil_output_image = Image.fromarray(final_enhanced_image_np_rgb)
        img_byte_arr = io.BytesIO()
        pil_output_image.save(img_byte_arr, format='JPEG', quality=90)
        img_byte_arr.seek(0)
        print(f"[IMAGE_PROCESSOR] Image prepared for response.")

        return Response(content=img_byte_arr.getvalue(), media_type="image/jpeg")

    except Exception as e:
        print(f"[IMAGE_PROCESSOR] ERROR: Failed to process image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process image: {e}")
