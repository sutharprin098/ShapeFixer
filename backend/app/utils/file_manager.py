import os
import shutil
import uuid
import time
from pathlib import Path

UPLOAD_DIR = Path("temp_storage/uploads")
REPAIR_DIR = Path("temp_storage/repairs")

# Ensure directories exist
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
REPAIR_DIR.mkdir(parents=True, exist_ok=True)

class FileManager:
    @staticmethod
    def save_upload(file_content: bytes, filename: str) -> str:
        session_id = str(uuid.uuid4())
        file_path = UPLOAD_DIR / f"{session_id}_{filename}"
        with open(file_path, "wb") as f:
            f.write(file_content)
        return str(file_path)

    @staticmethod
    def cleanup_old_files(max_age_seconds: int = 3600):
        """Deletes files older than max_age_seconds."""
        now = time.time()
        for folder in [UPLOAD_DIR, REPAIR_DIR]:
            for path in folder.glob("*"):
                if path.is_file() and (now - path.stat().st_mtime) > max_age_seconds:
                    try:
                        path.unlink()
                    except Exception as e:
                        print(f"Error deleting {path}: {e}")
                elif path.is_dir() and (now - path.stat().st_mtime) > max_age_seconds:
                    try:
                        shutil.rmtree(path)
                    except Exception as e:
                        print(f"Error deleting dir {path}: {e}")
