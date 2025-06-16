## Project Structure: 

```text
noctura-uformer/
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
│   │   │   ├── developed_inputs/ (elements ignored)
│   │   │   ├── processed/ (elements ignored)
│   │   │   └── uploads/ (elements ignored)
│   │   └── videos/ (empty)
│   ├── uformer_model/
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   └── image_utils.py
│   │   ├── model - Copy.py
│   │   └── model.py
│   ├── image_processor.html
│   ├── video_processor.html
│   └── wstest_uformer.html
├── datasets/
│   └── SID/ (empty)
├── frontend/
│   ├── public/ (empty)
│   └── src/ (empty)
├── uformer_training/
│   ├── dataset/
│   │   ├── dataset_denoise.py
│   │   └── dataset_motiondeblur.py
│   ├── script/
│   │   ├── test.sh
│   │   ├── train_denoise.sh
│   │   └── train_motiondeblur.sh
│   ├── train/
│   │   ├── train_denoise.py
│   │   └── train_motiondeblur.py
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── antialias.py
│   │   ├── bundle_submissions.py
│   │   ├── caculate_psnr_ssim.py
│   │   ├── dataset_utils.py
│   │   ├── dir_utils.py
│   │   ├── image_utils.py
│   │   ├── loader.py
│   │   └── model_utils.py
│   ├── warmup_scheduler/
│   │   ├── __init__.py
│   │   ├── run.py
│   │   └── scheduler.py
│   ├── generate_patches_SIDD.py
│   ├── losses.py
│   ├── model.py
│   └── options.py
├── .gitignore
├── _code_state.md
├── _code_state.py
├── _useful_commands.md
├── README.md
├── requirements.txt
└── to_delete.md
```

*Structure listing generated with `max_depth=10`.*
