/* backend/tester/js/pages/ImageProcessorPage.js */
import config from '../config.js';
import { showModal } from '../components/Modal.js';

const ImageProcessorPage = {
    title: "Image File Enhancement",
    defaultClearImages: true,
    defaultClearVideos: false,

    getHtml: () => `
        <div class="sidebar">
            <h2>Image Controls</h2>
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
                <label>
                    <input type="checkbox" id="patchCheckbox" checked /> Use Patch Processing (High Quality)
                </label>
            </div>
        </div>
        <div class="main-content">
            <div class="actions-bar">
                <button id="processImageBtn" disabled>Process Image</button>
                <p id="status">Please select an image file. Supports: jpeg, png, gif, webp, .arw, .nef, .cr2, .dng.</p>
            </div>
            <div class="image-feeds-container">
                <div class="image-box">
                    <div class="image-header">
                        <h3>Original Image</h3>
                        <input type="file" id="imageUpload" accept="image/jpeg,image/png,image/gif,image/webp,.arw,.nef,.cr2,.dng" style="display: none;" />
                        <button id="selectImageBtn">Select New Image</button>
                    </div>
                    <div class="image-player-wrapper">
                        <div id="upload-area" class="upload-area">
                            <p>Drag & Drop an image file here or click this area</p>
                            <p style="font-size: 0.8rem; color: #ccc;">(Supports: JPG, PNG, ARW, etc.)</p>
                        </div>
                        <img id="originalImage" class="image-display hidden" alt="Original" />
                    </div>
                </div>
                <div class="image-box">
                    <div class="image-header">
                        <h3 style="color: #f0e68c">Enhanced Image</h3>
                        <button id="downloadBtn" class="hidden" style="background-color: #f0e68c; color: #333; border-color: #d8c973; font-weight: 500;">Download</button>
                    </div>
                    <div class="image-player-wrapper">
                        <img id="processedImage" class="image-display hidden" alt="Processed" />
                    </div>
                </div>
            </div>
        </div>
    `,

    init: () => {
        // --- Elements ---
        const imageUploadInput = document.getElementById('imageUpload');
        const uploadArea = document.getElementById('upload-area');
        const originalImage = document.getElementById('originalImage');
        const processedImage = document.getElementById('processedImage');
        const taskSelect = document.getElementById('taskSelect');
        const modelSelect = document.getElementById('modelSelect');
        const patchCheckbox = document.getElementById('patchCheckbox');
        const statusEl = document.getElementById('status');
        const processImageBtn = document.getElementById('processImageBtn');
        const selectImageBtn = document.getElementById('selectImageBtn');
        const downloadBtn = document.getElementById('downloadBtn');

        // --- State ---
        let selectedImageFile = null;
        let pollInterval = null;
        let heartbeatInterval = null;
        let processedImageSrc = null;
        let finalDownloadFilename = '';
        let isDownloaded = false;
        
        const cleanupPolling = () => {
            if (pollInterval) clearInterval(pollInterval);
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            pollInterval = null;
            heartbeatInterval = null;
        };

        const resetUI = () => {
            originalImage.src = '';
            originalImage.classList.add('hidden');
            processedImage.src = '';
            processedImage.classList.add('hidden');
            uploadArea.classList.remove('hidden');
            uploadArea.style.borderColor = '#ccc';
            processImageBtn.disabled = true;
            processImageBtn.textContent = 'Process Image';
            downloadBtn.classList.add('hidden');
            isDownloaded = false;
            finalDownloadFilename = '';
            processedImageSrc = null;
            selectedImageFile = null;
            statusEl.textContent = "Please select an image file. Supports: jpeg, png, gif, webp, .arw, .nef, .cr2, .dng.";
            statusEl.classList.remove('error');
            cleanupPolling();
        };

        const pollTaskStatus = async (currentTaskId) => {
            try {
                const response = await fetch(`${config.API_BASE_URL}/api/image_status/${currentTaskId}`);
                if (!response.ok) throw new Error(`Server returned status ${response.status}`);
                const data = await response.json();

                switch (data.status) {
                    case 'completed':
                        if (pollInterval) clearInterval(pollInterval);
                        pollInterval = null;
                        
                        processImageBtn.disabled = false;
                        processImageBtn.textContent = 'Process Image';
                        statusEl.textContent = 'Processing complete! Ready to download.';
                        
                        processedImageSrc = `${config.API_BASE_URL}${data.result_path}`;
                        processedImage.src = processedImageSrc;
                        processedImage.classList.remove('hidden');
                        downloadBtn.classList.remove('hidden');

                        const sendHeartbeat = async (taskIdForHeartbeat) => {
                            try {
                                await fetch(`${config.API_BASE_URL}/api/task_heartbeat`, {
                                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ task_id: taskIdForHeartbeat })
                                });
                            } catch (err) { cleanupPolling(); }
                        };
                        sendHeartbeat(currentTaskId);
                        heartbeatInterval = setInterval(() => sendHeartbeat(currentTaskId), config.HEARTBEAT_POLL_INTERVAL_MS);
                        break;
                    case 'failed':
                        cleanupPolling();
                        processImageBtn.disabled = false;
                        processImageBtn.textContent = 'Process Image';
                        statusEl.textContent = `Error: ${data.error || 'Processing failed.'}`;
                        statusEl.classList.add('error');
                        break;
                    case 'processing':
                        statusEl.textContent = `Processing... ${data.progress || 0}%`;
                        break;
                    default:
                        statusEl.textContent = data.message || 'Task is pending...';
                        break;
                }
            } catch (error) {
                cleanupPolling();
                processImageBtn.disabled = false;
                processImageBtn.textContent = 'Process Image';
                statusEl.textContent = `Error: Could not get task status. ${error.message}`;
                statusEl.classList.add('error');
            }
        };

        const handleDownload = async (e) => {
            e.preventDefault();
            if (!processedImageSrc || isDownloaded) return;

            try {
                const response = await fetch(processedImageSrc);
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
                const relativePath = new URL(processedImageSrc).pathname;
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

        const handleProcessImage = async () => {
            if (!selectedImageFile) {
                statusEl.textContent = "Error: No image selected.";
                return;
            }

            isDownloaded = false;
            downloadBtn.disabled = false;
            downloadBtn.textContent = 'Download';
            downloadBtn.style.backgroundColor = '#f0e68c';
            downloadBtn.style.color = '#333';
            
            processImageBtn.disabled = true;
            processImageBtn.textContent = 'Processing...';
            statusEl.textContent = "Uploading and starting task...";
            processedImage.src = '';
            processedImage.classList.add('hidden');

            const formData = new FormData();
            formData.append("image_file", selectedImageFile);
            formData.append("task_type", taskSelect.value);
            formData.append("model_name", modelSelect.value);
            formData.append("use_patch_processing", patchCheckbox.checked);
            
            window.dispatchEvent(new CustomEvent('forceHeaderUpdate'));

            try {
                const response = await fetch(`${config.API_BASE_URL}/api/process_image`, {
                    method: 'POST', body: formData
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.detail || 'Failed to start task.');

                const originalFileName = selectedImageFile?.name || 'image.jpg';
                finalDownloadFilename = `enhanced_${taskSelect.value}_${modelSelect.value}${patchCheckbox.checked ? '_patch' : ''}_${originalFileName.replace(/\s+/g, '_')}`;
                
                const newTaskId = result.task_id;
                statusEl.textContent = "Task started. Waiting for progress...";
                cleanupPolling();
                pollInterval = setInterval(() => pollTaskStatus(newTaskId), config.IMAGE_STATUS_POLL_INTERVAL_MS);

            } catch (error) {
                processImageBtn.disabled = false;
                processImageBtn.textContent = 'Process Image';
                statusEl.textContent = `Error: ${error.message}. Is backend running?`;
                statusEl.classList.add('error');
            }
        };
        
        const handleImageFileSelect = async (file) => {
            if (!file) return;
            resetUI();
            selectedImageFile = file;
            statusEl.textContent = `Loading preview for "${file.name}"...`;

            try {
                const formData = new FormData();
                formData.append("image_file", file);
                const response = await fetch(`${config.API_BASE_URL}/api/generate_preview`, {
                    method: 'POST', body: formData
                });
                if (!response.ok) throw new Error('Server could not generate preview.');
                const blob = await response.blob();
                originalImage.src = URL.createObjectURL(blob);
                originalImage.classList.remove('hidden');
                uploadArea.classList.add('hidden');
                statusEl.textContent = `Selected: "${file.name}". Ready to process.`;
                processImageBtn.disabled = false;
            } catch (error) {
                statusEl.textContent = `Error: Could not load preview for "${file.name}".`;
                statusEl.classList.add('error');
            }
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
        selectImageBtn.addEventListener('click', () => imageUploadInput.click());
        imageUploadInput.addEventListener('change', (e) => handleImageFileSelect(e.target.files[0]));
        uploadArea.addEventListener('click', () => imageUploadInput.click());
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); });
        });
        uploadArea.addEventListener('dragover', () => uploadArea.style.borderColor = '#61dafb');
        uploadArea.addEventListener('dragleave', () => uploadArea.style.borderColor = '#ccc');
        uploadArea.addEventListener('drop', (e) => {
            uploadArea.style.borderColor = '#ccc';
            if (e.dataTransfer.files[0]) handleImageFileSelect(e.dataTransfer.files[0]);
        });
        processImageBtn.addEventListener('click', handleProcessImage);
        downloadBtn.addEventListener('click', handleDownload);
    }
};

export default ImageProcessorPage;
