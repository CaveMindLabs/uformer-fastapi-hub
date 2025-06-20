/* backend/tester/js/components/VRAMManager.js */
import config from '../config.js';
import { showModal } from './Modal.js';

export function createVRAMManager() {
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
        const isClearingAll = modelsToClear.length === 0;
        const modelListStr = Array.from(modelsToClear).join(', ');

        let confirmMsg;
        if (isClearingAll) {
            confirmMsg = "Are you sure you want to unload all available models from VRAM? This may cause a delay on subsequent requests.";
        } else if (modelsToClear.length === 1) {
            confirmMsg = `Are you sure you want to unload the selected model (${modelListStr}) from VRAM?`;
        } else {
            confirmMsg = `Are you sure you want to unload the selected models (${modelListStr}) from VRAM?`;
        }
        
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

                    if (unloaded_models.length > 0) {
                        const plural = unloaded_models.length === 1 ? 'model' : 'models';
                        messages.push(`Successfully unloaded ${unloaded_models.length} ${plural}: ${unloaded_models.join(', ')}.`);
                    }

                    if (skipped_models.length > 0) {
                        const skippedPlural = skipped_models.length === 1 ? 'model' : 'models';
                        const verbPhrase = skipped_models.length === 1 ? 'it is' : 'they are';
                        messages.push(`Could not unload ${skipped_models.length} ${skippedPlural} as ${verbPhrase} in use: ${skipped_models.join(', ')}.`);
                        
                        modalStatus = unloaded_models.length > 0 ? 'warning' : 'error';
                        
                        if (unloaded_models.length > 0) {
                            modalTitle = 'Action Partially Completed';
                        } else {
                            modalTitle = skipped_models.length === 1 ? 'Model in Use' : 'Models in Use';
                        }
                    }

                    if (unloaded_models.length === 0 && skipped_models.length === 0) {
                        messages.push('No models were eligible for unloading.');
                        modalTitle = 'Info';
                    }
                    
                    const modalContentEl = document.createElement('div');
                    modalContentEl.innerHTML = messages.map(msg => `<p style="margin: 0 0 10px 0; padding: 0; line-height: 1.4;">${msg}</p>`).join('');

                    showModal({ title: modalTitle, status: modalStatus, content: modalContentEl, onConfirm: null, showCancel: false, confirmText: 'OK' });
                    
                    // --- BUG FIX ---
                    selectedModelsToClear.clear();
                    await updateStatus();
                    // --- END BUG FIX ---
                } catch (error) {
                    showModal({ title: 'Error', status: 'error', content: `An error occurred while unloading models: ${error.message}`, onConfirm: null, showCancel: false, confirmText: 'OK' });
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
