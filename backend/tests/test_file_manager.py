"""Unit tests for FileManager and _strip_suffixes / _safe_path helpers."""
import os
import time

import pytest
from fastapi import HTTPException

from app.utils.file_manager import FileManager, UPLOAD_DIR
from app.api.endpoints import _strip_suffixes, _safe_path


class TestFileManager:
    def test_save_upload_creates_file(self):
        path = FileManager.save_upload(b"hello", "sample.zip")
        assert os.path.exists(path)
        assert path.endswith("sample.zip")

    def test_save_upload_content_correct(self):
        data = b"\x00\x01\x02\x03"
        path = FileManager.save_upload(data, "bin.bin")
        with open(path, "rb") as f:
            assert f.read() == data

    def test_save_upload_unique_paths(self):
        p1 = FileManager.save_upload(b"a", "dup.zip")
        p2 = FileManager.save_upload(b"b", "dup.zip")
        assert p1 != p2

    def test_cleanup_deletes_old_files(self, tmp_path):
        old_file = UPLOAD_DIR / "old_test_file.txt"
        old_file.write_bytes(b"old")
        old_mtime = time.time() - 7200  # 2 hours ago
        os.utime(str(old_file), (old_mtime, old_mtime))

        FileManager.cleanup_old_files(max_age_seconds=3600)
        assert not old_file.exists()

    def test_cleanup_keeps_new_files(self):
        new_file = UPLOAD_DIR / "new_test_file.txt"
        new_file.write_bytes(b"new")
        FileManager.cleanup_old_files(max_age_seconds=3600)
        assert new_file.exists()
        new_file.unlink()  # tidy up


class TestStripSuffixes:
    @pytest.mark.parametrize("name,expected", [
        ("Pune_district_reconstructed", "Pune_district"),
        ("Pune_district_repaired", "Pune_district"),
        ("Pune_district_edited", "Pune_district"),
        ("Pune_district_export", "Pune_district"),
        ("Pune_district_fixed", "Pune_district"),
        ("Pune_district", "Pune_district"),
        # Must not mangle mid-name occurrence
        ("reconstructed_data", "reconstructed_data"),
        # Only strips one suffix
        ("file_repaired_repaired", "file_repaired"),
    ])
    def test_strip(self, name, expected):
        assert _strip_suffixes(name) == expected


class TestSafePath:
    def test_valid_upload_path_allowed(self):
        test_path = str(UPLOAD_DIR / "some_file.zip")
        result = _safe_path(test_path)
        assert str(result).endswith("some_file.zip")

    def test_traversal_raises_403(self):
        with pytest.raises(HTTPException) as exc:
            _safe_path("../../etc/passwd")
        assert exc.value.status_code == 403

    def test_absolute_outside_allowed_raises_403(self):
        with pytest.raises(HTTPException) as exc:
            _safe_path("C:/Windows/System32/drivers/etc/hosts")
        assert exc.value.status_code == 403
