"use client";

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UploadZoneProps {
  onUploadComplete: (data: any[]) => void;
  isLoading: boolean;
}

export default function UploadZone({ onUploadComplete, isLoading }: UploadZoneProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    if (acceptedFiles.length === 0) return;

    const allowedExts = ['.zip', '.geojson', '.json', '.gpkg', '.kml'];
    const validFiles = acceptedFiles.filter(file => 
      allowedExts.some(ext => file.name.toLowerCase().endsWith(ext))
    );

    if (validFiles.length < acceptedFiles.length) {
      setError(`Some files were skipped. Only .zip, .geojson, .gpkg, .kml are supported.`);
    }

    if (validFiles.length === 0) return;

    const uploadResults: any[] = [];
    
    try {
      // Parallel upload
      const uploadPromises = validFiles.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/upload`,
          { method: 'POST', body: formData }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return { error: errorData.error || `Failed to upload ${file.name}`, filename: file.name };
        }

        return await response.json();
      });

      const results = await Promise.all(uploadPromises);
      onUploadComplete(results);
    } catch (err: any) {
      setError(err.message || 'Failed to upload files. Please ensure the backend is running.');
    }
  }, [onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'application/geo+json': ['.geojson', '.json'],
      'application/geopackage+sqlite3': ['.gpkg'],
      'application/vnd.google-earth.kml+xml': ['.kml'],
    },
  });

  // Separate the dropzone div from motion.div to avoid Framer Motion type conflict
  const rootProps = getRootProps();

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div {...rootProps}>
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className={`relative group cursor-pointer overflow-hidden
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}
            border-2 border-dashed rounded-3xl p-16 transition-all duration-300
            hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/5`}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center justify-center space-y-6 text-center">
            <div className="p-5 rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform duration-300 border border-blue-100">
              {isLoading ? (
                <Loader2 className="w-12 h-12 animate-spin" />
              ) : (
                <Upload className="w-12 h-12" />
              )}
            </div>

            <div>
              <h3 className="text-2xl font-bold text-slate-900">
                {isDragActive ? 'Drop your GIS file here' : 'Click or drag GIS file to upload'}
              </h3>
              <p className="text-slate-500 mt-2 text-sm max-w-xs mx-auto">
                SHP ZIP, GeoJSON, GeoPackage, or KML. Missing .dbf? We&apos;ll rebuild it automatically.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-6">
              {['.SHP', '.GEOJSON', '.GPKG', '.KML'].map(fmt => (
                <span key={fmt} className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider">
                  {fmt}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 flex items-center space-x-3"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
