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
                    border: 1px solid #61dafb; /* Default/Success border */
                    width: 90%;
                    max-width: 450px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.5);
                    color: #e6e6e6;
                    text-align: center;
                    transition: border-color 0.2s;
                }
                .modal-content.warning { border-color: #f0e68c; } /* Yellow border for warning */
                .modal-content.error { border-color: #e05252; } /* Red border for error */
                
                .modal-title {
                    margin-top: 0;
                    margin-bottom: 20px;
                    color: #61dafb; /* Default/Success title color */
                    font-size: 1.5rem;
                    transition: color 0.2s;
                }
                .modal-content.warning .modal-title { color: #f0e68c; } /* Yellow title text */
                .modal-content.error .modal-title { color: #e05252; } /* Red title text */

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
                
                /* Default/Success Button Style */
                .confirm-button {
                    background-color: #61dafb;
                    color: #20232a;
                    border-color: #61dafb;
                }
                .confirm-button:hover {
                    background-color: #52b9d8;
                    border-color: #52b9d8;
                }

                /* Warning Button Style */
                .confirm-button.warning {
                    background-color: #f0e68c;
                    color: #333;
                    border-color: #d8c973;
                }
                .confirm-button.warning:hover {
                    background-color: #d8c973;
                    border-color: #bfae5a;
                }
                
                /* Error Button Style */
                .confirm-button.error {
                    background-color: #e05252;
                    color: #fff;
                    border-color: #d04242;
                }
                .confirm-button.error:hover {
                    background-color: #d04242;
                    border-color: #b03232;
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
                        <button className={`modal-button confirm-button ${status}`} onClick={handleConfirm}>
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Modal;
