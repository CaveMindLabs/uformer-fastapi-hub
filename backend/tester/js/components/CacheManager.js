/* backend/tester/js/components/CacheManager.js */
import config from '../config.js';
import { showModal } from './Modal.js';

export function createCacheManager(props) {
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

                    if (cleared_count > 0) {
                        const plural = cleared_count === 1 ? 'file' : 'files';
                        messages.push(`Successfully cleared ${cleared_count} ${plural} from the cache.`);
                    }

                    if (skipped_in_progress_count > 0) {
                        const plural = skipped_in_progress_count === 1 ? 'file' : 'files';
                        const verb = skipped_in_progress_count === 1 ? 'it is' : 'they are';
                        messages.push(`Skipped ${skipped_in_progress_count} ${plural} as ${verb} currently being processed.`);
                    }

                    if (skipped_awaiting_download_count > 0) {
                        const plural = skipped_awaiting_download_count === 1 ? 'file' : 'files';
                        const verb = skipped_awaiting_download_count === 1 ? 'is' : 'are';
                        messages.push(`Skipped ${skipped_awaiting_download_count} ${plural} that ${verb} awaiting download.`);
                    }

                    if (total_skipped > 0) {
                        modalStatus = cleared_count > 0 ? 'warning' : 'error';
                        if (cleared_count > 0) {
                            modalTitle = 'Cache Partially Cleared';
                        } else {
                            modalTitle = total_skipped === 1 ? 'Cache File in Use' : 'Cache Files in Use';
                        }
                    } else if (cleared_count === 0) {
                         messages.push('No files were eligible for clearing.');
                         modalTitle = 'Info';
                    }

                    const modalContentEl = document.createElement('div');
                    modalContentEl.innerHTML = messages.map(msg => `<p style="margin: 0 0 10px 0; padding: 0; line-height: 1.4;">${msg}</p>`).join('');

                    showModal({ title: modalTitle, status: modalStatus, content: modalContentEl, onConfirm: null, showCancel: false, confirmText: 'OK' });
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
