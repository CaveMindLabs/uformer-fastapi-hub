/* frontend/src/components/Modal.js */
import React from 'react';

const Modal = ({ isOpen, onClose, onConfirm, title, children, confirmText = 'Confirm', cancelText = 'Cancel', showCancel = true, status = 'success' }) => {
    if (!isOpen) {
        return null;
    }

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm();
        }
        onClose();
    };

    return (
        <>
            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background-color: rgba(0, 0, 0, 0.6);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                .modal-content {
                    background-color: #282c34;
                    padding: 25px;
                    border-radius: 8px;
                    border: 1px solid #61dafb;
                    width: 90%;
                    max-width: 450px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.5);
                    color: #e6e6e6;
                    text-align: center;
                }
                .modal-title {
                    margin-top: 0;
                    margin-bottom: 20px;
                    color: #61dafb;
                    font-size: 1.5rem;
                }
                .modal-body {
                    margin-bottom: 25px;
                    font-size: 1rem;
                    line-height: 1.5;
                }
                .modal-actions {
                    display: flex;
                    justify-content: center;
                    gap: 15px;
                }
                .modal-button {
                    padding: 10px 20px;
                    border-radius: 5px;
                    border: 1px solid transparent;
                    cursor: pointer;
                    font-size: 1rem;
                    font-weight: 500;
                    transition: background-color 0.2s, border-color 0.2s;
                }
                .confirm-button {
                    background-color: #61dafb;
                    color: #20232a;
                    border-color: #61dafb;
                }
                .confirm-button:hover {
                    background-color: #52b9d8;
                    border-color: #52b9d8;
                }
                .cancel-button {
                    background-color: #4a4f5a;
                    color: #e6e6e6;
                    border-color: #555;
                }
                .cancel-button:hover {
                    background-color: #5a5f6a;
                    border-color: #666;
                }
                }
                /* Warning Status Colors */
                .modal-content.warning .modal-title, .modal-content.warning .confirm-button {
                    color: #333;
                    background-color: #f0e68c;
                    border-color: #d8c973;
                }
                .modal-content.warning .confirm-button:hover {
                    background-color: #d8c973;
                    border-color: #bfae5a;
                }
                /* Error Status Colors */
                 .modal-content.error .modal-title, .modal-content.error .confirm-button {
                    color: #fff;
                    background-color: #e05252;
                    border-color: #d04242;
                }
                .modal-content.error .confirm-button:hover {
                    background-color: #d04242;
                    border-color: #b03232;
                }
            `}</style>
            <div className="modal-overlay" onClick={onClose}>
                <div className={`modal-content ${status}`} onClick={(e) => e.stopPropagation()}>
                    <h2 className="modal-title">{title || 'Notification'}</h2>
                    <div className="modal-body">
                        {children}
                    </div>
                    <div className="modal-actions">
                        {showCancel && (
                            <button className="modal-button cancel-button" onClick={onClose}>
                                {cancelText}
                            </button>
                        )}
                        <button className="modal-button confirm-button" onClick={handleConfirm}>
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Modal;
