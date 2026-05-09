from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse
import geopandas as gpd
import os
import json
import zipfile
import tempfile
import shutil
import fiona
from app.services.validator import GISValidator
from app.services.repairer import GISRepairer
from app.utils.file_manager import FileManager, UPLOAD_DIR, REPAIR_DIR

router = APIRouter()

# Enable KML support in fiona
fiona.drvsupport.supported_drivers['KML'] = 'rw'
fiona.drvsupport.supported_drivers['LIBKML'] = 'rw'

_ALLOWED_DIRS = [UPLOAD_DIR.resolve(), REPAIR_DIR.resolve()]


def _safe_path(file_path: str) -> Path:
    """
    Bug 2 fix: reject path traversal attempts.
    Raises HTTPException 400 if the resolved path escapes allowed directories.
    """
    try:
        resolved = Path(file_path).resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file path")
    if not any(resolved.is_relative_to(d) for d in _ALLOWED_DIRS):
        raise HTTPException(status_code=403, detail="Access to this path is not allowed")
    return resolved


def _strip_suffixes(name: str) -> str:
    """
    Bug 10 fix: use endswith instead of replace to avoid mangling filenames
    that happen to contain '_reconstructed' or '_repaired' mid-name.
    """
    for suffix in ("_reconstructed", "_repaired", "_edited", "_export", "_fixed"):
        if name.endswith(suffix):
            name = name[: -len(suffix)]
            break  # only strip one suffix
    return name


def _read_zip_gdf(zip_path: str) -> gpd.GeoDataFrame:
    """
    Extracts ZIP to a temp dir and reads the .shp directly.
    Avoids WinError 32 on Windows where fiona's zip:// extraction
    holds locked file handles on .dbf/.shx components.
    """
    tmp_dir = tempfile.mkdtemp()
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(tmp_dir)
        shp_file = next(
            (os.path.join(tmp_dir, f) for f in os.listdir(tmp_dir) if f.lower().endswith('.shp')),
            None,
        )
        if shp_file is None:
            raise ValueError("No .shp file found in ZIP")
        return gpd.read_file(shp_file)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _read_gdf(file_path: str) -> gpd.GeoDataFrame:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.zip':
        return _read_zip_gdf(file_path)
    if ext == '.kml':
        return gpd.read_file(file_path, driver='KML')
    return gpd.read_file(file_path)


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    allowed = {'.zip', '.geojson', '.json', '.gpkg', '.kml'}

    if ext not in allowed:
        return JSONResponse(status_code=400, content={"error": f"Unsupported format: {ext}"})

    content = await file.read()
    file_path = FileManager.save_upload(content, file.filename)

    if ext == '.zip':
        structure = GISValidator.validate_structure(file_path)
        if not structure["is_valid"]:
            return JSONResponse(status_code=400, content=structure)

    return {
        "filename": file.filename,
        "path": file_path,
        "format": ext.replace('.', '').upper(),
    }


@router.post("/validate")
async def validate_data(data: dict):
    file_path = data.get("path")
    if not file_path:
        return JSONResponse(status_code=400, content={"error": "path is required"})

    _safe_path(file_path)  # Bug 2 fix

    if not os.path.exists(file_path):
        return JSONResponse(status_code=404, content={"error": "File not found"})

    try:
        ext = os.path.splitext(file_path)[1].lower()

        struct_results = GISValidator.validate_structure(file_path)
        issues = struct_results["issues"]

        if ext == '.zip':
            file_path = GISRepairer.reconstruct_missing_files(file_path)
            gdf = _read_zip_gdf(file_path)
        elif ext == '.kml':
            gdf = gpd.read_file(file_path, driver='KML')
        else:
            gdf = gpd.read_file(file_path)

        geom_issues = GISValidator.validate_geometries(gdf)
        issues.extend(geom_issues)

        return {
            "stats": {
                "feature_count": len(gdf),
                "geometry_type": str(gdf.geometry.dropna().geom_type.iloc[0]) if not gdf.empty else "None",
                "crs": str(gdf.crs) if gdf.crs else "None",
                "format": ext.replace('.', '').upper(),
                "path": file_path,
            },
            "issues": issues,
        }
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Read failed: {str(e)}"})


@router.post("/repair")
async def repair_data(data: dict):
    file_path = data.get("path")
    options = data.get("options", {})

    if not file_path:
        return JSONResponse(status_code=400, content={"error": "path is required"})

    _safe_path(file_path)  # Bug 2 fix

    if not os.path.exists(file_path):
        return JSONResponse(status_code=404, content={"error": "File not found"})

    try:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.zip':
            file_path = GISRepairer.reconstruct_missing_files(file_path)
            gdf = _read_zip_gdf(file_path)
        elif ext == '.kml':
            gdf = gpd.read_file(file_path, driver='KML')
        else:
            gdf = gpd.read_file(file_path)

        repaired_gdf = GISRepairer.repair_geometries(gdf)

        if options.get("singlepart"):
            repaired_gdf = GISRepairer.convert_to_singlepart(repaired_gdf)

        # Bug 7 fix: assign_default_crs now reprojects if needed
        if repaired_gdf.crs is None or options.get("force_crs"):
            repaired_gdf = GISRepairer.assign_default_crs(
                repaired_gdf, options.get("target_crs", "EPSG:4326")
            )

        base_name = _strip_suffixes(os.path.basename(file_path).rsplit('.', 1)[0])
        
        # Bug 25 fix: Ensure compatibility before saving
        compat_gdf = GISRepairer._ensure_legacy_dtypes(repaired_gdf)

        if ext in {'.geojson', '.json'}:
            out_path = os.path.join(REPAIR_DIR, f"{base_name}_fixed.geojson")
            compat_gdf.to_file(out_path, driver='GeoJSON')
        elif ext == '.gpkg':
            out_path = os.path.join(REPAIR_DIR, f"{base_name}_fixed.gpkg")
            compat_gdf.to_file(out_path, driver='GPKG')
        else:
            out_path = GISRepairer.package_repaired_data(compat_gdf, str(REPAIR_DIR), base_name)

        preview_gdf = (
            repaired_gdf.to_crs("EPSG:4326")
            if repaired_gdf.crs and str(repaired_gdf.crs) != "EPSG:4326"
            else repaired_gdf
        )
        preview_geojson = json.loads(preview_gdf.to_json())

        return {
            "repaired_path": str(out_path),
            "preview_geojson": preview_geojson,
            "stats": {
                "feature_count": len(repaired_gdf),
                "crs": str(repaired_gdf.crs),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Repair failed: {str(e)}"})


@router.post("/save_changes")
async def save_changes(data: dict):
    geojson = data.get("geojson")
    original_path = data.get("path")

    if not geojson or not original_path:
        return JSONResponse(status_code=400, content={"error": "Missing geojson or path"})

    # Bug 9 fix: validate GeoJSON structure before processing
    if not isinstance(geojson, dict) or "features" not in geojson or not isinstance(geojson["features"], list):
        return JSONResponse(status_code=400, content={"error": "Invalid GeoJSON structure"})

    _safe_path(original_path)  # Bug 2 fix

    try:
        gdf = gpd.GeoDataFrame.from_features(geojson["features"])
        gdf = gdf.set_crs("EPSG:4326")

        ext = os.path.splitext(original_path)[1].lower()
        # Bug 10 fix: use _strip_suffixes instead of .replace()
        base_name = _strip_suffixes(os.path.basename(original_path).rsplit('.', 1)[0])

        # Bug 25 fix: Ensure compatibility before saving
        compat_gdf = GISRepairer._ensure_legacy_dtypes(gdf)

        if ext in {'.geojson', '.json'}:
            out_path = os.path.join(REPAIR_DIR, f"{base_name}_edited.geojson")
            compat_gdf.to_file(out_path, driver='GeoJSON')
        elif ext == '.gpkg':
            out_path = os.path.join(REPAIR_DIR, f"{base_name}_edited.gpkg")
            compat_gdf.to_file(out_path, driver='GPKG')
        else:
            out_path = GISRepairer.package_repaired_data(compat_gdf, str(REPAIR_DIR), f"{base_name}_edited")

        return {"repaired_path": str(out_path)}
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Save failed: {str(e)}"})


@router.get("/download")
async def download_file(path: str):
    _safe_path(path)  # Bug 2 fix
    if not os.path.exists(path):
        return JSONResponse(status_code=404, content={"error": "File not found"})
    return FileResponse(path, filename=os.path.basename(path))


@router.get("/export")
async def export_file(path: str, format: str = "geojson"):
    """Convert any repaired file to the requested format for download."""
    _safe_path(path)  # Bug 2 fix
    if not os.path.exists(path):
        return JSONResponse(status_code=404, content={"error": "File not found"})

    try:
        gdf = _read_gdf(path)

        if gdf.crs and str(gdf.crs) != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")

        base_name = _strip_suffixes(os.path.basename(path).rsplit('.', 1)[0])
        fmt = format.lower()
        
        # Bug 25 fix: Ensure compatibility before saving
        compat_gdf = GISRepairer._ensure_legacy_dtypes(gdf)

        if fmt == "geojson":
            out_path = os.path.join(REPAIR_DIR, f"{base_name}_export.geojson")
            compat_gdf.to_file(out_path, driver='GeoJSON')
            return FileResponse(
                out_path,
                filename=f"{base_name}.geojson",
                media_type="application/geo+json",
            )
        elif fmt == "gpkg":
            out_path = os.path.join(REPAIR_DIR, f"{base_name}_export.gpkg")
            compat_gdf.to_file(out_path, driver='GPKG')
            return FileResponse(out_path, filename=f"{base_name}.gpkg")
        else:
            out_path = GISRepairer.package_repaired_data(compat_gdf, str(REPAIR_DIR), f"{base_name}_export")
            return FileResponse(out_path, filename=f"{base_name}.zip")
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Export failed: {str(e)}"})


@router.get("/health")
async def health_check():
    return {"status": "ok", "service": "ShapeFixer Engine"}
