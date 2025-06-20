/* uformer-fastapi-hub/frontend/src/pages/video-processor.js */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import config from '../config';

const VideoProcessorPage = () => {
    // --- Refs for DOM Elements & Non-State Data ---
    const videoUploadInputRef = useRef(null);
    const uploadAreaRef = useRef(null);
    const originalVideoRef = useRef(null);
    const taskSelectRef = useRef(null);
    const modelSelectRef = useRef(null);
    const selectedVideoFile = useRef(null);
    const pollIntervalRef = useRef(null);
    const heartbeatIntervalRef = useRef(null);

    // --- React State for UI Control ---
    const [statusText, setStatusText] = useState("Please select a video file. Supports: mp4, mov, avi, mkv, webm.");
    const [isProcessing, setIsProcessing] = useState(false);
    const [originalVideoSrc, setOriginalVideoSrc] = useState(null);
    const [processedVideoSrc, setProcessedVideoSrc] = useState(null);
    const [taskId, setTaskId] = useState(null);
    const [isDownloaded, setIsDownloaded] = useState(false);
    const [modalState, setModalState] = useState({ isOpen: false, content: '' });
    const [finalDownloadFilename, setFinalDownloadFilename] = useState('');

    // --- Polling and Cleanup Logic ---
    const cleanupPolling = () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        pollIntervalRef.current = null;
        heartbeatIntervalRef.current = null;
    };

    const resetUI = () => {
        setOriginalVideoSrc(null);
        setProcessedVideoSrc(null);
        setIsProcessing(false);
        setTaskId(null);
        setIsDownloaded(false);
        setFinalDownloadFilename('');
        selectedVideoFile.current = null;
        if (uploadAreaRef.current) uploadAreaRef.current.style.borderColor = '#ccc';
        setStatusText("Please select a video file. Supports: mp4, mov, avi, mkv, webm.");
        cleanupPolling();
    };

    const pollTaskStatus = useCallback(async (currentTaskId) => {
        try {
            const response = await fetch(`${config.API_BASE_URL}/api/video_status/${currentTaskId}`);
            if (!response.ok) throw new Error(`Server returned status ${response.status}`);
            const data = await response.json();

            // Update status text with progress if available
            let currentStatus = data.message || `Status: ${data.status}...`;
            if (data.status === 'processing' && data.progress > 0) {
                currentStatus = `Processing... ${data.progress}%`;
            }
            setStatusText(currentStatus);

            if (data.status === 'completed') {
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;

                setIsProcessing(false);
                setStatusText('Processing complete! Ready to download.');
                setProcessedVideoSrc(`${config.API_BASE_URL}${data.result_path}`);
                
                const sendHeartbeat = async (taskIdForHeartbeat) => {
                    try {
                        await fetch(`${config.API_BASE_URL}/api/task_heartbeat`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ task_id: taskIdForHeartbeat })
                        });
                    } catch (err) {
                        console.error("Heartbeat failed:", err);
                        cleanupPolling();
                    }
                };
                sendHeartbeat(currentTaskId);
                heartbeatIntervalRef.current = setInterval(() => sendHeartbeat(currentTaskId), config.HEARTBEAT_POLL_INTERVAL_MS);

            } else if (data.status === 'failed') {
                cleanupPolling();
                setIsProcessing(false);
                setStatusText(`Error: Processing failed. Reason: ${data.error}`);
            }
        } catch (error) {
            cleanupPolling();
            setIsProcessing(false);
            setStatusText(`Error: Could not get task status. ${error.message}`);
        }
    }, []);

    // --- Event Handlers ---
    const handleStartProcessing = async () => {
        if (!selectedVideoFile.current) {
            setStatusText("Error: No video selected.");
            return;
        }

        setIsDownloaded(false);
        setIsProcessing(true);
        setStatusText("Uploading and starting task...");
        setProcessedVideoSrc(null);

        const formData = new FormData();
        formData.append("video_file", selectedVideoFile.current);
        formData.append("task_type", taskSelectRef.current.value);
        formData.append("model_name", modelSelectRef.current.value);

        window.dispatchEvent(new CustomEvent('forceHeaderUpdate'));

        try {
            const response = await fetch(`${config.API_BASE_URL}/api/process_video`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.detail || 'Failed to start task.');

            const taskType = taskSelectRef.current.value;
            const modelName = modelSelectRef.current.value;
            const originalFileName = selectedVideoFile.current?.name || 'video.mp4';
            setFinalDownloadFilename(`enhanced_${taskType}_${modelName}_${originalFileName.replace(/\s+/g, '_')}`);
            
            const newTaskId = result.task_id;
            setTaskId(newTaskId);
            setStatusText("Task started. Waiting for progress...");

            cleanupPolling();
            pollIntervalRef.current = setInterval(() => pollTaskStatus(newTaskId), config.VIDEO_STATUS_POLL_INTERVAL_MS);

        } catch (error) {
            setIsProcessing(false);
            setStatusText(`Error: ${error.message}. Is the backend running?`);
        }
    };

    const handleVideoFileSelect = useCallback((file) => {
        if (!file || !file.type.startsWith('video/')) {
             setStatusText("Please select a valid video file.");
             return;
        }
        resetUI();
        selectedVideoFile.current = file;
        const videoURL = URL.createObjectURL(file);
        setOriginalVideoSrc(videoURL);
        setStatusText(`Selected: "${file.name}". Ready to process.`);
    }, []);
    
    const handleDownload = async (e) => {
        e.preventDefault();
        if (!processedVideoSrc) return;

        try {
            const originalStatus = statusText;
            setStatusText("Preparing download...");
            
            const response = await fetch(processedVideoSrc);
            if (!response.ok) throw new Error(`Failed to fetch video. Status: ${response.status}`);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', finalDownloadFilename);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            cleanupPolling();
            const relativePath = new URL(processedVideoSrc).pathname;
            await fetch(`${config.API_BASE_URL}/api/confirm_download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ result_path: relativePath })
            });
            setIsDownloaded(true);
            setStatusText("Download initiated successfully.");

        } catch (error) {
            console.error("Download failed:", error);
            setModalState({ 
                isOpen: true, 
                title: 'Download Error', 
                status: 'error',
                content: `Download failed: ${error.message}. The file may have been cleared from the server cache.`
            });
            setStatusText(`Error: Download failed.`);
        }
    };

    // --- Setup Effect (runs once) ---
    useEffect(() => {
        const uploadArea = uploadAreaRef.current;
        const taskSelect = taskSelectRef.current;
        const modelSelect = modelSelectRef.current;
        
        const preventDefaults = (e) => { e.preventDefault(); e.stopPropagation(); };
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
        });
        uploadArea.addEventListener('dragover', () => uploadArea.style.borderColor = '#61dafb');
        uploadArea.addEventListener('dragleave', () => uploadArea.style.borderColor = '#ccc');
        uploadArea.addEventListener('drop', (e) => {
            uploadArea.style.borderColor = '#ccc';
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleVideoFileSelect(e.dataTransfer.files[0]);
            }
        });
        
        const modelsByTask = {
            denoise: [ { value: 'denoise_b', text: 'Uformer-B (High Quality)' }, { value: 'denoise_16', text: 'Uformer-16 (Fast)' } ],
            deblur: [ { value: 'deblur_b', text: 'Uformer-B (Deblur)' } ]
        };

        function populateModelSelect(taskType) {
            modelSelect.innerHTML = '';
            modelsByTask[taskType].forEach(model => {
                const option = document.createElement('option');
                option.value = model.value;
                option.textContent = model.text;
                if (taskType === 'denoise' && model.value === 'denoise_16') option.selected = true;
                modelSelect.appendChild(option);
            });
        }
        
        taskSelect.addEventListener('change', () => populateModelSelect(taskSelect.value));
        populateModelSelect(taskSelect.value);

        // This effect will run ONLY when originalVideoSrc changes.
        // It directly manipulates the video element's src, which is a stable way
        // to handle media elements in React and avoid the AbortError.
        if (originalVideoRef.current) {
            originalVideoRef.current.src = originalVideoSrc;
        }

        return () => cleanupPolling();
    }, [handleVideoFileSelect, originalVideoSrc]); // Add originalVideoSrc as a dependency
    
    const headerProps = {
        activePage: "video",
        pageTitle: "Video File Enhancement",
        defaultClearImages: false,
        defaultClearVideos: true
    };
    
    const closeModal = () => setModalState({ isOpen: false, content: '' });

    return (
        <Layout headerProps={headerProps}>
            <Modal isOpen={modalState.isOpen} onClose={closeModal} title={modalState.title} status={modalState.status} confirmText="OK" showCancel={false}>
                {modalState.content}
            </Modal>
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
                    <select id="modelSelect" ref={modelSelectRef} style={{ padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #61dafb', backgroundColor: '#4a4f5a', color: 'white' }}></select>
                </div>
                <div className="control-group">
                    <p style={{ fontSize: '0.9rem', color: '#ccc' }}>Note: Video processing always uses a high-quality pipeline for maximum detail.</p>
                </div>
            </div>
            <div className="main-content">
                <div className="actions-bar">
                    <button id="startProcessingBtn" onClick={handleStartProcessing} disabled={!originalVideoSrc || isProcessing}>
                        {isProcessing ? 'Processing...' : 'Start Processing'}
                    </button>
                    {/* A stop/cancel button can be added here in the future */}
                    <p id="status" className={statusText.toLowerCase().includes('error') ? 'error' : ''}>{statusText}</p>
                </div>
                <div className="video-feeds-container">
                    <div className="video-box">
                        <div className="video-header">
                            <h3>Original Video</h3>
                            <input type="file" id="videoUpload" ref={videoUploadInputRef} onChange={(e) => handleVideoFileSelect(e.target.files[0])} accept="video/mp4,video/mov,video/avi,video/mkv,video/webm" style={{ display: 'none' }} />
                            <button id="selectVideoBtn" onClick={() => videoUploadInputRef.current.click()}>Select New Video</button>
                        </div>
                        <div className="video-player-wrapper">
                            <div id="upload-area" ref={uploadAreaRef} className={`upload-area ${originalVideoSrc ? 'hidden' : ''}`} onClick={() => videoUploadInputRef.current.click()}>
                                <p>Drag & Drop a video file here or click this area</p>
                                <p style={{ fontSize: '0.8rem', color: '#ccc' }}>(Supports: MP4, MOV, etc.)</p>
                            </div>
                            {/* We remove the src attribute from here to control it directly via useEffect */}
                            <video id="originalVideo" ref={originalVideoRef} controls className={`image-display ${!originalVideoSrc ? 'hidden' : ''}`}></video>
                        </div>
                    </div>
                    <div className="video-box">
                        <div className="video-header">
                            <h3 style={{ color: '#f0e68c' }}>Enhanced Video</h3>
                            <button 
                                id="downloadBtn" 
                                onClick={handleDownload} 
                                disabled={isDownloaded || !processedVideoSrc} 
                                className={!processedVideoSrc ? 'hidden' : ''} 
                                style={isDownloaded 
                                    ? { backgroundColor: '#2e8b57', color: 'white', cursor: 'default', borderColor: '#2e8b57' } 
                                    : { backgroundColor: '#f0e68c', color: '#333', borderColor: '#d8c973', fontWeight: 500 }
                                }
                            >
                                {isDownloaded ? 'Downloaded' : 'Download'}
                            </button>
                        </div>
                        <div className="video-player-wrapper">
                            <video id="processedVideo" src={processedVideoSrc} controls className={`image-display ${!processedVideoSrc ? 'hidden' : ''}`}></video>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default VideoProcessorPage;
