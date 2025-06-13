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
    print(f"[VIDEO_PROCESSOR] Task {task_id}: Starting REAL processing for {input_path}")

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
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        print(f"[VIDEO_PROCESSOR] Task {task_id}: Video properties: {frame_width}x{frame_height} @ {fps:.2f} FPS, {total_frames} frames.")
        
        # 2. Setup video writer for processed frames (no audio yet)
        temp_video_path = output_path.replace(".mp4", ".tmp.mp4") # Ensure temp file has .mp4 extension
        fourcc = cv2.VideoWriter_fourcc(*'mp4v') # Use MP4V codec for broader compatibility
        writer = cv2.VideoWriter(temp_video_path, fourcc, fps, (frame_width, frame_height))
        
        if not writer.isOpened():
            raise IOError(f"Could not open video writer for {temp_video_path}")

        # 3. Process each frame
        frame_count = 0
        while cap.isOpened():
            ret, frame_bgr = cap.read()
            if not ret:
                break # End of video or error

            # Pre-process frame: BGR -> RGB, resize to 256x256, normalize
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            frame_resized = cv2.resize(frame_rgb, (256, 256), interpolation=cv2.INTER_LANCZOS4)
            
            input_tensor = torch.from_numpy(frame_resized.astype(np.float32) / 255.0).permute(2, 0, 1).unsqueeze(0).to(device)
            
            # Run Uformer model
            with torch.no_grad():
                enhanced_tensor = uformer_model(input_tensor)
            
            # Post-process frame: denormalize, permute to HWC, clamp, convert to uint8
            enhanced_np = (enhanced_tensor.squeeze(0).permute(1, 2, 0).clamp(0.0, 1.0).cpu().numpy() * 255.0).astype(np.uint8)
            
            # Upscale back to original resolution and convert back to BGR for VideoWriter
            enhanced_upscaled = cv2.resize(enhanced_np, (frame_width, frame_height), interpolation=cv2.INTER_LANCZOS4)
            final_frame_bgr = cv2.cvtColor(enhanced_upscaled, cv2.COLOR_RGB2BGR)

            writer.write(final_frame_bgr)
            frame_count += 1
            if frame_count % 30 == 0 or frame_count == total_frames: # Print progress
                print(f"[VIDEO_PROCESSOR] Task {task_id}: Processed {frame_count}/{total_frames} frames.")

        cap.release()
        writer.release()
        print(f"[VIDEO_PROCESSOR] Task {task_id}: Finished processing {frame_count} frames. Intermediate video saved to {temp_video_path}")

        # 4. Re-attach audio from original video using ffmpeg
        print(f"[VIDEO_PROCESSOR] Task {task_id}: Attaching audio with FFmpeg...")
        
        try:
            probe = ffmpeg.probe(input_path)
            audio_streams = [s for s in probe['streams'] if s['codec_type'] == 'audio']
        except ffmpeg.Error as e:
            print(f"[VIDEO_PROCESSOR] Task {task_id}: FFmpeg probe error: {e.stderr.decode()}")
            audio_streams = []

        if audio_streams:
            try:
                input_video_stream = ffmpeg.input(temp_video_path)
                input_audio_stream = ffmpeg.input(input_path)
                
                # *** THIS IS THE CORRECTED LINE ***
                # Using 'libx264' for better browser compatibility.
                ffmpeg.output(input_video_stream.video, input_audio_stream.audio, output_path, vcodec='libx264', acodec='aac', y='-y').run(quiet=True)
                print(f"[VIDEO_PROCESSOR] Task {task_id}: Audio attached. Final output at {output_path}")

            except ffmpeg.Error as e:
                print(f"[VIDEO_PROCESSOR] Task {task_id}: FFmpeg audio merge error: {e.stderr.decode()}")
                os.rename(temp_video_path, output_path)
                print(f"[VIDEO_PROCESSOR] Task {task_id}: FFmpeg audio merge failed, saving video only. Output at {output_path}")
        else:
            print(f"[VIDEO_PROCESSOR] Task {task_id}: No audio found in original video. Saving video only.")
            os.rename(temp_video_path, output_path)

        # 5. Clean up temporary file
        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)
            print(f"[VIDEO_PROCESSOR] Task {task_id}: Cleaned up temporary video file.")
        
        tasks[task_id]['status'] = 'completed'
        tasks[task_id]['result_path'] = output_path

    except Exception as e:
        print(f"[VIDEO_PROCESSOR] Task {task_id}: ERROR during processing - {e}")
        tasks[task_id]['status'] = 'failed'
        tasks[task_id]['error'] = str(e)
        temp_video_path = output_path.replace(".mp4", ".tmp.mp4")
        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)
            print(f"[VIDEO_PROCESSOR] Task {task_id}: Cleaned up failed temporary video file.")


router = APIRouter()

@router.post("/api/process_video")
async def process_video(
    background_tasks: BackgroundTasks,
    video_file: UploadFile = File(...),
    models: Dict[str, Any] = Depends(get_uformer_model)
):
    video_upload_dir = os.path.join("temp", "videos", "uploads")
    video_output_dir = os.path.join("temp", "videos", "processed")
    os.makedirs(video_upload_dir, exist_ok=True)
    os.makedirs(video_output_dir, exist_ok=True)

    task_id = str(uuid.uuid4())
    sanitized_filename = os.path.basename(video_file.filename)
    input_path = os.path.join(video_upload_dir, f"{task_id}_{sanitized_filename}")
    
    output_filename_base, _ = os.path.splitext(sanitized_filename)
    output_path = os.path.join(video_output_dir, f"enhanced_{task_id}_{output_filename_base}.mp4")

    print(f"[VIDEO_PROCESSOR] Received video: {sanitized_filename}, saving to {input_path}")
    with open(input_path, "wb") as buffer:
        buffer.write(await video_file.read())
    print(f"[VIDEO_PROCESSOR] Video saved: {input_path}")

    tasks[task_id] = {"status": "pending", "filename": sanitized_filename, "result_path": None, "error": None}
    
    background_tasks.add_task(video_processing_task, task_id, input_path, output_path, models)
    print(f"[VIDEO_PROCESSOR] Task {task_id} added to background tasks.")

    return JSONResponse(status_code=202, content={"task_id": task_id, "message": "Video upload successful, processing started."})


@router.get("/api/video_status/{task_id}")
async def get_video_status(task_id: str):
    task = tasks.get(task_id)
    if not task:
        print(f"[VIDEO_PROCESSOR] Status request for unknown task_id: {task_id}")
        raise HTTPException(status_code=404, detail="Task not found")
    print(f"[VIDEO_PROCESSOR] Status for task {task_id}: {task['status']}")
    return JSONResponse(content=task)


@router.get("/api/download_video")
async def download_video(filepath: str):
    """
    Serves the processed video file for download/streaming.
    Includes a security check to prevent directory traversal.
    """
    allowed_dir = os.path.abspath(os.path.join("temp", "videos", "processed"))
    requested_path = os.path.abspath(filepath)

    print(f"[VIDEO_PROCESSOR] Download requested for: {filepath}")
    print(f"[VIDEO_PROCESSOR] Resolved requested path: {requested_path}")
    print(f"[VIDEO_PROCESSOR] Allowed directory: {allowed_dir}")

    if not requested_path.startswith(allowed_dir):
        print(f"[VIDEO_PROCESSOR] SECURITY ALERT: Attempted download outside allowed directory: {requested_path}")
        raise HTTPException(status_code=403, detail="Access denied: File is outside the allowed directory.")
    
    if not os.path.exists(requested_path):
        print(f"[VIDEO_PROCESSOR] File not found for download: {requested_path}")
        raise HTTPException(status_code=404, detail="File not found.")

    return FileResponse(path=requested_path, media_type='video/mp4', filename=os.path.basename(requested_path))
