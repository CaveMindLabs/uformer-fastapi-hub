/* backend/tester/js/components/Header.js */
import config from '../config.js';
import { showModal } from './Modal.js';

// --- Internal Component: CacheManager ---
function createCacheManager(props) {
    const { defaultClearImages, defaultClearVideos } = props;
    let imageCacheMb = '...';
    let videoCacheMb = '...';
    let clearImages = defaultClearImages;
    let clearVideos = defaultClearVideos;

    const element = document.createElement('div');
    element.style.cssText = 'display: flex; flex-direction: column; min-width: 150px;';
    element.innerHTML = `
        <style>#clearCacheBtn:not(:disabled):hover { background-color: #e05252; border-color: #d04242; }</style>
        <div style="display: flex; flex-direction: column; gap: 5px;">
            <label class="cache-line">
                <input type="checkbox" id="headerClearImagesCheck">
                <span class="cache-label-text">Image Cache:</span>
                <span class="cache-value" id="headerImageCacheValue">... MB</span>
            </label>
            <label class="cache-line">
                <input type="checkbox" id="headerClearVideosCheck">
                <span class="cache-label-text">Video Cache:</span>
                <span class="cache-value" id="headerVideoCacheValue">... MB</span>
            </label>
        </div>
        <div style="display: flex; justify-content: center; width: 100%; margin-top: auto; padding-top: 5px;">
            <button id="clearCacheBtn" disabled>Clear Selected Cache</button>
        </div>
    `;

    const imageCacheValueEl = element.querySelector('#headerImageCacheValue');
    const videoCacheValueEl = element.querySelector('#headerVideoCacheValue');
    const clearImagesCheckEl = element.querySelector('#headerClearImagesCheck');
    const clearVideosCheckEl = element.querySelector('#headerClearVideosCheck');
    const clearCacheBtnEl = element.querySelector('#clearCacheBtn');

    clearImagesCheckEl.checked = clearImages;
    clearVideosCheckEl.checked = clearVideos;

    const updateButtonState = () => {
        clearCacheBtnEl.disabled = !clearImages && !clearVideos;
    };

    const updateStatus = async () => {
        try {
            const response = await fetch(`${config.API_BASE_URL}/api/cache_status`);
            if (!response.ok) throw new Error('Server offline');
            const data = await response.json();
            if (imageCacheMb !== data.image_cache_mb) imageCacheValueEl.textContent = `${data.image_cache_mb} MB`;
            if (videoCacheMb !== data.video_cache_mb) videoCacheValueEl.textContent = `${data.video_cache_mb} MB`;
            imageCacheMb = data.image_cache_mb;
            videoCacheMb = data.video_cache_mb;
        } catch (error) {
            imageCacheValueEl.textContent = `... MB`;
            videoCacheValueEl.textContent = `... MB`;
        }
    };
    
    clearImagesCheckEl.addEventListener('change', (e) => { clearImages = e.target.checked; updateButtonState(); });
    clearVideosCheckEl.addEventListener('change', (e) => { clearVideos = e.target.checked; updateButtonState(); });

    clearCacheBtnEl.addEventListener('click', () => {
        showModal({
            title: 'Confirm Cache Clearing',
            content: 'Are you sure you want to clear the selected temporary file caches?',
            onConfirm: async () => {
                try {
                    const url = new URL(`${config.API_BASE_URL}/api/clear_cache`);
                    url.searchParams.append('clear_images', clearImages);
                    url.searchParams.append('clear_videos', clearVideos);
                    const response = await fetch(url, { method: 'POST' });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.detail || 'Failed to clear cache.');

                    const { cleared_count, skipped_in_progress_count, skipped_awaiting_download_count } = result;
                    const total_skipped = skipped_in_progress_count + skipped_awaiting_download_count;

                    let modalTitle = 'Success';
                    let modalStatus = 'success';
                    let messages = [];

                    if (cleared_count > 0) messages.push(`Successfully cleared ${cleared_count} file(s).`);
                    if (skipped_in_progress_count > 0) messages.push(`Skipped ${skipped_in_progress_count} file(s) currently being processed.`);
                    if (skipped_awaiting_download_count > 0) messages.push(`Skipped ${skipped_awaiting_download_count} file(s) awaiting download.`);
                    if (total_skipped > 0) modalStatus = cleared_count > 0 ? 'warning' : 'error';
                    if (cleared_count > 0 && total_skipped > 0) modalTitle = 'Cache Partially Cleared';
                    else if (cleared_count === 0 && total_skipped > 0) modalTitle = 'Cache Files in Use';
                    else if (cleared_count === 0 && total_skipped === 0) {
                        messages.push('No files were eligible for clearing.');
                        modalTitle = 'Info';
                    }

                    const modalContentEl = document.createElement('div');
                    modalContentEl.innerHTML = messages.map(msg => `<p style="margin: 0 0 10px 0; padding: 0; line-height: 1.4;">${msg}</p>`).join('');

                    showModal({ isOpen: true, title: modalTitle, status: modalStatus, content: modalContentEl, showCancel: false, confirmText: 'OK' });
                    await updateStatus();
                } catch (error) {
                    showModal({ title: 'Error', status: 'error', content: `An error occurred: ${error.message}`, showCancel: false, confirmText: 'OK' });
                }
            }
        });
    });

    updateButtonState();

    return { element, updateStatus };
}

// --- Internal Component: VRAMManager ---
function createVRAMManager() {
    let selectedModelsToClear = new Set();
    let loadedModels = [];

    const element = document.createElement('div');
    element.style.cssText = 'display: none; flex-direction: column; gap: 5px; min-width: 200px;';
    element.innerHTML = `
        <style>
            .vram-button { padding: 6px 10px; font-size: 0.85rem; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.2s, filter 0.2s; }
            .vram-button.clear-selected { background-color: #f0e68c; color: #333; }
            .vram-button.clear-all { background-color: #61dafb; color: #20232a; }
            .vram-button:hover:not(:disabled) { filter: brightness(0.9); }
            .vram-button:disabled { background-color: #cccccc !important; color: #666666 !important; cursor: not-allowed; filter: none; }
        </style>
        <div id="headerLoadedModelsList" style="margin-bottom: 5px; max-height: 80px; overflow-y: auto; width: 100%;"></div>
        <div style="display: flex; justify-content: space-between; width: 100%;">
            <button id="headerClearSelectedBtn" class="vram-button clear-selected" disabled>Clear Selected</button>
            <button id="headerClearAllBtn" class="vram-button clear-all" disabled>Clear All</button>
        </div>
    `;

    const modelsListEl = element.querySelector('#headerLoadedModelsList');
    const clearSelectedBtnEl = element.querySelector('#headerClearSelectedBtn');
    const clearAllBtnEl = element.querySelector('#headerClearAllBtn');
    
    const updateVRAMButtons = () => {
        clearSelectedBtnEl.disabled = selectedModelsToClear.size === 0;
        clearAllBtnEl.disabled = !loadedModels.some(m => m.loaded);
    };

    const renderModels = (models) => {
        loadedModels = models;
        modelsListEl.innerHTML = '';
        models.forEach(model => {
            const label = document.createElement('label');
            label.className = 'cache-line';
            label.style.fontSize = '0.85rem';
            label.innerHTML = `
                <input type="checkbox" data-model-name="${model.name}" ${!model.loaded ? 'disabled' : ''} ${selectedModelsToClear.has(model.name) ? 'checked' : ''}>
                <span class="cache-label-text" style="margin-left: 8px;">${model.name}</span>
                <span style="color: ${model.loaded ? '#86e58b' : '#ff7a7a'}; font-weight: bold; min-width: 65px; text-align: right; margin-left: auto;">
                    ${model.loaded ? 'Loaded' : 'Unloaded'}
                </span>
            `;
            label.querySelector('input').addEventListener('change', (e) => {
                const name = e.target.dataset.modelName;
                if (e.target.checked) selectedModelsToClear.add(name);
                else selectedModelsToClear.delete(name);
                updateVRAMButtons();
            });
            modelsListEl.appendChild(label);
        });
        updateVRAMButtons();
    };

    const updateStatus = async () => {
        try {
            const response = await fetch(`${config.API_BASE_URL}/api/loaded_models_status`);
            if (!response.ok) throw new Error('Server offline');
            const data = await response.json();
            renderModels(data.models || []);
        } catch (error) {
             renderModels([]);
        }
    };
    
    const handleClearModels = (modelsToClear = []) => {
        let confirmMsg = modelsToClear.length === 0 
            ? "Unload all available models from VRAM?" 
            : `Unload the selected ${modelsToClear.length} model(s)?`;

        showModal({
            title: 'Confirm VRAM Clearing',
            content: confirmMsg,
            onConfirm: async () => {
                try {
                    const response = await fetch(`${config.API_BASE_URL}/api/unload_models`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model_names: modelsToClear })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.detail || 'Failed to unload models.');
                    
                    const { unloaded_models, skipped_models } = result;
                    let modalTitle = 'Success';
                    let modalStatus = 'success';
                    let messages = [];

                    if (unloaded_models.length > 0) messages.push(`Successfully unloaded: ${unloaded_models.join(', ')}.`);
                    if (skipped_models.length > 0) {
                        messages.push(`Could not unload models in use: ${skipped_models.join(', ')}.`);
                        modalStatus = unloaded_models.length > 0 ? 'warning' : 'error';
                        modalTitle = unloaded_models.length > 0 ? 'Action Partially Completed' : 'Models in Use';
                    }
                     if (unloaded_models.length === 0 && skipped_models.length === 0) {
                        messages.push('No models were eligible for unloading.');
                        modalTitle = 'Info';
                    }

                    const modalContentEl = document.createElement('div');
                    modalContentEl.innerHTML = messages.map(msg => `<p style="margin: 0 0 10px 0; padding: 0; line-height: 1.4;">${msg}</p>`).join('');

                    showModal({ title: modalTitle, status: modalStatus, content: modalContentEl, showCancel: false, confirmText: 'OK' });
                    await updateStatus();
                } catch (error) {
                     showModal({ title: 'Error', status: 'error', content: `An error occurred: ${error.message}`, showCancel: false, confirmText: 'OK' });
                }
            }
        });
    };

    clearSelectedBtnEl.addEventListener('click', () => handleClearModels(Array.from(selectedModelsToClear)));
    clearAllBtnEl.addEventListener('click', () => handleClearModels([]));

    // Check strategy on init
    (async () => {
        try {
            const response = await fetch(`${config.API_BASE_URL}/api/model_loading_strategy`);
            const data = await response.json();
            if (!data.load_all_on_startup) {
                element.style.display = 'flex';
            }
        } catch (e) {/* fail silently */}
    })();

    return { element, updateStatus };
}


// --- Main Exported Function ---
export function renderHeader(props) {
    const { onNavClick } = props;

    const headerEl = document.createElement('div');
    headerEl.innerHTML = `
        <div class="nav-bar">
            <a href="#" class="nav-button" data-page="live">Live Stream</a>
            <a href="#" class="nav-button" data-page="video">Video File</a>
            <a href="#" class="nav-button" data-page="image">Image File</a>
        </div>
        <div class="title-block">
            <h1>🦉 Enhancement Hub <span style="font-weight: 300; color: '#ccc';">| Uformer</span></h1>
            <p id="headerPageTitle"></p>
        </div>
        <div class="cache-info-block" style="flex-direction: row; gap: 20px; align-items: stretch; width: auto;">
            <!-- Component mount points -->
        </div>
    `;

    const navButtons = headerEl.querySelectorAll('.nav-button');
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            onNavClick(e.target.dataset.page);
        });
    });

    const pageTitleEl = headerEl.querySelector('#headerPageTitle');
    const controlsContainer = headerEl.querySelector('.cache-info-block');

    let cacheManager;
    let vramManager;

    const setPage = (pageKey, pageTitle, defaults) => {
        pageTitleEl.textContent = pageTitle;
        navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === pageKey);
        });

        // Re-create managers with new defaults
        controlsContainer.innerHTML = '';
        cacheManager = createCacheManager({
            defaultClearImages: defaults.defaultClearImages,
            defaultClearVideos: defaults.defaultClearVideos,
        });
        vramManager = createVRAMManager();
        controlsContainer.appendChild(cacheManager.element);
        controlsContainer.appendChild(vramManager.element);
        updateAllStatus(); // Initial update for the new page
    };

    const updateAllStatus = () => {
        if (cacheManager) cacheManager.updateStatus();
        if (vramManager) vramManager.updateStatus();
    };

    // Set up polling
    setInterval(updateAllStatus, config.HEADER_STATUS_POLL_INTERVAL_MS);
    // This event allows other pages to trigger an immediate, on-demand update.
    window.addEventListener('forceHeaderUpdate', updateAllStatus);


    return { element: headerEl, setPage };
}
