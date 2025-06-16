# noctura-uformer/backend/app/api/dependencies.py
import torch
import torch.nn as nn
import os
from typing import Dict, Any

# Import Uformer model and its necessary building blocks from the copied Uformer files
from uformer_model.model import Uformer, Downsample, Upsample

# --- DEFINE THE SHARED STATE DICTIONARY HERE ---
app_models: Dict[str, Any] = {} # This will hold the loaded Uformer model and device

def _load_single_model(model_definition: Uformer, model_path: str, model_key: str, debug_log_dir: str, device: torch.device) -> Uformer:
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
            for key in sorted(model_definition.state_dict().keys()):
                f.write(f"{key}\n")

            f.write(f"\n\n--- DEBUG: KEYS IN THE LOADED .PTH FILE FOR '{model_key}' ---\n")
            for key in sorted(new_state_dict.keys()):
                f.write(f"{key}\n")
        
        print(f"\n--- DEBUG: Wrote model keys for '{model_key}' to '{debug_output_path}'. ---")

    except Exception as e:
        print(f"--- DEBUG: FAILED TO WRITE DEBUG FILE FOR '{model_key}': {e} ---")
    # --- END OF DEBUGGING CODE ---

    model_definition.load_state_dict(new_state_dict, strict=True)
    model_definition.to(device)
    model_definition.eval()
    print(f"Successfully loaded model from {os.path.basename(model_path)} as '{model_key}'.")
    return model_definition


async def load_models(device: torch.device):
    """
    Loads all Uformer models and their pre-trained weights into the app_models dictionary.
    """
    base_path = os.path.join(os.path.dirname(__file__), '..', '..', 'model_weights', 'official_pretrained')
    debug_log_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'debug_logs'))

    # --- 1. Define Uformer-B (High Quality Denoise) ---
    uformer_b_denoise = Uformer(
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
    )

    # --- 2. Define Uformer-16 (Fast Denoise) ---
    uformer_16_denoise = Uformer(
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
    )

    # --- 3. Define Uformer-B (Deblur) ---
    uformer_b_deblur = Uformer(
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
    )
    
    # --- Load weights and store models ---
    app_models['denoise_b'] = _load_single_model(
        uformer_b_denoise,
        os.path.join(base_path, 'Uformer_B_SIDD.pth'),
        'denoise_b',
        debug_log_dir,
        device
    )
    app_models['denoise_16'] = _load_single_model(
        uformer_16_denoise,
        os.path.join(base_path, 'uformer16_denoising_sidd.pth'),
        'denoise_16',
        debug_log_dir,
        device
    )
    app_models['deblur_b'] = _load_single_model(
        uformer_b_deblur,
        os.path.join(base_path, 'Uformer_B_GoPro.pth'),
        'deblur_b', # New model key for debug file
        debug_log_dir,
        device
    )

def get_models() -> Dict[str, Any]:
    """
    Dependency function to get the dictionary of loaded models and device.
    Raises an HTTPException if models are not loaded.
    """
    if not app_models or not any(k for k in app_models if k != 'device'):
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Uformer models are not loaded or failed to initialize.")
    return app_models
