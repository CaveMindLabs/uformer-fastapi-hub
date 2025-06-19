/* frontend/src/pages/image-processor.js */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/Layout'; // Import the Layout component

const ImageProcessorPage = () => {
    // --- Refs for DOM Elements & Non-State Data ---
    const imageUploadInputRef = useRef(null);
    const uploadAreaRef = useRef(null);
    const originalImageRef = useRef(null);
    const processedImageRef = useRef(null);
    const taskSelectRef = useRef(null);
    const modelSelectRef = useRef(null);
    const patchCheckboxRef = useRef(null);
    const selectedImageFile = useRef(null); // The raw file object
    const pollIntervalRef = useRef(null); // To store the polling interval ID

    // --- React State for UI Control ---
    const [statusText, setStatusText] = useState("Please select an image file. Supports: jpeg, png, gif, webp, .arw, .nef, .cr2, .dng.");
    const [isProcessing, setIsProcessing] = useState(false);
    const [originalImageSrc, setOriginalImageSrc] = useState(null);
    const [processedImageSrc, setProcessedImageSrc] = useState(null);
    const [taskId, setTaskId] = useState(null);

    const cleanupPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    };

    const resetUI = () => {
        setOriginalImageSrc(null);
        setProcessedImageSrc(null);
        setIsProcessing(false);
        setTaskId(null);
        selectedImageFile.current = null;
        if (uploadAreaRef.current) uploadAreaRef.current.style.borderColor = '#ccc';
        setStatusText("Please select an image file. Supports: jpeg, png, gif, webp, .arw, .nef, .cr2, .dng.");
        cleanupPolling();
    };

    const pollTaskStatus = useCallback(async (currentTaskId) => {
        try {
            const response = await fetch(`http://127.0.0.1:8000/api/image_status/${currentTaskId}`);
            if (!response.ok) {
                throw new Error(`Server returned status ${response.status}`);
            }
            const data = await response.json();

            switch (data.status) {
                case 'completed':
                    cleanupPolling();
                    setIsProcessing(false);
                    setStatusText('Processing complete!');
                    // Prepend the backend server URL to the relative path
                    setProcessedImageSrc(`http://127.0.0.1:8000${data.result_path}`);
                    break;
                case 'failed':
                    cleanupPolling();
                    setIsProcessing(false);
                    setStatusText(`Error: ${data.error || 'Processing failed.'}`);
                    break;
                case 'processing':
                    setStatusText(`Processing... ${data.progress || 0}%`);
                    break;
                case 'pending':
                default:
                    setStatusText(data.message || 'Task is pending...');
                    break;
            }
        } catch (error) {
            cleanupPolling();
            setIsProcessing(false);
            setStatusText(`Error: Could not get task status. ${error.message}`);
        }
    }, []);

    const handleDownload = async (e) => {
        e.preventDefault(); // Stop the browser from navigating to the link
        if (!processedImageSrc) return;

        try {
            const originalStatus = statusText;
            setStatusText("Preparing download...");
            
            // Fetch the image from the cross-origin URL
            const response = await fetch(processedImageSrc);
            if (!response.ok) {
                throw new Error(`Failed to fetch image. Status: ${response.status}`);
            }
            const blob = await response.blob();
            
            // Create a temporary link to trigger the download
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const fileName = `enhanced_${selectedImageFile.current?.name || 'image.jpg'}`;
            link.setAttribute('download', fileName);
            
            // Append to body, click, and remove
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            setStatusText(originalStatus); // Restore the status text
        } catch (error) {
            console.error("Download failed:", error);
            setStatusText(`Error: Download failed. ${error.message}`);
        }
    };

    const handleProcessImage = async () => {
        if (!selectedImageFile.current) {
            setStatusText("Error: No image selected.");
            return;
        }

        setIsProcessing(true);
        setStatusText("Uploading and starting task...");
        setProcessedImageSrc(null); // Clear previous result

        const formData = new FormData();
        formData.append("image_file", selectedImageFile.current);
        formData.append("task_type", taskSelectRef.current.value);
        formData.append("model_name", modelSelectRef.current.value);
        formData.append("use_patch_processing", patchCheckboxRef.current.checked);
        
        // This non-blocking call ensures the Header can update immediately.
        window.dispatchEvent(new CustomEvent('forceHeaderUpdate'));

        try {
            const response = await fetch('http://127.0.0.1:8000/api/process_image', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.detail || 'Failed to start processing task.');
            }
            
            const newTaskId = result.task_id;
            setTaskId(newTaskId);
            setStatusText("Task started. Waiting for progress...");

            // Start polling
            cleanupPolling(); // Ensure no old pollers are running
            pollIntervalRef.current = setInterval(() => pollTaskStatus(newTaskId), 2000);

        } catch (error) {
            setIsProcessing(false);
            setStatusText(`Error: ${error.message}. Is the backend running?`);
        }
    };
    
    const handleImageFileSelect = useCallback(async (file) => {
        if (!file) return;
        
        resetUI(); // Reset everything for the new file
        selectedImageFile.current = file;

        setStatusText(`Loading preview for "${file.name}"...`);

        try {
            let previewUrl;
            // Generate a server-side preview for RAW files
            const formData = new FormData();
            formData.append("image_file", file);
            const response = await fetch('http://127.0.0.1:8000/api/generate_preview', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Server could not generate preview.');
            const blob = await response.blob();
            previewUrl = URL.createObjectURL(blob);

            setOriginalImageSrc(previewUrl);
            setStatusText(`Selected: "${file.name}". Ready to process.`);
        } catch (error) {
            setStatusText(`Error: Could not load preview for "${file.name}".`);
            setOriginalImageSrc(null);
        }
    }, []);


    // --- Setup Effect (runs once) ---
    useEffect(() => {
        const uploadArea = uploadAreaRef.current;
        const taskSelect = taskSelectRef.current;
        const modelSelect = modelSelectRef.current;
        
        // Drag and Drop listeners
        const preventDefaults = (e) => { e.preventDefault(); e.stopPropagation(); };
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
        });
        uploadArea.addEventListener('dragover', () => uploadArea.style.borderColor = '#61dafb');
        uploadArea.addEventListener('dragleave', () => uploadArea.style.borderColor = '#ccc');
        uploadArea.addEventListener('drop', (e) => {
            uploadArea.style.borderColor = '#ccc';
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleImageFileSelect(e.dataTransfer.files[0]);
            }
        });
        
        // Model select population logic
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

        // Pan and Zoom setup
        [originalImageRef.current, processedImageRef.current].forEach(img => {
            if (!img) return;
            let scale = 1, panning = false, pointX = 0, pointY = 0, startX = 0, startY = 0;
            const container = img.parentElement;
            const resetTransform = () => { scale = 1; pointX = 0; pointY = 0; img.style.transform = `translate(0px, 0px) scale(1)`; };
            const applyTransform = () => { img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`; };
            img.addEventListener('dblclick', resetTransform);
            container.addEventListener('wheel', e => { e.preventDefault(); if (!img.src) return; const rect = img.getBoundingClientRect(); const x = (e.clientX - rect.left) / scale; const y = (e.clientY - rect.top) / scale; const delta = e.deltaY > 0 ? 0.9 : 1.1; const newScale = Math.max(1, scale * delta); pointX += (x - x / (newScale / scale)) * newScale; pointY += (y - y / (newScale / scale)) * newScale; scale = newScale; applyTransform(); });
            img.addEventListener('mousedown', e => { e.preventDefault(); if (!img.src) return; panning = true; img.classList.add('panning'); startX = e.clientX - pointX; startY = e.clientY - pointY; });
            window.addEventListener('mouseup', () => { panning = false; img.classList.remove('panning'); });
            window.addEventListener('mousemove', e => { if (!panning) return; e.preventDefault(); pointX = e.clientX - startX; pointY = e.clientY - startY; applyTransform(); });
            new MutationObserver(resetTransform).observe(img, { attributeFilter: ['src'] });
        });

        // Cleanup polling on component unmount
        return () => cleanupPolling();
    }, [handleImageFileSelect]);

    const headerProps = {
        activePage: "image",
        pageTitle: "Image File Enhancement",
        defaultClearImages: true,
        defaultClearVideos: false
    };

    return (
        <Layout headerProps={headerProps}>
            <div className="sidebar">
                <h2>Image Controls</h2>
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
                    <label>
                        <input type="checkbox" id="patchCheckbox" ref={patchCheckboxRef} defaultChecked /> Use Patch Processing (High Quality)
                    </label>
                </div>
            </div>
            <div className="main-content">
                <div className="actions-bar">
                    <button id="processImageBtn" onClick={handleProcessImage} disabled={!originalImageSrc || isProcessing}>
                        {isProcessing ? 'Processing...' : 'Process Image'}
                    </button>
                    <p id="status" className={statusText.toLowerCase().includes('error') ? 'error' : ''}>{statusText}</p>
                </div>
                <div className="image-feeds-container">
                    <div className="image-box">
                        <div className="image-header">
                            <h3>Original Image</h3>
                            <input type="file" id="imageUpload" ref={imageUploadInputRef} onChange={(e) => handleImageFileSelect(e.target.files[0])} accept="image/jpeg,image/png,image/gif,image/webp,.arw,.nef,.cr2,.dng" style={{ display: 'none' }} />
                            <button id="selectImageBtn" onClick={() => imageUploadInputRef.current.click()}>Select New Image</button>
                        </div>
                        <div className="image-player-wrapper">
                            <div id="upload-area" ref={uploadAreaRef} className={`upload-area ${originalImageSrc ? 'hidden' : ''}`} onClick={() => imageUploadInputRef.current.click()}>
                                <p>Drag & Drop an image file here or click this area</p>
                                <p style={{ fontSize: '0.8rem', color: '#ccc' }}>(Supports: JPG, PNG, ARW, etc.)</p>
                            </div>
                            <img id="originalImage" ref={originalImageRef} src={originalImageSrc} className={`image-display ${!originalImageSrc ? 'hidden' : ''}`} alt="Original" />
                        </div>
                    </div>
                    <div className="image-box">
                        <div className="image-header">
                            <h3>Enhanced Image</h3>
                            <a id="downloadBtn" href={processedImageSrc || '#'} className={!processedImageSrc ? 'hidden' : ''} onClick={handleDownload}>Download</a>
                        </div>
                        <div className="image-player-wrapper">
                            <img id="processedImage" ref={processedImageRef} src={processedImageSrc} className={`image-display ${!processedImageSrc ? 'hidden' : ''}`} alt="Processed" />
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default ImageProcessorPage;
