## Project Structure: 

```text
uformer-fastapi-hub/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints/
│   │   │   │   ├── [6.9 KB] cache_management.py
│   │   │   │   ├── [8.8 KB] image_file_processing.py
│   │   │   │   ├── [6.4 KB] live_stream_processing.py
│   │   │   │   └── [9.3 KB] video_file_processing.py
│   │   │   └── [11.7 KB] dependencies.py
│   │   └── [4.6 KB] main.py
│   ├── debug_logs/
│   │   ├── [64.0 KB] debug_keys_deblur_b.txt
│   │   ├── [28.3 KB] debug_keys_denoise_16.txt
│   │   └── [64.0 KB] debug_keys_denoise_b.txt
│   ├── model_weights/
│   │   ├── custom_trained/ (empty)
│   │   └── official_pretrained/
│   │       ├── [60.7 MB] uformer16_denoising_sidd.pth
│   │       ├── [584.2 MB] Uformer_B_GoPro.pth
│   │       └── [584.2 MB] Uformer_B_SIDD.pth
│   ├── temp/
│   │   ├── images/
│   │   │   ├── deblur/
│   │   │   │   ├── developed_inputs/ (elements ignored)
│   │   │   │   ├── processed/ (elements ignored)
│   │   │   │   └── uploads/ (elements ignored)
│   │   │   └── denoise/
│   │   │       ├── developed_inputs/ (elements ignored)
│   │   │       ├── processed/ (elements ignored)
│   │   │       └── uploads/
│   │   │           └── [23.6 MB] 1750070641_e9641798_original_fullres_00041_08_0.1s.ARW
│   │   └── videos/
│   │       └── denoise/
│   │           ├── processed/ (elements ignored)
│   │           └── uploads/ (elements ignored)
│   ├── uformer_model/
│   │   ├── utils/
│   │   │   ├── [0 B] __init__.py
│   │   │   └── [1.4 KB] image_utils.py
│   │   ├── [54.4 KB] model - Copy.py
│   │   └── [55.4 KB] model.py
│   ├── [487 B] .env
│   ├── [684 B] .env.example
│   ├── [23.5 KB] image_processor.html
│   ├── [1.0 KB] requirements.txt
│   ├── [21.4 KB] video_processor.html
│   └── [22.8 KB] wstest_uformer.html
├── frontend/
│   ├── public/
│   │   ├── [25.3 KB] favicon.ico
│   │   ├── [391 B] file.svg
│   │   ├── [1.0 KB] globe.svg
│   │   ├── [1.3 KB] next.svg
│   │   ├── [128 B] vercel.svg
│   │   └── [385 B] window.svg
│   ├── src/
│   │   ├── pages/
│   │   │   ├── [167 B] _app.js
│   │   │   ├── [233 B] _document.js
│   │   │   ├── [18.4 KB] image-processor.js
│   │   │   ├── [22.9 KB] index.js
│   │   │   └── [17.4 KB] video-processor.js
│   │   └── styles/
│   │       └── [5.6 KB] globals.css
│   ├── [399 B] .gitignore
│   ├── [369 B] eslint.config.mjs
│   ├── [77 B] jsconfig.json
│   ├── [118 B] next.config.mjs
│   ├── [182.4 KB] package-lock.json
│   ├── [399 B] package.json
│   └── [1.9 KB] README.md
├── [914 B] .gitignore
├── [261.9 KB] _code_state.md
├── [7.0 KB] _code_state.py
├── [2.6 KB] _useful_commands.md
└── [8.8 KB] README.md
```

*Structure listing generated with `max_depth=9`.*
