# noctura-uformer/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import torch

# Import the model loading dependency AND the app_models dictionary
from app.api.dependencies import load_models, app_models
from app.api.endpoints import image_file_processing, video_file_processing, live_stream_processing, cache_management


# Using asynccontextmanager to manage application startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI application startup and shutdown events.
    Loads all Uformer models into memory on startup.
    """
    print("FastAPI application startup...")
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    app_models["device"] = device # Store device in shared state

    try:
        await load_models(device)
        print(f"All models loaded successfully. Available: {list(k for k in app_models.keys() if k != 'device')}")
    except Exception as e:
        print(f"FATAL ERROR: Failed to load one or more Uformer models: {e}")
        # Clear any partially loaded models to indicate a failed state
        for key in list(app_models.keys()):
            if key != 'device':
                del app_models[key]

    yield # Application is running

    print("FastAPI application shutdown...")
    if app_models:
        app_models.clear()
        if device.type == 'cuda':
            torch.cuda.empty_cache()
            print("CUDA cache cleared.")
    print("FastAPI application shutdown complete.")


app = FastAPI(
    title="NocturaVision Uformer API",
    description="Backend API for real-time low-light image enhancement using Uformer.",
    version="0.1.0",
    lifespan=lifespan # Attach the lifespan context manager
)

# CORS Middleware for allowing cross-origin requests
origins = ["*"] # Allow requests from any origin for development

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
