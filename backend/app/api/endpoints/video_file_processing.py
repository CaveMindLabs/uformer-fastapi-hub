# backend/app/api/endpoints/video_file_processing.py
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException, Depends
from fastapi.responses import JSONResponse, FileResponse
from typing import Dict, Any, Tuple
import uuid
import os
import time
import cv2
import numpy as np
import torch
import ffmpeg
import traceback
from tqdm import tqdm

# Import shared models from dependencies
from app.api.dependencies import get_models, get_model_by_name

router = APIRouter()

# The local 'tasks' dictionary has been removed.
# All state is now managed in the central app_models dictionary.

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

def video_processing_task(task_id: str, input_path: str, output_path: str, model_name: str, models_container: Dict[str, Any]):
    """
    Processes a video frame-by-frame, fully integrated with central task,
    VRAM, and file cache tracking systems.
    """
    tasks_db = models_container.get("tasks_db", {})
    models_in_use = models_container.get("models_in_use", {})
    
    tasks_db[task_id] = {'status': 'processing', 'progress': 0, 'message': 'Starting video processing engine.'}
    print(f"[VIDEO_PROCESSOR] Task {task_id}: Starting for {input_path} with model '{model_name}'")

    try:
        # --- VRAM Reference Counting: Increment ---
        models_in_use[model_name] = models_in_use.get(model_name, 0) + 1
        print(f"[REF_COUNT] INCREMENT: Model '{model_name}' in use count is now {models_in_use[model_name]}.")
        # ----------------------------------------
        
        # This get_model_by_name call will also handle on-demand loading if needed
        uformer_model = get_model_by_name(model_name=model_name, models=models_container)
        device = models_container["device"]
        patch_size = 256

        # 1. Open video and get properties
        cap = cv2.VideoCapture(input_path)
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames == 0:
            raise ValueError("Cannot read video file or video has zero frames.")
        
        # 2. Setup video writer
        temp_video_path = output_path.replace(".mp4", ".tmp.mp4")
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(temp_video_path, fourcc, fps, (frame_width, frame_height))

        # 3. Process each frame
        for i in tqdm(range(total_frames), desc=f"Processing Video Task {task_id}", unit="frame"):
            ret, frame_bgr = cap.read()
            if not ret:
                break

            # Frame processing logic
            frame_rgb_float = (cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB) / 255.0).astype(np.float32)
            padded_frame_np, _ = pad_image_to_multiple(frame_rgb_float, patch_size)
            padded_h, padded_w, _ = padded_frame_np.shape
            padded_output_np = np.zeros_like(padded_frame_np)

            for y in range(0, padded_h, patch_size):
                for x in range(0, padded_w, patch_size):
                    patch_np = padded_frame_np[y:y+patch_size, x:x+patch_size, :]
                    patch_tensor = torch.from_numpy(patch_np).permute(2, 0, 1).unsqueeze(0).to(device)
                    with torch.no_grad():
                        restored_patch_tensor = uformer_model(patch_tensor)
                    restored_patch_np = restored_patch_tensor.squeeze(0).permute(1, 2, 0).clamp(0.0, 1.0).cpu().numpy()
                    padded_output_np[y:y+patch_size, x:x+patch_size, :] = restored_patch_np
            
            restored_frame_float = padded_output_np[0:frame_height, 0:frame_width, :]
            final_frame_bgr = cv2.cvtColor((restored_frame_float * 255.0).astype(np.uint8), cv2.COLOR_RGB2BGR)
            writer.write(final_frame_bgr)
            
            # Update progress
            tasks_db[task_id]['progress'] = int(((i + 1) / total_frames) * 100)

        cap.release()
        writer.release()

        # 4. Re-attach audio
        tasks_db[task_id]['message'] = 'Attaching original audio...'
        print(f"[VIDEO_PROCESSOR] Task {task_id}: Attaching audio with FFmpeg...")
        input_video_stream = ffmpeg.input(temp_video_path)
        input_audio_stream = ffmpeg.input(input_path)
        try:
            ffmpeg.output(input_video_stream.video, input_audio_stream.audio, output_path, vcodec='libx264', acodec='aac', crf=18, y='-y').run(quiet=True, overwrite_output=True)
        except ffmpeg.Error as e:
            print(f"[VIDEO_PROCESSOR] Task {task_id}: No audio stream found or merge failed. Saving video only.")
            os.rename(temp_video_path, output_path)

        # 5. Clean up temporary video file
        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)
        
        # 6. Finalize task status and add to file cache tracker
        relative_path = os.path.relpath(output_path, "temp").replace("\\", "/")
        full_result_path = f"/static_results/{relative_path}"
        tasks_db[task_id].update({
            "status": "completed",
            "result_path": full_result_path,
            "message": "Processing complete."
        })

        # --- File Cache Tracking ---
        tracker_by_path = models_container.get("tracker_by_path", {})
        path_by_task_id = models_container.get("path_by_task_id", {})
        current_timestamp = time.time()
        tracker_by_path[full_result_path] = {
            "status": "active",
            "task_id": task_id,
            "file_type": "video", # Set correct file type
            "created_at": current_timestamp,
            "downloaded_at": None,
            "last_heartbeat_at": current_timestamp
        }
        path_by_task_id[task_id] = full_result_path
        print(f"[CACHE_TRACKER] Added '{full_result_path}' to tracker for task '{task_id}'.")
        # -------------------------

    except Exception as e:
        print(f"[VIDEO_PROCESSOR] Task {task_id}: ERROR during processing - {e}")
        traceback.print_exc()
        tasks_db[task_id].update({
            'status': 'failed',
            'error': str(e),
            'message': 'An unexpected error occurred during processing.'
        })
    finally:
        # --- VRAM Reference Counting: Decrement ---
        if model_name in models_in_use:
            models_in_use[model_name] = max(0, models_in_use.get(model_name, 0) - 1)
            print(f"[REF_COUNT] DECREMENT: Model '{model_name}' in use count is now {models_in_use[model_name]}.")
        # ----------------------------------------


@router.post("/api/process_video")
async def process_video(
    background_tasks: BackgroundTasks,
    video_file: UploadFile = File(...),
    task_type: str = Form("denoise"),
    model_name: str = Form("denoise_b"),
    models_container: Dict[str, Any] = Depends(get_models)
):
    """
    Accepts a video file, starts a background enhancement task, and immediately
    returns a task ID for status polling.
    """
    tasks_db = models_container.get("tasks_db", {})
    
    # Define task-specific subdirectories
    base_temp_dir = os.path.join("temp", "videos", task_type)
    video_upload_dir = os.path.join(base_temp_dir, "uploads")
    video_output_dir = os.path.join(base_temp_dir, "processed")
    os.makedirs(video_upload_dir, exist_ok=True)
    os.makedirs(video_output_dir, exist_ok=True)

    task_id = str(uuid.uuid4())
    sanitized_filename = os.path.basename(video_file.filename)
    # Use a unique ID in the input filename to prevent collisions
    input_path = os.path.join(video_upload_dir, f"{task_id}_{sanitized_filename}")
    
    output_filename_base, _ = os.path.splitext(sanitized_filename)
    output_path = os.path.join(video_output_dir, f"enhanced_{task_id}_{output_filename_base}.mp4")

    # Save the uploaded file
    with open(input_path, "wb") as buffer:
        buffer.write(await video_file.read())

    # Initial entry in the central tasks_db
    tasks_db[task_id] = {"status": "pending", "filename": sanitized_filename, "message": "Task queued."}
    
    background_tasks.add_task(video_processing_task, task_id, input_path, output_path, model_name, models_container)
    
    return JSONResponse(status_code=202, content={"task_id": task_id, "message": "Video processing task started."})


@router.get("/api/video_status/{task_id}")
async def get_video_status(task_id: str, models_container: Dict[str, Any] = Depends(get_models)):
    """
    Poll this endpoint with a task_id to get the status of a video processing job.
    Reads from the central tasks_db.
    """
    tasks_db = models_container.get("tasks_db", {})
    task = tasks_db.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return JSONResponse(content=task)

# The old /api/download_video endpoint has been removed.
# Results are now served via the static path /static_results/...
# This unifies the file delivery mechanism with the image processor.
