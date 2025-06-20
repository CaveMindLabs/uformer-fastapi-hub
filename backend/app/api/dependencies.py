# backend/app/api/dependencies.py
from fastapi import Depends, HTTPException
import traceback
import torch
import torch.nn as nn
import os
from typing import Dict, Any

# Import Uformer model and its necessary building blocks from the copied Uformer files
from uformer_model.model import Uformer, Downsample, Upsample

# --- DEFINE THE SHARED STATE DICTIONARY HERE ---
# app_models will hold model instances or their definitions based on loading strategy.
# It also stores 'device' and 'load_all_on_startup' flag.
app_models: Dict[str, Any] = {}

# Dictionary to hold model definitions (callable functions to create a model instance)
# This prevents re-defining the model architecture every time in on-demand mode.
model_definitions_dict = {}

def unload_all_models_from_memory(models_dict: Dict[str, Any]):
    """Clears all loaded model instances from the shared dictionary and CUDA cache."""
    device = models_dict.get("device", torch.device("cpu"))
    print(f"Clearing all loaded models from memory on {device}...")
    # This is the key change: only delete keys that are defined as models.
    # This prevents the deletion of 'tasks_db' or other essential state keys.
    keys_to_delete = [k for k in models_dict.keys() if k in model_definitions_dict]
    for key in keys_to_delete:
        del models_dict[key]
    if device.type == 'cuda':
        torch.cuda.empty_cache()
        print("CUDA cache cleared.")
    print("All models unloaded.")

def _load_single_model_weights(model_instance: Uformer, model_path: str, model_key: str, debug_log_dir: str, device: torch.device) -> Uformer:
    """Helper function to load state dict for a given model instance and log its keys."""
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Uformer model weights not found at: {model_path}")

    checkpoint = torch.load(model_path, map_location=device)
    state_dict_to_load = checkpoint.get('state_dict', checkpoint)
    new_state_dict = {k[7:] if k.startswith('module.') else k: v for k, v in state_dict_to_load.items()}

    # --- DEBUGGING CODE ---
    # This will write the keys to a separate file for each model in the debug_log_dir.
    os.makedirs(debug_log_dir, exist_ok=True) # Ensure debug directory exists
    debug_output_path = os.path.join(debug_log_dir, f'debug_keys_{model_key}.txt')
    try:
        with open(debug_output_path, 'w') as f:
            f.write(f"--- DEBUG: KEYS IN OUR MODEL DEFINITION FOR '{model_key}' ---\n")
            for key in sorted(model_instance.state_dict().keys()):
                f.write(f"{key}\n")

            f.write(f"\n\n--- DEBUG: KEYS IN THE LOADED .PTH FILE FOR '{model_key}' ---\n")
            for key in sorted(new_state_dict.keys()):
                f.write(f"{key}\n")
        
        print(f"\n--- DEBUG: Wrote model keys for '{model_key}' to '{debug_output_path}'. ---")

    except Exception as e:
        print(f"--- DEBUG: FAILED TO WRITE DEBUG FILE FOR '{model_key}': {e} ---")
    # --- END OF DEBUGGING CODE ---

    model_instance.load_state_dict(new_state_dict, strict=True)
    model_instance.to(device)
    model_instance.eval()
    print(f"Successfully loaded model from {os.path.basename(model_path)} as '{model_key}'.")
    return model_instance


async def load_models(device: torch.device, app_models: Dict[str, Any], load_all: bool = False, load_definitions_only: bool = False):
    """
    Conditionally loads Uformer models:
    - If load_all=True, loads all models with weights into app_models.
    - If load_definitions_only=True, only stores model constructors in model_definitions_dict.
    - If neither, implies on-demand loading where get_models will handle it.
    """
    base_path = os.path.join(os.path.dirname(__file__), '..', '..', 'model_weights', 'official_pretrained')
    debug_log_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'debug_logs'))

    # Helper to define a model and its path
    def _define_model(key: str, model_instance: Uformer, pth_filename: str):
        model_definitions_dict[key] = {
            'instance': model_instance,
            'path': os.path.join(base_path, pth_filename)
        }

    # Define all models (architectures and their paths)
    # --- 1. Define Uformer-B (High Quality Denoise) ---
    _define_model('denoise_b', Uformer(
        img_size=256,
        in_chans=3,
        dd_in=3,
        embed_dim=32,                              # Uformer-B uses embed_dim 32
        depths=[1, 2, 8, 8, 2, 8, 8, 2, 1],        # Official depths for Uformer-B
        num_heads=[1, 2, 4, 8, 16, 16, 8, 4, 2],    # Official heads for Uformer-B
        win_size=8,
        mlp_ratio=4.,
        qkv_bias=True,
        qk_scale=None,
        drop_rate=0.,
        attn_drop_rate=0.,
        drop_path_rate=0.1,
        norm_layer=nn.LayerNorm,
        patch_norm=True,
        use_checkpoint=False,
        token_projection='linear',
        token_mlp='leff',
        dowsample=Downsample,
        upsample=Upsample,
        shift_flag=True,
        modulator=True,                           # Uformer-B SIDD model USES the modulator
        cross_modulator=False
    ), 'Uformer_B_SIDD.pth')

    # --- 2. Define Uformer-16 (Fast Denoise) ---
    _define_model('denoise_16', Uformer(
        img_size=256,
        in_chans=3,
        dd_in=3,
        embed_dim=16, # The correct embed_dim for Uformer16
        depths=[2, 2, 2, 2, 2, 2, 2, 2, 2], # Depths for Uformer-B / Uformer16
        num_heads=[1, 2, 4, 8, 16, 16, 8, 4, 2], # Adjusted for embed_dim=16
        win_size=8,
        mlp_ratio=4.,
        qkv_bias=True,
        qk_scale=None,
        drop_rate=0.,
        attn_drop_rate=0.,
        drop_path_rate=0.1,
        norm_layer=nn.LayerNorm,
        patch_norm=True,
        use_checkpoint=False,
        token_projection='linear',
        token_mlp='leff',
        dowsample=Downsample,
        upsample=Upsample,
        shift_flag=True,
        modulator=False, # Adjusted for embed_dim=16
        cross_modulator=False
    ), 'uformer16_denoising_sidd.pth')

    # --- 3. Define Uformer-B (Deblur) ---
    _define_model('deblur_b', Uformer(
        img_size=256,
        in_chans=3, dd_in=3,
        embed_dim=32,                              # Uformer-B uses embed_dim 32
        depths=[1, 2, 8, 8, 2, 8, 8, 2, 1],        # Official depths for Uformer-B
        num_heads=[1, 2, 4, 8, 16, 16, 8, 4, 2],    # Official heads for Uformer-B
        win_size=8,
        mlp_ratio=4.,
        qkv_bias=True,
        qk_scale=None,
        drop_rate=0.,
        attn_drop_rate=0.,
        drop_path_rate=0.1,
        norm_layer=nn.LayerNorm,
        patch_norm=True,
        use_checkpoint=False,
        token_projection='linear',
        token_mlp='leff',
        dowsample=Downsample,
        upsample=Upsample,
        shift_flag=True,
        modulator=True,
        cross_modulator=False
    ), 'Uformer_B_GoPro.pth')

    if load_all:
        for key, value in model_definitions_dict.items():
            try:
                # Instantiate model and load weights
                loaded_model = _load_single_model_weights(
                    value['instance'],
                    value['path'],
                    key,
                    debug_log_dir,
                    device
                )
                app_models[key] = loaded_model
            except Exception as e:
                print(f"Error loading model '{key}' at startup: {e}")

    elif load_definitions_only:
        # No actual model loading here, just definitions are set up in model_definitions_dict
        print(f"--- [DIAGNOSTIC] Model definitions populated. Keys: {list(model_definitions_dict.keys())} ---")
        pass
    else:
        # This branch won't be hit by lifespan, but is for clarity if load_models were called differently
        raise ValueError("Invalid loading mode specified for load_models.")

def get_models() -> Dict[str, Any]:
    """
    Dependency function to get the dictionary of loaded models and device.
    Handles on-demand loading of model weights if LOAD_ALL_MODELS_ON_STARTUP is False.
    Raises an HTTPException if models are not available or fail to load.
    """
    
    device = app_models.get("device")
    load_all_on_startup = app_models.get("load_all_on_startup", True) # Default to True for safety

    if not device:
        raise HTTPException(status_code=503, detail="Device not initialized.")

    if load_all_on_startup:
        # If all models were loaded on startup, just ensure they are present.
        # This check primarily ensures initial loading didn't fail catastrophically.
        if not any(k for k in app_models.keys() if k not in ['device', 'load_all_on_startup']):
            raise HTTPException(status_code=503, detail="Uformer models failed to load at startup.")
    else:
        # On-demand loading: Check for requested model and load if not in app_models
        # We assume the endpoint handler will specify which model it needs,
        # but for this generic dependency, we'll iterate through available definitions.
        # This part of get_models won't load anything unless the calling function
        # (e.g., inside image_file_processing.py) explicitly requests it by name.
        # The main purpose here is to ensure the framework is ready.
        if not model_definitions_dict: # If definitions themselves aren't loaded (e.g. fatal error at startup)
             raise HTTPException(status_code=503, detail="Model definitions not available. Server startup failed.")

    return app_models

# This is a specific dependency for getting a MODEL by its key
def get_model_by_name(model_name: str, models: Dict[str, Any] = Depends(get_models)) -> torch.nn.Module:
    """
    Dependency to retrieve a specific Uformer model, loading it if not already in VRAM.
    """
    device = models["device"]
    load_all_on_startup = models["load_all_on_startup"]
    debug_log_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'debug_logs'))

    # model_name can come from path, query, or form. FastAPI handles this.
    
    # We get the model directly from the models dict if it's already there
    uformer_model = models.get(model_name)
    if uformer_model is not None:
        return uformer_model
    
    # If the model is not in the models dict
    if load_all_on_startup:
        # This should ideally not happen if load_all_on_startup was True, as all should be loaded.
        # Indicates a potential issue with initial loading or a bad model_name.
        raise HTTPException(status_code=400, detail=f"Model '{model_name}' not found, but server configured to load all on startup.")
    
    # On-demand loading for this specific model
    if model_name not in model_definitions_dict:
        raise HTTPException(status_code=400, detail=f"Model definition for '{model_name}' not found. Invalid model_name.")
    
    print(f"Loading model '{model_name}' on demand...")
    model_info = model_definitions_dict[model_name]
    try:
        # We need to create a new instance to avoid modifying the one in model_definitions_dict
        model_instance_to_load = model_info['instance']
        
        loaded_instance = _load_single_model_weights(
            model_instance_to_load,
            model_info['path'],
            model_name,
            debug_log_dir,
            device
        )
        models[model_name] = loaded_instance # Cache the loaded model
        print(f"Model '{model_name}' loaded successfully on demand.")
        return loaded_instance
    except Exception as e:
        print(f"ERROR: Failed to load model '{model_name}' on demand: {e}")
        traceback.print_exc() # Print full traceback for debugging
        raise HTTPException(status_code=500, detail=f"Failed to load model '{model_name}': {e}")
