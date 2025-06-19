# noctura-uformer/backend/app/api/endpoints/live_stream_processing.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from typing import Dict, Any, Tuple
import base64
import io
import torch
import time
import traceback
import cv2
import numpy as np
from PIL import Image

# Import the dependency to get our loaded models and the specific model getter
from app.api.dependencies import get_models, get_model_by_name

router = APIRouter()

# Helper function for image padding (Keep this as is, it's correct)
def pad_image_to_multiple(image_np: np.ndarray, multiple: int, mode='reflect') -> Tuple[np.ndarray, Tuple[int, int]]:
    """
    Pads an image to ensure its height and width are multiples of 'multiple'.
    Returns the padded image and the original dimensions (h, w).
    """
    original_h, original_w, c = image_np.shape

    pad_h = (multiple - (original_h % multiple)) % multiple
    pad_w = (multiple - (original_w % multiple)) % multiple

    if pad_h == 0 and pad_w == 0:
        return image_np, (original_h, original_w)

    padded_image = np.pad(image_np, ((0, pad_h), (0, pad_w), (0, 0)), mode=mode)
    return padded_image, (original_h, original_w)

@router.websocket("/ws/process_video")
async def websocket_process_video(
    websocket: WebSocket,
    models_container: Dict[str, Any] = Depends(get_models) # Use models_container to access app_models
):
    await websocket.accept()
    print("[WS-BACKEND] ==> WebSocket connection accepted.")

    device = models_container["device"] # Get device from the container
    models_in_use = models_container.get("models_in_use", {}) # Get the reference counter
    patch_size = 256 # Define patch_size here
    
    prev_frame_time = 0
    # Keep track of the last model used by this specific websocket connection
    last_model_used_by_ws = None
    
    try:
        # We need to manually resolve get_model_by_name here because WebSocket dependencies
        # are processed per connection, not per message. We need to fetch it dynamically.
        # However, get_model_by_name is a synchronous function.
        
        while True:
            data = await websocket.receive_json()
            image_b64 = data["image_b64"]
            
            # Get processing options from the client
            model_name = data.get("model_name", "denoise_b") # Default to high-quality model
            show_fps = data.get("show_fps", False)
            use_patch_processing = data.get("use_patch_processing", False)

            try:
                # --- Reference Counting for Live Stream ---
                if model_name != last_model_used_by_ws:
                    # If the model has changed, decrement the old one (if any)
                    if last_model_used_by_ws and last_model_used_by_ws in models_in_use:
                        models_in_use[last_model_used_by_ws] = max(0, models_in_use.get(last_model_used_by_ws, 0) - 1)
                        print(f"[REF_COUNT] DECREMENT (WS Switch): Model '{last_model_used_by_ws}' count is now {models_in_use[last_model_used_by_ws]}.")
                    
                    # And increment the new one
                    models_in_use[model_name] = models_in_use.get(model_name, 0) + 1
                    print(f"[REF_COUNT] INCREMENT (WS): Model '{model_name}' count is now {models_in_use[model_name]}.")
                    last_model_used_by_ws = model_name
                # ------------------------------------------

                uformer_model = get_model_by_name(model_name=model_name, models=models_container)
            except HTTPException as e:
                # If get_model_by_name raises an HTTPException (e.g., model not found/failed to load)
                # we catch it and send an error back to the client, then continue the loop.
                print(f"[WS-BACKEND] Model loading error: {e.detail}")
                await websocket.send_json({"error": f"Model loading error: {e.detail}"})
                continue # Skip processing this frame and wait for the next message

            img_bytes = base64.b64decode(image_b64.split(',')[1])
            image_pil = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            
            input_frame_np = (np.array(image_pil) / 255.0).astype(np.float32)
            original_h, original_w, _ = input_frame_np.shape

            restored_frame_np = None

            with torch.no_grad():
                if use_patch_processing:
                    # SLOW - Patch-based pipeline
                    padded_frame_np, _ = pad_image_to_multiple(input_frame_np, patch_size)
                    padded_h, padded_w, _ = padded_frame_np.shape
                    padded_output_np = np.zeros_like(padded_frame_np)

                    for y in range(0, padded_h, patch_size):
                        for x in range(0, padded_w, patch_size):
                            patch_np = padded_frame_np[y:y+patch_size, x:x+patch_size, :]
                            patch_tensor = torch.from_numpy(patch_np).permute(2, 0, 1).unsqueeze(0).to(device)
                            restored_patch_tensor = uformer_model(patch_tensor)
                            restored_patch_np = restored_patch_tensor.squeeze(0).permute(1, 2, 0).clamp(0.0, 1.0).cpu().numpy()
                            padded_output_np[y:y+patch_size, x:x+patch_size, :] = restored_patch_np
                    
                    restored_frame_np = padded_output_np[0:original_h, 0:original_w, :]
                
                else:
                    # FAST - Resize pipeline
                    resized_input_np = cv2.resize(input_frame_np, (patch_size, patch_size), interpolation=cv2.INTER_LANCZOS4)
                    input_tensor = torch.from_numpy(resized_input_np).permute(2, 0, 1).unsqueeze(0).to(device)
                    restored_tensor = uformer_model(input_tensor)
                    restored_resized_np = restored_tensor.squeeze(0).permute(1, 2, 0).clamp(0.0, 1.0).cpu().numpy()
                    restored_frame_np = cv2.resize(restored_resized_np, (original_w, original_h), interpolation=cv2.INTER_LANCZOS4)

            # Convert to uint8 and add FPS counter
            output_image_bgr = cv2.cvtColor((restored_frame_np * 255.0).astype(np.uint8), cv2.COLOR_RGB2BGR)

            if show_fps:
                new_frame_time = time.time()
                if prev_frame_time > 0:
                    fps = 1 / (new_frame_time - prev_frame_time)
                    cv2.putText(output_image_bgr, f"FPS: {fps:.2f}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA)
                prev_frame_time = new_frame_time

            is_success, buffer = cv2.imencode(".jpg", output_image_bgr)
            if not is_success: raise Exception("Could not encode output image.")
                
            processed_b64 = base64.b64encode(buffer).decode('utf-8')
            await websocket.send_text(f"data:image/jpeg;base64,{processed_b64}")

    except WebSocketDisconnect as e:
        print(f"[WS-BACKEND] XXX Client disconnected. Code: {e.code}, Reason: {e.reason}")
    except Exception as e:
        print(f"[WS-BACKEND] !!! An error occurred in WebSocket: {e}")
        traceback.print_exc()
        try:
            await websocket.send_json({"error": f"Server processing error: {e}"})
        except: pass
        await websocket.close(code=1011, reason=f"Server error: {e}")
    finally:
        # --- Final Reference Counter Decrement on Disconnect ---
        if last_model_used_by_ws and last_model_used_by_ws in models_in_use:
            models_in_use[last_model_used_by_ws] = max(0, models_in_use.get(last_model_used_by_ws, 0) - 1)
            print(f"[REF_COUNT] DECREMENT (WS Disconnect): Model '{last_model_used_by_ws}' count is now {models_in_use[last_model_used_by_ws]}.")
        # --------------------------------------------------------
