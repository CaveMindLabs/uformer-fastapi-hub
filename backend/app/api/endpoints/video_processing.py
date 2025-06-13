# noctura-uformer/backend/app/api/endpoints/video_processing.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, Any
import base64
import io
import torch
import time
import traceback
import cv2
import numpy as np
from PIL import Image

# Import the dependency to get our loaded Uformer model
from app.api.dependencies import get_uformer_model

# Import image_utils from our copied Uformer model files
# This helps with consistent image preprocessing/postprocessing if needed,
# though we'll primarily use numpy/torch/cv2 directly.
# from uformer_model.utils import image_utils # Not strictly needed if we implement directly

router = APIRouter()

# Helper function for image padding (for Uformer's windowing, often benefits multiples of 8)
def pad_image_to_multiple(image_np: np.ndarray, multiple: int = 8):
    """
    Pads an image to ensure its height and width are multiples of 'multiple'.
    Returns the padded image and the padding amounts (top, bottom, left, right).
    """
    h, w, c = image_np.shape
    pad_h = (multiple - (h % multiple)) % multiple
    pad_w = (multiple - (w % multiple)) % multiple

    if pad_h == 0 and pad_w == 0:
        return image_np, (0, 0, 0, 0) # No padding needed

    padded_image = np.pad(image_np, 
                          ((0, pad_h), (0, pad_w), (0, 0)), 
                          mode='reflect') # 'reflect' or 'edge' are good for image borders
    return padded_image, (0, pad_h, 0, pad_w) # Returns (top, bottom, left, right) padding

@router.websocket("/ws/process_video")
async def websocket_process_video(
    websocket: WebSocket,
    models: Dict[str, Any] = Depends(get_uformer_model) # Dependency injection for our loaded model
):
    await websocket.accept()
    print("[WS-BACKEND] ==> WebSocket connection accepted.")

    uformer_model = models["uformer_model"]
    device = models["device"]
    
    prev_frame_time = 0
    
    try:
        while True:
            # --- 1. Receive configuration and image data from client ---
            data = await websocket.receive_json()

            # --- Extract parameters from the received JSON data ---
            image_b64 = data["image_b64"]
            show_fps = data.get("show_fps", False)
            
            # --- 2. Decode and prepare image ---
            img_bytes = base64.b64decode(image_b64.split(',')[1]) # Handle 'data:image/jpeg;base64,' prefix
            image_pil = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            
            # Convert PIL Image to numpy array (HWC, RGB)
            input_image_np_rgb = np.array(image_pil)
            original_h, original_w, _ = input_image_np_rgb.shape

            # Pad image to a multiple of Uformer's window size (8)
            padded_image_np_rgb, (pad_t, pad_b, pad_l, pad_r) = pad_image_to_multiple(input_image_np_rgb, multiple=8)
            
            # Normalize to [0, 1] and convert to PyTorch tensor (CHW, float32)
            input_tensor = torch.from_numpy(padded_image_np_rgb.astype(np.float32) / 255.0).permute(2, 0, 1).unsqueeze(0).to(device)

            # --- 3. Perform Enhancement with Uformer ---
            enhanced_tensor = None
            if uformer_model is not None:
                with torch.no_grad():
                    # Uformer model output is typically x + y (input + residual) or just y (residual)
                    # For SIDD, it's usually designed to learn the residual/clean image.
                    # Based on model.py's forward: `return x + y if self.dd_in ==3 else y`
                    # Since dd_in=3, it should return x + y.
                    enhanced_tensor = uformer_model(input_tensor)
            else:
                # If model failed to load, return original image or an error indicator
                print("[WS-BACKEND] Uformer model not loaded, skipping enhancement.")
                # For now, we'll just send back the original if no model
                enhanced_tensor = input_tensor 

            # --- 4. Post-process enhanced image ---
            # Move to CPU, remove batch dimension, permute to HWC, scale back to [0, 255]
            if enhanced_tensor is not None:
                enhanced_image_np_rgb = (enhanced_tensor.squeeze(0).permute(1, 2, 0).clamp(0.0, 1.0).cpu().numpy() * 255.0).astype(np.uint8)
            else:
                enhanced_image_np_rgb = input_image_np_rgb # Fallback if no enhancement occurred

            # Remove padding
            if pad_b > 0 or pad_r > 0:
                enhanced_image_np_rgb = enhanced_image_np_rgb[:original_h, :original_w, :]

            # --- 5. Add FPS counter (optional) ---
            output_image_bgr = cv2.cvtColor(enhanced_image_np_rgb, cv2.COLOR_RGB2BGR)
            if show_fps:
                new_frame_time = time.time()
                if prev_frame_time > 0:
                    fps = 1 / (new_frame_time - prev_frame_time)
                    cv2.putText(output_image_bgr, f"FPS: {fps:.2f}", 
                                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA)
                prev_frame_time = new_frame_time

            # --- 6. Encode and send back the processed frame ---
            is_success, buffer = cv2.imencode(".jpg", output_image_bgr)
            if not is_success:
                raise Exception("Could not encode output image to JPEG.")
                
            processed_b64 = base64.b64encode(buffer).decode('utf-8')
            await websocket.send_text(f"data:image/jpeg;base64,{processed_b64}")

    except WebSocketDisconnect as e:
        print(f"[WS-BACKEND] XXX Client disconnected. Code: {e.code}, Reason: {e.reason}")
    except Exception as e:       
        print(f"[WS-BACKEND] !!! An unexpected error occurred in WebSocket: {e}")
        traceback.print_exc() # This will print the full stack trace to your terminal
        # Attempt to send an error message to the client before closing
        try:
            await websocket.send_json({"error": f"Server processing error: {e}"})
        except:
            pass # Ignore if sending error also fails
        await websocket.close(code=1011, reason=f"Server error: {e}")
