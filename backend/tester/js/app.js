/* backend/tester/js/app.js */
import { renderHeader } from './components/Header.js';
import LiveStreamPage from './pages/LiveStreamPage.js';
import ImageProcessorPage from './pages/ImageProcessorPage.js';
import VideoProcessorPage from './pages/VideoProcessorPage.js';

document.addEventListener('DOMContentLoaded', () => {
    const headerMount = document.getElementById('app-header');
    const contentMount = document.getElementById('app-content');

    const pages = {
        live: LiveStreamPage,
        image: ImageProcessorPage,
        video: VideoProcessorPage,
    };

    let headerInstance = null;

    function navigateTo(pageKey) {
        if (!pages[pageKey]) {
            console.error(`Page not found: ${pageKey}`);
            return;
        }

        const page = pages[pageKey];

        // 1. Set header state (title, active button, default checkboxes)
        headerInstance.setPage(pageKey, page.title, {
            defaultClearImages: page.defaultClearImages,
            defaultClearVideos: page.defaultClearVideos,
        });

        // 2. Load the page's HTML into the main content area
        contentMount.innerHTML = page.getHtml();

        // 3. Run the page's specific JavaScript initialization logic
        page.init();
    }

    // Initial render
    headerInstance = renderHeader({ onNavClick: navigateTo });
    headerMount.appendChild(headerInstance.element);
    
    // Load the default page (Live Stream)
    navigateTo('live');
});
