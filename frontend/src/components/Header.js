/* frontend/src/components/Header.js */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

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
            // Only log the error and set UI to "Error" once to prevent console spam.
            if (!cacheErrorStateRef.current) {
                console.error("Failed to fetch cache status (backend may be down):", error);
                cacheErrorStateRef.current = true; // Set error state
                setImageCacheMb('Error');
                setVideoCacheMb('Error');
            }
        }
    }, []); // Empty dependencies, functional updates are used.

    // Expose the updateStatus function via the ref for the parent component to call for on-demand clearing.
    React.useImperativeHandle(ref, () => ({
        updateStatus
    }));

    // This useEffect hook sets up the listener for cache updates.
    useEffect(() => {
        window.addEventListener('forceCacheUpdate', updateStatus);
        // Cleanup on unmount
        return () => window.removeEventListener('forceCacheUpdate', updateStatus);
    }, [updateStatus]);

    const handleClear = async () => {
        if (!confirm(`Are you sure you want to clear the selected cache(s)?`)) return;
        try {
            const url = new URL('http://127.0.0.1:8000/api/clear_cache');
            url.searchParams.append('clear_images', clearImages);
            url.searchParams.append('clear_videos', clearVideos);
            const response = await fetch(url, { method: 'POST' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.detail || 'Failed to clear cache.');
            alert(result.message || 'Cache cleared successfully!');
            await updateStatus();
        } catch (error) {
            alert(`An error occurred: ${error.message}`);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '150px' }}>
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

const VRAMManager = () => {
    const [loadedModels, setLoadedModels] = useState([]);
    const [isVramControlVisible, setIsVramControlVisible] = useState(false);
    const [selectedModelsToClear, setSelectedModelsToClear] = useState(new Set());
    const vramErrorStateRef = useRef(false);

    const updateLoadedModelsStatus = useCallback(async () => {
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
                console.error("VRAMManager: Failed to fetch status (backend may be down):", error);
                vramErrorStateRef.current = true;
                setLoadedModels([]);
            }
        }
    }, []);

    useEffect(() => {
        const checkModelLoadingStrategy = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/model_loading_strategy');
                if (!response.ok) throw new Error(`Failed to fetch model loading strategy. Status: ${response.status}`);
                const data = await response.json();
                setIsVramControlVisible(!data.load_all_on_startup);
            } catch (error) {
                console.error("VRAMManager: Error checking model loading strategy:", error);
                setIsVramControlVisible(false);
            }
        };

        window.addEventListener('forceVRAMUpdate', updateLoadedModelsStatus);
        checkModelLoadingStrategy();
        
        return () => window.removeEventListener('forceVRAMUpdate', updateLoadedModelsStatus);
    }, [updateLoadedModelsStatus]);

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
        const confirmMsg = isClearingAll
            ? "Are you sure you want to unload ALL models from VRAM? This may cause a delay on subsequent requests."
            : `Are you sure you want to unload the selected models (${modelListStr}) from VRAM?`;
        if (!confirm(confirmMsg)) return;

        try {
            const response = await fetch('http://127.0.0.1:8000/api/unload_models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_names: modelsToClear })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.detail || 'Failed to unload models.');
            alert(result.message || 'Models unloaded successfully!');
            await updateLoadedModelsStatus(); // Force immediate refresh
        } catch (error) {
            alert(`An error occurred while unloading models: ${error.message}`);
        }
    };

    if (!isVramControlVisible) return null;

    const isAnyModelLoaded = loadedModels.some(m => m.loaded);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '200px' }}>
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
};

// The main Header component
const Header = ({ activePage, pageTitle, defaultClearImages, defaultClearVideos }) => {
    const cacheManagerRef = useRef(null);

    // This useEffect hook now only manages the polling and event listening.
    // It triggers updates in the child components.
    useEffect(() => {
        const handleForceUpdate = () => {
            // Dispatch specific events for child components to listen to.
            // This is more modular than calling refs directly in a polling loop.
            window.dispatchEvent(new CustomEvent('forceCacheUpdate'));
            window.dispatchEvent(new CustomEvent('forceVRAMUpdate'));
        };

        // For immediate updates triggered by page actions (e.g., after processing).
        // This single event is now broadcast to all children.
        window.addEventListener('forceHeaderUpdate', handleForceUpdate);

        // For consistent, background/cross-tab updates.
        const pollInterval = setInterval(handleForceUpdate, 2000);

        handleForceUpdate(); // Initial update on mount

        // Cleanup function to run when the component unmounts.
        return () => {
            window.removeEventListener('forceHeaderUpdate', handleForceUpdate);
            clearInterval(pollInterval);
        };
    }, []);

    return (
        <header>
            <NavBar activePage={activePage} />
            <TitleBlock pageTitle={pageTitle} />
            <div className="cache-info-block" style={{ flexDirection: 'row', gap: '20px', alignItems: 'stretch', width: 'auto' }}>
                <CacheManager 
                    ref={cacheManagerRef} // ref is kept for potential direct calls if needed in future
                    defaultClearImages={defaultClearImages} 
                    defaultClearVideos={defaultClearVideos} 
                />
                <VRAMManager />
            </div>
        </header>
    );
};

export default Header;
