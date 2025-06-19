/* frontend/src/components/Header.js */
import React, { useState, useEffect, useCallback, useRef, useImperativeHandle } from 'react';
import Link from 'next/link';
import Modal from './Modal'; // Import the new Modal component

// Memoized static components to prevent re-rendering when the parent state changes.
const NavBar = React.memo(({ activePage }) => (
    <div className="nav-bar">
        <Link href="/" className={`nav-button ${activePage === 'live' ? 'active' : ''}`}>Live Stream</Link>
        <Link href="/video-processor" className={`nav-button ${activePage === 'video' ? 'active' : ''}`}>Video File</Link>
        <Link href="/image-processor" className={`nav-button ${activePage === 'image' ? 'active' : ''}`}>Image File</Link>
    </div>
));
NavBar.displayName = 'NavBar';

const TitleBlock = React.memo(({ pageTitle }) => (
    <div className="title-block">
        <h1>🦉 NocturaVision <span style={{ fontWeight: 300, color: '#ccc' }}>| Uformer</span></h1>
        <p>{pageTitle}</p>
    </div>
));
TitleBlock.displayName = 'TitleBlock';


// The CacheManager component is now internal to the Header
const CacheManager = React.forwardRef(({ defaultClearImages, defaultClearVideos }, ref) => {
    const [imageCacheMb, setImageCacheMb] = useState('...');
    const [videoCacheMb, setVideoCacheMb] = useState('...');
    const [modalState, setModalState] = useState({ isOpen: false, content: '', onConfirm: null });
    const [clearImages, setClearImages] = useState(defaultClearImages);
    const [clearVideos, setClearVideos] = useState(defaultClearVideos);
    const cacheErrorStateRef = useRef(false); // Ref to track error state for cache status

    const updateStatus = useCallback(async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/api/cache_status');
            if (!response.ok) throw new Error(`Server returned status ${response.status}`);
            const data = await response.json();

            // On successful fetch, reset the error state.
            if (cacheErrorStateRef.current) {
                cacheErrorStateRef.current = false;
            }
            
            // Use functional updates to prevent re-renders if the value hasn't changed.
            setImageCacheMb(prevMb => prevMb !== data.image_cache_mb ? data.image_cache_mb : prevMb);
            setVideoCacheMb(prevMb => prevMb !== data.video_cache_mb ? data.video_cache_mb : prevMb);

        } catch (error) {
            // If an error occurs (like the backend being down), update the UI.
            // We only do this if it's not already in an error state to prevent extra re-renders.
            if (!cacheErrorStateRef.current) {
                cacheErrorStateRef.current = true;
                setImageCacheMb('...');
                setVideoCacheMb('...');
            }
        }
    }, []); // Empty dependencies, functional updates are used.

    // Expose the updateStatus function via the ref for the parent component to call for on-demand clearing.
    React.useImperativeHandle(ref, () => ({
        updateStatus
    }));

    // This useEffect is no longer needed as the parent Header's polling loop
    // now calls updateStatus directly via the ref.

    const handleClear = async () => {
        setModalState({
            isOpen: true,
            title: 'Confirm Cache Clearing',
            content: 'Are you sure you want to clear the selected temporary file caches?',
            onConfirm: async () => {
                try {
                    const url = new URL('http://127.0.0.1:8000/api/clear_cache');
                    url.searchParams.append('clear_images', clearImages);
                    url.searchParams.append('clear_videos', clearVideos);
                    const response = await fetch(url, { method: 'POST' });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.detail || 'Failed to clear cache.');
                    
                    // Show a success alert
                    setModalState({ isOpen: true, title: 'Success', content: result.message || 'Cache cleared successfully!', onConfirm: null, showCancel: false, confirmText: 'OK' });
                    await updateStatus();
                } catch (error) {
                    // Show an error alert
                    setModalState({ isOpen: true, title: 'Error', content: `An error occurred: ${error.message}`, onConfirm: null, showCancel: false, confirmText: 'OK' });
                }
            }
        });
    };

    const closeModal = () => setModalState({ ...modalState, isOpen: false });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '150px' }}>
            <Modal
                isOpen={modalState.isOpen}
                onClose={closeModal}
                onConfirm={modalState.onConfirm}
                title={modalState.title}
                confirmText={modalState.confirmText}
                showCancel={modalState.showCancel}
                status={modalState.status}
            >
                {modalState.content}
            </Modal>
            <style jsx>{`
                #clearCacheBtn:not(:disabled):hover {
                    background-color: #e05252;
                    border-color: #d04242;
                }
            `}</style>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label className="cache-line">
                    <input type="checkbox" checked={clearImages} onChange={(e) => setClearImages(e.target.checked)} />
                    <span className="cache-label-text">Image Cache:</span>
                    <span className="cache-value">{imageCacheMb} MB</span>
                </label>
                <label className="cache-line">
                    <input type="checkbox" checked={clearVideos} onChange={(e) => setClearVideos(e.target.checked)} />
                    <span className="cache-label-text">Video Cache:</span>
                    <span className="cache-value">{videoCacheMb} MB</span>
                </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: 'auto', paddingTop: '5px' }}>
                <button id="clearCacheBtn" onClick={handleClear} disabled={!clearImages && !clearVideos}>
                    Clear Selected Cache
                </button>
            </div>
        </div>
    );
});
CacheManager.displayName = 'CacheManager'; // for better debugging

const VRAMManager = React.forwardRef((props, ref) => {
    const [loadedModels, setLoadedModels] = useState([]);
    const [isVramControlVisible, setIsVramControlVisible] = useState(false);
    const [modalState, setModalState] = useState({ isOpen: false, content: '', onConfirm: null });
    const [selectedModelsToClear, setSelectedModelsToClear] = useState(new Set());
    const vramErrorStateRef = useRef(false);

    const updateStatus = useCallback(async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/api/loaded_models_status');
            if (!response.ok) throw new Error(`Server returned status ${response.status}`);
            const data = await response.json();

            if (vramErrorStateRef.current) vramErrorStateRef.current = false;

            setLoadedModels(prev => JSON.stringify(prev) !== JSON.stringify(data.models || []) ? data.models || [] : prev);

            setSelectedModelsToClear(prev => {
                const newSet = new Set(prev);
                let changed = false;
                (data.models || []).forEach(model => {
                    if (!model.loaded && newSet.has(model.name)) {
                        newSet.delete(model.name);
                        changed = true;
                    }
                });
                return changed ? newSet : prev;
            });
        } catch (error) {
            if (!vramErrorStateRef.current) {
                vramErrorStateRef.current = true;
                setLoadedModels([]);
            }
        }
    }, []);

    // Expose the updateStatus function to the parent component via the ref.
    useImperativeHandle(ref, () => ({
        updateStatus
    }));

    useEffect(() => {
        const checkModelLoadingStrategy = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/model_loading_strategy');
                if (!response.ok) throw new Error(`Failed to fetch model loading strategy. Status: ${response.status}`);
                const data = await response.json();
                setIsVramControlVisible(!data.load_all_on_startup);
            } catch (error) {
                // This catch is for the initial strategy check only. If it fails, just hide the component.
                setIsVramControlVisible(false);
            }
        };
        checkModelLoadingStrategy();
    }, []); // This effect runs only once on mount.

    const handleModelSelectionChange = (modelName) => {
        setSelectedModelsToClear(prev => {
            const newSet = new Set(prev);
            if (newSet.has(modelName)) newSet.delete(modelName);
            else newSet.add(modelName);
            return newSet;
        });
    };

    const handleClearModels = async (modelsToClear = []) => {
        const isClearingAll = modelsToClear.length === 0;
        const modelListStr = Array.from(modelsToClear).join(', ');

        let confirmMsg;
        if (isClearingAll) {
            confirmMsg = "Are you sure you want to unload all available models from VRAM? This may cause a delay on subsequent requests.";
        } else if (modelsToClear.length === 1) {
            confirmMsg = `Are you sure you want to unload the selected model (${modelListStr}) from VRAM?`;
        } else {
            confirmMsg = `Are you sure you want to unload the selected models (${modelListStr}) from VRAM?`;
        }
        
        setModalState({
            isOpen: true,
            title: 'Confirm VRAM Clearing',
            content: confirmMsg,
            onConfirm: async () => {
                try {
                    const response = await fetch('http://127.0.0.1:8000/api/unload_models', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model_names: modelsToClear })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.detail || 'Failed to unload models.');

                    const { unloaded_models, skipped_models } = result;
                    let modalTitle = 'Success';
                    let modalStatus = 'success';
                    let messages = [];

                    if (unloaded_models.length > 0) {
                        const plural = unloaded_models.length === 1 ? 'model' : 'models';
                        messages.push(`Successfully unloaded ${unloaded_models.length} ${plural}: ${unloaded_models.join(', ')}.`);
                    }

                    if (skipped_models.length > 0) {
                        const skippedPlural = skipped_models.length === 1 ? 'model' : 'models';
                        const verbPhrase = skipped_models.length === 1 ? 'it is' : 'they are';
                        messages.push(`Could not unload ${skipped_models.length} ${skippedPlural} as ${verbPhrase} in use: ${skipped_models.join(', ')}.`);
                        
                        modalStatus = unloaded_models.length > 0 ? 'warning' : 'error';
                        
                        if (unloaded_models.length > 0) {
                            modalTitle = 'Action Partially Completed';
                        } else {
                            // Set title dynamically based on number of models in use.
                            modalTitle = skipped_models.length === 1 ? 'Model in Use' : 'Models in Use';
                        }
                    }

                    if (unloaded_models.length === 0 && skipped_models.length === 0) {
                        messages.push('No models were eligible for unloading.');
                        modalTitle = 'Info';
                    }
                    
                    // Create JSX for the content to allow for separate lines.
                    const modalContent = (
                        <div>
                            {messages.map((msg, index) => <p key={index} style={{ margin: '0 0 10px 0', padding: 0, lineHeight: '1.4' }}>{msg}</p>)}
                        </div>
                    );

                    setModalState({ isOpen: true, title: modalTitle, status: modalStatus, content: modalContent, onConfirm: null, showCancel: false, confirmText: 'OK' });
                    await updateStatus(); // Force immediate refresh
                } catch (error) {
                    setModalState({ isOpen: true, title: 'Error', status: 'error', content: `An error occurred while unloading models: ${error.message}`, onConfirm: null, showCancel: false, confirmText: 'OK' });
                }
            }
        });
    };

    if (!isVramControlVisible) {
        // When the component is not visible, it's better to render nothing.
        // If there was an error fetching the strategy, the model list will be empty anyway.
        return null;
    }

    // If we are in an error state (e.g., backend is down), show a user-friendly message.
    if (vramErrorStateRef.current && loadedModels.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '200px', color: '#ccc', fontSize: '0.85rem', alignItems: 'center', justifyContent: 'center' }}>
                VRAM status unknown
            </div>
        );
    }
    
    const isAnyModelLoaded = loadedModels.some(m => m.loaded);

    const closeModal = () => setModalState({ ...modalState, isOpen: false });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '200px' }}>
            <Modal
                isOpen={modalState.isOpen}
                onClose={closeModal}
                onConfirm={modalState.onConfirm}
                title={modalState.title}
                confirmText={modalState.confirmText}
                showCancel={modalState.showCancel}
                status={modalState.status}
            >
                {modalState.content}
            </Modal>
            <style jsx>{`
                .vram-button { padding: 6px 10px; font-size: 0.85rem; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.2s, filter 0.2s; }
                .vram-button.clear-selected { background-color: #f0e68c; color: #333; }
                .vram-button.clear-all { background-color: #61dafb; color: #20232a; }
                .vram-button:hover:not(:disabled) { filter: brightness(0.9); }
                .vram-button:disabled { background-color: #cccccc !important; color: #666666 !important; cursor: not-allowed; filter: none; }
            `}</style>
            <div style={{ marginBottom: '5px', maxHeight: '80px', overflowY: 'auto', width: '100%' }}>
                {loadedModels.map(model => (
                    <label key={model.name} className="cache-line" style={{ fontSize: '0.85rem' }}>
                        <input type="checkbox" checked={selectedModelsToClear.has(model.name)} onChange={() => handleModelSelectionChange(model.name)} disabled={!model.loaded} />
                        <span className="cache-label-text" style={{ marginLeft: '8px' }}>{model.name}</span>
                        <span style={{ color: model.loaded ? '#86e58b' : '#ff7a7a', fontWeight: 'bold', minWidth: '65px', textAlign: 'right', marginLeft: 'auto' }}>
                            {model.loaded ? 'Loaded' : 'Unloaded'}
                        </span>
                    </label>
                ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <button className="vram-button clear-selected" disabled={selectedModelsToClear.size === 0} onClick={() => handleClearModels(Array.from(selectedModelsToClear))}>
                    Clear Selected
                </button>
                <button className="vram-button clear-all" disabled={!isAnyModelLoaded} onClick={() => handleClearModels([])}>
                    Clear All
                </button>
            </div>
        </div>
    );
});
VRAMManager.displayName = 'VRAMManager';

// The main Header component
const Header = ({ activePage, pageTitle, defaultClearImages, defaultClearVideos }) => {
    const cacheManagerRef = useRef(null);
    const vramManagerRef = useRef(null);

    // This useEffect hook manages polling and calls updates on child components via refs.
    useEffect(() => {
        const updateAllStatus = () => {
            if (cacheManagerRef.current) {
                cacheManagerRef.current.updateStatus();
            }
            if (vramManagerRef.current) {
                vramManagerRef.current.updateStatus();
            }
        };

        // This event allows other pages to trigger an immediate, on-demand update.
        window.addEventListener('forceHeaderUpdate', updateAllStatus);

        // Set up the polling for consistent background/cross-tab updates.
        const pollInterval = setInterval(updateAllStatus, 2000);

        updateAllStatus(); // Initial update on mount

        // Cleanup function to run when the component unmounts.
        return () => {
            window.removeEventListener('forceHeaderUpdate', updateAllStatus);
            clearInterval(pollInterval);
        };
    }, []);

    return (
        <header>
            <NavBar activePage={activePage} />
            <TitleBlock pageTitle={pageTitle} />
            <div className="cache-info-block" style={{ flexDirection: 'row', gap: '20px', alignItems: 'stretch', width: 'auto' }}>
                <CacheManager 
                    ref={cacheManagerRef}
                    defaultClearImages={defaultClearImages} 
                    defaultClearVideos={defaultClearVideos} 
                />
                <VRAMManager ref={vramManagerRef} />
            </div>
        </header>
    );
};

export default Header;
