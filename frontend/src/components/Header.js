/* frontend/src/components/Header.js */
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// The CacheManager component is now internal to the Header
const CacheManager = ({ defaultClearImages, defaultClearVideos }) => {
    const [imageCacheMb, setImageCacheMb] = useState('...');
    const [videoCacheMb, setVideoCacheMb] = useState('...');
    // The state is now initialized from props
    const [clearImages, setClearImages] = useState(defaultClearImages);
    const [clearVideos, setClearVideos] = useState(defaultClearVideos);

    const updateStatus = useCallback(async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/api/cache_status');
            if (!response.ok) throw new Error("Failed to fetch cache status");
            const data = await response.json();
            setImageCacheMb(data.image_cache_mb);
            setVideoCacheMb(data.video_cache_mb);
        } catch (error) {
            console.error(error);
            setImageCacheMb('Error');
            setVideoCacheMb('Error');
        }
    }, []);

    useEffect(() => {
        updateStatus();
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
};

// The main Header component
const Header = ({ activePage, pageTitle, defaultClearImages, defaultClearVideos }) => {
    const [loadedModels, setLoadedModels] = useState([]);
    const [isVramControlVisible, setIsVramControlVisible] = useState(false);
    const [selectedModelsToClear, setSelectedModelsToClear] = useState(new Set());

    const updateLoadedModelsStatus = useCallback(async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/api/loaded_models_status');
            if (!response.ok) throw new Error("Failed to fetch loaded models status.");
            const data = await response.json();
            setLoadedModels(data.models || []);
            setSelectedModelsToClear(prev => {
                const newSet = new Set(prev);
                (data.models || []).forEach(model => {
                    if (!model.loaded && newSet.has(model.name)) {
                        newSet.delete(model.name);
                    }
                });
                return newSet;
            });
        } catch (error) {
            console.error("Failed to fetch loaded models status:", error);
            setLoadedModels([]);
        }
    }, []);

    useEffect(() => {
        async function checkModelLoadingStrategy() {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/model_loading_strategy');
                if (!response.ok) throw new Error(`Failed to fetch model loading strategy. Status: ${response.status}`);
                const data = await response.json();
                setIsVramControlVisible(!data.load_all_on_startup);
            } catch (error) {
                console.error("Error in checkModelLoadingStrategy:", error);
                setIsVramControlVisible(false);
            }
        }
        checkModelLoadingStrategy();
        updateLoadedModelsStatus();

        // We can poll here if needed, or rely on page-level logic to trigger updates.
        // For now, it updates on mount.
        const interval = setInterval(updateLoadedModelsStatus, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);

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
            await updateLoadedModelsStatus();
        } catch (error) {
            alert(`An error occurred while unloading models: ${error.message}`);
        }
    };
    
    const isAnyModelLoaded = loadedModels.some(m => m.loaded);

    return (
        <header>
            <div className="nav-bar">
                <Link href="/" className={`nav-button ${activePage === 'live' ? 'active' : ''}`}>Live Stream</Link>
                <Link href="/video-processor" className={`nav-button ${activePage === 'video' ? 'active' : ''}`}>Video File</Link>
                <Link href="/image-processor" className={`nav-button ${activePage === 'image' ? 'active' : ''}`}>Image File</Link>
            </div>
            <div className="title-block">
                <h1>🦉 NocturaVision <span style={{ fontWeight: 300, color: '#ccc' }}>| Uformer</span></h1>
                <p>{pageTitle}</p>
            </div>
            <div className="cache-info-block" style={{ flexDirection: 'row', gap: '20px', alignItems: 'stretch', width: 'auto' }}>
                <CacheManager 
                    defaultClearImages={defaultClearImages} 
                    defaultClearVideos={defaultClearVideos} 
                />
                {isVramControlVisible && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '200px' }}>
                        <style jsx>{`
                            .vram-button { padding: 6px 10px; font-size: 0.85rem; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.2s, filter 0.2s; }
                            .vram-button.clear-selected { background-color: #f0e68c; color: #333; }
                            .vram-button.clear-all { background-color: #61dafb; color: #20232a; }
                            .vram-button:hover:not(:disabled) { filter: brightness(0.9); }
                            /* This is the correct disabled style from the screenshot. */
                            .vram-button:disabled {
                                background-color: #cccccc !important; /* Use a light gray background */
                                color: #666666 !important; /* Use a darker gray for the text */
                                cursor: not-allowed;
                                filter: none;
                            }
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
                )}
            </div>
        </header>
    );
};

export default Header;
