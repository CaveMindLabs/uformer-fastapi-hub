# noctura-uformer/backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import torch

# Import the model loading dependency AND the app_models dictionary
from app.api.dependencies import load_uformer_model, app_models
from app.api.endpoints import file_processing, image_processing, video_processing


# Using asynccontextmanager to manage application startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI application startup and shutdown events.
    Loads the Uformer model into memory on startup.
    """
    print("FastAPI application startup...")
    
    # Determine device: CUDA if available, else CPU
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # Load the Uformer model
    model_path = os.path.join(os.path.dirname(__file__), '../model_weights/official_pretrained/Uformer_B_SIDD.pth')
    
    try:
        uformer_model = await load_uformer_model(model_path, device)
        app_models["uformer_model"] = uformer_model
        app_models["device"] = device
        print("Uformer model loaded successfully.")
    except Exception as e:
        print(f"ERROR: Failed to load Uformer model: {e}")
        app_models["uformer_model"] = None # Indicate failure
        app_models["device"] = device # Still set device even if model fails

    yield # Application is running

    print("FastAPI application shutdown...")
    # Any cleanup code (e.g., releasing GPU memory if explicit handles were used) can go here
    if "uformer_model" in app_models and app_models["uformer_model"] is not None:
        del app_models["uformer_model"] # Explicitly release model
        if device.type == 'cuda':
            torch.cuda.empty_cache() # Clear CUDA cache
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
app.include_router(video_processing.router, tags=["video_streaming"])
app.include_router(file_processing.router, tags=["file_processing"])
app.include_router(image_processing.router, tags=["image_processing"]) 

@app.get("/health", tags=["healthcheck"])
async def health_check():
    """Simple health check endpoint."""
    if "uformer_model" in app_models and app_models["uformer_model"] is not None:
        return {"status": "ok", "model_loaded": True, "device": str(app_models["device"])}
    else:
        return {"status": "error", "model_loaded": False, "detail": "Uformer model failed to load.", "device": str(app_models.get("device", "N/A"))}

@app.get("/")
async def read_root():
    return {"message": "Welcome to NocturaVision Uformer API! Visit /docs for API documentation."}

# To run this application:
# 1. Navigate to the 'backend/' directory in your terminal (inside pipenv shell)
# 2. Run: pipenv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
#    The '--reload' flag is great for development.
