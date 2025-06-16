## Project Structure: 

```text
noctura-uformer/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints/
│   │   │   │   ├── [3.3 KB] cache_management.py
│   │   │   │   ├── [8.6 KB] image_file_processing.py
│   │   │   │   ├── [5.5 KB] live_stream_processing.py
│   │   │   │   └── [7.6 KB] video_file_processing.py
│   │   │   └── [6.3 KB] dependencies.py
│   │   └── [3.4 KB] main.py
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
│   │   │   │   └── uploads/
│   │   │   │       └── [23.6 MB] 1750061770_b1f142b7_original_fullres_00041_08_0.1s.ARW
│   │   │   └── denoise/
│   │   │       ├── developed_inputs/ (elements ignored)
│   │   │       ├── processed/ (elements ignored)
│   │   │       └── uploads/
│   │   │           └── [23.6 MB] 1750061728_6c4602f3_original_fullres_00041_08_0.1s.ARW
│   │   └── videos/ (empty)
│   ├── uformer_model/
│   │   ├── utils/
│   │   │   ├── [0 B] __init__.py
│   │   │   └── [1.4 KB] image_utils.py
│   │   ├── [54.4 KB] model - Copy.py
│   │   └── [55.4 KB] model.py
│   ├── [20.0 KB] image_processor.html
│   ├── [19.1 KB] video_processor.html
│   └── [14.7 KB] wstest_uformer.html
├── datasets/
│   └── SID/ (empty)
├── frontend/
│   ├── public/ (empty)
│   └── src/ (empty)
├── uformer_training/
│   ├── dataset/
│   │   ├── [5.3 KB] dataset_denoise.py
│   │   └── [6.8 KB] dataset_motiondeblur.py
│   ├── script/
│   │   ├── [1.0 KB] test.sh
│   │   ├── [255 B] train_denoise.sh
│   │   └── [302 B] train_motiondeblur.sh
│   ├── train/
│   │   ├── [9.4 KB] train_denoise.py
│   │   └── [9.4 KB] train_motiondeblur.py
│   ├── utils/
│   │   ├── [145 B] __init__.py
│   │   ├── [4.2 KB] antialias.py
│   │   ├── [3.3 KB] bundle_submissions.py
│   │   ├── [8.0 KB] caculate_psnr_ssim.py
│   │   ├── [1.7 KB] dataset_utils.py
│   │   ├── [424 B] dir_utils.py
│   │   ├── [1.4 KB] image_utils.py
│   │   ├── [576 B] loader.py
│   │   └── [3.0 KB] model_utils.py
│   ├── warmup_scheduler/
│   │   ├── [65 B] __init__.py
│   │   ├── [841 B] run.py
│   │   └── [3.1 KB] scheduler.py
│   ├── [2.2 KB] generate_patches_SIDD.py
│   ├── [1.6 KB] losses.py
│   ├── [54.1 KB] model.py
│   └── [4.5 KB] options.py
├── [709 B] .gitignore
├── [163.9 KB] _code_state.md
├── [5.7 KB] _code_state.py
├── [2.3 KB] _useful_commands.md
├── [8.8 KB] README.md
├── [1.0 KB] requirements.txt
└── [43.0 KB] to_delete.md
```

*Structure listing generated with `max_depth=9`.*
