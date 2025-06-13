## Project Structure: 

```text
noctura-uformer/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints/
│   │   │   │   └── video_processing.py
│   │   │   └── dependencies.py
│   │   └── main.py
│   ├── model_weights/
│   │   ├── custom_trained/ (empty)
│   │   └── official_pretrained/
│   │       └── Uformer_B_SIDD.pth
│   ├── uformer_model/
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   └── image_utils.py
│   │   └── model.py
│   ├── debug_keys.txt
│   └── wstest_uformer.html
├── datasets/
│   └── SID/ (empty)
├── frontend/
│   ├── public/ (empty)
│   └── src/ (empty)
├── uformer_training/
│   ├── dataset/ (empty)
│   ├── script/ (empty)
│   ├── train/ (empty)
│   └── utils/ (empty)
├── .gitignore
├── _code_state.py
├── _useful_commands.md
└── requirements.txt
```

*Structure listing generated with `max_depth=9`.*
