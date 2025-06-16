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
│   ├── model_weights/
│   │   ├── custom_trained/ (empty)
│   │   └── official_pretrained/
│   │       ├── uformer16_denoising_sidd.pth
│   │       ├── Uformer_B_SIDD - Copy.pth
│   │       └── Uformer_B_SIDD.pth
│   ├── temp/
│   │   ├── images/
│   │   │   ├── developed_inputs/ (elements ignored)
│   │   │   ├── processed/ (elements ignored)
│   │   │   └── uploads/
│   │   │       └── 1749985176_c112afa7_original_fullres_00041_08_0.1s.ARW
│   │   └── videos/
│   │       ├── processed/
│   │       │   ├── enhanced_23ac71cb-867d-469c-8eb5-418b493e6726_5s_Marvel Studios’ Moon Knight  Official Trailer  Disney plus.mp4
│   │       │   ├── enhanced_4778dcdc-37d9-4ca8-89e3-1f288ce60325_5s_Marvel Studios’ Moon Knight  Official Trailer  Disney plus.mp4
│   │       │   └── enhanced_bcabff1f-5779-4da1-89ef-ac040e0f4fc1_5s_Marvel Studios’ Moon Knight  Official Trailer  Disney plus.mp4
│   │       └── uploads/
│   │           ├── 23ac71cb-867d-469c-8eb5-418b493e6726_5s_Marvel Studios’ Moon Knight  Official Trailer  Disney plus.mp4
│   │           ├── 4778dcdc-37d9-4ca8-89e3-1f288ce60325_5s_Marvel Studios’ Moon Knight  Official Trailer  Disney plus.mp4
│   │           └── bcabff1f-5779-4da1-89ef-ac040e0f4fc1_5s_Marvel Studios’ Moon Knight  Official Trailer  Disney plus.mp4
│   ├── uformer_model/
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   └── image_utils.py
│   │   ├── model - Copy.py
│   │   └── model.py
│   ├── debug_keys.txt
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

*Structure listing generated with `max_depth=9`.*
