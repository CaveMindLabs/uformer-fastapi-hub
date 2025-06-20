/* backend/tester/js/pages/LiveStreamPage.js */
import config from '../config.js';

const LiveStreamPage = {
    title: "Real-time Enhancement",
    defaultClearImages: false,
    defaultClearVideos: false,

    getHtml: () => `
        <div class="sidebar">
            <h2>Live Controls</h2>
            <div class="control-group" id="taskControlGroup">
                <label for="taskSelect">Task</label>
                <select id="taskSelect" style="padding: 8px; font-size: 1rem; border-radius: 4px; border: 1px solid #61dafb; background-color: #4a4f5a; color: white;">
                    <option value="denoise">Denoise</option>
                    <option value="deblur">Deblur</option>
                </select>
            </div>
            <div class="control-group">
                <label for="modelSelect">Enhancement Model</label>
                <select id="modelSelect" style="padding: 8px; font-size: 1rem; border-radius: 4px; border: 1px solid #61dafb; background-color: #4a4f5a; color: white;"></select>
            </div>
            <div class="control-group checkbox-group">
                <label><input type="checkbox" id="fpsCheckbox" checked /> Show FPS Counter</label>
            </div>
            <div class="control-group checkbox-group">
                <label>
                    <input type="checkbox" id="patchCheckbox" /> Use Patch Processing
                    <span id="patchWarning" style="color: '#ff6b6b'; font-weight: bold; display: none;"> (Not Recommended: Very Slow)</span>
                </label>
            </div>
        </div>
        <div class="main-content">
            <div class="actions-bar">
                <button id="startButton">Start Webcam</button>
                <button id="stopButton" disabled>Stop Webcam</button>
                <p id="status">Idle. Press Start to begin.</p>
            </div>
            <div class="video-feeds-container">
                <div class="video-box">
                     <div class="video-header" style="justify-content: center;"><h3>Original Webcam</h3></div>
                    <video id="webcam" class="video" autoPlay playsInline muted style="transform: scaleX(-1);"></video>
                </div>
                <div class="video-box">
                    <div class="video-header" style="justify-content: center;">
                        <h3 style="color: #f0e68c;">Enhanced Stream</h3>
                    </div>
                    <img id="processedImage" class="image-display" alt="Processed stream from backend" />
                </div>
            </div>
        </div>
    `,

    init: () => {
        // --- Element Refs ---
        const webcamVideo = document.getElementById('webcam');
        const processedImage = document.getElementById('processedImage');
        const statusSpan = document.getElementById('status');
        const modelSelect = document.getElementById('modelSelect');
        const taskSelect = document.getElementById('taskSelect');
        const fpsCheckbox = document.getElementById('fpsCheckbox');
        const patchCheckbox = document.getElementById('patchCheckbox');
        const patchWarning = document.getElementById('patchWarning');
        const startButton = document.getElementById('startButton');
        const stopButton = document.getElementById('stopButton');
        
        // --- State ---
        let websocket;
        let stream;
        let localIsStreaming = false;

        const stopStreaming = () => {
            localIsStreaming = false;
            startButton.disabled = false;
            stopButton.disabled = true;
            if (websocket) {
                websocket.onclose = null;
                websocket.close();
            }
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                if(webcamVideo) webcamVideo.srcObject = null;
            }
            if (processedImage) processedImage.src = "";
            window.dispatchEvent(new CustomEvent('forceHeaderUpdate')); // Update VRAM status
        };

        const processAndSendFrame = () => {
            if (!localIsStreaming || !websocket || websocket.readyState !== WebSocket.OPEN) return;
            if (!webcamVideo || !webcamVideo.videoWidth || !webcamVideo.videoHeight) {
                requestAnimationFrame(processAndSendFrame);
                return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = webcamVideo.videoWidth;
            canvas.height = webcamVideo.videoHeight;
            const context = canvas.getContext('2d');

            context.translate(canvas.width, 0);
            context.scale(-1, 1);
            context.drawImage(webcamVideo, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg');

            const payload = {
                image_b64: dataUrl,
                task_type: taskSelect.value,
                model_name: modelSelect.value,
                show_fps: fpsCheckbox.checked,
                use_patch_processing: patchCheckbox.checked
            };
            websocket.send(JSON.stringify(payload));
        };

        const startStreaming = async () => {
            try {
                statusSpan.classList.remove('error');
                statusSpan.textContent = 'Starting webcam...';
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                webcamVideo.srcObject = stream;
                
                websocket = new WebSocket(config.WEBSOCKET_URL);

                websocket.onopen = () => {
                    statusSpan.textContent = 'WebSocket Connected. Processing...';
                    localIsStreaming = true;
                    startButton.disabled = true;
                    stopButton.disabled = false;
                    requestAnimationFrame(processAndSendFrame);
                    window.dispatchEvent(new CustomEvent('forceHeaderUpdate')); // Update VRAM
                };
                websocket.onmessage = (event) => {
                    processedImage.src = event.data;
                    if (localIsStreaming) requestAnimationFrame(processAndSendFrame);
                };
                websocket.onclose = () => {
                    if (localIsStreaming) statusSpan.textContent = 'WebSocket Disconnected.';
                    stopStreaming();
                };
                websocket.onerror = (error) => {
                    statusSpan.classList.add('error');
                    statusSpan.textContent = !localIsStreaming ? 'Connection Failed. Is backend running?' : 'WebSocket Error.';
                    console.error("WebSocket Error:", error);
                    stopStreaming();
                };
            } catch (err) {
                console.error("Error starting webcam:", err);
                statusSpan.textContent = 'Error starting webcam!';
                statusSpan.classList.add('error');
            }
        };

        const modelsByTask = {
            denoise: [ { value: 'denoise_b', text: 'Uformer-B (High Quality)' }, { value: 'denoise_16', text: 'Uformer-16 (Fast)' } ],
            deblur: [ { value: 'deblur_b', text: 'Uformer-B (Deblur)' } ]
        };
        
        function populateModelSelect(taskType) {
            modelSelect.innerHTML = '';
            const models = modelsByTask[taskType];
            if (models) {
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.value; option.textContent = model.text;
                    if (taskType === 'denoise' && model.value === 'denoise_16') option.selected = true;
                    else if (models.length === 1) option.selected = true;
                    modelSelect.appendChild(option);
                });
            }
        }

        taskSelect.addEventListener('change', (event) => populateModelSelect(event.target.value));
        patchCheckbox.addEventListener('change', () => { patchWarning.style.display = patchCheckbox.checked ? 'inline' : 'none'; });

        startButton.onclick = startStreaming;
        stopButton.onclick = stopStreaming;

        populateModelSelect(taskSelect.value);

        // Cleanup on navigate away (handled by app.js clearing the DOM)
    }
};

export default LiveStreamPage;
