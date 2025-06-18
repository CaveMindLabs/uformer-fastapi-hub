// frontend/src/pages/index.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/Layout'; // Import the new Layout component

const LiveStreamPage = () => {
    // --- Refs for direct DOM access ---
    const webcamVideoRef = useRef(null);
    const processedImageRef = useRef(null);
    const statusSpanRef = useRef(null);
    const modelSelectRef = useRef(null);
    const taskSelectRef = useRef(null);
    const fpsCheckboxRef = useRef(null);
    const patchCheckboxRef = useRef(null);
    const patchWarningRef = useRef(null);

    // --- State for React to manage UI ---
    const [isStreaming, setIsStreaming] = useState(false);

    // --- useEffect for component setup and teardown ---
    useEffect(() => {
        let websocket;
        let stream;
        let localIsStreaming = false;
        const WS_URL = "ws://127.0.0.1:8000/ws/process_video";

        const webcamVideo = webcamVideoRef.current;
        const processedImage = processedImageRef.current;
        const statusSpan = statusSpanRef.current;
        const modelSelect = modelSelectRef.current;
        const taskSelect = taskSelectRef.current;
        const fpsCheckbox = fpsCheckboxRef.current;
        const patchCheckbox = patchCheckboxRef.current;
        const patchWarning = patchWarningRef.current;

        const stopStreaming = () => {
            localIsStreaming = false;
            setIsStreaming(false); // This will update the button disabled state
            if (websocket) {
                websocket.onclose = null;
                websocket.close();
            }
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                if(webcamVideo) webcamVideo.srcObject = null;
            }
            if (processedImage) processedImage.src = "";
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

            // This correctly pre-mirrors the frame before sending it.
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
                
                websocket = new WebSocket(WS_URL);

                websocket.onopen = () => {
                    statusSpan.textContent = 'WebSocket Connected. Processing...';
                    localIsStreaming = true;
                    setIsStreaming(true);
                    requestAnimationFrame(processAndSendFrame);
                };
                websocket.onmessage = (event) => {
                    // The processed image is already flipped by the backend logic, so we display it directly
                    processedImage.src = event.data;
                    if (localIsStreaming) requestAnimationFrame(processAndSendFrame);
                };
                websocket.onclose = () => {
                    if (localIsStreaming) statusSpan.textContent = 'WebSocket Disconnected.';
                    stopStreaming();
                };
                websocket.onerror = (error) => {
                    statusSpan.classList.add('error');
                    statusSpan.textContent = !localIsStreaming ? 'Connection Failed. Is the backend running?' : 'WebSocket Error during stream.';
                    console.error("WebSocket Error:", error);
                    stopStreaming();
                };
            } catch (err) {
                console.error("Error starting webcam:", err);
                statusSpan.textContent = 'Error starting webcam!';
                statusSpan.classList.add('error');
            }
        };

        // --- Model and Task Management ---
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

        // --- Assign button clicks ---
        const startButton = document.getElementById('startButton'); // Get buttons by ID for page-specific actions
        const stopButton = document.getElementById('stopButton');
        startButton.onclick = startStreaming;
        stopButton.onclick = stopStreaming;

        // --- Initial setup ---
        populateModelSelect(taskSelect.value);

        return () => {
            // Cleanup on unmount
            stopStreaming();
            taskSelect.removeEventListener('change', (event) => populateModelSelect(event.target.value));
            patchCheckbox.removeEventListener('change', () => { patchWarning.style.display = patchCheckbox.checked ? 'inline' : 'none'; });
        };
    }, []); // Empty dependency array ensures this runs once on mount.

    const headerProps = {
        title: "NocturaVision - Live Stream",
        activePage: "live",
        pageTitle: "Real-time Enhancement",
        defaultClearImages: false, // For live stream, neither is checked by default
        defaultClearVideos: false
    };

    return (
        <Layout headerProps={headerProps}>
            <div className="sidebar">
                <h2>Live Controls</h2>
                <div className="control-group" id="taskControlGroup">
                    <label htmlFor="taskSelect">Task</label>
                    <select id="taskSelect" ref={taskSelectRef} style={{ padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #61dafb', backgroundColor: '#4a4f5a', color: 'white' }}>
                        <option value="denoise">Denoise</option>
                        <option value="deblur">Deblur</option>
                    </select>
                </div>
                <div className="control-group">
                    <label htmlFor="modelSelect">Enhancement Model</label>
                    <select id="modelSelect" ref={modelSelectRef} style={{ padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #61dafb', backgroundColor: '#4a4f5a', color: 'white' }}></select>
                </div>
                <div className="control-group checkbox-group">
                    <label><input type="checkbox" id="fpsCheckbox" ref={fpsCheckboxRef} defaultChecked /> Show FPS Counter</label>
                </div>
                <div className="control-group checkbox-group">
                    <label>
                        <input type="checkbox" id="patchCheckbox" ref={patchCheckboxRef} /> Use Patch Processing
                        <span id="patchWarning" ref={patchWarningRef} style={{ color: '#ff6b6b', fontWeight: 'bold', display: 'none' }}> (Not Recommended: Very Slow)</span>
                    </label>
                </div>
            </div>
            <div className="main-content">
                <div className="actions-bar">
                    {/* These buttons are controlled via state now */}
                    <button id="startButton" disabled={isStreaming}>Start Webcam</button>
                    <button id="stopButton" disabled={!isStreaming}>Stop Webcam</button>
                    <p id="status" ref={statusSpanRef}>Idle. Press Start to begin.</p>
                </div>
                <div className="video-feeds-container">
                    <div className="video-box">
                         <div className="video-header" style={{ justifyContent: 'center' }}><h3>Original Webcam</h3></div>
                        {/* The webcam video is mirrored via CSS */}
                        <video id="webcam" ref={webcamVideoRef} className="video" autoPlay playsInline muted></video>
                    </div>
                    <div className="video-box">
                        <div className="video-header" style={{ justifyContent: 'center' }}><h3>Enhanced Stream</h3></div>
                        {/* The processed image is mirrored via CSS for consistency */}
                        <img id="processedImage" ref={processedImageRef} className="image-display" alt="Processed stream from backend" />
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default LiveStreamPage;
