# noctura-uformer/backend/app/api/endpoints/file_processing.py
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, Depends
from fastapi.responses import JSONResponse, FileResponse
from typing import Dict, Any
import uuid
import os
import time
import cv2
import numpy as np
import torch
import ffmpeg

# Import shared model from dependencies
from app.api.dependencies import get_uformer_model

# In-memory storage for task statuses.
tasks: Dict[str, Dict[str, Any]] = {}

def video_processing_task(task_id: str, input_path: str, output_path: str, models: Dict[str, Any]):
    """
    Processes a video frame-by-frame using the Uformer model and re-attaches audio.
    """
    tasks[task_id]['status'] = 'processing'
    print(f"Task {task_id}: Starting REAL processing for {input_path}")

    try:
        uformer_model = models["uformer_model"]
        device = models["device"]
        
        if uformer_model is None:
            raise RuntimeError("Uformer model is not loaded.")

        # 1. Open video and get properties
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise IOError(f"Cannot open video file {input_path}")
        
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        
        # 2. Setup video writer for processed frames (no audio yet)
        temp_video_path = output_path + ".tmp.mp4"
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(temp_video_path, fourcc, fps, (frame_width, frame_height))

        # 3. Process each frame
        frame_count = 0
        while cap.isOpened():
            ret, frame_bgr = cap.read()
            if not ret:
                break
            
            # Pre-process frame
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            frame_resized = cv2.resize(frame_rgb, (256, 256), interpolation=cv2.INTER_LANCZOS4)
            
            input_tensor = torch.from_numpy(frame_resized.astype(np.float32) / 255.0).permute(2, 0, 1).unsqueeze(0).to(device)
            
            # Run Uformer model
            with torch.no_grad():
                enhanced_tensor = uformer_model(input_tensor)
            
            # Post-process frame
            enhanced_np = (enhanced_tensor.squeeze(0).permute(1, 2, 0).clamp(0.0, 1.0).cpu().numpy() * 255.0).astype(np.uint8)
            
            # Upscale back to original resolution and convert back to BGR
            enhanced_upscaled = cv2.resize(enhanced_np, (frame_width, frame_height), interpolation=cv2.INTER_LANCZOS4)
            final_frame_bgr = cv2.cvtColor(enhanced_upscaled, cv2.COLOR_RGB2BGR)

            writer.write(final_frame_bgr)
            frame_count += 1
            if frame_count % 30 == 0: # Print progress every 30 frames
                print(f"Task {task_id}: Processed {frame_count} frames...")

        cap.release()
        writer.release()
        print(f"Task {task_id}: Finished processing {frame_count} frames. Video saved to {temp_video_path}")

        # 4. Re-attach audio from original video using ffmpeg
        print(f"Task {task_id}: Attaching audio...")
        input_video_stream = ffmpeg.input(temp_video_path)
        input_audio_stream = ffmpeg.input(input_path)
        
        ffmpeg.concat(input_video_stream, input_audio_stream, v=1, a=1).output(output_path, y='-y').run(quiet=True)
        
        os.remove(temp_video_path) # Clean up temp file
        print(f"Task {task_id}: Audio attached. Final output at {output_path}")
        
        tasks[task_id]['status'] = 'completed'
        tasks[task_id]['result_path'] = output_path

    except Exception as e:
        print(f"Task {task_id}: ERROR during processing - {e}")
        tasks[task_id]['status'] = 'failed'
        tasks[task_id]['error'] = str(e)
        # Clean up partial files if they exist
        if 'temp_video_path' in locals() and os.path.exists(temp_video_path):
            os.remove(temp_video_path)


router = APIRouter()

@router.post("/api/process_video")
async def process_video(
    background_tasks: BackgroundTasks,
    video_file: UploadFile = File(...),
    models: Dict[str, Any] = Depends(get_uformer_model) # Dependency inject the model
):
    upload_dir = "backend/temp/uploads"
    output_dir = "backend/temp/processed"
    os.makedirs(upload_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    task_id = str(uuid.uuid4())
    sanitized_filename = os.path.basename(video_file.filename)
    input_path = os.path.join(upload_dir, f"{task_id}_{sanitized_filename}")
    
    # Ensure output file has a compatible container like .mp4
    output_filename, _ = os.path.splitext(sanitized_filename)
    output_path = os.path.join(output_dir, f"enhanced_{task_id}_{output_filename}.mp4")

    with open(input_path, "wb") as buffer:
        buffer.write(await video_file.read())

    tasks[task_id] = {"status": "pending", "filename": sanitized_filename, "result_path": None, "error": None}
    
    # Pass the loaded models to the background task
    background_tasks.add_task(video_processing_task, task_id, input_path, output_path, models)

    return JSONResponse(status_code=202, content={"task_id": task_id, "message": "Video upload successful, processing started."})


@router.get("/api/video_status/{task_id}")
async def get_video_status(task_id: str):
    task = tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return JSONResponse(content=task)


@router.get("/api/download_video")
async def download_video(filepath: str):
    """
    Serves the processed video file for download/streaming.
    Includes a security check to prevent directory traversal.
    """
    # Security Check: Ensure the requested path is within the allowed directory
    allowed_dir = os.path.abspath("backend/temp/processed")
    requested_path = os.path.abspath(filepath)

    if not requested_path.startswith(allowed_dir):
        raise HTTPException(status_code=403, detail="Access denied: File is outside the allowed directory.")
    
    if not os.path.exists(requested_path):
        raise HTTPException(status_code=404, detail="File not found.")

    return FileResponse(path=requested_path, media_type='video/mp4', filename=os.path.basename(requested_path))
