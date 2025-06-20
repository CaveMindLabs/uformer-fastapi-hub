# backend/app/api/endpoints/image_file_processing.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks
from fastapi.responses import Response, JSONResponse
from PIL import Image
from typing import Dict, Any, Tuple
import io
import torch
import cv2
import numpy as np
import os
import time
import uuid
import traceback
import rawpy

from app.api.dependencies import get_models, get_model_by_name

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
    return padded_image, (original_h, original_w)


def run_image_enhancement_task(
    task_id: str,
    file_contents: bytes,
    original_filename: str,
    task_type: str,
    model_name: str,
    use_patch_processing: bool,
    models: Dict[str, Any]
):
    """
    The actual, long-running image processing logic that runs in the background.
    """
    tasks_db = models["tasks_db"]
    models_in_use = models["models_in_use"]

    try:
        # --- Reference Counting: Increment ---
        # Increment the counter for the model we are about to use.
        models_in_use[model_name] = models_in_use.get(model_name, 0) + 1
        print(f"[REF_COUNT] INCREMENT: Model '{model_name}' in use count is now {models_in_use[model_name]}.")
        # ------------------------------------

        tasks_db[task_id] = {"status": "processing", "progress": 0, "message": "Model and data loaded. Starting enhancement."}
        uformer_model = get_model_by_name(model_name=model_name, models=models)
        device = models["device"]
        patch_size = 256

        print(f"--- [BG-TASK:{task_id}] Processing: {original_filename} (Task: {task_type}) ---")

        # Define task-specific directories
        base_temp_dir = os.path.join("temp", "images", task_type)
        image_upload_dir = os.path.join(base_temp_dir, "uploads")
        developed_dir = os.path.join(base_temp_dir, "developed_inputs")
        image_processed_dir = os.path.join(base_temp_dir, "processed")
        for dir_path in [image_upload_dir, developed_dir, image_processed_dir]:
            os.makedirs(dir_path, exist_ok=True)
        
        unique_id = f"{int(time.time())}_{task_id[:8]}"

        # --- Save the original uploaded file ---
        # This restores the functionality to save the pristine, original file.
        original_saved_filename = f"{unique_id}_original_upload_{original_filename}"
        original_filepath = os.path.join(image_upload_dir, original_saved_filename)
        with open(original_filepath, "wb") as f:
            f.write(file_contents)
        print(f"[BG-TASK:{task_id}] Saved original uploaded file to: {original_filepath}")

        # Step 1: Prepare the input image into a standard NumPy array
        if original_filename.lower().endswith(('.arw', '.nef', '.cr2', '.dng')):
            with rawpy.imread(io.BytesIO(file_contents)) as raw:
                input_np_8bit = raw.postprocess(use_camera_wb=True, output_color=rawpy.ColorSpace.sRGB, output_bps=8)
        else:
            input_np_8bit = np.array(Image.open(io.BytesIO(file_contents)).convert("RGB"))

        # Save the "developed" input that the model will see for debugging
        developed_filename_base = os.path.splitext(original_filename)[0]
        developed_filename = f"{unique_id}_developed_{developed_filename_base}.jpg"
        Image.fromarray(input_np_8bit).save(os.path.join(developed_dir, developed_filename))

        # Step 2: Normalize the 8-bit image to float[0,1] for the model
        input_full_res_np = (input_np_8bit / 255.0).astype(np.float32)
        
        # Step 3: Process the image
        final_enhanced_image_np = None
        if use_patch_processing:
            padded_input_np, (original_h, original_w) = pad_image_to_multiple(input_full_res_np, patch_size)
            padded_h, padded_w, _ = padded_input_np.shape
            padded_output_np = np.zeros_like(padded_input_np)
            num_patches = (padded_h // patch_size) * (padded_w // patch_size)
            processed_patches = 0
            for y in range(0, padded_h, patch_size):
                for x in range(0, padded_w, patch_size):
                    patch_np = padded_input_np[y:y+patch_size, x:x+patch_size, :]
                    patch_tensor = torch.from_numpy(patch_np).permute(2, 0, 1).unsqueeze(0).to(device)
                    with torch.no_grad():
                        restored_patch_tensor = uformer_model(patch_tensor)
                    restored_patch_np = restored_patch_tensor.squeeze(0).permute(1, 2, 0).clamp(0.0, 1.0).cpu().numpy()
                    padded_output_np[y:y+patch_size, x:x+patch_size, :] = restored_patch_np
                    processed_patches += 1
                    tasks_db[task_id]["progress"] = int((processed_patches / num_patches) * 100)
            final_enhanced_image_np = padded_output_np[0:original_h, 0:original_w, :]
        else: # Resize processing
            tasks_db[task_id]["progress"] = 25
            original_h, original_w, _ = input_full_res_np.shape
            resized_input_np = cv2.resize(input_full_res_np, (patch_size, patch_size), interpolation=cv2.INTER_LANCZOS4)
            input_tensor = torch.from_numpy(resized_input_np).permute(2, 0, 1).unsqueeze(0).to(device)
            tasks_db[task_id]["progress"] = 50
            with torch.no_grad():
                restored_tensor = uformer_model(input_tensor)
            restored_resized_np = restored_tensor.squeeze(0).permute(1, 2, 0).clamp(0.0, 1.0).cpu().numpy()
            tasks_db[task_id]["progress"] = 75
            final_enhanced_image_np = cv2.resize(restored_resized_np, (original_w, original_h), interpolation=cv2.INTER_LANCZOS4)
            tasks_db[task_id]["progress"] = 100

        # Step 4: Prepare and save the final output
        output_image_uint8 = (final_enhanced_image_np * 255.0).astype(np.uint8)
        pil_output_image = Image.fromarray(output_image_uint8)
        img_byte_arr = io.BytesIO()
        pil_output_image.save(img_byte_arr, format='JPEG', quality=95)
        
        processed_filename_base = os.path.splitext(original_filename)[0]
        processed_filename = f"{unique_id}_processed_{processed_filename_base}.jpg"
        processed_filepath = os.path.join(image_processed_dir, processed_filename)
        with open(processed_filepath, "wb") as f:
            f.write(img_byte_arr.getvalue())
        
        relative_path = os.path.relpath(processed_filepath, "temp").replace("\\", "/")
        full_result_path = f"/static_results/{relative_path}"
        print(f"[BG-TASK:{task_id}] Completed. Result at: {full_result_path}")

        # --- Add new result file to the trackers ---
        tracker_by_path = models.get("tracker_by_path", {})
        path_by_task_id = models.get("path_by_task_id", {})
        
        current_timestamp = time.time()
        
        # Main tracker entry
        tracker_by_path[full_result_path] = {
            "status": "active",
            "task_id": task_id,
            "file_type": "image", # Explicitly store the file type
            "created_at": current_timestamp,
            "downloaded_at": None,
            "last_heartbeat_at": current_timestamp  # Initialize with created_at
        }
        
        # Secondary index entry
        path_by_task_id[task_id] = full_result_path
        
        print(f"[CACHE_TRACKER] Added '{full_result_path}' to tracker for task '{task_id}'.")
        # ---------------------------------------------

        tasks_db[task_id] = {"status": "completed", "result_path": full_result_path}

    except Exception as e:
        print(f"[BG-TASK:{task_id}] ERROR: Failed to process image: {e}")
        traceback.print_exc()
        tasks_db[task_id] = {"status": "failed", "error": f"An unexpected error occurred: {e}"}
    finally:
        # --- Reference Counting: Decrement ---
        # Ensure the counter is decremented whether the task succeeds or fails.
        if model_name in models_in_use:
            models_in_use[model_name] = max(0, models_in_use.get(model_name, 0) - 1)
            print(f"[REF_COUNT] DECREMENT: Model '{model_name}' in use count is now {models_in_use[model_name]}.")
        # ------------------------------------

@router.post("/api/generate_preview", tags=["image_file_processing"])
async def generate_preview(image_file: UploadFile = File(...)):
    contents = await image_file.read()
    try:
        if image_file.filename.lower().endswith(('.arw', '.nef', '.cr2', '.dng')):
            with rawpy.imread(io.BytesIO(contents)) as raw:
                rgb_array = raw.postprocess(use_camera_wb=True, output_color=rawpy.ColorSpace.sRGB)
            img = Image.fromarray(rgb_array)
        else:
            img = Image.open(io.BytesIO(contents))
        img.thumbnail((800, 800), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=85)
        buf.seek(0)
        return Response(content=buf.getvalue(), media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not generate preview from file.")

@router.post("/api/process_image")
async def process_image(
    background_tasks: BackgroundTasks,
    image_file: UploadFile = File(...),
    task_type: str = Form("denoise"),
    model_name: str = Form("denoise_b"),
    use_patch_processing: bool = Form(True),
    models: Dict[str, Any] = Depends(get_models)
):
    """
    Accepts an image file, starts a background enhancement task, and immediately
    returns a task ID for status polling.
    """
    # Quick validation and model loading (fast, synchronous)
    try:
        get_model_by_name(model_name=model_name, models=models)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Read file contents once
    contents = await image_file.read()
    
    # Create and register the task
    task_id = str(uuid.uuid4())
    tasks_db = models["tasks_db"]
    tasks_db[task_id] = {"status": "pending", "message": "Task received and queued."}
    
    # Add the long-running job to the background
    background_tasks.add_task(
        run_image_enhancement_task,
        task_id=task_id,
        file_contents=contents,
        original_filename=image_file.filename,
        task_type=task_type,
        model_name=model_name,
        use_patch_processing=use_patch_processing,
        models=models
    )

    # Immediately return 202 Accepted
    return JSONResponse(
        status_code=202,
        content={"task_id": task_id, "message": "Image processing task started."}
    )

@router.get("/api/image_status/{task_id}", tags=["image_file_processing"])
async def get_image_status(task_id: str, models: Dict[str, Any] = Depends(get_models)):
    """
    Poll this endpoint with a task_id to get the status of an image processing job.
    """
    tasks_db = models["tasks_db"]
    task = tasks_db.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task
