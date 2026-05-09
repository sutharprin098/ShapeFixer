import os
import shutil
import zipfile
import tempfile
import shapefile  # pyshp
import geopandas as gpd
from shapely.validation import make_valid


class GISRepairer:

    @staticmethod
    def reconstruct_missing_files(zip_path: str) -> str:
        """
        If .dbf or .shx are missing, reconstructs them from the .shp.
        Returns path to a new ZIP containing all components.
        """
        temp_dir = tempfile.mkdtemp()
        try:
            # Bug 4 fix: explicit exception handling so temp_dir is always cleaned
            try:
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)
            except zipfile.BadZipFile:
                shutil.rmtree(temp_dir)
                raise ValueError("The uploaded ZIP file is corrupt and cannot be opened.")

            files = []
            for root, _, filenames in os.walk(temp_dir):
                for f in filenames:
                    files.append(os.path.join(root, f))
            
            shp_abs = next((f for f in files if f.lower().endswith('.shp')), None)
            if not shp_abs:
                return zip_path  # Can't reconstruct without .shp

            base_name_no_ext = os.path.splitext(os.path.basename(shp_abs))[0]
            shp_dir = os.path.dirname(shp_abs)
            dbf_abs = os.path.join(shp_dir, base_name_no_ext + ".dbf")
            shx_abs = os.path.join(shp_dir, base_name_no_ext + ".shx")

            if not os.path.exists(dbf_abs) or not os.path.exists(shx_abs):
                # Read all data into memory first (Bug 4: close reader before writing)
                with shapefile.Reader(shp_abs) as r:
                    shape_type = r.shapeType
                    fields = list(r.fields)  # includes DeletionFlag header
                    shapes = list(r.shapes())
                    try:
                        records = list(r.records())
                    except Exception:
                        records = []

                # Write to a separate temp dir to avoid clobbering the source .shp
                rebuild_dir = tempfile.mkdtemp()
                try:
                    new_base = os.path.join(rebuild_dir, base_name_no_ext)
                    with shapefile.Writer(new_base) as w:
                        w.shapeType = shape_type
                        user_fields = [f for f in fields if f[0] != 'DeletionFlag']
                        if not user_fields:
                            # .dbf was absent — add a minimal default field
                            w.field('ID', 'N')
                        else:
                            for field in user_fields:
                                w.field(*field)
                        for i, shape in enumerate(shapes):
                            w.shape(shape)
                            if user_fields and i < len(records):
                                w.record(*records[i])
                            else:
                                w.record(i + 1)

                    for generated_f in os.listdir(rebuild_dir):
                        shutil.copy2(
                            os.path.join(rebuild_dir, generated_f),
                            os.path.join(shp_dir, generated_f),
                        )
                finally:
                    # ignore_errors: Windows may hold a brief lock on the
                    # shapefile.Writer output files even after __exit__
                    shutil.rmtree(rebuild_dir, ignore_errors=True)

            new_zip_path = zip_path.replace(".zip", "_reconstructed.zip")
            with zipfile.ZipFile(new_zip_path, 'w') as new_zip:
                for root, _, filenames in os.walk(temp_dir):
                    for f in filenames:
                        fp = os.path.join(root, f)
                        rel_path = os.path.relpath(fp, temp_dir)
                        new_zip.write(fp, rel_path)
            return new_zip_path
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    @staticmethod
    def repair_geometries(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Fixes invalid geometries using shapely.make_valid."""
        repaired = gdf.copy()

        # Bug 5 fix: guard against None geometries before calling is_valid
        repaired.geometry = repaired.geometry.apply(
            lambda geom: make_valid(geom) if geom is not None and not geom.is_valid else geom
        )

        repaired = repaired[repaired.geometry.notnull() & ~repaired.geometry.is_empty]

        # Bug 6 fix: raise clearly if every geometry was unfixable
        if repaired.empty:
            raise ValueError(
                "All features had invalid geometries that could not be repaired. "
                "The file may be corrupt."
            )

        return repaired

    @staticmethod
    def convert_to_singlepart(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """Converts multipart geometries to singlepart."""
        return gdf.explode(index_parts=False)

    @staticmethod
    def assign_default_crs(gdf: gpd.GeoDataFrame, target_crs: str = "EPSG:4326") -> gpd.GeoDataFrame:
        """Assigns CRS if missing, or reprojects to target_crs if already set."""
        # Bug 7 fix: also reproject when CRS exists but differs from target
        if gdf.crs is None:
            gdf = gdf.set_crs(target_crs)
        elif str(gdf.crs) != target_crs:
            gdf = gdf.to_crs(target_crs)
        return gdf

    @staticmethod
    def _ensure_legacy_dtypes(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        """
        Bug 25 fix: Fiona/GDAL drivers often fail with newer pandas dtypes
        like StringDtype. Convert them back to 'object' for compatibility.
        """
        import pandas as pd
        df = gdf.copy()
        for col in df.columns:
            if isinstance(df[col].dtype, pd.StringDtype):
                df[col] = df[col].astype(object)
            elif df[col].dtype.name == 'string':
                df[col] = df[col].astype(object)
        return df

    @staticmethod
    def package_repaired_data(gdf: gpd.GeoDataFrame, output_dir: str, base_name: str) -> str:
        """Saves repaired data to a ZIP containing all shapefile components."""
        temp_subdir = tempfile.mkdtemp(dir=output_dir)
        shp_path = os.path.join(temp_subdir, f"{base_name}_repaired.shp")

        # Bug 25 fix: Ensure compatibility before saving
        compat_gdf = GISRepairer._ensure_legacy_dtypes(gdf)
        compat_gdf.to_file(shp_path)

        zip_path = os.path.join(output_dir, f"{base_name}_repaired.zip")
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            # Bug 8 fix: use listdir + isfile instead of os.walk to avoid nested dirs
            for file in os.listdir(temp_subdir):
                fp = os.path.join(temp_subdir, file)
                if os.path.isfile(fp):
                    zipf.write(fp, file)

        shutil.rmtree(temp_subdir)
        return zip_path
