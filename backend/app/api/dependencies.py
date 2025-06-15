# noctura-uformer/backend/app/api/dependencies.py
import torch
import torch.nn as nn
import os
from typing import Dict, Any

# Import Uformer model and its necessary building blocks from the copied Uformer files
from uformer_model.model import Uformer, Downsample, Upsample

# --- DEFINE THE SHARED STATE DICTIONARY HERE ---
app_models: Dict[str, Any] = {} # This will hold the loaded Uformer model and device

async def load_uformer_model(model_path: str, device: torch.device):
    """
    Loads the Uformer model and its pre-trained weights.
    """
    model = Uformer(
        img_size=256,
        in_chans=3,
        dd_in=3,
        # embed_dim=32, # The correct embed_dim for Uformer-B SIDD
        embed_dim=16, # The correct embed_dim for Uformer16
        # depths=[1, 2, 8, 8, 2, 8, 8, 2, 1], # The correct depths for Uformer-B SIDD
        depths=[2, 2, 2, 2, 2, 2, 2, 2, 2], # Depths for Uformer-B / Uformer16
        # num_heads=[1, 2, 4, 8, 16, 16, 8, 4, 2], # The correct num_heads for Uformer-B SIDD
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
        # modulator=True, # modulator value for Uformer-B SIDD
        modulator=False, # Adjusted for embed_dim=16
        cross_modulator=False
    )

    # model = Uformer(
    #     img_size=256,
    #     in_chans=3,
    #     dd_in=3,
    #     embed_dim=32,                              # Uformer-B uses embed_dim 32
    #     depths=[1, 2, 8, 8, 2, 8, 8, 2, 1],        # Official depths for Uformer-B
    #     num_heads=[1, 2, 4, 8, 16, 16, 8, 4, 2],    # Official heads for Uformer-B
    #     win_size=8,
    #     mlp_ratio=4.,
    #     qkv_bias=True,
    #     qk_scale=None,
    #     drop_rate=0.,
    #     attn_drop_rate=0.,
    #     drop_path_rate=0.1,
    #     norm_layer=nn.LayerNorm,
    #     patch_norm=True,
    #     use_checkpoint=False,
    #     token_projection='linear',
    #     token_mlp='leff',
    #     dowsample=Downsample,
    #     upsample=Upsample,
    #     shift_flag=True,
    #     modulator=True,                           # Uformer-B SIDD model USES the modulator
    #     cross_modulator=False
    # )

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Uformer model weights not found at: {model_path}")

    checkpoint = torch.load(model_path, map_location=device)
    
    if 'state_dict' in checkpoint:
        state_dict_to_load = checkpoint['state_dict']
    else:
        state_dict_to_load = checkpoint
        
    new_state_dict = {}
    for k, v in state_dict_to_load.items():
        if k.startswith('module.'):
            new_state_dict[k[7:]] = v
        else:
            new_state_dict[k] = v

    # --- START OF MODIFIED DEBUGGING CODE ---
    # This will write the keys to a file in the `backend/` directory.
    debug_output_path = 'debug_keys.txt'
    try:
        with open(debug_output_path, 'w') as f:
            f.write("--- DEBUG: KEYS IN OUR MODEL DEFINITION ---\n")
            # Sorting the keys makes comparison much easier
            for key in sorted(model.state_dict().keys()):
                f.write(f"{key}\n")

            f.write("\n\n--- DEBUG: KEYS IN THE LOADED .PTH FILE ---\n")
            # Sorting the keys here too is crucial
            for key in sorted(new_state_dict.keys()):
                f.write(f"{key}\n")
        
        print(f"\n\n--- DEBUG: Wrote model keys to '{debug_output_path}' in the backend/ directory. Please provide its content. ---\n\n")

    except Exception as e:
        print(f"--- DEBUG: FAILED TO WRITE DEBUG FILE: {e} ---")
    # --- END OF MODIFIED DEBUGGING CODE ---

    # This call will now succeed because the architectures match
    model.load_state_dict(new_state_dict, strict=True)
    
    model.to(device)
    model.eval()

    return model

def get_uformer_model() -> Dict[str, Any]:
    """
    Dependency function to get the loaded Uformer model and device.
    Raises an HTTPException if the model is not loaded.
    """
    if "uformer_model" not in app_models or app_models["uformer_model"] is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Uformer model is not loaded or failed to initialize.")
    return app_models
