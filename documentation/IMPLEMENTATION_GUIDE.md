<!-- documentation/IMPLEMENTATION_GUIDE.md -->  
# Uformer FastAPI Hub: Advanced Implementation Guide

**Document Version:** 1.0  
**Date:** 2025-06-20<br>
**Purpose:** This document provides a detailed technical explanation of the advanced architectural patterns implemented in the Uformer FastAPI Hub application. It is intended for developers, system architects, and future maintainers to understand the core logic for state management, concurrency safety, and automated cache handling.  

---

## 1. Core Architecture: Centralized Backend State

To enable complex, asynchronous operations and shared state across multiple API requests and background tasks, the application avoids local, ephemeral variables. Instead, it relies on a single, centralized, in-memory dictionary initialized at application startup.

**Location:** `backend/app/main.py`
**Object:** `app_models: Dict[str, Any]`

This dictionary is the **single source of truth** for all shared application state. It is injected into API endpoints via FastAPI's dependency injection system.

### 1.1. State Dictionary Keys

The `app_models` dictionary contains the following critical keys:

| Key                           | Type | Purpose                                                                                                                        |
| ----------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| `device`                      | `torch.device` | Stores the global PyTorch device (`cuda` or `cpu`) for all model operations.                                           |
| `load_all_on_startup`         | `bool` | A flag read from the `.env` file that dictates the VRAM management strategy (preload vs. on-demand).                         |
| `tasks_db`                    | `Dict` | Tracks the real-time status (`pending`, `processing`, `completed`, `failed`), progress, and results of all background tasks.      |
| `models_in_use`               | `Dict` | A reference counter (`{'model_name': count}`) to prevent unloading a model from VRAM while a task is actively using it.          |
| `in_progress_uploads`         | `Dict` | Tracks the absolute disk paths of raw video files that are currently being processed to protect them from premature deletion.      |
| `tracker_by_path`             | `Dict` | The primary tracker for **processed result files**. Maps a file's path to its detailed metadata object.                           |
| `path_by_task_id`             | `Dict` | A secondary index that maps a `task_id` to a result file's path for fast lookups.                                           |

## 2. Asynchronous Processing & Concurrency Safety

To provide a non-blocking user experience, all long-running operations (image and video processing) are handled as background tasks.

### 2.1. The "Start-and-Poll" Pattern

This pattern is used for both image and video file processing:

1.  **Initiation:** The frontend `POST`s the file to a `/api/process_*` endpoint.
2.  **Task Queuing:** The backend endpoint validates the request, saves the necessary files, creates a unique `task_id` (UUIDv4), adds an initial `'pending'` status to `tasks_db`, and queues the main processing function using FastAPI's `BackgroundTasks`.
3.  **Immediate Response:** The endpoint immediately returns a `202 Accepted` response to the frontend, containing the unique `task_id`. The UI thread is never blocked.
4.  **Polling:** The frontend enters a polling loop, periodically calling a `/api/*_status/{task_id}` endpoint.
5.  **Status Updates:** This status endpoint reads the task's current state directly from the central `tasks_db` and returns it. The background task is responsible for updating its own progress and status in `tasks_db` as it runs.
6.  **Completion:** When the poll response shows `'completed'`, the frontend stops polling and displays the final result.

### 2.2. VRAM Concurrency Protection (Reference Counting)

To prevent a model from being unloaded from VRAM while in use by another task, a reference counting system is implemented using the `models_in_use` dictionary.

*   **Increment:** When a processing task (image, video, or live stream) begins, it increments the count for its required model.
    ```python
    # Example from video_processing_task
    models_in_use[model_name] = models_in_use.get(model_name, 0) + 1
    ```
*   **Decrement:** In a `finally` block (guaranteeing execution even on error), the task decrements the count for the model it used.
    ```python
    # Example from video_processing_task's finally block
    if model_name in models_in_use:
        models_in_use[model_name] = max(0, models_in_use.get(model_name, 0) - 1)
    ```
*   **Check:** The `/api/unload_models` endpoint **must** check this counter before attempting to remove a model from VRAM. If the count for a model is greater than 0, the unload operation for that model is skipped, and the user is notified.

## 3. Production-Ready Cache Management System

This is the most complex system, designed to prevent premature file deletion while ensuring the server disk does not fill up with orphaned files.

### 3.1. Core Concepts

*   **Protection of In-Progress Uploads:** Raw video files are needed on disk for the entire duration of processing. They must be protected from manual cache clearing during this time.
*   **Protection of Active Results:** Processed files (images/videos) should not be deleted if a user is actively viewing them on the frontend.
*   **Protection of Downloaded Files:** After a user initiates a download, the file should be protected for a grace period to ensure the download can complete.
*   **Automated Cleanup:** The system must automatically identify and delete "abandoned" (undownloaded) and "expired" (downloaded long ago) files.

### 3.2. The Full File Lifecycle Flow

This flowchart describes the journey of a file from creation to deletion.

```text
START
  |
  V
[User Clicks "Process Video"]
  |
  +-> [Backend] POST /api/process_video
  |     |
  |     +-> Saves raw video to disk (e.g., /temp/.../uploads/video.mp4)
  |     +-> Adds absolute path to `in_progress_uploads` tracker. [FILE IS NOW PROTECTED]
  |     +-> Starts background task, returns `task_id`.
  |
  V
[Frontend] Begins polling /api/video_status/{task_id}
  |
  V
[Backend Task] `video_processing_task` runs...
  |
  V
[Backend Task] Task finishes successfully.
  |     |
  |     +-> Creates final result file (e.g., /temp/.../processed/enhanced.mp4)
  |     +-> **Removes** raw upload path from `in_progress_uploads`. [UPLOAD UNPROTECTED]
  |     +-> **Adds** result path to `tracker_by_path` with {status: 'active', created_at, last_heartbeat_at}. [RESULT IS NOW PROTECTED]
  |     +-> Updates `tasks_db` status to 'completed'.
  |
  V
[Frontend] Poll receives 'completed' status.
  |     |
  |     +-> Displays the processed video.
  |     +-> Stops the progress poll.
  |     +-> **Starts** the 5-minute heartbeat poll to POST /api/task_heartbeat.
  |
  V
[User Clicks "Download"]
  |
  +-> [Frontend] Initiates download.
  |     |
  |     +-> **Stops** the heartbeat poll.
  |     +-> Calls POST /api/confirm_download with the result path.
  |
  V
[Backend] /api/confirm_download receives call.
  |     |
  |     +-> Finds file in `tracker_by_path`.
  |     +-> Updates status to 'downloaded' and sets `downloaded_at` timestamp. [GRACE PERIOD STARTED]
  |
  V
[Cleanup Task] Runs periodically.
      |
      +-> Checks all tracked files against deletion rules.
      +-> If (current_time - downloaded_at > GRACE_PERIOD) -> DELETES FILE
      +-> If (status is 'active' AND current_time - last_heartbeat_at > TIMEOUT) -> DELETES FILE
```

### 3.3. The "Unprotected" File Deletion Rules

A file is eligible for deletion if it meets **ANY ONE** of the following conditions:

1.  **It is an in-progress upload, AND its path is NOT in the `in_progress_uploads` tracker.**
2.  **It is a processed result file, AND its `status` is `'downloaded'`, AND the time since `downloaded_at` exceeds its configured grace period** (`IMAGE_DOWNLOAD_GRACE_PERIOD_MINUTES` or `VIDEO_DOWNLOAD_GRACE_PERIOD_MINUTES`).
3.  **It is a processed result file, AND its `status` is `'active'`, AND the time since `last_heartbeat_at` exceeds the `HEARTBEAT_TIMEOUT_MINUTES`.**

### 3.4. Manual vs. Automatic Cleanup

*   **Manual (`/api/clear_cache`):** This endpoint iterates through all files on disk and applies the "Unprotected" rules above to decide which files to delete. It returns a detailed JSON object (`{cleared_count, skipped_..._count}`) for the frontend.
*   **Automatic (`periodic_cache_cleanup_task`):** This background task is scheduled at application startup **only if `ENABLE_AUTOMATIC_CACHE_CLEANUP=True`**. It runs the exact same deletion logic as the manual cleanup on a recurring interval.

## 4. Frontend Architecture & UI Feedback

The frontend is built on modern React principles to ensure a stable and responsive user experience.

*   **Centralized Configuration (`frontend/src/config.js`):** All API endpoints and polling intervals are stored in a single file for easy maintenance.
*   **Shared `Layout` Component:** A single `Layout` component wraps all pages, providing a consistent `Header`. This `Header` contains the VRAM and Cache management UI, ensuring functionality is reusable and not duplicated.
*   **State-Driven UI:** All pages (`image-processor.js`, `video-processor.js`) are built using React `useState` hooks. UI elements are declaratively bound to state variables (`<button disabled={isProcessing}>`). This avoids direct DOM manipulation and prevents common UI bugs.
*   **Dynamic Modal System (`frontend/src/components/Modal.js`):**
    *   A reusable `Modal` component is used for all user alerts and confirmations.
    *   Backend endpoints return structured JSON responses (e.g., `{ "cleared_count": 1, "skipped_count": 2 }`).
    *   The frontend components use this structured data to build detailed, multi-line, grammatically correct messages.
    *   The modal's appearance (color of the title, border, and button) changes dynamically based on a `status` prop (`'success'`, `'warning'`, `'error'`) that is determined by the outcome of the API call. This provides clear, immediate, and intuitive visual feedback to the user.

---
This document outlines the key architectural decisions that make the Uformer FastAPI Hub a robust, scalable, and user-friendly application.
