## Project Structure: 

```text
uformer-fastapi-hub/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints/
│   │   │   │   ├── cache_management.py
│   │   │   │   ├── image_file_processing.py
│   │   │   │   ├── live_stream_processing.py
│   │   │   │   └── video_file_processing.py
│   │   │   └── dependencies.py
│   │   └── main.py
│   ├── debug_logs/
│   │   ├── debug_keys_deblur_b.txt
│   │   ├── debug_keys_denoise_16.txt
│   │   └── debug_keys_denoise_b.txt
│   ├── model_weights/
│   │   ├── custom_trained/ (empty)
│   │   └── official_pretrained/
│   │       ├── uformer16_denoising_sidd.pth
│   │       ├── Uformer_B_GoPro.pth
│   │       └── Uformer_B_SIDD.pth
│   ├── temp/
│   │   ├── images/
│   │   │   └── denoise/
│   │   │       ├── developed_inputs/ (elements ignored)
│   │   │       ├── processed/ (elements ignored)
│   │   │       └── uploads/ (elements ignored)
│   │   └── videos/
│   │       └── denoise/
│   │           ├── processed/ (elements ignored)
│   │           └── uploads/ (elements ignored)
│   ├── uformer_model/
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   └── image_utils.py
│   │   ├── model - Copy.py
│   │   └── model.py
│   ├── .env
│   ├── .env.example
│   ├── image_processor.html
│   ├── requirements.txt
│   ├── video_processor.html
│   └── wstest_uformer.html
├── frontend/
│   ├── public/
│   │   ├── favicon.ico
│   │   ├── file.svg
│   │   ├── globe.svg
│   │   ├── next.svg
│   │   ├── vercel.svg
│   │   └── window.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.js
│   │   │   └── Layout.js
│   │   ├── pages/
│   │   │   ├── _app.js
│   │   │   ├── _document.js
│   │   │   ├── image-processor.js
│   │   │   ├── index.js
│   │   │   └── video-processor.js
│   │   └── styles/
│   │       └── globals.css
│   ├── .gitignore
│   ├── eslint.config.mjs
│   ├── jsconfig.json
│   ├── next.config.mjs
│   ├── package-lock.json
│   ├── package.json
│   └── README.md
├── .gitignore
├── _code_state.md
├── _code_state.py
├── _useful_commands.md
└── README.md
```

*Structure listing generated with `max_depth=9`.*
