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
│   │   ├── images/ (empty)
│   │   └── videos/ (empty)
│   ├── tester/
│   │   ├── css/
│   │   │   └── style.css
│   │   ├── js/
│   │   │   ├── components/
│   │   │   │   ├── CacheManager.js
│   │   │   │   ├── Header.js
│   │   │   │   ├── Layout.js
│   │   │   │   ├── Modal.js
│   │   │   │   ├── NavBar.js
│   │   │   │   ├── TitleBlock.js
│   │   │   │   └── VRAMManager.js
│   │   │   ├── pages/
│   │   │   │   ├── ImageProcessorPage.js
│   │   │   │   ├── LiveStreamPage.js
│   │   │   │   └── VideoProcessorPage.js
│   │   │   ├── app.js
│   │   │   └── config.js
│   │   └── index.html
│   ├── uformer_model/
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   └── image_utils.py
│   │   ├── model - Copy.py
│   │   └── model.py
│   ├── .env
│   ├── .env.example
│   ├── _to_note.md
│   └── requirements.txt
├── documentation/
│   ├── API_USAGE_GUIDE.md
│   └── IMPLEMENTATION_GUIDE.md
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
│   │   │   ├── Layout.js
│   │   │   └── Modal.js
│   │   ├── pages/
│   │   │   ├── _app.js
│   │   │   ├── _document.js
│   │   │   ├── image-processor.js
│   │   │   ├── index.js
│   │   │   └── video-processor.js
│   │   ├── styles/
│   │   │   └── globals.css
│   │   └── config.js
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
├── new_prompt.md
└── README.md
```

*Structure listing generated with `max_depth=9`.*
