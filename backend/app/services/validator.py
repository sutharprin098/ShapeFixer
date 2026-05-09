import os
import zipfile
import geopandas as gpd
from shapely.validation import explain_validity
from typing import List, Dict, Any

class GISValidator:
    REQUIRED_SHP_EXTENSIONS = {'.shp', '.shx', '.dbf'}
    RECOMMENDED_SHP_EXTENSIONS = {'.prj'}
    
    @staticmethod
    def validate_structure(file_path: str) -> Dict[str, Any]:
        """Checks if the file is a valid GIS format."""
        ext = os.path.splitext(file_path)[1].lower()
        issues = []
        
        if ext == '.zip':
            try:
                with zipfile.ZipFile(file_path, 'r') as zip_ref:
                    file_list = zip_ref.namelist()
                    found_exts = {os.path.splitext(f)[1].lower() for f in file_list}
                    
                    # Check required
                    missing_req = GISValidator.REQUIRED_SHP_EXTENSIONS - found_exts
                    if missing_req:
                        issues.append({
                            "id": "missing_shp_components",
                            "severity": "high",
                            "label": "Incomplete Shapefile",
                            "description": f"Missing: {', '.join(missing_req)}",
                            "friendly_explanation": "A shapefile needs at least .shp, .shx, and .dbf files inside the ZIP. We can try to rebuild them, but data might be lost."
                        })
                        
                    # Check recommended
                    missing_rec = GISValidator.RECOMMENDED_SHP_EXTENSIONS - found_exts
                    if missing_rec:
                        issues.append({
                            "id": "missing_prj",
                            "severity": "medium",
                            "label": "Missing Projection (.prj)",
                            "description": "The .prj file is missing.",
                            "friendly_explanation": "Without a .prj file, we don't know the coordinate system. We will assume WGS84 (EPSG:4326)."
                        })
            except zipfile.BadZipFile:
                issues.append({
                    "id": "corrupt_zip",
                    "severity": "critical",
                    "label": "Corrupt ZIP",
                    "description": "The file is not a valid ZIP.",
                    "friendly_explanation": "We couldn't open this ZIP file."
                })
        
        elif ext not in {'.geojson', '.json', '.gpkg', '.kml'}:
            issues.append({
                "id": "unsupported_format",
                "severity": "critical",
                "label": "Unsupported Format",
                "description": f"The format {ext} is not supported.",
                "friendly_explanation": "Please upload .zip, .geojson, .gpkg, or .kml files."
            })
            
        return {"is_valid": len([i for i in issues if i['severity'] == 'critical']) == 0, "issues": issues}

    @staticmethod
    def validate_geometries(gdf: gpd.GeoDataFrame) -> List[Dict[str, Any]]:
        issues = []
        
        # 1. Invalid geometries
        invalid_mask = ~gdf.geometry.is_valid
        if invalid_mask.any():
            count = invalid_mask.sum()
            issues.append({
                "id": "invalid_geometry",
                "severity": "high",
                "label": "Invalid Geometries",
                "description": f"Found {count} invalid shapes.",
                "friendly_explanation": f"{count} features have self-intersections or twisted boundaries."
            })
            
        # 2. CRS check
        if gdf.crs is None:
            issues.append({
                "id": "missing_crs",
                "severity": "medium",
                "label": "Missing CRS",
                "description": "No coordinate reference system detected.",
                "friendly_explanation": "This file has no projection. We will use WGS84 (EPSG:4326) as default."
            })
            
        # 3. Multipart check — Bug 1 fix: drop nulls before string operation
        is_multipart = gdf.geometry.dropna().geom_type.str.contains("Multi").any()
        if is_multipart:
            issues.append({
                "id": "multipart_geom",
                "severity": "low",
                "label": "Multipart Features",
                "description": "Contains MultiPolygon/MultiLineString.",
                "friendly_explanation": "Some tools prefer singlepart geometries."
            })

        return issues
