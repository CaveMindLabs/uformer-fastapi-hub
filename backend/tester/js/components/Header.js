/* backend/tester/js/components/Header.js */
import config from '../config.js';
import { createNavBar } from './NavBar.js';
import { createTitleBlock } from './TitleBlock.js';
import { createCacheManager } from './CacheManager.js';
import { createVRAMManager } from './VRAMManager.js';

/**
 * Renders the header components directly into a provided mount point.
 * @param {object} props
 * @param {HTMLElement} props.mountPoint - The <header> element to render into.
 * @param {function} props.onNavClick - The callback for navigation.
 */
export function renderHeader(props) {
    const { mountPoint, onNavClick } = props;

    // Clear any previous content
    mountPoint.innerHTML = '';

    // Create instances of each sub-component
    const navBar = createNavBar({ onNavClick });
    const titleBlock = createTitleBlock();
    
    // This container holds the right-side controls
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'cache-info-block';
    // This style is crucial to replicate the React layout and override the default flex-direction: column
    controlsContainer.style.cssText = 'display: flex; flex-direction: row; gap: 20px; align-items: stretch; width: auto;';

    // Append components directly to the <header> mount point
    mountPoint.appendChild(navBar.element);
    mountPoint.appendChild(titleBlock.element);
    mountPoint.appendChild(controlsContainer);

    let cacheManager;
    let vramManager;
    
    // This function is called by app.js when navigating
    const setPage = (pageKey, pageTitle, defaults) => {
        navBar.setActive(pageKey);
        titleBlock.setTitle(pageTitle);

        // Clear old managers and create new ones with the correct defaults for the page
        controlsContainer.innerHTML = '';
        cacheManager = createCacheManager({
            defaultClearImages: defaults.defaultClearImages,
            defaultClearVideos: defaults.defaultClearVideos,
        });
        vramManager = createVRAMManager();
        
        controlsContainer.appendChild(cacheManager.element);
        controlsContainer.appendChild(vramManager.element);
        
        updateAllStatus(); // Trigger an initial update
    };
    
    const updateAllStatus = () => {
        if (cacheManager) cacheManager.updateStatus();
        if (vramManager) vramManager.updateStatus();
    };

    // Set up polling and event listeners
    const pollInterval = setInterval(updateAllStatus, config.HEADER_STATUS_POLL_INTERVAL_MS);
    window.addEventListener('forceHeaderUpdate', updateAllStatus);
    
    // Return the setPage function so app.js can control the header's state
    return { setPage };
}
