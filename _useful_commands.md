#
## -> `requirements.txt`
```bash
pipenv install -r requirements.txt

# Specifically for PowerShell:
pipenv run pip freeze | Out-File -Encoding utf8 requirements.txt  
```

---
## Checking Python versions with Python Launcher (py.exe)
```bash
py --list  # Should list both 3.12 and 3.11
py -3.11 --version # Should output Python 3.11.9
py -3.12 --version # Should output Python 3.12.10
py --version       # Should output your default, Python 3.12.10
```

---
## Running the _list_structure.py file
```bash
# Show the built-in help
python ../_list_structure.py -h

# Basic invocation
## Execute with defaults (project_root defaults to . and depth defaults to 6).
## File sizes will be displayed by default:
python ../_list_structure.py

## To list the structure of the current directory, to 6 levels deep:
python ../_list_structure.py . --depth 6

## Or equivalently (since project_root defaults to .):
python ../_list_structure.py --depth 6

# Controlling file size display
## List structure, explicitly showing file sizes (this is the default behavior):
python ../_list_structure.py --depth 3 # Will show sizes
python ../_list_structure.py . --depth 5

## List structure WITHOUT showing file sizes:
python ../_list_structure.py --depth 3 --no-size
python ../_list_structure.py . --depth 5 --no-size

# Pointing at a specific project
## If your repo lives in /home/you/myproj, and you want full depth (8) with sizes:
python ../_list_structure.py /home/you/myproj

## Or to limit to 3, without showing sizes:
python ../_list_structure.py /home/you/myproj --depth 3 --no-size
```

---
## The proper command to use for PyTorch packages with `pipenv`:
~~~bash
pipenv install torch torchvision torchaudio --index https://download.pytorch.org/whl/cu128
~~~

---
# -> Backend:

~~~bash
# Start the Server (MUST be run from project root):
cd backend

pipenv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
OR
pipenv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --no-access-log

# Run the Test Client:
    # Navigate to the noctura-uformer/backend/ directory in your file explorer.

    # Double-click the wstest_uformer.html file to open it in your web browser.

    # Allow the browser to use your webcam.

    # Click the "Start Webcam" button.
~~~


---
