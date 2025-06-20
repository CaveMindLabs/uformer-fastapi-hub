/* backend/tester/js/app.js */
import { renderHeader } from './components/Header.js';
import LiveStreamPage from './pages/LiveStreamPage.js';
import ImageProcessorPage from './pages/ImageProcessorPage.js';
import VideoProcessorPage from './pages/VideoProcessorPage.js';
import { createLayout } from './components/Layout.js';

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

        // 2. Create the layout, passing the page's inner HTML to it
        const pageLayout = createLayout(page.getHtml());
        
        // 3. Load the complete layout into the main content area
        contentMount.innerHTML = ''; // Clear previous content
        contentMount.appendChild(pageLayout);

        // 4. Run the page's specific JavaScript initialization logic
        page.init();
    }

    // Initial render
    // Pass the mount point directly to the renderHeader function
    headerInstance = renderHeader({ mountPoint: headerMount, onNavClick: navigateTo });
    
    // Load the default page (Live Stream)
    navigateTo('live');
});
