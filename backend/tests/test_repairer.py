"""Unit tests for GISRepairer."""
import os
import zipfile
import tempfile

import pytest
import geopandas as gpd
from shapely.geometry import Polygon, MultiPolygon, shape

from app.services.repairer import GISRepairer


class TestReconstructMissingFiles:
    def test_no_reconstruction_needed(self, valid_zip):
        result = GISRepairer.reconstruct_missing_files(valid_zip)
        # Always returns a readable ZIP (may be a new path with _reconstructed suffix)
        assert result.endswith(".zip")
        with zipfile.ZipFile(result, "r") as zf:
            names = [n.lower() for n in zf.namelist()]
        assert any(n.endswith(".shp") for n in names)
        assert any(n.endswith(".dbf") for n in names)

    def test_reconstructs_missing_dbf(self, missing_dbf_zip):
        result = GISRepairer.reconstruct_missing_files(missing_dbf_zip)
        assert result != missing_dbf_zip
        assert result.endswith("_reconstructed.zip")
        with zipfile.ZipFile(result, "r") as zf:
            names = [n.lower() for n in zf.namelist()]
        assert any(n.endswith(".dbf") for n in names)
        assert any(n.endswith(".shp") for n in names)
        assert any(n.endswith(".shx") for n in names)

    def test_reconstructs_missing_shx(self, missing_shx_zip):
        result = GISRepairer.reconstruct_missing_files(missing_shx_zip)
        assert result.endswith("_reconstructed.zip")
        with zipfile.ZipFile(result, "r") as zf:
            names = [n.lower() for n in zf.namelist()]
        assert any(n.endswith(".shx") for n in names)

    def test_corrupt_zip_raises(self, corrupt_zip):
        with pytest.raises(ValueError, match="corrupt"):
            GISRepairer.reconstruct_missing_files(corrupt_zip)

    def test_reconstructed_zip_is_readable(self, missing_dbf_zip):
        result = GISRepairer.reconstruct_missing_files(missing_dbf_zip)
        from tests.conftest import _write_shapefile  # not needed — just use geopandas
        tmp_dir = tempfile.mkdtemp()
        try:
            with zipfile.ZipFile(result, "r") as zf:
                zf.extractall(tmp_dir)
            shp = next(
                os.path.join(tmp_dir, f)
                for f in os.listdir(tmp_dir)
                if f.lower().endswith(".shp")
            )
            gdf = gpd.read_file(shp)
            assert len(gdf) > 0
        finally:
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)


class TestRepairGeometries:
    def test_valid_geometries_unchanged(self):
        gdf = gpd.GeoDataFrame(
            {"id": [1]},
            geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
            crs="EPSG:4326",
        )
        result = GISRepairer.repair_geometries(gdf)
        assert len(result) == 1
        assert result.geometry.iloc[0].is_valid

    def test_invalid_geometry_is_repaired(self):
        bowtie = shape({
            "type": "Polygon",
            "coordinates": [[[0, 0], [2, 2], [2, 0], [0, 2], [0, 0]]]
        })
        gdf = gpd.GeoDataFrame({"id": [1]}, geometry=[bowtie], crs="EPSG:4326")
        result = GISRepairer.repair_geometries(gdf)
        assert all(result.geometry.is_valid)

    def test_none_geometry_dropped(self):
        gdf = gpd.GeoDataFrame(
            {"id": [1, 2]},
            geometry=[None, Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
            crs="EPSG:4326",
        )
        result = GISRepairer.repair_geometries(gdf)
        assert len(result) == 1

    def test_all_null_raises(self):
        gdf = gpd.GeoDataFrame({"id": [1]}, geometry=[None], crs="EPSG:4326")
        with pytest.raises(ValueError, match="All features"):
            GISRepairer.repair_geometries(gdf)


class TestConvertToSinglepart:
    def test_multipart_exploded(self):
        mp = MultiPolygon([
            Polygon([(0, 0), (1, 0), (1, 1), (0, 1)]),
            Polygon([(2, 2), (3, 2), (3, 3), (2, 3)]),
        ])
        gdf = gpd.GeoDataFrame({"id": [1]}, geometry=[mp], crs="EPSG:4326")
        result = GISRepairer.convert_to_singlepart(gdf)
        assert len(result) == 2
        assert all(not t.startswith("Multi") for t in result.geometry.geom_type)

    def test_singlepart_unchanged_count(self):
        gdf = gpd.GeoDataFrame(
            {"id": [1, 2]},
            geometry=[
                Polygon([(0, 0), (1, 0), (1, 1), (0, 1)]),
                Polygon([(2, 2), (3, 2), (3, 3), (2, 3)]),
            ],
            crs="EPSG:4326",
        )
        result = GISRepairer.convert_to_singlepart(gdf)
        assert len(result) == 2


class TestAssignDefaultCrs:
    def test_assigns_crs_when_none(self):
        gdf = gpd.GeoDataFrame(
            {"id": [1]},
            geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
        )
        result = GISRepairer.assign_default_crs(gdf)
        assert str(result.crs) == "EPSG:4326"

    def test_reprojects_when_different_crs(self):
        gdf = gpd.GeoDataFrame(
            {"id": [1]},
            geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
            crs="EPSG:32644",
        )
        result = GISRepairer.assign_default_crs(gdf)
        assert str(result.crs) == "EPSG:4326"

    def test_no_change_when_already_target_crs(self):
        gdf = gpd.GeoDataFrame(
            {"id": [1]},
            geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
            crs="EPSG:4326",
        )
        result = GISRepairer.assign_default_crs(gdf)
        assert str(result.crs) == "EPSG:4326"

    def test_custom_target_crs(self):
        gdf = gpd.GeoDataFrame(
            {"id": [1]},
            geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
        )
        result = GISRepairer.assign_default_crs(gdf, target_crs="EPSG:3857")
        assert str(result.crs) == "EPSG:3857"


class TestPackageRepairedData:
    def test_creates_valid_zip(self, tmp_path):
        gdf = gpd.GeoDataFrame(
            {"id": [1]},
            geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
            crs="EPSG:4326",
        )
        zip_path = GISRepairer.package_repaired_data(gdf, str(tmp_path), "output")
        assert os.path.exists(zip_path)
        with zipfile.ZipFile(zip_path, "r") as zf:
            names = [n.lower() for n in zf.namelist()]
        assert any(n.endswith(".shp") for n in names)
        assert any(n.endswith(".dbf") for n in names)
        assert any(n.endswith(".shx") for n in names)

    def test_zip_contains_no_nested_dirs(self, tmp_path):
        gdf = gpd.GeoDataFrame(
            {"id": [1]},
            geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
            crs="EPSG:4326",
        )
        zip_path = GISRepairer.package_repaired_data(gdf, str(tmp_path), "flat")
        with zipfile.ZipFile(zip_path, "r") as zf:
            for name in zf.namelist():
                assert "/" not in name, f"Unexpected nested path: {name}"
