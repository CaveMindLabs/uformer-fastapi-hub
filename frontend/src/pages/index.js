// frontend/src/pages/index.js
import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// NOTE: We are creating a functional component for each page.
// The entire logic from the old <script> tag will be moved inside this component.

const LiveStreamPage = () => {
    // Refs are the React way to get direct access to a DOM element, like getElementById.
    const startButtonRef = useRef(null);
    const stopButtonRef = useRef(null);
    const webcamVideoRef = useRef(null);
    const processedImageRef = useRef(null);
    const statusSpanRef = useRef(null);
    const modelSelectRef = useRef(null);
    const taskSelectRef = useRef(null);
    const fpsCheckboxRef = useRef(null);
    const patchCheckboxRef = useRef(null);
    const patchWarningRef = useRef(null);
    const clearCacheBtnRef = useRef(null);
    const clearImagesCheckRef = useRef(null);
    const clearVideosCheckRef = useRef(null);
    const imageCacheValueRef = useRef(null);
    const videoCacheValueRef = useRef(null);
    const clearAllModelsBtnRef = useRef(null); // New ref for the Clear All Models button

    // State variables to manage dynamic data and UI state.
    const [isStreaming, setIsStreaming] = useState(false);

    // This useEffect hook runs once when the component mounts, similar to DOMContentLoaded.
    // All our old script logic goes in here.
    useEffect(() => {
        let websocket;
        let stream;
        let localIsStreaming = false; // Use a local variable for the animation loop
        const WS_URL = "ws://127.0.0.1:8000/ws/process_video";

        const startButton = startButtonRef.current;
        const stopButton = stopButtonRef.current;
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
            setIsStreaming(false);
            if (websocket) {
                websocket.onclose = null; 
                websocket.close();
            }
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                if(webcamVideo) webcamVideo.srcObject = null;
            }
            if (startButton) startButton.disabled = false;
            if (stopButton) stopButton.disabled = true;
            if (processedImage) processedImage.src = "";
        };

        const processAndSendFrame = () => {
            if (!localIsStreaming || !websocket || websocket.readyState !== WebSocket.OPEN) {
                return;
            }
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

        startButton.onclick = async () => {
            try {
                statusSpan.classList.remove('error');
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                webcamVideo.srcObject = stream;
                statusSpan.textContent = 'Webcam started.';
                
                websocket = new WebSocket(WS_URL);

                websocket.onopen = () => {
                    statusSpan.textContent = 'WebSocket Connected. Processing...';
                    startButton.disabled = true;
                    stopButton.disabled = false;
                    localIsStreaming = true;
                    setIsStreaming(true);
                    requestAnimationFrame(processAndSendFrame); 
                };

                websocket.onmessage = (event) => {
                    processedImage.src = event.data;
                    if (localIsStreaming) {
                        requestAnimationFrame(processAndSendFrame);
                    }
                };

                websocket.onclose = () => {
                    if (localIsStreaming) { statusSpan.textContent = 'WebSocket Disconnected.'; }
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
            }
        };
        
        stopButton.onclick = () => {
            statusSpan.classList.remove('error');
            statusSpan.textContent = 'Idle. Press Start to begin.';
            stopStreaming();
        };

        patchCheckbox.onchange = () => {
            patchWarning.style.display = patchCheckbox.checked ? 'inline' : 'none';
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
                    option.value = model.value;
                    option.textContent = model.text;
                    if (taskType === 'denoise' && model.value === 'denoise_16') option.selected = true;
                    else if (models.length === 1) option.selected = true;
                    modelSelect.appendChild(option);
                });
            }
        }
        taskSelect.addEventListener('change', (event) => populateModelSelect(event.target.value));

        // Initial population
        populateModelSelect(taskSelect.value);

        // --- Cache Management ---
        const clearCacheBtn = clearCacheBtnRef.current;
        const clearImagesCheck = clearImagesCheckRef.current;
        const clearVideosCheck = clearVideosCheckRef.current;
        const imageCacheValue = imageCacheValueRef.current;
        const videoCacheValue = videoCacheValueRef.current;

        async function updateCacheStatus() {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/cache_status');
                if (!response.ok) throw new Error("Server status check failed");
                const data = await response.json();
                imageCacheValue.textContent = `${data.image_cache_mb} MB`;
                videoCacheValue.textContent = `${data.video_cache_mb} MB`;
            } catch (error) {
                console.error("Failed to fetch cache status:", error);
                imageCacheValue.textContent = `Error`;
                videoCacheValue.textContent = `Error`;
            }
        }

        function toggleClearButtonState() {
            clearCacheBtn.disabled = !clearImagesCheck.checked && !clearVideosCheck.checked;
        }

        clearImagesCheck.addEventListener('change', toggleClearButtonState);
        clearVideosCheck.addEventListener('change', toggleClearButtonState);
        
        clearCacheBtn.onclick = async () => {
            if (!confirm(`Are you sure you want to clear the selected cache(s)?`)) return;
            try {
                const url = new URL('http://127.0.0.1:8000/api/clear_cache');
                url.searchParams.append('clear_images', clearImagesCheck.checked);
                url.searchParams.append('clear_videos', clearVideosCheck.checked);

                const response = await fetch(url, { method: 'POST' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.detail || 'Failed to clear cache.');
                alert(result.message || 'Cache cleared successfully!');
                await updateCacheStatus();
            } catch (error) {
                alert(`An error occurred: ${error.message}`);
            }
        };

        updateCacheStatus();
        toggleClearButtonState();

        // --- Model Loading Strategy Check and Button Control ---
        const clearAllModelsBtn = clearAllModelsBtnRef.current;
        async function checkModelLoadingStrategy() {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/model_loading_strategy');
                if (!response.ok) throw new Error("Failed to fetch model loading strategy");
                const data = await response.json();
                if (!data.load_all_on_startup && clearAllModelsBtn) {
                    clearAllModelsBtn.style.display = 'block'; // Show the button if not loading all on startup
                } else if (clearAllModelsBtn) {
                    clearAllModelsBtn.style.display = 'none'; // Hide if loading all on startup
                }
            } catch (error) {
                console.error("Error fetching model loading strategy:", error);
                if (clearAllModelsBtn) clearAllModelsBtn.style.display = 'none'; // Hide on error
            }
        }

        if (clearAllModelsBtn) {
            clearAllModelsBtn.onclick = async () => {
                if (!confirm("Are you sure you want to unload all models from VRAM? This may cause a delay on subsequent requests.")) return;
                try {
                    const response = await fetch('http://127.0.0.1:8000/api/unload_models', { method: 'POST' });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.detail || 'Failed to unload models.');
                    alert(result.message || 'Models unloaded successfully!');
                    // Optionally, you might want to force a re-render or status update here
                } catch (error) {
                    alert(`An error occurred while unloading models: ${error.message}`);
                }
            };
        }

        checkModelLoadingStrategy(); // Initial check on component mount


        // Cleanup function when the component unmounts
        return () => {
            stopStreaming();
        };

    }, []);


    return (
        <>
            <Head>
                <title>NocturaVision - Live Stream</title>
            </Head>
            <header>
                <div className="nav-bar">
                    <Link href="/" className="nav-button active">Live Stream</Link>
                    <Link href="/video-processor" className="nav-button">Video File</Link>
                    <Link href="/image-processor" className="nav-button">Image File</Link>
                </div>
                <div className="title-block">
                    <h1>🦉 NocturaVision <span style={{ fontWeight: 300, color: '#ccc' }}>| Uformer</span></h1>
                    <p>Real-time Enhancement</p>
                </div>
                <div className="cache-info-block">
                    <label className="cache-line">
                        <input type="checkbox" id="clearImagesCheck" ref={clearImagesCheckRef} defaultChecked={false} />
                        <span className="cache-label-text">Image Cache:</span>
                        <span className="cache-value" id="imageCacheValue" ref={imageCacheValueRef}>... MB</span>
                    </label>
                    <label className="cache-line">
                        <input type="checkbox" id="clearVideosCheck" ref={clearVideosCheckRef} defaultChecked={false} />
                        <span className="cache-label-text">Video Cache:</span>
                        <span className="cache-value" id="videoCacheValue" ref={videoCacheValueRef}>... MB</span>
                    </label>
                    <button id="clearCacheBtn" ref={clearCacheBtnRef}>Clear Selected</button>
                    {/* New Clear All Models button */}
                    <button id="clearAllModelsBtn" ref={clearAllModelsBtnRef} style={{ marginTop: '5px', padding: '6px 12px', fontSize: '0.9rem', backgroundColor: '#61dafb', color: '#20232a', border: 'none', borderRadius: '5px', cursor: 'pointer', display: 'none' }}>
                        Clear All Models
                    </button>
                </div>
            </header>
            <div className="page-content">
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
                        <select id="modelSelect" ref={modelSelectRef} style={{ padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #61dafb', backgroundColor: '#4a4f5a', color: 'white' }}>
                            {/* Options will be dynamically populated */}
                        </select>
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
                        <button id="startButton" ref={startButtonRef}>Start Webcam</button>
                        <button id="stopButton" ref={stopButtonRef} disabled>Stop Webcam</button>
                        <p id="status" ref={statusSpanRef}>Idle. Press Start to begin.</p>
                    </div>
                    <div className="video-feeds-container">
                        <div className="video-box">
                            <div className="video-header" style={{ justifyContent: 'center' }}>
                                <h3>Original Webcam</h3>
                            </div>
                            <video id="webcam" ref={webcamVideoRef} className="video" autoPlay playsInline muted></video>
                        </div>
                        <div className="video-box">
                            <div className="video-header" style={{ justifyContent: 'center' }}>
                                <h3>Enhanced Stream</h3>
                            </div>
                            <img id="processedImage" ref={processedImageRef} className="image-display" alt="Processed stream from backend" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LiveStreamPage;
