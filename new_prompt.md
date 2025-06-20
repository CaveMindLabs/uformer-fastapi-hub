Hello. I have a working Next.js frontend and a FastAPI backend. I now want to consolidate this into a single, self-contained application where the FastAPI backend serves all the frontend assets as static files.

The goal is to translate the functionality of my Next.js application into a "Vanilla JS" Single-Page Application (SPA) built with static HTML, CSS, and JavaScript files. This will eliminate the need for a separate `npm run build` or `npm run dev` step for the frontend.

### **The Required Architecture**

1.  **Single Entry Point:** We will create a single `backend/static/index.html` file that will serve as the shell for the entire application.
2.  **Dynamic Content Loading:** When a user clicks a navigation button (e.g., "Image File"), the corresponding page's content (HTML structure and its logic) should be dynamically loaded into a main content area of `index.html` using JavaScript. The page should not fully reload.
3.  **Component-Based JavaScript:** The logic for reusable UI elements, like the `Header` and the `Modal`, should be encapsulated in their own JavaScript files (`.js`) within a `components` directory. These will be plain JavaScript modules that export functions to create and manage their respective DOM elements.
4.  **Page-Specific Logic:** The logic for each "page" (Live Stream, Image Processor, Video Processor) will be in its own `.js` file. Each file will be responsible for providing the HTML content and attaching all the necessary event listeners for that specific mode.
5.  **Centralized Configuration:** A `config.js` file will store all API endpoints and other constants, just like in the Next.js app.
6.  **Backend Serving:** The FastAPI application (`main.py`) must be configured to serve the `static/` directory and route all non-API requests to the `index.html` file to enable the SPA routing.

### **Proposed New File Structure within `backend/`**
```text
backend/
├── static/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── components/
│   │   │   ├── Header.js
│   │   │   └── Modal.js
│   │   ├── pages/
│   │   │   ├── LiveStreamPage.js
│   │   │   ├── ImageProcessorPage.js
│   │   │   └── VideoProcessorPage.js
│   │   ├── config.js
│   │   └── main.js
│   └── index.html
├── app/
│   └── ... (rest of the FastAPI app remains the same)
└── ...
```

### **Your Task**

Your task is to take the provided code from my existing Next.js application and translate it into this new static SPA architecture. This involves:
1.  Creating the new file structure under `backend/static/`.
2.  Rewriting the React components (`.js` files with JSX) into plain JavaScript modules that manipulate the DOM.
3.  Creating a main JavaScript file (`main.js`) to handle the SPA routing and initialization.
4.  Creating the main `index.html` shell.
5.  Modifying `backend/app/main.py` to serve the static files correctly.

You must ensure that all existing functionality—including the asynchronous processing, polling, WebSockets, VRAM/cache management, and the robust modal feedback system—is fully preserved in the new static version.

I will provide the contents of all the relevant Next.js files and the current `main.py`. Please begin by confirming the plan and then proceed with generating the new files.















------
Hello, I need to implement a robust, non-blocking, and scalable processing flow for the Image Processor page in my Next.js application.

### **Current Application State & Problem**

My application has a shared, reusable `Header.js` component which is already stable. It correctly polls the backend for VRAM and cache status, handles backend disconnections gracefully, and is properly decomposed into smaller, memoized components to prevent unnecessary re-renders.

The core problem is now isolated to the **Image Processor page (`image-processor.js`)** and its corresponding backend endpoint (`/api/process_image`).

1.  **Synchronous, Blocking API:** The current "Process Image" button triggers a synchronous `await fetch()` call that blocks the browser’s UI thread. The backend endpoint performs the entire, time-consuming image enhancement task before returning a response.
2.  **Inconsistent VRAM Status:** This blocking behavior prevents the `Header` on the Image Processor page from updating its VRAM status in real-time. While other open tabs correctly show a model as "Loaded" via polling, the requesting page’s UI is frozen and only updates after the task is fully complete, creating a confusing and inconsistent user experience.
3.  **Lack of Scalability and Feedback:** The current "fire-and-wait" approach provides no progress feedback to the user and does not scale well. It is fundamentally different from the more robust background task system used by the video processor.

### **The Required Solution: A Unified, Scalable Architecture**

The entire application must be unified under a single, scalable, non-blocking architectural pattern for long-running jobs. The Image Processor must be refactored to use an asynchronous background task system.

**This solution has two distinct parts:**

**Part 1: Backend Refactoring**

The backend must be modified to handle image processing as a background task. This involves:

*   **Shared State Management:** A central, in-memory dictionary (`tasks_db` in `app/main.py`) will be the single source of truth for the status of all background tasks (both video and image).
*   **Non-Blocking Endpoint:** The `/api/process_image` endpoint must be rewritten. Its sole responsibilities will be to:
    1.  Validate the request and ensure the required model is loaded into VRAM (this is a fast, synchronous step).
    2.  Create a unique `task_id`.
    3.  Add the image processing job to FastAPI’s `BackgroundTasks` queue.
    4.  Instantly return a `202 Accepted` response containing the `task_id`.
*   **Status Polling Endpoint:** A new endpoint, `/api/image_status/{task_id}`, must be created. This endpoint will be polled by the frontend. It will inspect the shared `tasks_db` and return the current status of the task (`pending`, `processing`, `completed`, or `failed`).
*   **Scalable Result Delivery (Option B):** Upon successful completion, the status object returned by `/api/image_status/{task_id}` **must** be updated to include the final `result_path` key (e.g., `{ "status": "completed", "result_path": "/path/to/image.jpg" }`). **There will be no separate `/download_image` endpoint.** The frontend will construct the download URL from this path.

**Part 2: Frontend Refactoring**

The `frontend/src/pages/image-processor.js` page must be rewritten to work with this new asynchronous flow. This involves:

*   **Initiating the Task:** The `onclick` handler for the "Process Image" button will make a quick, non-blocking `fetch` call to `/api/process_image` and store the returned `task_id`.
*   **Polling for Status:** Upon receiving the `task_id`, a `setInterval` loop will be initiated to poll the `/api/image_status/{task_id}` endpoint every 2-3 seconds.
*   **Dynamic UI Feedback:** The UI will be updated in real-time based on the response from the status poll. This includes disabling buttons, showing a "Processing..." message with progress, and handling potential errors.
*   **Displaying the Result:** When the poll response indicates `"status": "completed"`, the polling interval will be cleared. The frontend will then use the `result_path` from the response to construct the final URL for the "Download" button and the processed image preview.

This will resolve the UI blocking, provide a vastly improved and informative user experience, and align the image processing architecture with a consistent, scalable pattern.

---

Here are the names of the relevant files you will need:

*   `backend/app/main.py`
*   `frontend/src/components/Header.js`
*   `backend/app/api/endpoints/image_file_processing.py`
*   `frontend/src/pages/image-processor.js`

---

## Communication & Implementation Protocol

To ensure stability, minimize risk, and maintain a clear history of changes, all modifications to the codebase will follow a strict, targeted protocol. This method has been highly successful and must be adhered to in all future interactions.

---

### **1. Guiding Principles**

*   **Focused Implementation:** I will address one specific task at a time (e.g., a single UI page, one backend feature). I will await your explicit confirmation that a step is complete and satisfactory before moving to the next.
*   **User-Driven Changes & UI Integrity:** All code provided is a direct implementation of your request. I will not introduce unrequested features or architectural changes. My role is to implement your vision precisely and carefully, ensuring existing UI structure, styling, and user experience are maintained ("don't mess up my UI").

---

### **2. The Required Method: Targeted "Find & Replace"**

The default and mandatory method for making *any* code change is to provide precise "find and replace" instructions. This preserves the context of the surrounding code and makes reviewing changes fast and safe.

The format must be as follows:

```markdown
**File:** `path/to/your/file.py`

**Find this block of code:**
```python
# The starting line of the block to be replaced.
# This must be an exact, copy-pasteable match from the current file.
# It should include enough lines to be unique.
def some_function(param1, param2):
    return param1 + param2
# The ending line of the block.
```

**Replace it with this new block of code:**
```python
# The new code that replaces the 'found' block.
# This should also be an exact, copy-pasteable block.
def some_function(param1, param2, param3=None): # Example change
    # A comment explaining the change can be here
    result = param1 + param2
    if param3:
        result *= param3
    return result
```
*__Reasoning:__ A brief, one-line explanation of *why* the change is being made is highly encouraged, as it aids in understanding the logic.*

---

### **3. Regarding Full File Replacements**

**Full file rewrites are to be avoided almost universally.** They carry a significant risk of introducing unintended bugs, destroying existing work, and making reviews incredibly difficult.

A full file replacement is only permissible under one of two strict conditions:
1.  A file is being **created from scratch**.
2.  In the extremely rare event that a file requires so many widespread, non-contiguous changes that a series of "Find & Replace" blocks would be genuinely more confusing than the full file. This must be **explicitly justified and approved beforehand**.

---

### **4. Key Project Constraints & Operational Details**

This section outlines specific requirements for file management, VRAM handling, and frontend development.

#### **4.1. Project Structure & File Management**

*   **HTML Files Preservation**: The original static HTML files in the `backend/` directory (`image_processor.html`, `video_processor.html`, `wstest_uformer.html`) are to be **retained** for debugging and quick prototyping purposes. They will *not* be removed from the repository.
*   **`Pipfile.lock`**: The Python dependency lock file (`backend/Pipfile.lock`) is **essential for reproducible builds** and **must be committed** to the repository. It will not be ignored by Git.
*   **Line Endings (`LF`/`CRLF`)**: Warnings from Git related to line ending conversions are understood to be normal behavior on Windows and can be safely ignored.
*   **File Header Comments**: All relevant code files (Python, JavaScript, CSS, etc.) will include a header comment indicating their full path (e.g., `/* frontend/src/styles/globals.css */`).

#### **4.2. VRAM Management Strategy (Adaptive Loading)**

This strategy is for managing GPU VRAM usage on the backend:

*   **`LOAD_ALL_MODELS_ON_STARTUP` (`.env` variable)**: This environment variable (located in `backend/.env`) controls the initial model loading behavior:
    *   **`True`**: All Uformer models (denoise_b, denoise_16, deblur_b) will be pre-loaded into VRAM on FastAPI server startup. This offers the best immediate performance but uses more VRAM initially.
    *   **`False`**: Models will **NOT** be pre-loaded on startup. Instead, they will be loaded **on-demand** (the first time a specific model is requested via an API endpoint).
*   **On-Demand Caching (When `LOAD_ALL_MODELS_ON_STARTUP=False`)**: Once a model is loaded on-demand, it will be **cached in VRAM** within the `app_models` dictionary and will remain there.
    *   **Crucial Point**: Models will **not** be automatically unloaded or de-allocated when a different model is selected or when a frontend page is closed. This is vital to prevent crashes and race conditions in a concurrent API server environment.
    *   **Accumulation**: If multiple distinct models are requested (e.g., `denoise_b`, then `deblur_b`), they will both accumulate in VRAM.
*   **Explicit VRAM Clearing (When `LOAD_ALL_MODELS_ON_STARTUP=False`)**: A "Clear All Models from VRAM" button will be provided in the UI.
    *   This button will trigger a specific API endpoint (`/api/unload_models`) that will **explicitly unload ALL currently loaded models** from `app_models` and clear the CUDA cache (`torch.cuda.empty_cache()`).
    *   **Conditional UI Visibility/Activity for VRAM Controls**:
        *   The "Clear All Models from VRAM" button will **only be visible and active** in the UI if `LOAD_ALL_MODELS_ON_STARTUP` is set to `False` in the backend's `.env` file.
        *   The button will be **disabled** if no models are currently loaded in VRAM (i.e., `app_models` contains only 'device' and 'load_all_on_startup').
        *   The button will be **enabled** if one or more models are loaded in VRAM (in the on-demand loading scenario).
        *   The UI will also display a list of currently *loaded* models (with checkboxes) that can be cleared individually. These checkboxes will be disabled if the corresponding model is not currently loaded in VRAM.

#### **4.3. Frontend Development (Next.js)**

*   **Framework Choice**: Next.js (using the Pages Router) is the chosen frontend framework.
*   **Page Separation**: Each distinct "mode" (Live Stream, Video File, Image File) will remain a separate Next.js page/file (`index.js`, `video-processor.js`, `image-processor.js`) to maintain modularity and avoid large, monolithic files. The control panel for each mode will remain specific to its page and will not be centralized.

---

## General Pitfalls & Context (Critical for Success)

This section serves as the "institutional memory" of the project, capturing critical lessons learned from previous development cycles. Adhering to these principles is essential to avoid re-introducing bugs and to ensure a smooth, efficient workflow.

*   **The sRGB Data Requirement:** Remember, the Uformer models were originally trained on the **SIDD sRGB PNG dataset**. The backend pipeline is designed to correctly handle user-provided RAW files by first developing them into a compatible 8-bit sRGB format before model inference. This step is crucial for achieving the desired enhancement results.

*   **Access to Original Uformer Repository:** As the user, you possess the full original Uformer repository. If any questions arise regarding specific model parameters, data preprocessing pipelines for different tasks (e.g., deblurring), or subtle model behaviors, I can refer to and analyze the contents of any necessary files from that repository.
*   **Service-Oriented Design & Adaptive VRAM Management:** This project is engineered as a containerized, service-oriented hub, featuring a FastAPI backend and a Next.js frontend. A key architectural decision for managing GPU resources is the adaptive VRAM loading strategy, which facilitates on-demand model loading and explicit VRAM clearing via the UI. More detailed information on this strategy can be found in the "Communication & Implementation Protocol" section.

*   **The Golden Rule of React: Use State, Not Direct DOM Manipulation.** This is the most critical lesson from our work. Many UI bugs (e.g., a button not staying disabled) were caused by trying to modify the DOM directly (e.g., `element.disabled = true`). React's re-render cycle will overwrite these manual changes. **The solution is always to use `useState` to create a state variable and bind the element's property (e.g., `disabled={isButtonDisabled}`) to that state.** This makes the UI declarative and predictable.

*   **Decompose Monolithic Components.** The initial `index.js` file was a "monolith" managing streaming, VRAM, and caching logic all at once. This created complex state interactions and bugs. The successful refactor involved breaking out logic into smaller, self-contained components like `CacheManager` and `VRAMManager`. **When a component becomes too complex, the correct pattern is to isolate functionality into its own component with its own state.**

*   **Style with CSS Classes, Not Inline Styles.** Buttons were not showing their disabled or hover effects because inline `style` props were overriding the global CSS. **To ensure consistent styling for states like `:disabled` and `:hover`, remove inline styles from the element and control its appearance with CSS classes or a component-scoped `<style jsx>` block.**

*   **Poll for Background State Changes.** The UI needs to reflect backend state that can change without direct user interaction (e.g., a model loading on-demand). The correct pattern for this is polling. **When the frontend needs to stay in sync with a changing backend state during an operation, use `setInterval` to periodically call an update function, and `clearInterval` when the operation is complete.**

This structured plan will guide us in systematically building out the full-featured `uformer-fastapi-hub`.
------












------
# Project Handover: uformer-fastapi-hub - Phase 2 (Productionization & Expansion)

## Project Overview

**Project:** uformer-fastapi-hub
**Current Phase:** Phase 1 (Core Debugging) is complete. Phase 2 focuses on evolving this validated core into a polished, multi-modal, and user-friendly hub for image restoration tasks.

**Project Vision:**
Transform the debugged proof-of-concept into a turnkey, service-oriented toolkit for image restoration. This hub provides a robust FastAPI backend serving multiple Uformer models (for denoising, deblurring, and potentially more tasks), managed by a responsive Next.js frontend. It is designed for developers who need a production-grade, resource-aware, and easy-to-deploy solution for low-level vision tasks.

**Current State & Core Successes:**
The previous phase was a critical success. Through an exhaustive debugging process, we have:
*   **Validated the Denoising Pipeline:** Confirmed that the `Uformer-B` model performs high-quality denoising when fed the correct `sRGB PNG` data from the SIDD dataset.
*   **Uncovered Critical Undocumented Steps:** Identified that the official models were trained not on RAW data, but on a pre-processed sRGB dataset. The backend now correctly mimics this pipeline, which was the key to achieving the desired output.
*   **Implemented a Robust Patching Pipeline:** Correctly implemented the patch-based processing necessary for handling high-resolution images and videos, which is essential for quality results.
*   **Built a Complete Application Core:** The FastAPI backend, including WebSocket streaming, background video processing, and file handling, is fully operational and serves as a solid foundation.

---
## Phased Implementation Overview (Historical)

This project has been developed sequentially through distinct phases. The following outlines the objectives for each phase, with the understanding that most tasks within Phases 2.1 through 2.3 are now complete, and significant progress has been made on Phase 2.4.

### **Phase 2.1: Multi-Model Backend & Dynamic UI Controls**

**Objective:** Refactor the backend to serve multiple models simultaneously and update the frontend to control them dynamically.
*(This phase has been completed as detailed in the Project Progress Summary.)*

---

### **Phase 2.2: Cache Management & UI Integration**

**Objective:** Implement a backend system for managing temporary files and connect it to a user-friendly UI control.
*(This phase has been completed as detailed in the Project Progress Summary.)*

---

### **Phase 2.3: Deblurring Model Integration**

**Objective:** Expand the hub's capabilities by integrating the motion deblurring Uformer model.
*(This phase has been completed as detailed in the Project Progress Summary.)*

---

### **Phase 2.4: Final Polish & Documentation**

**Objective:** Add final UX improvements and prepare comprehensive documentation for public use.

**Remaining Tasks (Current Focus):**
1.  **VRAM Management UI Enhancement:** Fully implement the "Clear All Models from VRAM" button's conditional behavior (visibility, enabled/disabled state) and the display/selection of individual loaded models with checkboxes across all frontend pages (`index.js`, `video-processor.js`, `image-processor.js`).
2.  **Comprehensive Documentation (`README.md`):** Create the final `README.md` including:
    *   Updated project title.
    *   A "Motivation" section detailing the challenges of the original repo and the value of this production-ready hub.
    *   Clear setup and running instructions.
    *   A "Usage" guide for all features.
    *   A "Weights & Data" section with links to the model weights and sample test images on a cloud drive, and a link to the official SIDD dataset page.

---

## Communication & Implementation Protocol

To ensure stability, minimize risk, and maintain a clear history of changes, all modifications to the codebase will follow a strict, targeted protocol. This method has been highly successful and must be adhered to in all future interactions.

---

### **1. Guiding Principles**

*   **Focused Implementation:** I will address one specific task at a time (e.g., a single UI page, one backend feature). I will await your explicit confirmation that a step is complete and satisfactory before moving to the next.
*   **User-Driven Changes & UI Integrity:** All code provided is a direct implementation of your request. I will not introduce unrequested features or architectural changes. My role is to implement your vision precisely and carefully, ensuring existing UI structure, styling, and user experience are maintained ("don't mess up my UI").

---

### **2. The Required Method: Targeted "Find & Replace"**

The default and mandatory method for making *any* code change is to provide precise "find and replace" instructions. This preserves the context of the surrounding code and makes reviewing changes fast and safe.

The format must be as follows:

```markdown
**File:** `path/to/your/file.py`

**Find this block of code:**
```python
# The starting line of the block to be replaced.
# This must be an exact, copy-pasteable match from the current file.
# It should include enough lines to be unique.
def some_function(param1, param2):
    return param1 + param2
# The ending line of the block.
```

**Replace it with this new block of code:**
```python
# The new code that replaces the 'found' block.
# This should also be an exact, copy-pasteable block.
def some_function(param1, param2, param3=None): # Example change
    # A comment explaining the change can be here
    result = param1 + param2
    if param3:
        result *= param3
    return result
```
*__Reasoning:__ A brief, one-line explanation of *why* the change is being made is highly encouraged, as it aids in understanding the logic.*

---

### **3. Regarding Full File Replacements**

**Full file rewrites are to be avoided almost universally.** They carry a significant risk of introducing unintended bugs, destroying existing work, and making reviews incredibly difficult.

A full file replacement is only permissible under one of two strict conditions:
1.  A file is being **created from scratch**.
2.  In the extremely rare event that a file requires so many widespread, non-contiguous changes that a series of "Find & Replace" blocks would be genuinely more confusing than the full file. This must be **explicitly justified and approved beforehand**.

---

### **4. Key Project Constraints & Operational Details**

This section outlines specific requirements for file management, VRAM handling, and frontend development.

#### **4.1. Project Structure & File Management**

*   **HTML Files Preservation**: The original static HTML files in the `backend/` directory (`image_processor.html`, `video_processor.html`, `wstest_uformer.html`) are to be **retained** for debugging and quick prototyping purposes. They will *not* be removed from the repository.
*   **`Pipfile.lock`**: The Python dependency lock file (`backend/Pipfile.lock`) is **essential for reproducible builds** and **must be committed** to the repository. It will not be ignored by Git.
*   **Line Endings (`LF`/`CRLF`)**: Warnings from Git related to line ending conversions are understood to be normal behavior on Windows and can be safely ignored.
*   **File Header Comments**: All relevant code files (Python, JavaScript, CSS, etc.) will include a header comment indicating their full path (e.g., `/* frontend/src/styles/globals.css */`).

#### **4.2. VRAM Management Strategy (Adaptive Loading)**

This strategy is for managing GPU VRAM usage on the backend:

*   **`LOAD_ALL_MODELS_ON_STARTUP` (`.env` variable)**: This environment variable (located in `backend/.env`) controls the initial model loading behavior:
    *   **`True`**: All Uformer models (denoise_b, denoise_16, deblur_b) will be pre-loaded into VRAM on FastAPI server startup. This offers the best immediate performance but uses more VRAM initially.
    *   **`False`**: Models will **NOT** be pre-loaded on startup. Instead, they will be loaded **on-demand** (the first time a specific model is requested via an API endpoint).
*   **On-Demand Caching (When `LOAD_ALL_MODELS_ON_STARTUP=False`)**: Once a model is loaded on-demand, it will be **cached in VRAM** within the `app_models` dictionary and will remain there.
    *   **Crucial Point**: Models will **not** be automatically unloaded or de-allocated when a different model is selected or when a frontend page is closed. This is vital to prevent crashes and race conditions in a concurrent API server environment.
    *   **Accumulation**: If multiple distinct models are requested (e.g., `denoise_b`, then `deblur_b`), they will both accumulate in VRAM.
*   **Explicit VRAM Clearing (When `LOAD_ALL_MODELS_ON_STARTUP=False`)**: A "Clear All Models from VRAM" button will be provided in the UI.
    *   This button will trigger a specific API endpoint (`/api/unload_models`) that will **explicitly unload ALL currently loaded models** from `app_models` and clear the CUDA cache (`torch.cuda.empty_cache()`).
    *   **Conditional UI Visibility/Activity for VRAM Controls**:
        *   The "Clear All Models from VRAM" button will **only be visible and active** in the UI if `LOAD_ALL_MODELS_ON_STARTUP` is set to `False` in the backend's `.env` file.
        *   The button will be **disabled** if no models are currently loaded in VRAM (i.e., `app_models` contains only 'device' and 'load_all_on_startup').
        *   The button will be **enabled** if one or more models are loaded in VRAM (in the on-demand loading scenario).
        *   The UI will also display a list of currently *loaded* models (with checkboxes) that can be cleared individually. These checkboxes will be disabled if the corresponding model is not currently loaded in VRAM.

#### **4.3. Frontend Development (Next.js)**

*   **Framework Choice**: Next.js (using the Pages Router) is the chosen frontend framework.
*   **Page Separation**: Each distinct "mode" (Live Stream, Video File, Image File) will remain a separate Next.js page/file (`index.js`, `video-processor.js`, `image-processor.js`) to maintain modularity and avoid large, monolithic files. The control panel for each mode will remain specific to its page and will not be centralized.

---

## General Pitfalls & Context (Critical for Success)

This section serves as the "institutional memory" of the project, capturing critical lessons learned from previous development cycles. Adhering to these principles is essential to avoid re-introducing bugs and to ensure a smooth, efficient workflow.

*   **The sRGB Data Requirement:** Remember, the Uformer models were originally trained on the **SIDD sRGB PNG dataset**. The backend pipeline is designed to correctly handle user-provided RAW files by first developing them into a compatible 8-bit sRGB format before model inference. This step is crucial for achieving the desired enhancement results.

*   **Access to Original Uformer Repository:** As the user, you possess the full original Uformer repository. If any questions arise regarding specific model parameters, data preprocessing pipelines for different tasks (e.g., deblurring), or subtle model behaviors, I can refer to and analyze the contents of any necessary files from that repository.
*   **Service-Oriented Design & Adaptive VRAM Management:** This project is engineered as a containerized, service-oriented hub, featuring a FastAPI backend and a Next.js frontend. A key architectural decision for managing GPU resources is the adaptive VRAM loading strategy, which facilitates on-demand model loading and explicit VRAM clearing via the UI. More detailed information on this strategy can be found in the "Communication & Implementation Protocol" section.

*   **The Golden Rule of React: Use State, Not Direct DOM Manipulation.** This is the most critical lesson from our work. Many UI bugs (e.g., a button not staying disabled) were caused by trying to modify the DOM directly (e.g., `element.disabled = true`). React's re-render cycle will overwrite these manual changes. **The solution is always to use `useState` to create a state variable and bind the element's property (e.g., `disabled={isButtonDisabled}`) to that state.** This makes the UI declarative and predictable.

*   **Decompose Monolithic Components.** The initial `index.js` file was a "monolith" managing streaming, VRAM, and caching logic all at once. This created complex state interactions and bugs. The successful refactor involved breaking out logic into smaller, self-contained components like `CacheManager` and `VRAMManager`. **When a component becomes too complex, the correct pattern is to isolate functionality into its own component with its own state.**

*   **Style with CSS Classes, Not Inline Styles.** Buttons were not showing their disabled or hover effects because inline `style` props were overriding the global CSS. **To ensure consistent styling for states like `:disabled` and `:hover`, remove inline styles from the element and control its appearance with CSS classes or a component-scoped `<style jsx>` block.**

*   **Poll for Background State Changes.** The UI needs to reflect backend state that can change without direct user interaction (e.g., a model loading on-demand). The correct pattern for this is polling. **When the frontend needs to stay in sync with a changing backend state during an operation, use `setInterval` to periodically call an update function, and `clearInterval` when the operation is complete.**

This structured plan will guide us in systematically building out the full-featured `uformer-fastapi-hub`.

---

## Project Progress Summary

We have successfully completed **Phase 2.3: Deblurring Model Integration** and **Phase 2.4: Final Polish & Documentation (Frontend Migration & VRAM Management)**.

### **Summary of Completed Work:**

#### **Phase 2.1: Multi-Model Backend & Dynamic UI Controls (COMPLETED)**
*   **Backend:** Refactored `backend/app/api/dependencies.py` to define and manage multiple Uformer models (`denoise_b`, `denoise_16`, `deblur_b`).
*   **API Endpoints:** Modified `image_file_processing.py`, `video_file_processing.py`, and `live_stream_processing.py` to accept `model_name` and `task_type` parameters, using the new `get_model_by_name` dependency for flexible model retrieval.
*   **HTML UIs:** Integrated "Task" and dynamic "Model" selection dropdowns into all three original HTML pages (`wstest_uformer.html`, `video_processor.html`, `image_processor.html`).

#### **Phase 2.2: Cache Management & UI Integration (COMPLETED)**
*   **Backend:** Created `backend/app/api/endpoints/cache_management.py` with `GET /api/cache_status` and `POST /api/clear_cache` endpoints.
*   **HTML UIs:** Implemented "Image Cache" and "Video Cache" display with a "Clear Selected" button in the header of all three original HTML pages.

#### **Phase 2.3: Deblurring Model Integration (COMPLETED)**
*   **Backend:**
    *   `backend/app/api/dependencies.py` updated to define and load the deblurring model (`Uformer_B_GoPro.pth`).
    *   Backend API endpoints updated to correctly accept `task_type` and save files into task-specific subdirectories (e.g., `temp/images/denoise/` or `temp/images/deblur/`).
    *   Download endpoints made flexible to serve files from these new subdirectories.
*   **HTML UIs:**
    *   All three original HTML pages now include a "Task" selection dropdown ("Denoise" / "Deblur").
    *   Model dropdowns dynamically populate options based on the selected task, correctly reflecting available models for each task.
    *   The frontend is now sending the `task_type` parameter to the backend.

#### **Phase 2.4: Final Polish & Documentation (Partial - Frontend Migration & VRAM)**
*   **Image Zoom (`image_processor.html`):** Implemented in-place pan and zoom functionality for original and enhanced image previews.
*   **Repository Renaming:** Guided user through renaming the project locally and on GitHub from `noctura-uformer` to `uformer-fastapi-hub`, and transferring ownership to the `CaveMindLabs` organization.
*   **Frontend Migration to Next.js (COMPLETED)**:
    *   Next.js application (`frontend/`) created and configured (Pages Router, ESLint, no Tailwind/TypeScript/Turbopack).
    *   Global CSS (`frontend/src/styles/globals.css`) created and populated with all necessary styles.
    *   **Live Stream Page (`frontend/src/pages/index.js`)** fully migrated to Next.js/React, including:
        *   All original functionality (webcam stream, WebSocket communication, model inference).
        *   Correct application of CSS styles (e.g., borders, centered titles).
    *   **Image File Processor Page (`frontend/src/pages/image-processor.js`)** fully migrated to Next.js/React, including:
        *   All original functionality (file upload, preview generation, image processing, download).
        *   In-place pan and zoom for image previews.
    *   **Video File Processor Page (`frontend/src/pages/video-processor.js`)** fully migrated to Next.js/React, including:
        *   All original functionality (video upload, processing, status polling, download).
*   **Adaptive VRAM Management (Backend & Frontend - PARTIAL)**:
    *   **Backend:**
        *   `python-dotenv` added to `backend/Pipfile` (and installed).
        *   `backend/.env.example` created and `backend/.env` configured to be ignored.
        *   `backend/app/main.py` updated to conditionally load models based on `LOAD_ALL_MODELS_ON_STARTUP` from `.env`, and to call `unload_all_models_from_memory` on shutdown.
        *   `backend/app/api/dependencies.py` refactored to use `model_definitions_dict` and introduced `get_model_by_name` dependency for on-demand loading and `unload_all_models_from_memory` utility function.
        *   `backend/app/api/endpoints/cache_management.py` added `/api/unload_models` (POST) and `/api/model_loading_strategy` (GET) endpoints.
        *   All processing endpoints (`image_file_processing.py`, `video_file_processing.py`, `live_stream_processing.py`) updated to correctly use the new `get_model_by_name` dependency (or manually replicate its logic for background tasks/WebSockets).
    *   **Frontend (Live Stream Page `index.js` only):**
        *   Added "Clear All Models from VRAM" button.
        *   Implemented JavaScript logic to query `/api/model_loading_strategy` and conditionally show/hide this button based on the backend's setting.
        *   Wired the button's click event to the `/api/unload_models` endpoint.
        *   **Outstanding for VRAM Management (Frontend):** The "Clear All Models" button needs to be integrated into `video-processor.js` and `image-processor.js`. Also, the additional conditional UI for *disabling* the button when no models are loaded, and the display of *individual loaded models with checkboxes for clearing*, are still pending implementation across all pages.
*   **Repository Cleanup:** `uformer_training/` and `datasets/` directories have been removed. `.gitignore` updated to correctly ignore `frontend/.next/` and `frontend/node_modules/` while ensuring `backend/Pipfile.lock` is tracked.

### **Current Focus & Next Steps:**

The full UI and logic refactor for the **Live Stream page (`frontend/src/pages/index.js`)** and its HTML counterpart (`wstest_uformer.html`) is now **complete**. This page serves as the "gold standard" for functionality and user experience for the rest of the project.

Our immediate focus is to propagate these completed features to the remaining pages.

1.  **Modernize the Image File Processor Page (`frontend/src/pages/image-processor.js`):**
    *   Replicate the two-column header layout, integrating the self-contained `CacheManager` and `VRAMManager` components.
    *   Implement logic to fetch the model loading strategy and conditionally display the VRAM panel.
    *   Implement polling logic to update the loaded models list:
        *   A single update when the control panel (Task/Model dropdowns) changes.
        *   Periodic polling while the "Process Image" task is running, stopping on completion.
    *   Ensure all buttons (`Clear Selected Cache`, VRAM buttons) have correct styling and dynamic disabled/enabled states.
    *   Set the "Image Cache" checkbox to be checked by default.

2.  **Modernize the Video File Processor Page (`frontend/src/pages/video-processor.js`):**
    *   Repeat the steps above to bring the video processor page to full parity with the live stream and image processor pages.

3.  **Containerize the Application (Dockerization):**
    *   Create a `Dockerfile` for the FastAPI backend.
    *   Create a `Dockerfile` for the Next.js frontend.
    *   Create a `docker-compose.yml` file to orchestrate both services for easy, one-command deployment.

4.  **Finalize Documentation (`README.md`):**
    *   Create the final, comprehensive `README.md` including a project overview, motivation, and detailed setup/usage instructions for both local development and the new Dockerized deployment.
    *   Include links to model weights and sample data.

---

Please be smart about the context usage. If there are significant changes to make just give full file replacement. Like I also already explained, if you want to rewrite a whole block like a function that has a clear name just give its name and give the content to replace with. For big blocks without names, you can give the few lines of the start and say till these few lines of the end of that block.

---

Bro, I told you to do only one change at a time. Both your changes failed. Lets focus fully first on the live mode again. I notice that the top part of the UI is very similarly the same for the 3 modes. The only thing that changes from mode to mode is which mode is selected, the text that this below the logo and big title, meaning this text "Real-time Enhancement", and which of the cache boxes is checked or unchecked. So Im thinking that we can have a form of centralization for those UI components. Do you understand what I m saying. Dont write any code yet, first acknowledge and tell me the options we have
------

