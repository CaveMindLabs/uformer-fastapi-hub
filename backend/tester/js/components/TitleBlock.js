/* backend/tester/js/components/TitleBlock.js */

export function createTitleBlock() {
    const element = document.createElement('div');
    element.className = 'title-block';
    element.innerHTML = `
        <h1>🦉 Enhancement Hub <span style="font-weight: 300; color: #ccc;">| Uformer</span></h1>
        <p id="headerPageTitle"></p>
    `;

    const pageTitleEl = element.querySelector('#headerPageTitle');

    const setTitle = (title) => {
        pageTitleEl.textContent = title;
    };

    return { element, setTitle };
}
