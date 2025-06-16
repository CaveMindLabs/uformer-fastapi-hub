/* frontend/src/pages/image-processor.js */
import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const ImageProcessorPage = () => {
    // --- Refs for DOM Elements ---
    const selectImageBtnRef = useRef(null);
    const imageUploadInputRef = useRef(null);
    const uploadAreaRef = useRef(null);
    const originalImageRef = useRef(null);
    const processedImageRef = useRef(null);
    const processImageBtnRef = useRef(null);
    const downloadBtnRef = useRef(null);
    const statusSpanRef = useRef(null);
    const taskSelectRef = useRef(null);
    const modelSelectRef = useRef(null);
    const patchCheckboxRef = useRef(null);
    const clearCacheBtnRef = useRef(null);
    const clearImagesCheckRef = useRef(null);
    const clearVideosCheckRef = useRef(null);
    const imageCacheValueRef = useRef(null);
    const videoCacheValueRef = useRef(null);

    // --- State for React ---
    // We use state to hold variables that, when changed, should cause React to re-render.
    // For now, most of our logic is directly manipulating the DOM via refs, like in the original HTML file.
    let selectedImageFile = null; // Using a let variable as it doesn't trigger re-renders in this logic

    // This useEffect hook runs once when the component mounts, similar to DOMContentLoaded.
    useEffect(() => {
        // --- Get current elements from refs ---
        const selectImageBtn = selectImageBtnRef.current;
        const imageUploadInput = imageUploadInputRef.current;
        const uploadArea = uploadAreaRef.current;
        const originalImage = originalImageRef.current;
        const processedImage = processedImageRef.current;
        const processImageBtn = processImageBtnRef.current;
        const downloadBtn = downloadBtnRef.current;
        const statusSpan = statusSpanRef.current;
        const taskSelect = taskSelectRef.current;
        const modelSelect = modelSelectRef.current;
        const patchCheckbox = patchCheckboxRef.current;
        const clearCacheBtn = clearCacheBtnRef.current;
        const clearImagesCheck = clearImagesCheckRef.current;
        const clearVideosCheck = clearVideosCheckRef.current;
        const imageCacheValue = imageCacheValueRef.current;
        const videoCacheValue = videoCacheValueRef.current;
        
        // --- Event Listeners ---
        selectImageBtn.onclick = () => imageUploadInput.click();
        imageUploadInput.onchange = (event) => handleImageFile(event.target.files[0]);
        uploadArea.onclick = () => imageUploadInput.click();
        
        uploadArea.ondragover = (event) => { event.preventDefault(); uploadArea.style.borderColor = '#61dafb'; };
        uploadArea.ondragleave = (event) => { event.preventDefault(); uploadArea.style.borderColor = '#ccc'; };
        uploadArea.ondrop = (event) => {
            event.preventDefault();
            uploadArea.style.borderColor = '#ccc';
            if (event.dataTransfer.files && event.dataTransfer.files[0]) {
                handleImageFile(event.dataTransfer.files[0]);
            }
        };
        
        processImageBtn.onclick = async () => {
            if (!selectedImageFile) {
                statusSpan.textContent = "Error: No image selected.";
                statusSpan.classList.add('error');
                return;
            }

            statusSpan.textContent = `Processing "${selectedImageFile.name}"...`;
            statusSpan.classList.remove('error');
            processImageBtn.disabled = true;
            downloadBtn.classList.add('hidden');
            processedImage.classList.add('hidden');

            const formData = new FormData();
            formData.append("image_file", selectedImageFile);
            formData.append("task_type", taskSelect.value);
            formData.append("model_name", modelSelect.value);
            formData.append("use_patch_processing", patchCheckbox.checked);

            try {
                const response = await fetch('http://127.0.0.1:8000/api/process_image', { 
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ detail: 'Server returned an unreadable error.' }));
                    throw new Error(errorData.detail || `Server responded with status ${response.status}`);
                }
                
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);

                processedImage.src = imageUrl;
                processedImage.classList.remove('hidden');
                downloadBtn.href = imageUrl;
                
                const taskType = taskSelect.value;
                downloadBtn.download = `enhanced_${taskType}_${selectedImageFile.name}`;
                downloadBtn.classList.remove('hidden');

                await updateCacheStatus();
                statusSpan.textContent = "Image processing complete!";

            } catch (error) {
                statusSpan.classList.add('error');
                statusSpan.textContent = `Error: ${error.message}. Is the backend running?`;
            } finally {
                processImageBtn.disabled = false;
            }
        };

        // --- Helper Functions ---
        async function handleImageFile(file) {
            if (!file) return;

            selectedImageFile = file;
            const isRaw = file.name.toLowerCase().endsWith('.arw') || file.name.toLowerCase().endsWith('.nef') || file.name.toLowerCase().endsWith('.cr2') || file.name.toLowerCase().endsWith('.dng');

            originalImage.classList.remove('hidden');
            uploadArea.classList.add('hidden');
            statusSpan.textContent = `Loading preview for "${file.name}"...`;
            statusSpan.classList.remove('error');
            originalImage.src = "";

            try {
                let previewUrl;
                if (isRaw) {
                    const formData = new FormData();
                    formData.append("image_file", file);
                    const response = await fetch('http://127.0.0.1:8000/api/generate_preview', {
                        method: 'POST',
                        body: formData
                    });
                    if (!response.ok) throw new Error('Server could not generate preview.');
                    const blob = await response.blob();
                    previewUrl = URL.createObjectURL(blob);
                } else {
                    previewUrl = URL.createObjectURL(file);
                }
                originalImage.src = previewUrl;
                statusSpan.textContent = `Selected: "${file.name}". Ready to process.`;
                processImageBtn.disabled = false;

            } catch (error) {
                console.error("Preview Error:", error);
                statusSpan.textContent = `Error: Could not load preview for "${file.name}".`;
                statusSpan.classList.add('error');
                originalImage.classList.add('hidden');
                uploadArea.classList.remove('hidden');
                processImageBtn.disabled = true;
            }

            processedImage.src = "";
            processedImage.classList.add('hidden');
            downloadBtn.classList.add('hidden');
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
        
        // --- In-Place Pan and Zoom Logic ---
        function setupPanAndZoom() {
            const images = [originalImage, processedImage];
            images.forEach(img => {
                let scale = 1, panning = false, pointX = 0, pointY = 0, startX = 0, startY = 0;
                const resetTransform = () => {
                    scale = 1; pointX = 0; pointY = 0;
                    img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
                    img.style.transformOrigin = `0 0`;
                };
                const applyTransform = () => {
                    img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
                };
                img.addEventListener('dblclick', resetTransform);
                img.parentElement.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    if (img.classList.contains('hidden')) return;
                    const rect = img.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / scale;
                    const y = (e.clientY - rect.top) / scale;
                    const delta = e.deltaY > 0 ? 0.9 : 1.1;
                    const newScale = Math.max(1, scale * delta);
                    pointX += (x - x / (newScale / scale)) * newScale;
                    pointY += (y - y / (newScale / scale)) * newScale;
                    scale = newScale;
                    applyTransform();
                });
                img.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    if (img.classList.contains('hidden')) return;
                    panning = true;
                    img.classList.add('panning');
                    startX = e.clientX - pointX;
                    startY = e.clientY - pointY;
                });
                window.addEventListener('mouseup', () => {
                    panning = false;
                    img.classList.remove('panning');
                });
                window.addEventListener('mousemove', (e) => {
                    if (!panning) return;
                    e.preventDefault();
                    pointX = e.clientX - startX;
                    pointY = e.clientY - startY;
                    applyTransform();
                });
                new MutationObserver(resetTransform).observe(img, { attributeFilter: ['src'] });
            });
        }

        // --- Initial Load Logic ---
        updateCacheStatus();
        toggleClearButtonState();
        populateModelSelect(taskSelect.value);
        setupPanAndZoom();

    }, []); // Empty array ensures this runs only once on mount

    return (
        <>
            <Head>
                <title>NocturaVision - Image File Processor</title>
            </Head>
            <header>
                 <div className="nav-bar">
                    <Link href="/" className="nav-button">Live Stream</Link>
                    <Link href="/video-processor" className="nav-button">Video File</Link>
                    <Link href="/image-processor" className="nav-button active">Image File</Link>
                </div>
                <div className="title-block">
                    <h1>🦉 NocturaVision <span style={{ fontWeight: 300, color: '#ccc' }}>| Uformer</span></h1>
                    <p>Image File Enhancement</p>
                </div>
                <div className="cache-info-block">
                    <label className="cache-line">
                        <input type="checkbox" id="clearImagesCheck" ref={clearImagesCheckRef} defaultChecked />
                        <span className="cache-label-text">Image Cache:</span>
                        <span className="cache-value" id="imageCacheValue" ref={imageCacheValueRef}>... MB</span>
                    </label>
                    <label className="cache-line">
                        <input type="checkbox" id="clearVideosCheck" ref={clearVideosCheckRef} defaultChecked={false} />
                        <span className="cache-label-text">Video Cache:</span>
                        <span className="cache-value" id="videoCacheValue" ref={videoCacheValueRef}>... MB</span>
                    </label>
                    <button id="clearCacheBtn" ref={clearCacheBtnRef}>Clear Selected</button>
                </div>
            </header>
            <div className="page-content">
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
                        <select id="modelSelect" ref={modelSelectRef} style={{ padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #61dafb', backgroundColor: '#4a4f5a', color: 'white' }}>
                            {/* Options populated by script */}
                        </select>
                    </div>
                    <div className="control-group checkbox-group">
                        <label>
                            <input type="checkbox" id="patchCheckbox" ref={patchCheckboxRef} defaultChecked /> Use Patch Processing (High Quality)
                        </label>
                    </div>
                </div>
                <div className="main-content">
                    <div className="actions-bar">
                        <button id="processImageBtn" ref={processImageBtnRef} disabled>Process Image</button>
                        <p id="status" ref={statusSpanRef}>Please select an image file. Supports: jpeg, png, gif, webp, .arw, .nef, .cr2, .dng.</p>
                    </div>
                    <div className="image-feeds-container">
                        <div className="image-box">
                            <div className="image-header">
                                <h3>Original Image</h3>
                                <input type="file" id="imageUpload" ref={imageUploadInputRef} accept="image/jpeg,image/png,image/gif,image/webp,.arw,.nef,.cr2,.dng" style={{ display: 'none' }} />
                                <button id="selectImageBtn" ref={selectImageBtnRef}>Select Image</button>
                            </div>
                            <div className="image-player-wrapper">
                                <div id="upload-area" ref={uploadAreaRef} className="upload-area">
                                    <p>Drag & Drop an image file here or click this area</p>
                                    <p style={{ fontSize: '0.8rem', color: '#ccc' }}>(Supports: JPG, PNG, ARW, etc.)</p>
                                </div>
                                <img id="originalImage" ref={originalImageRef} className="image-display hidden" alt="Original Image" />
                            </div>
                        </div>
                        <div className="image-box">
                            <div className="image-header">
                                <h3>Enhanced Image</h3>
                                <a id="downloadBtn" ref={downloadBtnRef} href="#" className="hidden" download>Download</a>
                            </div>
                            <div className="image-player-wrapper">
                                <img id="processedImage" ref={processedImageRef} className="image-display hidden" alt="Processed Image" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ImageProcessorPage;
