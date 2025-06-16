/* frontend/src/pages/video-processor.js */
import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const VideoProcessorPage = () => {
    // --- Refs for DOM Elements ---
    const selectVideoBtnRef = useRef(null);
    const videoUploadInputRef = useRef(null);
    const uploadAreaRef = useRef(null);
    const originalVideoRef = useRef(null);
    const processedVideoRef = useRef(null);
    const startProcessingBtnRef = useRef(null);
    const stopProcessingBtnRef = useRef(null);
    const downloadBtnRef = useRef(null);
    const statusSpanRef = useRef(null);
    const taskSelectRef = useRef(null);
    const modelSelectRef = useRef(null);
    const clearCacheBtnRef = useRef(null);
    const clearImagesCheckRef = useRef(null);
    const clearVideosCheckRef = useRef(null);
    const imageCacheValueRef = useRef(null);
    const videoCacheValueRef = useRef(null);

    // --- State Variables ---
    let selectedVideoFile = null;
    let pollingInterval = null;

    useEffect(() => {
        // --- Get current elements from refs ---
        const selectVideoBtn = selectVideoBtnRef.current;
        const videoUploadInput = videoUploadInputRef.current;
        const uploadArea = uploadAreaRef.current;
        const originalVideo = originalVideoRef.current;
        const processedVideo = processedVideoRef.current;
        const startProcessingBtn = startProcessingBtnRef.current;
        const stopProcessingBtn = stopProcessingBtnRef.current;
        const downloadBtn = downloadBtnRef.current;
        const statusSpan = statusSpanRef.current;
        const taskSelect = taskSelectRef.current;
        const modelSelect = modelSelectRef.current;
        const clearCacheBtn = clearCacheBtnRef.current;
        const clearImagesCheck = clearImagesCheckRef.current;
        const clearVideosCheck = clearVideosCheckRef.current;
        const imageCacheValue = imageCacheValueRef.current;
        const videoCacheValue = videoCacheValueRef.current;

        // --- Event Listeners ---
        selectVideoBtn.onclick = () => videoUploadInput.click();
        videoUploadInput.onchange = (event) => handleVideoFile(event.target.files[0]);
        uploadArea.onclick = () => videoUploadInput.click();

        uploadArea.ondragover = (event) => { event.preventDefault(); uploadArea.style.borderColor = '#61dafb'; };
        uploadArea.ondragleave = (event) => { event.preventDefault(); uploadArea.style.borderColor = '#ccc'; };
        uploadArea.ondrop = (event) => {
            event.preventDefault();
            uploadArea.style.borderColor = '#ccc';
            if (event.dataTransfer.files && event.dataTransfer.files[0]) {
                handleVideoFile(event.dataTransfer.files[0]);
            }
        };

        const resetUI = () => {
            startProcessingBtn.disabled = selectedVideoFile ? false : true;
            stopProcessingBtn.disabled = true;
            selectVideoBtn.disabled = false;
            videoUploadInput.disabled = false;
        };

        function handleVideoFile(file) {
            if (file && file.type.startsWith('video/')) {
                if (pollingInterval) clearInterval(pollingInterval);
                selectedVideoFile = file;
                const videoURL = URL.createObjectURL(file);
                
                originalVideo.src = videoURL;
                originalVideo.classList.remove('hidden');
                uploadArea.classList.add('hidden');
                
                statusSpan.textContent = `Selected: "${file.name}". Ready to process.`;
                statusSpan.classList.remove('error');
                processedVideo.src = "";
                processedVideo.classList.add('hidden');
                downloadBtn.classList.add('hidden');
                resetUI();
            } else {
                selectedVideoFile = null;
                statusSpan.textContent = "Please select a valid video file.";
                statusSpan.classList.add('error');
                originalVideo.classList.add('hidden');
                uploadArea.classList.remove('hidden');
                resetUI();
            }
        }

        startProcessingBtn.onclick = async () => {
            if (!selectedVideoFile) {
                statusSpan.textContent = "Error: No video selected.";
                statusSpan.classList.add('error');
                return;
            }

            statusSpan.textContent = `Uploading "${selectedVideoFile.name}"...`;
            statusSpan.classList.remove('error');
            startProcessingBtn.disabled = true;
            stopProcessingBtn.disabled = false;
            selectVideoBtn.disabled = true;
            videoUploadInput.disabled = true;
            downloadBtn.classList.add('hidden');
            processedVideo.classList.add('hidden');

            const formData = new FormData();
            formData.append("video_file", selectedVideoFile);
            formData.append("task_type", taskSelect.value);
            formData.append("model_name", modelSelect.value);

            try {
                const response = await fetch('http://127.0.0.1:8000/api/process_video', { 
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ detail: 'Server returned an unreadable error.' }));
                    throw new Error(errorData.detail || `Server responded with status ${response.status}`);
                }
                
                const result = await response.json();
                statusSpan.textContent = `Processing started. Waiting for updates...`;
                pollStatus(result.task_id);

            } catch (error) {
                statusSpan.classList.add('error');
                statusSpan.textContent = `Error: ${error.message}. Is the backend running?`;
                resetUI();
            }
        };

        stopProcessingBtn.onclick = () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
            statusSpan.textContent = "Processing stopped by user.";
            statusSpan.classList.remove('error');
            resetUI();
            console.log("Placeholder: A 'cancel' request should be sent to the backend.");
        };

        function pollStatus(taskId) {
            if (pollingInterval) clearInterval(pollingInterval);

            pollingInterval = setInterval(async () => {
                try {
                    const response = await fetch(`http://127.0.0.1:8000/api/video_status/${taskId}`);
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ detail: `Server responded with status ${response.status}` }));
                        throw new Error(errorData.detail);
                    }
                    const data = await response.json();

                    statusSpan.textContent = `Status: ${data.status}...`;

                    if (data.status === 'completed') {
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                        statusSpan.textContent = "Processing complete! Video is ready.";
                        
                        const downloadUrl = `http://127.0.0.1:8000/api/download_video?filepath=${encodeURIComponent(data.result_path)}`;
                        downloadBtn.href = downloadUrl;
                        processedVideo.src = downloadUrl;

                        processedVideo.classList.remove('hidden');
                        downloadBtn.classList.remove('hidden');

                        resetUI();
                        stopProcessingBtn.disabled = true;
                        updateCacheStatus();

                    } else if (data.status === 'failed') {
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                        statusSpan.textContent = `Error: Processing failed. Reason: ${data.error}`;
                        statusSpan.classList.add('error');
                        resetUI();
                    }
                } catch (error) {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                    statusSpan.textContent = `Error polling status: ${error.message}`;
                    statusSpan.classList.add('error');
                    resetUI();
                }
            }, 2000);
        }

        // --- Cache Management ---
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

        // --- Initial Load Logic ---
        updateCacheStatus();
        toggleClearButtonState();
        populateModelSelect(taskSelect.value);

        return () => {
            // Cleanup: clear interval when the component unmounts
            if (pollingInterval) clearInterval(pollingInterval);
        };
    }, []);

    return (
        <>
            <Head>
                <title>NocturaVision - Video File Processor</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <header>
                 <div className="nav-bar">
                    <Link href="/" className="nav-button">Live Stream</Link>
                    <Link href="/video-processor" className="nav-button active">Video File</Link>
                    <Link href="/image-processor" className="nav-button">Image File</Link>
                </div>
                <div className="title-block">
                    <h1>🦉 NocturaVision <span style={{ fontWeight: 300, color: '#ccc' }}>| Uformer</span></h1>
                    <p>Video File Enhancement</p>
                </div>
                <div className="cache-info-block">
                    <label className="cache-line">
                        <input type="checkbox" id="clearImagesCheck" ref={clearImagesCheckRef} defaultChecked={false} />
                        <span className="cache-label-text">Image Cache:</span>
                        <span className="cache-value" id="imageCacheValue" ref={imageCacheValueRef}>... MB</span>
                    </label>
                    <label className="cache-line">
                        <input type="checkbox" id="clearVideosCheck" ref={clearVideosCheckRef} defaultChecked />
                        <span className="cache-label-text">Video Cache:</span>
                        <span className="cache-value" id="videoCacheValue" ref={videoCacheValueRef}>... MB</span>
                    </label>
                    <button id="clearCacheBtn" ref={clearCacheBtnRef}>Clear Selected</button>
                </div>
            </header>
            <div className="page-content">
                <div className="sidebar">
                    <h2>Video Controls</h2>
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
                            {/* Options populated by script */}
                        </select>
                    </div>
                    <div className="control-group">
                        <p style={{ fontSize: '0.9rem', color: '#ccc' }}>Note: Video file processing always uses the high-quality, patch-based pipeline for maximum detail.</p>
                    </div>
                </div>
                <div className="main-content">
                    <div className="actions-bar">
                        <button id="startProcessingBtn" ref={startProcessingBtnRef} disabled>Start Processing</button>
                        <button id="stopProcessingBtn" ref={stopProcessingBtnRef} disabled>Stop Processing</button>
                        <p id="status" ref={statusSpanRef}>Please select a video file. Supports: mp4, mov, avi, mkv, webm.</p>
                    </div>
                    <div className="video-feeds-container">
                        <div className="video-box">
                            <div className="video-header">
                                <h3>Original Video</h3>
                                <input type="file" id="videoUpload" ref={videoUploadInputRef} accept="video/mp4,video/mov,video/avi,video/mkv,video/webm" style={{ display: 'none' }} />
                                <button id="selectVideoBtn" ref={selectVideoBtnRef}>Select Video</button>
                            </div>
                            <div id="original-player-wrapper" className="video-player-wrapper">
                                <div id="upload-area" ref={uploadAreaRef} className="upload-area">
                                    <p>Drag & Drop a video file here or click this area</p>
                                    <p style={{ fontSize: '0.8rem', color: '#ccc' }}>(Supports: MP4, MOV, etc.)</p>
                                </div>
                                <video id="originalVideo" ref={originalVideoRef} controls className="video hidden"></video>
                            </div>
                        </div>
                        <div className="video-box">
                            <div className="video-header">
                                <h3>Enhanced Video</h3>
                                <a id="downloadBtn" ref={downloadBtnRef} href="#" className="hidden">Download</a>
                            </div>
                            <div id="processed-player-wrapper" className="video-player-wrapper">
                                <video id="processedVideo" ref={processedVideoRef} controls className="video hidden"></video>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default VideoProcessorPage;
