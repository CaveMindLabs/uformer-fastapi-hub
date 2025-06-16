# noctura-uformer/backend/app/api/endpoints/video_file_processing.py
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
from app.api.dependencies import get_models

router = APIRouter()

# In-memory storage for task statuses.
tasks: Dict[str, Dict[str, Any]] = {}

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

def video_processing_task(task_id: str, input_path: str, output_path: str, model_name: str, models: Dict[str, Any]):
    """
    Processes a video frame-by-frame using a patch-based approach with the selected Uformer model.
    """
    tasks[task_id]['status'] = 'processing'
    print(f"[VIDEO_PROCESSOR] Task {task_id}: Starting processing for {input_path} with model '{model_name}'")

    try:
        if model_name not in models:
            raise RuntimeError(f"Invalid model name provided to task: {model_name}")
            
        uformer_model = models[model_name]
        device = models["device"]
        patch_size = 256

        # 1. Open video and get properties
        cap = cv2.VideoCapture(input_path)
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # 2. Setup video writer
        temp_video_path = output_path.replace(".mp4", ".tmp.mp4")
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(temp_video_path, fourcc, fps, (frame_width, frame_height))

        # 3. Process each frame with a TQDM progress bar
        with tqdm(total=total_frames, desc=f"Processing Video Task {task_id}", unit="frame") as pbar:
            while cap.isOpened():
                ret, frame_bgr = cap.read()
                if not ret:
                    break

                # --- The frame processing logic remains the same ---
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

                # Update the progress bar for one processed frame
                pbar.update(1)

        cap.release()
        writer.release()

        # 4. Re-attach audio
        print(f"[VIDEO_PROCESSOR] Task {task_id}: Attaching audio with FFmpeg...")
        input_video_stream = ffmpeg.input(temp_video_path)
        input_audio_stream = ffmpeg.input(input_path)
        try:
            ffmpeg.output(input_video_stream.video, input_audio_stream.audio, output_path, vcodec='libx264', acodec='aac', crf=18, y='-y').run(quiet=True)
        except ffmpeg.Error as e:
            print(f"[VIDEO_PROCESSOR] Task {task_id}: No audio stream found or merge failed. Saving video only. Error: {e.stderr.decode()}")
            os.rename(temp_video_path, output_path)

        # 5. Clean up
        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)
        
        tasks[task_id]['status'] = 'completed'
        tasks[task_id]['result_path'] = output_path

    except Exception as e:
        print(f"[VIDEO_PROCESSOR] Task {task_id}: ERROR during processing - {e}")
        traceback.print_exc()
        tasks[task_id]['status'] = 'failed'
        tasks[task_id]['error'] = str(e)

# --- The rest of the file (API endpoints) remains the same ---
@router.post("/api/process_video")
async def process_video(
    background_tasks: BackgroundTasks,
    video_file: UploadFile = File(...),
    task_type: str = Form("denoise"), # Add task_type from frontend
    model_name: str = Form("denoise_b"),
    models: Dict[str, Any] = Depends(get_models)
):
    # Define task-specific subdirectories
    base_temp_dir = os.path.join("temp", "videos", task_type)
    video_upload_dir = os.path.join(base_temp_dir, "uploads")
    video_output_dir = os.path.join(base_temp_dir, "processed")
    os.makedirs(video_upload_dir, exist_ok=True)
    os.makedirs(video_output_dir, exist_ok=True)

    task_id = str(uuid.uuid4())
    sanitized_filename = os.path.basename(video_file.filename)
    input_path = os.path.join(video_upload_dir, f"{task_id}_{sanitized_filename}")
    
    output_filename_base, _ = os.path.splitext(sanitized_filename)
    output_path = os.path.join(video_output_dir, f"enhanced_{task_type}_{task_id}_{output_filename_base}.mp4")

    with open(input_path, "wb") as buffer:
        buffer.write(await video_file.read())

    tasks[task_id] = {"status": "pending", "filename": sanitized_filename, "result_path": None, "error": None}
    
    # Pass the selected model_name to the background task
    background_tasks.add_task(video_processing_task, task_id, input_path, output_path, model_name, models)
    
    return JSONResponse(status_code=202, content={"task_id": task_id, "message": "Video upload successful, processing started."})


@router.get("/api/video_status/{task_id}")
async def get_video_status(task_id: str):
    task = tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return JSONResponse(content=task)


@router.get("/api/download_video")
async def download_video(filepath: str):
    # Allow downloads from anywhere within the 'temp/videos' directory
    allowed_base_dir = os.path.abspath(os.path.join("temp", "videos"))
    requested_path = os.path.abspath(filepath)

    if not requested_path.startswith(allowed_base_dir):
        raise HTTPException(status_code=403, detail="Access denied: File is outside the allowed directory.")

    if not os.path.exists(requested_path):
        raise HTTPException(status_code=404, detail="File not found.")

    return FileResponse(path=requested_path, media_type='video/mp4', filename=os.path.basename(requested_path))
