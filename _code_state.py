# _get_code_state.py
import os
import logging
import sys
import argparse # Import the argparse module

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

# List of files relevant for the README update
# Paths are relative to the directory where this script runs
FILES_TO_EXTRACT = [
    # --- Project Setup ---
    "Pipfile",
    "_useful_commands.md",

    # --- FastAPI Backend Application ---
    "backend/app/main.py",
    "backend/app/api/dependencies.py",
    "backend/app/api/endpoints/video_processing.py",
    "backend/app/api/endpoints/file_processing.py",
    "backend/app/api/endpoints/image_processing.py",


    # --- Core Uformer Model Code (for inference) ---
    "backend/uformer_model/model.py",
    "backend/uformer_model/utils/image_utils.py",
    "backend/uformer_model/utils/__init__.py",

    # --- HTML User Interfaces ---
    "backend/wstest_uformer.html",
    "backend/video_processor.html",
    "backend/image_processor.html",

    # --- Script for generating this state file ---
    "_code_state.py",
]

MARKDOWN_OUTPUT = []


def get_file_content(filepath):
    """Reads content of a file, returns None if error."""
    if not os.path.exists(filepath):
        logger.warning(f"File not found: {filepath}")
        return None
    try:
        # Use 'utf-8-sig' to automatically handle/skip the BOM if present
        with open(filepath, 'r', encoding='utf-8-sig', errors='replace') as f:
            return f.read()
    except Exception as e:
        # Log the error specifically
        logger.error(f"Error reading file {filepath}: {e}")
        return None

def get_markdown_language(filepath):
    """Determines language hint for markdown code block.
    Prioritizes known extensions, then treats simple dotfiles (like .env)
    as 'bash'.
    """
    filename = os.path.basename(filepath)
    _, ext = os.path.splitext(filename)
    ext = ext.lower()

    # --- Specific Extension Checks (Highest Priority) ---
    if ext == ".py":
        return "python"
    if ext == ".txt":
        return "text"
    if ext == ".md":
        return "markdown"
    if ext == ".json":
        return "json"
    if ext == ".yaml" or ext == ".yml":
        return "yaml"
    if ext == ".env":
        return "bash"
    if ext == ".sh":
         return "bash"

    # --- General Dotfile Check (if no specific extension matched) ---
    if filename.startswith('.') and not ext:
        return "bash"

    # --- Specific Filename Checks (e.g., files without extensions) ---
    if filename == "Dockerfile":
        return "dockerfile"
    if filename == "Pipfile":
         return "toml" # Pipfile is TOML format
    if filename == "Pipfile.lock":
         return "json" # Pipfile.lock is JSON format

    # --- Default ---
    return ""


if __name__ == "__main__":
    # --- NEW: Set up argument parser ---
    parser = argparse.ArgumentParser(description='Extract code state from specified files and output as markdown.')
    parser.add_argument(
        '--output',
        '-o',
        help='Specify the output markdown file name.',
        default='_code_state.md' # Set the default output file name
    )
    args = parser.parse_args() # Parse the arguments
    output_filename = args.output # Use the argument value (or default)
    # --- END NEW ---


    # Construct the markdown output in the list
    MARKDOWN_OUTPUT.append("# Code State!") # A descriptive title
    MARKDOWN_OUTPUT.append("\n---\n")

    all_files_found = True # Assume success initially
    for filepath in FILES_TO_EXTRACT:
        content = get_file_content(filepath) # Returns content string or None
        # Use os.path.basename for language hint determination
        lang = get_markdown_language(filepath)
        MARKDOWN_OUTPUT.append(f"## File: `{filepath}`")
        # Add a language hint if determined
        MARKDOWN_OUTPUT.append(f"\n~~~~{lang}")

        if content is not None: # Check if reading succeeded
            MARKDOWN_OUTPUT.append(content)
        else: # Reading failed, content is None
            error_message = f"# Error: File not found or could not be read: {filepath}"
            MARKDOWN_OUTPUT.append(error_message) # Put error in markdown
            all_files_found = False # Mark that at least one file failed
            # Print immediate warning to console's error stream
            print(f"Warning: Problem accessing file '{filepath}'", file=sys.stderr)

        MARKDOWN_OUTPUT.append("~~~~\n")
        MARKDOWN_OUTPUT.append("---\n")

    if not all_files_found:
        # Final summary warning to console's error stream
        print("\nWarning: One or more files listed in FILES_TO_EXTRACT could not be read correctly. Output may be incomplete.", file=sys.stderr)


    # --- Write the combined markdown to the specified/default file ---
    try:
        # Open in write mode ('w'), specify encoding, and use a context manager
        with open(output_filename, "w", encoding="utf-8") as f:
            f.write("\n".join(MARKDOWN_OUTPUT))
        # Print a success message to stderr
        print(f"\nSuccessfully wrote code state to '{output_filename}'", file=sys.stderr)
    except IOError as e:
        # Print an error message to stderr if writing fails
        print(f"\nError writing to file '{output_filename}': {e}", file=sys.stderr)
    # --- END Writing ---


    # Print the combined markdown to standard output (for redirection)
    # This remains as per the original request
    # print("\n".join(MARKDOWN_OUTPUT))
    print()
