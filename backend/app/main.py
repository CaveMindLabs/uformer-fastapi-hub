# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import torch
from dotenv import load_dotenv
import asyncio

# Import the endpoint router to call its function directly
from app.api.endpoints import cache_management

# Import the model loading dependency AND the app_models dictionary
from app.api.dependencies import load_models, app_models, unload_all_models_from_memory 
from app.api.endpoints import image_file_processing, video_file_processing, live_stream_processing, cache_management

# Load environment variables from .env file
load_dotenv()


# Using asynccontextmanager to manage application startup/shutdown events
async def periodic_cache_cleanup_task():
    """A periodic task to automatically clean up unprotected cache files."""
    interval_minutes = float(os.getenv("AUTOMATIC_CLEANUP_INTERVAL_MINUTES", 30))
    print(f"[AUTO_CLEANUP] Task started. Will run every {interval_minutes} minutes.")
    
    while True:
        await asyncio.sleep(interval_minutes * 60)
        print("[AUTO_CLEANUP] Running scheduled cache cleanup...")
        try:
            # We can reuse the same logic from the manual endpoint.
            # We don't need the response here, just the action.
            await cache_management.clear_cache(clear_images=True, clear_videos=True)
            print("[AUTO_CLEANUP] Scheduled cleanup finished.")
        except Exception as e:
            print(f"[AUTO_CLEANUP] Error during scheduled cleanup: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application startup and shutdown events.
    - On startup, determines the model loading strategy (pre-load all or on-demand)
      based on the LOAD_ALL_MODELS_ON_STARTUP environment variable.
    - On shutdown, ensures all models are cleared from memory.
    """
    print("FastAPI application startup...")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    app_models["device"] = device # Store device in shared state
    app_models["tasks_db"] = {} # Initialize shared dictionary for background task status
    app_models["models_in_use"] = {} # Initialize reference counter for models in use
    app_models["tracker_by_path"] = {} # Main tracker for result file metadata
    app_models["path_by_task_id"] = {} # Secondary index for task_id -> path lookups
    app_models["in_progress_uploads"] = {} # Tracks raw uploads being used by active tasks

    # Determine model loading strategy from environment variable
    load_all_on_startup = os.getenv("LOAD_ALL_MODELS_ON_STARTUP", "True").lower() == "true"
    app_models["load_all_on_startup"] = load_all_on_startup # Store for get_models dependency

    if load_all_on_startup:
        try:
            # Pass app_models directly for initial loading
            await load_models(device, app_models=app_models, load_all=True)
            print(f"All models loaded successfully. Available: {list(k for k in app_models.keys() if k not in ['device', 'load_all_on_startup', 'tasks_db'])}")
        except Exception as e:
            print(f"FATAL ERROR: Failed to load one or more Uformer models on startup: {e}")
            # Clear any partially loaded models to indicate a failed state
            for key in list(app_models.keys()):
                if key not in ['device', 'load_all_on_startup', 'tasks_db']:
                    del app_models[key]
    else:
        print("Models will be loaded on demand. Initial VRAM usage low.")
        # Pre-populate model definitions so they are ready for on-demand loading
        # This will save a bit of overhead compared to defining them every time.
        await load_models(device, app_models=app_models, load_definitions_only=True)
        print(f"Model definitions loaded successfully. Ready for on-demand loading: {list(k for k in app_models.keys() if k not in ['device', 'load_all_on_startup', 'tasks_db', 'models_in_use', 'tracker_by_path', 'path_by_task_id'])}")

    # --- Schedule the automatic cleanup task if enabled ---
    if os.getenv("ENABLE_AUTOMATIC_CACHE_CLEANUP", "False").lower() == "true":
        cleanup_task = asyncio.create_task(periodic_cache_cleanup_task())
    else:
        cleanup_task = None
        print("[AUTO_CLEANUP] Automatic cache cleanup is disabled.")

    yield # Application is running

    # --- Cancel the cleanup task on shutdown ---
    if cleanup_task:
        cleanup_task.cancel()
        print("[AUTO_CLEANUP] Automatic cache cleanup task stopped.")

    print("FastAPI application shutdown...")
    if app_models:
        # On shutdown, ensure all models are cleared from memory
        unload_all_models_from_memory(app_models)
    print("FastAPI application shutdown complete.")


app = FastAPI(
    title="NocturaVision Uformer API",
    description="Backend API for real-time low-light image enhancement using Uformer.",
    version="0.1.0",
    lifespan=lifespan # Attach the lifespan context manager
)

# CORS Middleware for allowing cross-origin requests
origins = ["*"] # Allow requests from any origin for development

# --- Mount Static Directory for Results ---
# This makes the 'temp' directory available under '/static_results'
# so the frontend can fetch processed images/videos.
os.makedirs("temp", exist_ok=True)
app.mount("/static_results", StaticFiles(directory="temp"), name="static_results")


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ALL ROUTERS MUST BE INCLUDED ---
app.include_router(live_stream_processing.router, tags=["live_stream_processing"])
app.include_router(video_file_processing.router, tags=["video_file_processing"])
app.include_router(image_file_processing.router, tags=["image_file_processing"])
app.include_router(cache_management.router, tags=["cache_management"])


@app.get("/health", tags=["healthcheck"])
async def health_check():
    """Simple health check endpoint."""
    loaded_models = [k for k in app_models.keys() if k != 'device']
    if loaded_models:
        return {"status": "ok", "models_loaded": True, "models_available": loaded_models, "device": str(app_models.get("device"))}
    else:
        return {"status": "error", "models_loaded": False, "detail": "Uformer models failed to load.", "device": str(app_models.get("device", "N/A"))}

@app.get("/")
async def read_root():
    return {"message": "Welcome to NocturaVision Uformer API! Visit /docs for API documentation."}

# To run this application:
# 1. Navigate to the 'backend/' directory in your terminal (inside pipenv shell)
# 2. Run: pipenv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
#    The '--reload' flag is great for development.
