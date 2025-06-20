/* backend/tester/js/components/Layout.js */

/**
 * Creates the main page layout structure.
 * @param {string} pageHtml - The inner HTML of the page (sidebar and main content).
 * @returns {HTMLElement} The fully constructed layout element.
 */
export function createLayout(pageHtml) {
    const layoutWrapper = document.createElement('div');
    layoutWrapper.className = 'page-content'; // This is the key class for the flex layout
    layoutWrapper.innerHTML = pageHtml;
    return layoutWrapper;
}
