### **Handover Prompt: Refactoring Backend HTML Test Files into a Modern SPA Test Harness**

Hello. I have a project with a full-featured Next.js frontend and a FastAPI backend. The backend currently contains several standalone HTML files (`image_processor.html`, `video_processor.html`, etc.) that were created for basic endpoint testing. These files are outdated, separate, and inefficient to maintain.

My goal is to **replace these old, separate HTML test files** with a single, modern, and consolidated "test harness" served directly from the backend. This test harness will function as a simple Single-Page Application (SPA) using vanilla JavaScript, allowing for easy and comprehensive testing of all backend features without needing to run the full Next.js frontend.

**This task does NOT involve modifying or replacing the main Next.js application. The Next.js app is the production frontend and will remain separate. This is purely an enhancement for the backend's internal testing tools.**

### **The Required Architecture for the Test Harness**

1.  **Single Entry Point:** We will create a single `backend/tester/index.html` file that will serve as the shell for the entire test application.
2.  **SPA-style Navigation:** The `index.html` will contain navigation buttons (e.g., "Live Stream," "Image Processor," "Video Processor"). Clicking these buttons should dynamically load the HTML content and JavaScript logic for the corresponding page into a main content area, without a full page reload.
3.  **Component-Based JavaScript:** Logic for reusable UI elements, like the `Header` (with its cache/VRAM managers) and the `Modal`, should be encapsulated in their own JavaScript files (`.js`) within a `components` directory. These will be plain JavaScript modules that export functions to create and manage their respective DOM elements.
4.  **Page-Specific Logic:** The logic for each "page" will be in its own `.js` file. Each file will be responsible for providing the HTML content for its view and attaching all the necessary event listeners and functionality.
5.  **Centralized Configuration:** A `config.js` file will store all API endpoints and other constants.
6.  **Backend Serving:** The FastAPI application (`main.py`) must be configured to serve this new `tester/` directory and route all non-API requests under the `/tester` path to `tester/index.html` to enable the SPA routing.

### **Proposed New File Structure within `backend/`**

```text
backend/
├── tester/  <-- New directory for the test harness
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
│   │   ├── app.js      <-- Main script for SPA routing and initialization
│   │   └── config.js
│   └── index.html
├── app/
│   └── ... (rest of the FastAPI app remains the same)
├── image_processor.html  <-- These old files will be deleted
├── video_processor.html  <-- These old files will be deleted
└── wstest_uformer.html   <-- These old files will be deleted
```

### **Your Task**

Your task is to take the provided code from my existing Next.js application and translate it into this new static SPA test harness architecture. This involves:

1.  Creating the new file structure under `backend/tester/`.
2.  Rewriting the React components (`.js` files with JSX) into plain JavaScript modules that manipulate the DOM. The functionality should be a direct, high-fidelity translation of the React code.
3.  Creating a main JavaScript file (`app.js`) to handle the SPA navigation/initialization.
4.  Creating the main `index.html` shell.
5.  Modifying `backend/app/main.py` to serve the new `/tester` static directory correctly, while leaving the existing `/static_results` mount for processed files untouched.

You must ensure that all existing functionality—including the asynchronous processing, status polling, WebSockets for the live stream, VRAM/cache management in the header, and the robust, status-aware modal feedback system—is fully preserved in the new vanilla JS test harness.

I will provide the contents of all the relevant Next.js files and the current `main.py`. Please begin by confirming the plan and then proceed with generating the new files for the test harness.
















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

### **Other important Next Steps:**

Other steps that we will do after thge 

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

Bro, you need to first aknowledge and tell me how you will go about the changes and the start when I approve. Ok?
------






