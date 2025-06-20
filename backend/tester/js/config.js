/* backend/tester/js/config.js */
// A direct copy of "frontend/src/config.js"
// This file centralizes configuration constants.

const config = {
    // API Endpoints
    API_BASE_URL: 'http://127.0.0.1:8000',
    WEBSOCKET_URL: 'ws://127.0.0.1:8000/ws/process_video',

    // Polling Intervals (in milliseconds)
    HEADER_STATUS_POLL_INTERVAL_MS: 2000,          // For VRAM and Cache status in the Header.
    IMAGE_STATUS_POLL_INTERVAL_MS: 2000,           // For checking image processing progress.
    VIDEO_STATUS_POLL_INTERVAL_MS: 3000,           // For checking video processing progress (for future use).
    HEARTBEAT_POLL_INTERVAL_MS: 5 * 60 * 1000,     // 5 minutes, for the cache heartbeat signal.
};

export default config;
