/* backend/tester/js/components/Modal.js */

/**
 * Creates and displays a modal dialog.
 * @param {object} props - The properties for the modal.
 * @param {string} props.title - The title of the modal.
 * @param {string|HTMLElement} props.content - The body content of the modal.
 * @param {function} [props.onConfirm] - Callback function when confirm is clicked.
 * @param {string} [props.confirmText='Confirm'] - Text for the confirm button.
 * @param {string} [props.cancelText='Cancel'] - Text for the cancel button.
 * @param {boolean} [props.showCancel=true] - Whether to show the cancel button.
 * @param {string} [props.status='success'] - 'success', 'warning', or 'error' for styling.
 */
export function showModal(props) {
    const {
        title,
        content,
        onConfirm,
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        showCancel = true,
        status = 'success'
    } = props;

    // Create modal structure
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modalContent = document.createElement('div');
    modalContent.className = `modal-content ${status}`;
    modalContent.innerHTML = `
        <style>
            .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
            .modal-content { background-color: #282c34; padding: 25px; border-radius: 8px; border: 1px solid #61dafb; width: 90%; max-width: 450px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); color: #e6e6e6; text-align: center; }
            .modal-content.warning { border-color: #f0e68c; }
            .modal-content.error { border-color: #e05252; }
            .modal-title { margin-top: 0; margin-bottom: 20px; color: #61dafb; font-size: 1.5rem; }
            .modal-content.warning .modal-title { color: #f0e68c; }
            .modal-content.error .modal-title { color: #e05252; }
            .modal-body { margin-bottom: 25px; font-size: 1rem; line-height: 1.5; }
            .modal-actions { display: flex; justify-content: center; gap: 15px; }
            .modal-button { padding: 10px 20px; border-radius: 5px; border: 1px solid transparent; cursor: pointer; font-size: 1rem; font-weight: 500; transition: background-color 0.2s, border-color 0.2s; }
            .confirm-button { background-color: #61dafb; color: #20232a; border-color: #61dafb; }
            .confirm-button:hover { background-color: #52b9d8; }
            .confirm-button.warning { background-color: #f0e68c; color: #333; border-color: #d8c973; }
            .confirm-button.warning:hover { background-color: #d8c973; }
            .confirm-button.error { background-color: #e05252; color: #fff; border-color: #d04242; }
            .confirm-button.error:hover { background-color: #d04242; }
            .cancel-button { background-color: #4a4f5a; color: #e6e6e6; border-color: #555; }
            .cancel-button:hover { background-color: #5a5f6a; }
        </style>
        <h2 class="modal-title">${title || 'Notification'}</h2>
        <div class="modal-body"></div>
        <div class="modal-actions">
            ${showCancel ? `<button class="modal-button cancel-button">${cancelText}</button>` : ''}
            <button class="modal-button confirm-button ${status}">${confirmText}</button>
        </div>
    `;

    // Append content safely (string or HTML element)
    const modalBody = modalContent.querySelector('.modal-body');
    if (typeof content === 'string') {
        modalBody.innerHTML = content;
    } else if (content instanceof HTMLElement) {
        modalBody.appendChild(content);
    }
    
    overlay.appendChild(modalContent);
    document.body.appendChild(overlay);

    // --- Event Handlers ---
    const close = () => {
        overlay.remove();
    };

    overlay.addEventListener('click', close);
    modalContent.addEventListener('click', (e) => e.stopPropagation());

    const confirmButton = modalContent.querySelector('.confirm-button');
    confirmButton.addEventListener('click', () => {
        if (onConfirm) {
            onConfirm();
        }
        close();
    });

    if (showCancel) {
        const cancelButton = modalContent.querySelector('.cancel-button');
        cancelButton.addEventListener('click', close);
    }
}
