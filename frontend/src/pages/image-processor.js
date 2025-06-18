/* frontend/src/pages/image-processor.js */
import React, { useEffect, useRef } from 'react';
import Layout from '../components/Layout'; // Import the Layout component

const ImageProcessorPage = () => {
    // --- Refs for DOM Elements ---
    const imageUploadInputRef = useRef(null);
    const uploadAreaRef = useRef(null);
    const originalImageRef = useRef(null);
    const processedImageRef = useRef(null);
    const downloadBtnRef = useRef(null);
    const statusSpanRef = useRef(null);
    const taskSelectRef = useRef(null);
    const modelSelectRef = useRef(null);
    const patchCheckboxRef = useRef(null);

    // Using a ref to hold the selected file, as it doesn't need to trigger re-renders
    const selectedImageFile = useRef(null);

    useEffect(() => {
        // --- Get current elements from refs ---
        const imageUploadInput = imageUploadInputRef.current;
        const uploadArea = uploadAreaRef.current;
        const originalImage = originalImageRef.current;
        const processedImage = processedImageRef.current;
        const downloadBtn = downloadBtnRef.current;
        const statusSpan = statusSpanRef.current;
        const taskSelect = taskSelectRef.current;
        const modelSelect = modelSelectRef.current;
        const patchCheckbox = patchCheckboxRef.current;

        // --- Event Listeners for Controls ---
        const selectImageBtn = document.getElementById('selectImageBtn');
        const processImageBtn = document.getElementById('processImageBtn');
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
        
        taskSelect.addEventListener('change', () => populateModelSelect(taskSelect.value));
        
        async function handleImageFile(file) {
            if (!file) return;
            selectedImageFile.current = file;
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
                    const response = await fetch('http://127.0.0.1:8000/api/generate_preview', { method: 'POST', body: formData });
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
        
        processImageBtn.onclick = async () => {
            if (!selectedImageFile.current) {
                statusSpan.textContent = "Error: No image selected.";
                statusSpan.classList.add('error');
                return;
            }

            statusSpan.textContent = `Processing "${selectedImageFile.current.name}"...`;
            statusSpan.classList.remove('error');
            processImageBtn.disabled = true;
            downloadBtn.classList.add('hidden');
            processedImage.classList.add('hidden');
            
            const formData = new FormData();
            formData.append("image_file", selectedImageFile.current);
            formData.append("task_type", taskSelect.value);
            formData.append("model_name", modelSelect.value);
            formData.append("use_patch_processing", patchCheckbox.checked);

            // Dispatch an event to tell the header to update its status.
            window.dispatchEvent(new CustomEvent('forceHeaderUpdate'));

            // Use a brief timeout. This allows the UI (especially the Header) to re-render
            // with the "model loading" status *before* the main thread is blocked by the fetch call.
            // This is the key to solving the race condition.
            setTimeout(async () => {
                try {
                    const response = await fetch('http://127.0.0.1:8000/api/process_image', { method: 'POST', body: formData });
                    if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ detail: 'Server returned an unreadable error.' }));
                    throw new Error(errorData.detail || `Server responded with status ${response.status}`);
                }
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);
                processedImage.src = imageUrl;
                processedImage.classList.remove('hidden');
                downloadBtn.href = imageUrl;
                downloadBtn.download = `enhanced_${taskSelect.value}_${selectedImageFile.current.name}`;
                downloadBtn.classList.remove('hidden');
                statusSpan.textContent = "Image processing complete!";
            } catch (error) {
                statusSpan.classList.add('error');
                let errorMessage = error.message || 'An unknown error occurred.';
                if (error.detail && Array.isArray(error.detail)) {
                    errorMessage = error.detail.map(d => `${d.loc.join(' -> ')}: ${d.msg}`).join('; ');
                }
                    statusSpan.textContent = `Error: ${errorMessage}. Is the backend running?`;
                } finally {
                    processImageBtn.disabled = false;
                }
            }, 50); // A small 50ms delay is sufficient to ensure the UI updates.
        };

        function setupPanAndZoom() {
            [originalImage, processedImage].forEach(img => {
                let scale = 1, panning = false, pointX = 0, pointY = 0, startX = 0, startY = 0;
                const resetTransform = () => { scale = 1; pointX = 0; pointY = 0; img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`; img.style.transformOrigin = `0 0`; };
                const applyTransform = () => { img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`; };
                img.addEventListener('dblclick', resetTransform);
                img.parentElement.addEventListener('wheel', (e) => {
                    e.preventDefault(); if (img.classList.contains('hidden')) return;
                    const rect = img.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / scale; const y = (e.clientY - rect.top) / scale;
                    const delta = e.deltaY > 0 ? 0.9 : 1.1; const newScale = Math.max(1, scale * delta);
                    pointX += (x - x / (newScale / scale)) * newScale; pointY += (y - y / (newScale / scale)) * newScale;
                    scale = newScale; applyTransform();
                });
                img.addEventListener('mousedown', (e) => {
                    e.preventDefault(); if (img.classList.contains('hidden')) return;
                    panning = true; img.classList.add('panning');
                    startX = e.clientX - pointX; startY = e.clientY - pointY;
                });
                window.addEventListener('mouseup', () => { panning = false; img.classList.remove('panning'); });
                window.addEventListener('mousemove', (e) => { if (!panning) return; e.preventDefault(); pointX = e.clientX - startX; pointY = e.clientY - startY; applyTransform(); });
                new MutationObserver(resetTransform).observe(img, { attributeFilter: ['src'] });
            });
        }

        // --- Initial Load Logic ---
        populateModelSelect(taskSelect.value);
        setupPanAndZoom();

    }, []); // Empty array ensures this runs only once on mount

    const headerProps = {
        title: "NocturaVision - Image File Processor",
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
                    <button id="processImageBtn" disabled>Process Image</button>
                    <p id="status" ref={statusSpanRef}>Please select an image file. Supports: jpeg, png, gif, webp, .arw, .nef, .cr2, .dng.</p>
                </div>
                <div className="image-feeds-container">
                    <div className="image-box">
                        <div className="image-header">
                            <h3>Original Image</h3>
                            <input type="file" id="imageUpload" ref={imageUploadInputRef} accept="image/jpeg,image/png,image/gif,image/webp,.arw,.nef,.cr2,.dng" style={{ display: 'none' }} />
                            <button id="selectImageBtn">Select Image</button>
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
        </Layout>
    );
};

export default ImageProcessorPage;
