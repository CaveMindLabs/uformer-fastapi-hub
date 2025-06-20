/* backend/tester/js/components/NavBar.js */

export function createNavBar(props) {
    const { onNavClick } = props;

    const element = document.createElement('div');
    element.className = 'nav-bar';
    element.innerHTML = `
        <a href="#" class="nav-button" data-page="live">Live Stream</a>
        <a href="#" class="nav-button" data-page="video">Video File</a>
        <a href="#" class="nav-button" data-page="image">Image File</a>
    `;

    const navButtons = element.querySelectorAll('.nav-button');
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            onNavClick(e.target.dataset.page);
        });
    });

    const setActive = (pageKey) => {
        navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === pageKey);
        });
    };

    return { element, setActive };
}
