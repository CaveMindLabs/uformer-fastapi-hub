## Project Structure: 

```text
noctura-uformer/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints/
│   │   │   │   ├── file_processing.py
│   │   │   │   ├── image_processing.py
│   │   │   │   └── video_processing.py
│   │   │   └── dependencies.py
│   │   └── main.py
│   ├── model_weights/
│   │   ├── custom_trained/ (empty)
│   │   └── official_pretrained/
│   │       └── Uformer_B_SIDD.pth
│   ├── temp/
│   │   ├── images/
│   │   │   ├── processed/ (elements ignored)
│   │   │   └── uploads/ (elements ignored)
│   │   └── videos/
│   │       ├── processed/
│   │       │   ├── enhanced_2d12bb46-f981-4a9b-939f-dc0bbafe2f62_Marvel Studios’ Moon Knight  Official Trailer  Disney plus.mp4
│   │       │   └── enhanced_986e9eb9-2cab-4e2e-8c12-c08132369566_What's that in the sky - A group of moving lights flying across the sky in the Triad.mp4
│   │       └── uploads/
│   │           ├── 2d12bb46-f981-4a9b-939f-dc0bbafe2f62_Marvel Studios’ Moon Knight  Official Trailer  Disney plus.mp4
│   │           └── 986e9eb9-2cab-4e2e-8c12-c08132369566_What's that in the sky - A group of moving lights flying across the sky in the Triad.mp4
│   ├── uformer_model/
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   └── image_utils.py
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
└── requirements.txt
```

*Structure listing generated with `max_depth=9`.*
