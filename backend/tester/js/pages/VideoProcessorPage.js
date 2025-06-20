/* backend/tester/js/pages/VideoProcessorPage.js */
import config from '../config.js';
import { showModal } from '../components/Modal.js';

const VideoProcessorPage = {
    title: "Video File Enhancement",
    defaultClearImages: false,
    defaultClearVideos: true,

    getHtml: () => `
        <div class="sidebar">
            <h2>Video Controls</h2>
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
            <div class="control-group">
                <p style="font-size: 0.9rem; color: #ccc;">Note: Video processing always uses a high-quality pipeline for maximum detail.</p>
            </div>
        </div>
        <div class="main-content">
            <div class="actions-bar">
                <button id="startProcessingBtn" disabled>Start Processing</button>
                <p id="status">Please select a video file. Supports: mp4, mov, avi, mkv, webm.</p>
            </div>
            <div class="video-feeds-container">
                <div class="video-box">
                    <div class="video-header">
                        <h3>Original Video</h3>
                        <input type="file" id="videoUpload" accept="video/mp4,video/mov,video/avi,video/mkv,video/webm" style="display: none;" />
                        <button id="selectVideoBtn">Select New Video</button>
                    </div>
                    <div class="video-player-wrapper">
                        <div id="upload-area" class="upload-area">
                            <p>Drag & Drop a video file here or click this area</p>
                            <p style="font-size: 0.8rem; color: #ccc;">(Supports: MP4, MOV, etc.)</p>
                        </div>
                        <video id="originalVideo" controls class="video hidden"></video>
                    </div>
                </div>
                <div class="video-box">
                    <div class="video-header">
                        <h3 style="color: #f0e68c;">Enhanced Video</h3>
                        <button id="downloadBtn" class="hidden" style="background-color: #f0e68c; color: #333; border-color: #d8c973; font-weight: 500;">Download</button>
                    </div>
                    <div class="video-player-wrapper">
                        <video id="processedVideo" controls class="video hidden"></video>
                    </div>
                </div>
            </div>
        </div>
    `,

    init: () => {
        // --- Elements ---
        const videoUploadInput = document.getElementById('videoUpload');
        const uploadArea = document.getElementById('upload-area');
        const originalVideo = document.getElementById('originalVideo');
        const processedVideo = document.getElementById('processedVideo');
        const taskSelect = document.getElementById('taskSelect');
        const modelSelect = document.getElementById('modelSelect');
        const statusEl = document.getElementById('status');
        const startProcessingBtn = document.getElementById('startProcessingBtn');
        const selectVideoBtn = document.getElementById('selectVideoBtn');
        const downloadBtn = document.getElementById('downloadBtn');

        // --- State ---
        let selectedVideoFile = null;
        let pollInterval = null;
        let heartbeatInterval = null;
        let processedVideoSrc = null;
        let finalDownloadFilename = '';
        let isDownloaded = false;

        const cleanupPolling = () => {
            if (pollInterval) clearInterval(pollInterval);
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            pollInterval = null; heartbeatInterval = null;
        };

        const resetUI = () => {
            originalVideo.src = '';
            originalVideo.classList.add('hidden');
            processedVideo.src = '';
            processedVideo.classList.add('hidden');
            uploadArea.classList.remove('hidden');
            uploadArea.style.borderColor = '#ccc';
            startProcessingBtn.disabled = true;
            startProcessingBtn.textContent = 'Start Processing';
            downloadBtn.classList.add('hidden');
            isDownloaded = false;
            finalDownloadFilename = '';
            processedVideoSrc = null;
            selectedVideoFile = null;
            statusEl.textContent = "Please select a video file. Supports: mp4, mov, avi, mkv, webm.";
            statusEl.classList.remove('error');
            cleanupPolling();
        };

        const pollTaskStatus = async (currentTaskId) => {
            try {
                const response = await fetch(`${config.API_BASE_URL}/api/video_status/${currentTaskId}`);
                if (!response.ok) throw new Error(`Server returned status ${response.status}`);
                const data = await response.json();

                let currentStatus = data.message || `Status: ${data.status}...`;
                if (data.status === 'processing' && data.progress > 0) {
                    currentStatus = `Processing... ${data.progress}%`;
                }
                statusEl.textContent = currentStatus;

                if (data.status === 'completed') {
                    if (pollInterval) clearInterval(pollInterval);
                    pollInterval = null;

                    startProcessingBtn.disabled = false;
                    startProcessingBtn.textContent = 'Start Processing';
                    statusEl.textContent = 'Processing complete! Ready to download.';
                    
                    processedVideoSrc = `${config.API_BASE_URL}${data.result_path}`;
                    processedVideo.src = processedVideoSrc;
                    processedVideo.classList.remove('hidden');
                    downloadBtn.classList.remove('hidden');
                    
                    const sendHeartbeat = async (taskId) => {
                        try {
                            await fetch(`${config.API_BASE_URL}/api/task_heartbeat`, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ task_id: taskId })
                            });
                        } catch (err) { cleanupPolling(); }
                    };
                    sendHeartbeat(currentTaskId);
                    heartbeatInterval = setInterval(() => sendHeartbeat(currentTaskId), config.HEARTBEAT_POLL_INTERVAL_MS);
                } else if (data.status === 'failed') {
                    cleanupPolling();
                    startProcessingBtn.disabled = false;
                    startProcessingBtn.textContent = 'Start Processing';
                    statusEl.textContent = `Error: Processing failed. Reason: ${data.error}`;
                    statusEl.classList.add('error');
                }
            } catch (error) {
                cleanupPolling();
                startProcessingBtn.disabled = false;
                startProcessingBtn.textContent = 'Start Processing';
                statusEl.textContent = `Error: Could not get task status. ${error.message}`;
                statusEl.classList.add('error');
            }
        };

        const handleDownload = async (e) => {
            e.preventDefault();
            if (!processedVideoSrc || isDownloaded) return;
            try {
                const response = await fetch(processedVideoSrc);
                if (!response.ok) throw new Error(`Failed to fetch. Status: ${response.status}`);
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
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ result_path: relativePath })
                });

                isDownloaded = true;
                downloadBtn.disabled = true;
                downloadBtn.textContent = 'Downloaded';
                downloadBtn.style.backgroundColor = '#2e8b57';
                downloadBtn.style.color = 'white';
                statusEl.textContent = "Download initiated successfully.";
            } catch (error) {
                showModal({
                    title: 'Download Error', status: 'error',
                    content: `Download failed: ${error.message}. The file may have been cleared from server cache.`,
                    showCancel: false, confirmText: 'OK'
                });
                statusEl.textContent = `Error: Download failed.`;
            }
        };

        const handleStartProcessing = async () => {
            if (!selectedVideoFile) {
                statusEl.textContent = "Error: No video selected.";
                return;
            }

            isDownloaded = false;
            downloadBtn.disabled = false;
            downloadBtn.textContent = 'Download';
            downloadBtn.style.backgroundColor = '#f0e68c';
            downloadBtn.style.color = '#333';

            startProcessingBtn.disabled = true;
            startProcessingBtn.textContent = 'Processing...';
            statusEl.textContent = "Uploading and starting task...";
            processedVideo.src = '';
            processedVideo.classList.add('hidden');

            const formData = new FormData();
            formData.append("video_file", selectedVideoFile);
            formData.append("task_type", taskSelect.value);
            formData.append("model_name", modelSelect.value);

            window.dispatchEvent(new CustomEvent('forceHeaderUpdate'));

            try {
                const response = await fetch(`${config.API_BASE_URL}/api/process_video`, {
                    method: 'POST', body: formData
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.detail || 'Failed to start task.');

                const originalFileName = selectedVideoFile?.name || 'video.mp4';
                finalDownloadFilename = `enhanced_${taskSelect.value}_${modelSelect.value}_${originalFileName.replace(/\s+/g, '_')}`;
                
                const newTaskId = result.task_id;
                statusEl.textContent = "Task started. Waiting for progress...";
                cleanupPolling();
                pollInterval = setInterval(() => pollTaskStatus(newTaskId), config.VIDEO_STATUS_POLL_INTERVAL_MS);
            } catch (error) {
                startProcessingBtn.disabled = false;
                startProcessingBtn.textContent = 'Start Processing';
                statusEl.textContent = `Error: ${error.message}. Is backend running?`;
                statusEl.classList.add('error');
            }
        };

        const handleVideoFileSelect = (file) => {
            if (!file || !file.type.startsWith('video/')) {
                statusEl.textContent = "Please select a valid video file.";
                return;
            }
            resetUI();
            selectedVideoFile = file;
            originalVideo.src = URL.createObjectURL(file);
            originalVideo.classList.remove('hidden');
            uploadArea.classList.add('hidden');
            statusEl.textContent = `Selected: "${file.name}". Ready to process.`;
            startProcessingBtn.disabled = false;
        };
        
        const modelsByTask = {
            denoise: [ { value: 'denoise_b', text: 'Uformer-B (High Quality)' }, { value: 'denoise_16', text: 'Uformer-16 (Fast)' } ],
            deblur: [ { value: 'deblur_b', text: 'Uformer-B (Deblur)' } ]
        };

        function populateModelSelect(taskType) {
            modelSelect.innerHTML = '';
            modelsByTask[taskType].forEach(model => {
                const option = document.createElement('option');
                option.value = model.value; option.textContent = model.text;
                if (taskType === 'denoise' && model.value === 'denoise_16') option.selected = true;
                modelSelect.appendChild(option);
            });
        }
        
        taskSelect.addEventListener('change', () => populateModelSelect(taskSelect.value));
        populateModelSelect(taskSelect.value);

        // --- Event Listeners Setup ---
        selectVideoBtn.addEventListener('click', () => videoUploadInput.click());
        videoUploadInput.addEventListener('change', (e) => handleVideoFileSelect(e.target.files[0]));
        uploadArea.addEventListener('click', () => videoUploadInput.click());
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); });
        });
        uploadArea.addEventListener('dragover', () => uploadArea.style.borderColor = '#61dafb');
        uploadArea.addEventListener('dragleave', () => uploadArea.style.borderColor = '#ccc');
        uploadArea.addEventListener('drop', (e) => {
            uploadArea.style.borderColor = '#ccc';
            if (e.dataTransfer.files[0]) handleVideoFileSelect(e.dataTransfer.files[0]);
        });
        startProcessingBtn.addEventListener('click', handleStartProcessing);
        downloadBtn.addEventListener('click', handleDownload);
    }
};

export default VideoProcessorPage;
