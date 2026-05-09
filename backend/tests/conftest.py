"""Shared pytest fixtures for ShapeFixer tests."""
import io
import os
import zipfile
import tempfile

import pytest
import shapefile  # pyshp
import geopandas as gpd
from shapely.geometry import Point, Polygon, MultiPolygon
from fastapi.testclient import TestClient

from app.main import app
from app.utils.file_manager import UPLOAD_DIR, REPAIR_DIR


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _write_shapefile(directory: str, name: str, geoms, records=None):
    """Helper: write a minimal polygon shapefile with pyshp."""
    base = os.path.join(directory, name)
    with shapefile.Writer(base) as w:
        w.field("ID", "N")
        for i, geom in enumerate(geoms):
            coords = list(geom.exterior.coords)
            w.poly([list(coords)])
            w.record(records[i] if records else i + 1)
    return base


@pytest.fixture
def valid_zip(tmp_path):
    """Valid ZIP: .shp + .shx + .dbf, one square polygon."""
    shp_dir = tmp_path / "src"
    shp_dir.mkdir()
    poly = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
    _write_shapefile(str(shp_dir), "valid", [poly])
    zip_path = tmp_path / "valid.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        for ext in (".shp", ".shx", ".dbf"):
            src = str(shp_dir / f"valid{ext}")
            if os.path.exists(src):
                zf.write(src, f"valid{ext}")
    return str(zip_path)


@pytest.fixture
def missing_dbf_zip(tmp_path):
    """ZIP with .shp and .shx only (no .dbf)."""
    shp_dir = tmp_path / "src"
    shp_dir.mkdir()
    poly = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
    _write_shapefile(str(shp_dir), "nodebf", [poly])
    zip_path = tmp_path / "nodebf.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        for ext in (".shp", ".shx"):
            src = str(shp_dir / f"nodebf{ext}")
            if os.path.exists(src):
                zf.write(src, f"nodebf{ext}")
    return str(zip_path)


@pytest.fixture
def missing_shx_zip(tmp_path):
    """ZIP with .shp and .dbf only (no .shx)."""
    shp_dir = tmp_path / "src"
    shp_dir.mkdir()
    poly = Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])
    _write_shapefile(str(shp_dir), "noshx", [poly])
    zip_path = tmp_path / "noshx.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        for ext in (".shp", ".dbf"):
            src = str(shp_dir / f"noshx{ext}")
            if os.path.exists(src):
                zf.write(src, f"noshx{ext}")
    return str(zip_path)


@pytest.fixture
def corrupt_zip(tmp_path):
    """A file that looks like a ZIP but is corrupt."""
    p = tmp_path / "corrupt.zip"
    p.write_bytes(b"PK\x03\x04this is not a real zip file at all")
    return str(p)


@pytest.fixture
def valid_geojson(tmp_path):
    """Valid GeoJSON file with one polygon."""
    gdf = gpd.GeoDataFrame(
        {"id": [1]},
        geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
        crs="EPSG:4326",
    )
    path = tmp_path / "valid.geojson"
    gdf.to_file(str(path), driver="GeoJSON")
    return str(path)


@pytest.fixture
def invalid_geom_geojson(tmp_path):
    """GeoJSON with one self-intersecting (butterfly/bowtie) polygon."""
    from shapely.geometry import shape
    bowtie = shape({
        "type": "Polygon",
        "coordinates": [[[0, 0], [2, 2], [2, 0], [0, 2], [0, 0]]]
    })
    gdf = gpd.GeoDataFrame({"id": [1]}, geometry=[bowtie], crs="EPSG:4326")
    path = tmp_path / "invalid_geom.geojson"
    gdf.to_file(str(path), driver="GeoJSON")
    return str(path)


@pytest.fixture
def multipart_geojson(tmp_path):
    """GeoJSON with one MultiPolygon feature."""
    mp = MultiPolygon([
        Polygon([(0, 0), (1, 0), (1, 1), (0, 1)]),
        Polygon([(2, 2), (3, 2), (3, 3), (2, 3)]),
    ])
    gdf = gpd.GeoDataFrame({"id": [1]}, geometry=[mp], crs="EPSG:4326")
    path = tmp_path / "multipart.geojson"
    gdf.to_file(str(path), driver="GeoJSON")
    return str(path)


@pytest.fixture
def no_crs_geojson(tmp_path):
    """GeoJSON written without CRS."""
    gdf = gpd.GeoDataFrame(
        {"id": [1]},
        geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
    )
    path = tmp_path / "nocrs.geojson"
    gdf.to_file(str(path), driver="GeoJSON")
    return str(path)


@pytest.fixture
def save_to_upload(tmp_path):
    """Copy a file into UPLOAD_DIR and return its new path (simulates a real upload)."""
    import shutil

    def _copy(src: str) -> str:
        import uuid
        name = f"{uuid.uuid4()}_{os.path.basename(src)}"
        dst = str(UPLOAD_DIR / name)
        shutil.copy2(src, dst)
        return dst

    return _copy
