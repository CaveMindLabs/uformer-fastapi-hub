# noctura-uformer/backend/app/api/endpoints/cache_management.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List
import os
import shutil
import traceback
import torch

from app.api.dependencies import app_models, unload_all_models_from_memory # Import app_models and the new utility
from app.api.dependencies import model_definitions_dict # Import this here

class UnloadModelsRequest(BaseModel):
    model_names: List[str] = Field(default_factory=list)

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
    Clears content from the temporary image and/or video directories based on flags.
    """
    if not clear_images and not clear_videos:
        return JSONResponse(
            status_code=400,
            content={"message": "No action taken. Please select at least one cache to clear."}
        )
    try:
        if clear_images:
            clear_dir_content(TEMP_DIRS["images"])
        if clear_videos:
            clear_dir_content(TEMP_DIRS["videos"])
            
        cleared = []
        if clear_images: cleared.append("image")
        if clear_videos: cleared.append("video")
        
        return JSONResponse(
            status_code=200, 
            content={"message": f"Successfully cleared { ' and '.join(cleared) } cache."}
        )
    except Exception as e:
        print(f"Error clearing cache: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {e}")

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
        
        message = ""
        if unloaded_models:
            message += f"Successfully unloaded {len(unloaded_models)} model(s): {', '.join(unloaded_models)}. "
        if skipped_models:
            message += f"Could not unload {len(skipped_models)} model(s) as they are in use: {', '.join(skipped_models)}."
        if not message:
            # This handles cases where no models were selected, or selected models were not loaded.
            message = "No models were eligible for unloading."

        return JSONResponse(status_code=200, content={"message": message})

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
