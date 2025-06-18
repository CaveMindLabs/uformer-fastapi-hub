# noctura-uformer/backend/app/api/endpoints/image_file_processing.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import Response
from PIL import Image
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

      
# Import the dependency to get our loaded models
from app.api.dependencies import get_models, get_model_by_name # Import the new model dependency

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
    # Removed original_h, original_w as it's not used
    # If needed replace teh return with "return padded_image, (original_h, original_w)"
    return padded_image, (0, 0) 


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
                # rgb_array = raw.postprocess(use_camera_wb=True, output_color=rawpy.ColorSpace.sRGB, no_auto_bright=True)
                rgb_array = raw.postprocess(use_camera_wb=True, output_color=rawpy.ColorSpace.sRGB)
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
    task_type: str = Form("denoise"),
    model_name: str = Form("denoise_b"),
    use_patch_processing: bool = Form(True),
    models: Dict[str, Any] = Depends(get_models) # Inject the models container instead
):
    """
    Accepts an image file, processes it using the selected Uformer model and task, 
    and returns the enhanced image. Saves files into task-specific subdirectories.
    """
    try:
        # Manually get the model using the model_name from the form.
        uformer_model = get_model_by_name(model_name=model_name, models=models)
        # Correctly get the device from the main models container, not the model instance.
        device = models["device"]
        patch_size = 256

        print(f"--- [IMAGE_PROCESSOR] New Job for: {image_file.filename} (Task: {task_type}) ---")
        contents = await image_file.read()

        # Define task-specific subdirectories
        base_temp_dir = os.path.join("temp", "images", task_type)
        image_upload_dir = os.path.join(base_temp_dir, "uploads")
        developed_dir = os.path.join(base_temp_dir, "developed_inputs")
        image_processed_dir = os.path.join(base_temp_dir, "processed")
        
        # Ensure all directories exist
        for dir_path in [image_upload_dir, developed_dir, image_processed_dir]:
            os.makedirs(dir_path, exist_ok=True)

        # --- Save the original uploaded file ---
        unique_id = f"{int(time.time())}_{uuid.uuid4().hex[:8]}"
        original_filename = f"{unique_id}_original_fullres_{image_file.filename}"
        original_filepath = os.path.join(image_upload_dir, original_filename)
        with open(original_filepath, "wb") as f:
            f.write(contents)
        print(f"[IMAGE_PROCESSOR] Saved original file to: {original_filepath}")

        # --- Step 1: Prepare the input image into a standard NumPy array ---
        # This input_np is what we will process. It will be 8-bit sRGB.
        if image_file.filename.lower().endswith(('.arw', '.nef', '.cr2', '.dng')):
            print("[IMAGE_PROCESSOR] RAW file detected. Developing to sRGB...")
            with rawpy.imread(io.BytesIO(contents)) as raw:
                # Develop the RAW file into a standard, viewable 8-bit sRGB image.
                # This mimics the format of the SIDD sRGB training dataset.
                input_np_8bit = raw.postprocess(use_camera_wb=True, output_color=rawpy.ColorSpace.sRGB, output_bps=8)
        else:
            print("[IMAGE_PROCESSOR] Standard image file detected.")
            input_np_8bit = np.array(Image.open(io.BytesIO(contents)).convert("RGB"))
        
        # --- Save the "developed" input that the model will see ---
        developed_filename_base = os.path.splitext(image_file.filename)[0]
        developed_filename = f"{unique_id}_developed_{developed_filename_base}.jpg"
        Image.fromarray(input_np_8bit).save(os.path.join(developed_dir, developed_filename))
        print(f"[IMAGE_PROCESSOR] Saved developed input to: {os.path.join(developed_dir, developed_filename)}")

        # --- Step 2: Normalize the 8-bit image to float[0,1] for the model ---
        input_full_res_np = (input_np_8bit / 255.0).astype(np.float32)
        original_h, original_w, _ = input_full_res_np.shape
        
        # --- Step 3: Process the image (patch or resize) ---
        final_enhanced_image_np = None
        if use_patch_processing:
            padded_input_np, _ = pad_image_to_multiple(input_full_res_np, patch_size)
            padded_h, padded_w, _ = padded_input_np.shape
            padded_output_np = np.zeros_like(padded_input_np)
            for y in range(0, padded_h, patch_size):
                for x in range(0, padded_w, patch_size):
                    patch_np = padded_input_np[y:y+patch_size, x:x+patch_size, :]
                    patch_tensor = torch.from_numpy(patch_np).permute(2, 0, 1).unsqueeze(0).to(device)
                    with torch.no_grad():
                        restored_patch_tensor = uformer_model(patch_tensor)
                    restored_patch_np = restored_patch_tensor.squeeze(0).permute(1, 2, 0).clamp(0.0, 1.0).cpu().numpy()
                    padded_output_np[y:y+patch_size, x:x+patch_size, :] = restored_patch_np
            final_enhanced_image_np = padded_output_np[0:original_h, 0:original_w, :]
        else:
            resized_input_np = cv2.resize(input_full_res_np, (patch_size, patch_size), interpolation=cv2.INTER_LANCZOS4)
            input_tensor = torch.from_numpy(resized_input_np).permute(2, 0, 1).unsqueeze(0).to(device)
            with torch.no_grad():
                restored_tensor = uformer_model(input_tensor)
            restored_resized_np = restored_tensor.squeeze(0).permute(1, 2, 0).clamp(0.0, 1.0).cpu().numpy()
            final_enhanced_image_np = cv2.resize(restored_resized_np, (original_w, original_h), interpolation=cv2.INTER_LANCZOS4)

        # --- Step 4: Prepare and save the final output ---
        output_image_uint8 = (final_enhanced_image_np * 255.0).astype(np.uint8)
        pil_output_image = Image.fromarray(output_image_uint8)
        img_byte_arr = io.BytesIO()
        pil_output_image.save(img_byte_arr, format='JPEG', quality=95)
        
        processed_filename_base = os.path.splitext(image_file.filename)[0]
        processed_filename = f"{unique_id}_processed_{processed_filename_base}.jpg"
        with open(os.path.join(image_processed_dir, processed_filename), "wb") as f:
            f.write(img_byte_arr.getvalue())
        print(f"[IMAGE_PROCESSOR] Saved processed image to: {os.path.join(image_processed_dir, processed_filename)}")

        img_byte_arr.seek(0)
        return Response(content=img_byte_arr.getvalue(), media_type="image/jpeg")

    except Exception as e:
        print(f"[IMAGE_PROCESSOR] ERROR: Failed to process image: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process image: {e}")
 