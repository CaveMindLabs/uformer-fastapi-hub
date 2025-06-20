# backend/app/api/endpoints/cache_management.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List
import os
import shutil
import traceback
import torch
import time
from dotenv import load_dotenv

# Load environment variables to get grace periods
load_dotenv()

from app.api.dependencies import app_models, unload_all_models_from_memory # Import app_models and the new utility
from app.api.dependencies import model_definitions_dict # Import this here

class UnloadModelsRequest(BaseModel):
    model_names: List[str] = Field(default_factory=list)

class ConfirmDownloadRequest(BaseModel):
    result_path: str

class TaskHeartbeatRequest(BaseModel):
    task_id: str

router = APIRouter()

TEMP_DIRS = {
    "images": os.path.abspath(os.path.join("temp", "images")),
    "videos": os.path.abspath(os.path.join("temp", "videos"))
}

def get_dir_size(path):
    """Recursively calculates the size of a directory in bytes."""
    total_size = 0
    if not os.path.exists(path):
        return 0
    for dirpath, _, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            # skip if it is symbolic link
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
    return total_size

def clear_dir_content(path):
    """Deletes all files and subdirectories within a given path."""
    if not os.path.exists(path):
        os.makedirs(path) # Ensure dir exists even if we do nothing
        return
        
    for item in os.listdir(path):
        item_path = os.path.join(path, item)
        try:
            if os.path.isfile(item_path) or os.path.islink(item_path):
                os.unlink(item_path)
            elif os.path.isdir(item_path):
                shutil.rmtree(item_path)
        except Exception as e:
            print(f"Failed to delete {item_path}. Reason: {e}")
            # Raise an exception to be caught by the endpoint
            raise e

@router.get("/api/cache_status", tags=["cache_management"])
async def get_cache_status():
    """Calculates and returns the size of the temporary image and video caches."""
    try:
        image_cache_size_bytes = get_dir_size(TEMP_DIRS["images"])
        video_cache_size_bytes = get_dir_size(TEMP_DIRS["videos"])
        
        return {
            "image_cache_mb": round(image_cache_size_bytes / (1024 * 1024), 2),
            "video_cache_mb": round(video_cache_size_bytes / (1024 * 1024), 2)
        }
    except Exception as e:
        print(f"Error getting cache status: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to calculate cache size.")


@router.post("/api/clear_cache", tags=["cache_management"])
async def clear_cache(clear_images: bool = True, clear_videos: bool = True):
    """
    Clears content from temp directories, respecting files that are protected
    (awaiting download, within their download grace period, or currently being processed).
    """
    if not clear_images and not clear_videos:
        return JSONResponse(status_code=400, content={"message": "No action taken."})

    tracker_by_path = app_models.get("tracker_by_path", {})
    path_by_task_id = app_models.get("path_by_task_id", {})
    in_progress_uploads = app_models.get("in_progress_uploads", {})
    
    # NEW: Separate counters for detailed feedback
    cleared_count = 0
    skipped_in_progress_count = 0
    skipped_awaiting_download_count = 0

    # Load grace periods from environment variables with sane defaults
    try:
        image_grace_period = float(os.getenv("IMAGE_DOWNLOAD_GRACE_PERIOD_MINUTES", 60)) * 60
        video_grace_period = float(os.getenv("VIDEO_DOWNLOAD_GRACE_PERIOD_MINUTES", 180)) * 60
        heartbeat_timeout = float(os.getenv("HEARTBEAT_TIMEOUT_MINUTES", 10)) * 60
    except ValueError:
        raise HTTPException(status_code=500, detail="Invalid timer value in .env file.")

    def get_protection_status(abs_path: str, rel_path: str) -> str:
        """
        Determines if a file is unprotected or identifies the reason for protection.
        Returns: "UNPROTECTED", "PROTECTED_IN_PROGRESS", "PROTECTED_AWAITING_DOWNLOAD"
        """
        # First, check if it's an in-progress upload using its absolute path.
        if abs_path in in_progress_uploads:
            return "PROTECTED_IN_PROGRESS" # PROTECTED

        file_info = tracker_by_path.get(rel_path)
        if not file_info:
            # If it's not an active upload and not a tracked result, it's unprotected.
            return "UNPROTECTED"
        
        current_time = time.time()
        
        # Condition A: Downloaded and expired
        if file_info["status"] == "downloaded" and file_info["downloaded_at"] is not None:
            file_type = file_info.get("file_type", "image") # Default to image for safety
            grace_period = video_grace_period if file_type == "video" else image_grace_period
            if (current_time - file_info["downloaded_at"]) > grace_period:
                return "UNPROTECTED"

        # Condition B: Active but abandoned (heartbeat timed out)
        if file_info["status"] == "active":
            if (current_time - file_info["last_heartbeat_at"]) > heartbeat_timeout:
                return "UNPROTECTED"
        
        # If none of the above, the file is protected awaiting download
        return "PROTECTED_AWAITING_DOWNLOAD"

    def safe_clear_dir(path_to_clear):
        nonlocal cleared_count, skipped_in_progress_count, skipped_awaiting_download_count
        if not os.path.exists(path_to_clear): return

        # Walk the directory from the bottom up to allow subdirectory removal
        for dirpath, dirnames, filenames in os.walk(path_to_clear, topdown=False):
            # First, process files
            for f in filenames:
                file_path_abs = os.path.join(dirpath, f)
                file_path_rel = f"/static_results/{os.path.relpath(file_path_abs, 'temp').replace(os.path.sep, '/')}"
                
                protection_status = get_protection_status(file_path_abs, file_path_rel)
                
                if protection_status == "UNPROTECTED":
                    try:
                        os.unlink(file_path_abs)
                        cleared_count += 1
                        if file_path_rel in tracker_by_path:
                            task_id_to_del = tracker_by_path[file_path_rel].get("task_id")
                            del tracker_by_path[file_path_rel]
                            if task_id_to_del and task_id_to_del in path_by_task_id:
                                del path_by_task_id[task_id_to_del]
                    except Exception as e:
                        print(f"Failed to delete file {file_path_abs}. Reason: {e}")
                elif protection_status == "PROTECTED_IN_PROGRESS":
                    skipped_in_progress_count += 1
                elif protection_status == "PROTECTED_AWAITING_DOWNLOAD":
                    skipped_awaiting_download_count += 1
            
            # Then, try to remove now-empty subdirectories
            for d in dirnames:
                try:
                    os.rmdir(os.path.join(dirpath, d))
                except OSError:
                    pass # Dir not empty, which is fine

    try:
        if clear_images:
            safe_clear_dir(TEMP_DIRS["images"])
        if clear_videos:
            safe_clear_dir(TEMP_DIRS["videos"])
        
        return JSONResponse(status_code=200, content={
            "cleared_count": cleared_count,
            "skipped_in_progress_count": skipped_in_progress_count,
            "skipped_awaiting_download_count": skipped_awaiting_download_count
        })
    except Exception as e:
        print(f"Error clearing cache: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {e}")

@router.post("/api/confirm_download", tags=["cache_management"])
async def confirm_download(request: ConfirmDownloadRequest):
    """
    Confirms that a download for a result file has been initiated.
    This updates the file's status to 'downloaded' and sets the download timestamp.
    """
    result_path = request.result_path
    tracker_by_path = app_models.get("tracker_by_path", {})
    
    if result_path in tracker_by_path:
        file_info = tracker_by_path[result_path]
        if file_info["status"] == "active":
            file_info["status"] = "downloaded"
            file_info["downloaded_at"] = time.time()
            print(f"[CACHE_TRACKER] Confirmed download for '{result_path}'. Status set to 'downloaded'.")
            return JSONResponse(status_code=200, content={"message": "Download confirmed."})
        elif file_info["status"] == "downloaded":
            return JSONResponse(status_code=200, content={"message": "Download was already confirmed."})

    print(f"[CACHE_TRACKER] WARNING: Received download confirmation for untracked path '{result_path}'.")
    return JSONResponse(status_code=404, content={"message": "Result path not found in tracker."})

@router.post("/api/task_heartbeat", tags=["cache_management"])
async def task_heartbeat(request: TaskHeartbeatRequest):
    """
    Receives a heartbeat from a client actively viewing a task result.
    This updates the 'last_heartbeat_at' timestamp for the result file,
    preventing it from being prematurely cleaned up as an 'orphaned' file.
    """
    path_by_task_id = app_models.get("path_by_task_id", {})
    tracker_by_path = app_models.get("tracker_by_path", {})
    
    result_path = path_by_task_id.get(request.task_id)
    
    if result_path and result_path in tracker_by_path:
        tracker_by_path[result_path]["last_heartbeat_at"] = time.time()
        # print(f"[HEARTBEAT] Received for task {request.task_id}. Updated timestamp for {result_path}.")
        return {"status": "heartbeat_received"}
    
    # It's okay if the path is not found; the client might have downloaded/cleared it.
    # We don't need to return an error, just acknowledge the request.
    return {"status": "task_not_found_ok"}


@router.post("/api/unload_models", tags=["cache_management"])
async def unload_models_endpoint(request: UnloadModelsRequest):
    """
    Unloads specified Uformer models from VRAM. If the 'model_names' list is empty,
    all currently loaded models will be unloaded.
    This operation will not unload models that are currently in use by background tasks.
    """
    models_in_use = app_models.get("models_in_use", {})
    try:
        model_names_to_unload = request.model_names
        device = app_models.get("device", torch.device("cpu"))
        unloaded_models = []
        skipped_models = []

        if not model_names_to_unload:
            # "Clear All" logic: target all known, loaded models
            print("Received request to unload all models.")
            # Create a list of all currently loaded models that are defined in our system
            target_models = [name for name in model_definitions_dict.keys() if name in app_models]
        else:
            # "Clear Selected" logic
            print(f"Attempting to unload specific models: {model_names_to_unload}")
            target_models = model_names_to_unload

        for model_name in target_models:
            # Check if the model is currently in use.
            if models_in_use.get(model_name, 0) > 0:
                print(f"Skipping unload for '{model_name}': model is in use (count: {models_in_use.get(model_name, 0)}).")
                skipped_models.append(model_name)
                continue
            
            # Check if the model is actually loaded and is a defined model.
            if model_name in app_models and model_name in model_definitions_dict:
                del app_models[model_name]
                unloaded_models.append(model_name)
                print(f"Model '{model_name}' unloaded.")

        if unloaded_models and device.type == 'cuda':
            torch.cuda.empty_cache()
            print("CUDA cache cleared.")
        
        # Instead of a pre-formatted string, return structured data.
        return JSONResponse(status_code=200, content={
            "unloaded_models": unloaded_models,
            "skipped_models": skipped_models
        })

    except Exception as e:
        print(f"Error unloading models: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to unload models: {e}")

@router.get("/api/loaded_models_status", tags=["cache_management"])
async def get_loaded_models_status():
    """
    Returns a list of all known model definitions and their current loaded status in VRAM.
    """
    status_list = []
    # model_definitions_dict contains all *possible* models with their initial instance and path
    for model_name, model_info in model_definitions_dict.items():
        # Check if the model instance is actually in app_models (meaning it's loaded)
        is_loaded = model_name in app_models and model_name not in ['device', 'load_all_on_startup']
        status_list.append({
            "name": model_name,
            "loaded": is_loaded
        })
    # Sort for consistent display in frontend
    status_list.sort(key=lambda x: x['name'])
    return JSONResponse(status_code=200, content={"models": status_list})

@router.get("/api/model_loading_strategy", tags=["cache_management"])
async def get_model_loading_strategy():
    """
    Returns whether models are loaded on startup or on demand.
    Frontend uses this to determine if 'Clear All Models' button should be shown.
    """
    load_all_on_startup = app_models.get("load_all_on_startup", True) # Default to True for safety
    return JSONResponse(status_code=200, content={"load_all_on_startup": load_all_on_startup})
