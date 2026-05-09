"""Unit tests for GISValidator."""
import os
import zipfile
import pytest
import geopandas as gpd
from shapely.geometry import Point, Polygon, MultiPolygon


from app.services.validator import GISValidator


class TestValidateStructure:
    def test_valid_zip_all_components(self, valid_zip):
        result = GISValidator.validate_structure(valid_zip)
        assert result["is_valid"] is True
        assert result["issues"] == []

    def test_zip_missing_dbf(self, missing_dbf_zip):
        result = GISValidator.validate_structure(missing_dbf_zip)
        ids = [i["id"] for i in result["issues"]]
        assert "missing_shp_components" in ids

    def test_zip_missing_shx(self, missing_shx_zip):
        result = GISValidator.validate_structure(missing_shx_zip)
        ids = [i["id"] for i in result["issues"]]
        assert "missing_shp_components" in ids

    def test_corrupt_zip(self, corrupt_zip):
        result = GISValidator.validate_structure(corrupt_zip)
        ids = [i["id"] for i in result["issues"]]
        assert "corrupt_zip" in ids
        assert result["is_valid"] is False

    def test_geojson_valid(self, valid_geojson):
        result = GISValidator.validate_structure(valid_geojson)
        assert result["is_valid"] is True
        assert result["issues"] == []

    def test_gpkg_valid(self, tmp_path):
        gdf = gpd.GeoDataFrame(
            {"id": [1]},
            geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
            crs="EPSG:4326",
        )
        p = tmp_path / "test.gpkg"
        gdf.to_file(str(p), driver="GPKG")
        result = GISValidator.validate_structure(str(p))
        assert result["is_valid"] is True

    def test_unsupported_format(self, tmp_path):
        p = tmp_path / "file.txt"
        p.write_text("hello")
        result = GISValidator.validate_structure(str(p))
        ids = [i["id"] for i in result["issues"]]
        assert "unsupported_format" in ids
        assert result["is_valid"] is False

    def test_missing_shp_issue_has_description(self, missing_dbf_zip):
        result = GISValidator.validate_structure(missing_dbf_zip)
        issue = next(i for i in result["issues"] if i["id"] == "missing_shp_components")
        assert ".dbf" in issue["description"]
        assert "friendly_explanation" in issue


class TestValidateGeometries:
    def test_all_valid_no_issues(self):
        gdf = gpd.GeoDataFrame(
            {"id": [1]},
            geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
            crs="EPSG:4326",
        )
        issues = GISValidator.validate_geometries(gdf)
        ids = [i["id"] for i in issues]
        assert "invalid_geometry" not in ids

    def test_detects_invalid_geometry(self):
        from shapely.geometry import shape
        bowtie = shape({
            "type": "Polygon",
            "coordinates": [[[0, 0], [2, 2], [2, 0], [0, 2], [0, 0]]]
        })
        gdf = gpd.GeoDataFrame({"id": [1]}, geometry=[bowtie], crs="EPSG:4326")
        issues = GISValidator.validate_geometries(gdf)
        ids = [i["id"] for i in issues]
        assert "invalid_geometry" in ids

    def test_invalid_geometry_count_in_description(self):
        from shapely.geometry import shape
        bowtie = shape({
            "type": "Polygon",
            "coordinates": [[[0, 0], [2, 2], [2, 0], [0, 2], [0, 0]]]
        })
        gdf = gpd.GeoDataFrame({"id": [1, 2]}, geometry=[bowtie, bowtie], crs="EPSG:4326")
        issues = GISValidator.validate_geometries(gdf)
        issue = next(i for i in issues if i["id"] == "invalid_geometry")
        assert "2" in issue["description"]

    def test_detects_missing_crs(self):
        gdf = gpd.GeoDataFrame(
            {"id": [1]},
            geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
        )
        issues = GISValidator.validate_geometries(gdf)
        ids = [i["id"] for i in issues]
        assert "missing_crs" in ids

    def test_no_missing_crs_when_crs_present(self):
        gdf = gpd.GeoDataFrame(
            {"id": [1]},
            geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
            crs="EPSG:4326",
        )
        issues = GISValidator.validate_geometries(gdf)
        ids = [i["id"] for i in issues]
        assert "missing_crs" not in ids

    def test_detects_multipart_geometries(self):
        mp = MultiPolygon([
            Polygon([(0, 0), (1, 0), (1, 1), (0, 1)]),
            Polygon([(2, 2), (3, 2), (3, 3), (2, 3)]),
        ])
        gdf = gpd.GeoDataFrame({"id": [1]}, geometry=[mp], crs="EPSG:4326")
        issues = GISValidator.validate_geometries(gdf)
        ids = [i["id"] for i in issues]
        assert "multipart_geom" in ids

    def test_no_multipart_for_singlepart(self):
        gdf = gpd.GeoDataFrame(
            {"id": [1]},
            geometry=[Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
            crs="EPSG:4326",
        )
        issues = GISValidator.validate_geometries(gdf)
        ids = [i["id"] for i in issues]
        assert "multipart_geom" not in ids

    def test_null_geometry_no_crash(self):
        gdf = gpd.GeoDataFrame(
            {"id": [1, 2]},
            geometry=[None, Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])],
            crs="EPSG:4326",
        )
        issues = GISValidator.validate_geometries(gdf)
        # Should not raise; None geometry is simply not multipart
        assert isinstance(issues, list)
