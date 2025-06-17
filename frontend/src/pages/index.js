// frontend/src/pages/index.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const CacheManager = () => {
    const [imageCacheMb, setImageCacheMb] = useState('...');
    const [videoCacheMb, setVideoCacheMb] = useState('...');
    const [clearImages, setClearImages] = useState(false);
    const [clearVideos, setClearVideos] = useState(false);

    const updateStatus = useCallback(async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/api/cache_status');
            if (!response.ok) throw new Error("Failed to fetch cache status");
            const data = await response.json();
            setImageCacheMb(data.image_cache_mb);
            setVideoCacheMb(data.video_cache_mb);
        } catch (error) {
            console.error(error);
            setImageCacheMb('Error');
            setVideoCacheMb('Error');
        }
    }, []);

    useEffect(() => {
        updateStatus();
    }, [updateStatus]);

    const handleClear = async () => {
        if (!confirm(`Are you sure you want to clear the selected cache(s)?`)) return;

        try {
            const url = new URL('http://127.0.0.1:8000/api/clear_cache');
            url.searchParams.append('clear_images', clearImages);
            url.searchParams.append('clear_videos', clearVideos);
            const response = await fetch(url, { method: 'POST' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.detail || 'Failed to clear cache.');
            alert(result.message || 'Cache cleared successfully!');
            
            // Reset checkboxes and update status after a successful clear
            setClearImages(false);
            setClearVideos(false);
            await updateStatus();

        } catch (error) {
            alert(`An error occurred: ${error.message}`);
        }
    };

    return (
        // This container is now a flex column that will stretch to fill vertical space
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '150px' }}>
            <style jsx>{`
                /* This rule targets the button by its ID, but only when it is NOT disabled. */
                #clearCacheBtn:not(:disabled):hover {
                    background-color: #e05252; /* This is a darker red for the hover effect */
                    border-color: #d04242;
                }
            `}</style>
            
            {/* A wrapper for the top content (checkboxes) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label className="cache-line">
                    <input type="checkbox" checked={clearImages} onChange={(e) => setClearImages(e.target.checked)} />
                    <span className="cache-label-text">Image Cache:</span>
                    <span className="cache-value">{imageCacheMb} MB</span>
                </label>
                <label className="cache-line">
                    <input type="checkbox" checked={clearVideos} onChange={(e) => setClearVideos(e.target.checked)} />
                    <span className="cache-label-text">Video Cache:</span>
                    <span className="cache-value">{videoCacheMb} MB</span>
                </label>
            </div>

            {/* The button wrapper, now pushed to the bottom and centered */}
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: 'auto', paddingTop: '5px' }}>
                <button
                    id="clearCacheBtn"
                    onClick={handleClear}
                    disabled={!clearImages && !clearVideos}
                >
                    Clear Selected Cache
                </button>
            </div>
        </div>
    );
};

const LiveStreamPage = () => {
    // --- Refs for direct DOM access ---
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
    // Refs for the cache manager have been removed as it's now a self-contained component.
    
    // --- State for React to manage UI ---
    const [isStreaming, setIsStreaming] = useState(false);
    const [loadedModels, setLoadedModels] = useState([]); // Holds {name: string, loaded: boolean}
    const [isVramControlVisible, setIsVramControlVisible] = useState(false);
    const [selectedModelsToClear, setSelectedModelsToClear] = useState(new Set());

    // --- API and Business Logic (defined outside useEffect) ---

    const updateLoadedModelsStatus = useCallback(async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/api/loaded_models_status');
            if (!response.ok) throw new Error("Failed to fetch loaded models status.");
            const data = await response.json();
            setLoadedModels(data.models || []);

            // Clear any selections for models that are no longer loaded
            setSelectedModelsToClear(prev => {
                const newSet = new Set(prev);
                (data.models || []).forEach(model => {
                    if (!model.loaded && newSet.has(model.name)) {
                        newSet.delete(model.name);
                    }
                });
                return newSet;
            });

        } catch (error) {
            console.error("Failed to fetch loaded models status:", error);
            setLoadedModels([]);
        }
    }, []);

    const handleModelSelectionChange = (modelName) => {
        setSelectedModelsToClear(prev => {
            const newSet = new Set(prev);
            if (newSet.has(modelName)) newSet.delete(modelName);
            else newSet.add(modelName);
            return newSet;
        });
    };
    
    const handleClearModels = useCallback(async (modelsToClear = []) => {
        const isClearingAll = modelsToClear.length === 0;
        const modelListStr = Array.from(modelsToClear).join(', ');
        const confirmMsg = isClearingAll
            ? "Are you sure you want to unload ALL models from VRAM? This may cause a delay on subsequent requests."
            : `Are you sure you want to unload the selected models (${modelListStr}) from VRAM?`;

        if (!confirm(confirmMsg)) return;

        try {
            const response = await fetch('http://127.0.0.1:8000/api/unload_models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_names: modelsToClear })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.detail || 'Failed to unload models.');
            alert(result.message || 'Models unloaded successfully!');
            await updateLoadedModelsStatus();
        } catch (error) {
            alert(`An error occurred while unloading models: ${error.message}`);
        }
    }, [updateLoadedModelsStatus]);

    // --- useEffect for component setup and teardown ---
    useEffect(() => {
        let websocket;
        let stream;
        let localIsStreaming = false;
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
            updateLoadedModelsStatus(); // Update model status on stream stop
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
                image_b64: dataUrl, task_type: taskSelect.value, model_name: modelSelect.value,
                show_fps: fpsCheckbox.checked, use_patch_processing: patchCheckbox.checked
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
                    startButton.disabled = true; stopButton.disabled = false;
                    localIsStreaming = true; setIsStreaming(true);
                    requestAnimationFrame(processAndSendFrame); 
                    updateLoadedModelsStatus();
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
                    statusSpan.textContent = !localIsStreaming ? 'Connection Failed. Is the backend running?' : 'WebSocket Error during stream.';
                    console.error("WebSocket Error:", error);
                    stopStreaming();
                };
            } catch (err) {
                console.error("Error starting webcam:", err);
                statusSpan.textContent = 'Error starting webcam!';
            }
        };
        
        stopButton.onclick = stopStreaming;
        patchCheckbox.onchange = () => { patchWarning.style.display = patchCheckbox.checked ? 'inline' : 'none'; };

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
        populateModelSelect(taskSelect.value);

        // Note: The logic for cache status, button state, and click handling
        // has been moved outside this useEffect and converted to standard React
        // hooks (useState, useCallback, useEffect) for better, safer state management.

        async function checkModelLoadingStrategy() {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/model_loading_strategy');
                if (!response.ok) {
                    // --- START of new diagnostic logging ---
                    const errorText = await response.text().catch(() => "Could not read error response body.");
                    console.error(`[DIAGNOSTIC] Fetch to /api/model_loading_strategy failed!`);
                    console.error(`[DIAGNOSTIC] Status: ${response.status} (${response.statusText})`);
                    console.error(`[DIAGNOSTIC] Response Body:`, errorText);
                    // --- END of new diagnostic logging ---
                    throw new Error(`Failed to fetch model loading strategy. Status: ${response.status}`);
                }
                const data = await response.json();
                setIsVramControlVisible(!data.load_all_on_startup);
            } catch (error) {
                console.error("Error in checkModelLoadingStrategy:", error);
                setIsVramControlVisible(false);
            }
        }

        checkModelLoadingStrategy();
        updateLoadedModelsStatus();

        // Cleanup: remove event listeners when component unmounts
        return () => {
            stopStreaming();
            // No cleanup is needed for cache listeners anymore, as they are handled by React's declarative JSX.
        };
    }, [updateLoadedModelsStatus]);

    const isAnyModelLoaded = loadedModels.some(m => m.loaded);

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
                {/* Main container for both cache and VRAM controls, set to display row */}
                <div className="cache-info-block" style={{ flexDirection: 'row', gap: '20px', alignItems: 'stretch', width: 'auto' }}>
                    {/* Left Column for general cache management (now a self-contained component) */}
                    <CacheManager />
                    {/* Right Column for VRAM Management (model loading/unloading) */}
                    {isVramControlVisible && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '200px', paddingTop: '0px', alignItems: 'stretch' }}> {/* Removed alignItems: 'flex-end', added alignItems: 'stretch' or simply remove it as stretch is default for flex-direction column*/}
                            <div id="loadedModelsList" style={{ marginBottom: '5px', maxHeight: '80px', overflowY: 'auto', width: '100%' }}>
                                {loadedModels.map(model => (
                                    <label key={model.name} className="cache-line" style={{
                                        fontSize: '0.85rem',
                                        justifyContent: 'flex-start',
                                        padding: '0', // Zero out all padding on the label
                                        margin: '0', // Zero out all margin on the label
                                        width: '100%', // Ensure it takes full width of its parent flex container
                                        boxSizing: 'border-box' // Include padding/border in element's total width
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedModelsToClear.has(model.name)}
                                            onChange={() => handleModelSelectionChange(model.name)}
                                            disabled={!model.loaded}
                                            style={{ margin: '0', flexShrink: 0 }} // Zero out all margin, and ensure it doesn't shrink
                                        />
                                        <span className="cache-label-text" style={{ marginLeft: '8px' }}>{model.name}</span> {/* Apply gap manually here for spacing */}
                                        <span style={{ color: model.loaded ? '#86e58b' : '#ff7a7a', fontWeight: 'bold', minWidth: '65px', textAlign: 'right', marginLeft: 'auto' }}>
                                            {model.loaded ? 'Loaded' : 'Unloaded'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <button
                                    style={{ padding: '6px 10px', fontSize: '0.85rem', backgroundColor: '#f0e68c', color: '#333', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                                    disabled={selectedModelsToClear.size === 0}
                                    onClick={() => handleClearModels(Array.from(selectedModelsToClear))}
                                >
                                    Clear Selected
                                </button>
                                {/* Changed to a blue tone */}
                                <button
                                    style={{ padding: '6px 10px', fontSize: '0.85rem', backgroundColor: '#61dafb', color: '#20232a', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                                    disabled={!isAnyModelLoaded}
                                    onClick={() => handleClearModels([])}
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>
                    )}
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
                        <button id="startButton" ref={startButtonRef}>Start Webcam</button>
                        <button id="stopButton" ref={stopButtonRef} disabled>Stop Webcam</button>
                        <p id="status" ref={statusSpanRef}>Idle. Press Start to begin.</p>
                    </div>
                    <div className="video-feeds-container">
                        <div className="video-box">
                            <div className="video-header" style={{ justifyContent: 'center' }}><h3>Original Webcam</h3></div>
                            <video id="webcam" ref={webcamVideoRef} className="video" autoPlay playsInline muted></video>
                        </div>
                        <div className="video-box">
                            <div className="video-header" style={{ justifyContent: 'center' }}><h3>Enhanced Stream</h3></div>
                            <img id="processedImage" ref={processedImageRef} className="image-display" alt="Processed stream from backend" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LiveStreamPage;
