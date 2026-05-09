"""Integration tests for all API endpoints."""
import io
import os
import json
import zipfile

import pytest
import geopandas as gpd
from shapely.geometry import Polygon, MultiPolygon

from app.utils.file_manager import UPLOAD_DIR, REPAIR_DIR


# ── helpers ────────────────────────────────────────────────────────────────

def _upload_zip(client, zip_path: str, filename: str = "test.zip"):
    with open(zip_path, "rb") as f:
        return client.post("/api/upload", files={"file": (filename, f, "application/zip")})


def _upload_geojson(client, geojson_path: str, filename: str = "test.geojson"):
    with open(geojson_path, "rb") as f:
        return client.post(
            "/api/upload",
            files={"file": (filename, f, "application/geo+json")},
        )


# ── /health ────────────────────────────────────────────────────────────────

def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ── /upload ────────────────────────────────────────────────────────────────

class TestUpload:
    def test_upload_valid_zip(self, client, valid_zip):
        r = _upload_zip(client, valid_zip)
        assert r.status_code == 200
        body = r.json()
        assert "path" in body
        assert body["format"] == "ZIP"

    def test_upload_geojson(self, client, valid_geojson):
        r = _upload_geojson(client, valid_geojson)
        assert r.status_code == 200
        assert r.json()["format"] == "GEOJSON"

    def test_upload_unsupported_format(self, client, tmp_path):
        p = tmp_path / "data.csv"
        p.write_text("a,b\n1,2")
        with open(p, "rb") as f:
            r = client.post("/api/upload", files={"file": ("data.csv", f, "text/csv")})
        assert r.status_code == 400
        assert "Unsupported" in r.json()["error"]

    def test_upload_corrupt_zip_rejected(self, client, corrupt_zip):
        r = _upload_zip(client, corrupt_zip, "corrupt.zip")
        assert r.status_code == 400

    def test_upload_missing_dbf_zip_allowed(self, client, missing_dbf_zip):
        # Structure validation flags it but still accepted (repair can fix it)
        r = _upload_zip(client, missing_dbf_zip, "nodebf.zip")
        # The upload itself may succeed (200) with issue info, or 400 — check either
        assert r.status_code in (200, 400)


# ── /validate ──────────────────────────────────────────────────────────────

class TestValidate:
    def test_validate_valid_zip(self, client, valid_zip, save_to_upload):
        path = save_to_upload(valid_zip)
        r = client.post("/api/validate", json={"path": path})
        assert r.status_code == 200
        body = r.json()
        assert "stats" in body
        assert body["stats"]["feature_count"] >= 1

    def test_validate_geojson(self, client, valid_geojson, save_to_upload):
        path = save_to_upload(valid_geojson)
        r = client.post("/api/validate", json={"path": path})
        assert r.status_code == 200
        body = r.json()
        assert body["stats"]["feature_count"] == 1

    def test_validate_missing_path_returns_400(self, client):
        r = client.post("/api/validate", json={})
        assert r.status_code == 400

    def test_validate_nonexistent_file_returns_404(self, client, save_to_upload, valid_zip):
        path = save_to_upload(valid_zip)
        r = client.post("/api/validate", json={"path": path + "_doesnotexist"})
        assert r.status_code == 404

    def test_validate_path_traversal_rejected(self, client):
        r = client.post("/api/validate", json={"path": "../../etc/passwd"})
        assert r.status_code in (400, 403)

    def test_validate_reports_invalid_geometry(self, client, invalid_geom_geojson, save_to_upload):
        path = save_to_upload(invalid_geom_geojson)
        r = client.post("/api/validate", json={"path": path})
        assert r.status_code == 200
        ids = [i["id"] for i in r.json()["issues"]]
        assert "invalid_geometry" in ids

    def test_validate_reports_multipart(self, client, multipart_geojson, save_to_upload):
        path = save_to_upload(multipart_geojson)
        r = client.post("/api/validate", json={"path": path})
        assert r.status_code == 200
        ids = [i["id"] for i in r.json()["issues"]]
        assert "multipart_geom" in ids

    def test_validate_missing_dbf_auto_reconstructed(self, client, missing_dbf_zip, save_to_upload):
        path = save_to_upload(missing_dbf_zip)
        r = client.post("/api/validate", json={"path": path})
        # Should succeed after auto-reconstruction, not return 500
        assert r.status_code == 200

    def test_validate_zip_no_winError32(self, client, valid_zip, save_to_upload):
        """Regression: WinError 32 must not surface for well-formed ZIPs."""
        path = save_to_upload(valid_zip)
        r = client.post("/api/validate", json={"path": path})
        assert r.status_code == 200
        assert "WinError" not in r.text
        assert "being used by another process" not in r.text


# ── /repair ────────────────────────────────────────────────────────────────

class TestRepair:
    def test_repair_valid_zip(self, client, valid_zip, save_to_upload):
        path = save_to_upload(valid_zip)
        r = client.post("/api/repair", json={"path": path, "options": {}})
        assert r.status_code == 200
        body = r.json()
        assert "repaired_path" in body
        assert os.path.exists(body["repaired_path"])

    def test_repair_geojson(self, client, valid_geojson, save_to_upload):
        path = save_to_upload(valid_geojson)
        r = client.post("/api/repair", json={"path": path, "options": {}})
        assert r.status_code == 200
        assert r.json()["repaired_path"].endswith(".geojson")

    def test_repair_missing_path_returns_400(self, client):
        r = client.post("/api/repair", json={})
        assert r.status_code == 400

    def test_repair_nonexistent_file_returns_404(self, client, valid_zip, save_to_upload):
        path = save_to_upload(valid_zip) + "_gone"
        r = client.post("/api/repair", json={"path": path})
        assert r.status_code == 404

    def test_repair_singlepart_option(self, client, multipart_geojson, save_to_upload):
        path = save_to_upload(multipart_geojson)
        r = client.post("/api/repair", json={"path": path, "options": {"singlepart": True}})
        assert r.status_code == 200
        preview = r.json()["preview_geojson"]
        geom_types = {f["geometry"]["type"] for f in preview["features"]}
        assert not any(t.startswith("Multi") for t in geom_types)

    def test_repair_force_crs(self, client, no_crs_geojson, save_to_upload):
        path = save_to_upload(no_crs_geojson)
        r = client.post("/api/repair", json={"path": path, "options": {"force_crs": True}})
        assert r.status_code == 200
        assert r.json()["stats"]["crs"] != "None"

    def test_repair_returns_preview_geojson(self, client, valid_geojson, save_to_upload):
        path = save_to_upload(valid_geojson)
        r = client.post("/api/repair", json={"path": path, "options": {}})
        body = r.json()
        assert "preview_geojson" in body
        assert "features" in body["preview_geojson"]

    def test_repair_invalid_geom_fixed(self, client, invalid_geom_geojson, save_to_upload):
        path = save_to_upload(invalid_geom_geojson)
        r = client.post("/api/repair", json={"path": path, "options": {}})
        assert r.status_code == 200
        preview = r.json()["preview_geojson"]
        from shapely.geometry import shape
        for feature in preview["features"]:
            geom = shape(feature["geometry"])
            assert geom.is_valid

    def test_repair_path_traversal_rejected(self, client):
        r = client.post("/api/repair", json={"path": "../../etc/passwd"})
        assert r.status_code in (400, 403)

    def test_repair_zip_no_winError32(self, client, valid_zip, save_to_upload):
        """Regression: WinError 32 must not surface during repair of a ZIP."""
        path = save_to_upload(valid_zip)
        r = client.post("/api/repair", json={"path": path, "options": {}})
        assert r.status_code == 200
        assert "WinError" not in r.text


# ── /save_changes ──────────────────────────────────────────────────────────

class TestSaveChanges:
    def _sample_geojson(self):
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
                    },
                    "properties": {"id": 1},
                }
            ],
        }

    def test_save_geojson(self, client, valid_geojson, save_to_upload):
        path = save_to_upload(valid_geojson)
        r = client.post("/api/save_changes", json={"geojson": self._sample_geojson(), "path": path})
        assert r.status_code == 200
        assert "repaired_path" in r.json()

    def test_save_missing_geojson_returns_400(self, client, valid_geojson, save_to_upload):
        path = save_to_upload(valid_geojson)
        r = client.post("/api/save_changes", json={"path": path})
        assert r.status_code == 400

    def test_save_missing_path_returns_400(self, client):
        r = client.post("/api/save_changes", json={"geojson": self._sample_geojson()})
        assert r.status_code == 400

    def test_save_invalid_geojson_structure(self, client, valid_geojson, save_to_upload):
        path = save_to_upload(valid_geojson)
        r = client.post("/api/save_changes", json={"geojson": {"not": "valid"}, "path": path})
        assert r.status_code == 400

    def test_save_path_traversal_rejected(self, client):
        r = client.post(
            "/api/save_changes",
            json={"geojson": self._sample_geojson(), "path": "../../etc/passwd"},
        )
        assert r.status_code in (400, 403)


# ── /download ──────────────────────────────────────────────────────────────

class TestDownload:
    def test_download_existing_file(self, client, valid_zip, save_to_upload):
        path = save_to_upload(valid_zip)
        r = client.get(f"/api/download?path={path}")
        assert r.status_code == 200
        assert len(r.content) > 0

    def test_download_nonexistent_returns_404(self, client, valid_zip, save_to_upload):
        path = save_to_upload(valid_zip) + "_missing"
        r = client.get(f"/api/download?path={path}")
        assert r.status_code == 404

    def test_download_path_traversal_rejected(self, client):
        r = client.get("/api/download?path=../../etc/passwd")
        assert r.status_code in (400, 403)


# ── /export ────────────────────────────────────────────────────────────────

class TestExport:
    def test_export_to_geojson(self, client, valid_geojson, save_to_upload):
        path = save_to_upload(valid_geojson)
        r = client.get(f"/api/export?path={path}&format=geojson")
        assert r.status_code == 200
        assert "geo+json" in r.headers.get("content-type", "")

    def test_export_to_gpkg(self, client, valid_geojson, save_to_upload):
        path = save_to_upload(valid_geojson)
        r = client.get(f"/api/export?path={path}&format=gpkg")
        assert r.status_code == 200

    def test_export_nonexistent_returns_404(self, client, valid_zip, save_to_upload):
        path = save_to_upload(valid_zip) + "_gone"
        r = client.get(f"/api/export?path={path}&format=geojson")
        assert r.status_code == 404

    def test_export_zip_format(self, client, valid_zip, save_to_upload):
        path = save_to_upload(valid_zip)
        r = client.get(f"/api/export?path={path}&format=shp")
        assert r.status_code == 200
