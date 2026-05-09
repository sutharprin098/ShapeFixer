"use client";

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Maximize2, Layers, Map as MapIcon } from 'lucide-react';

interface MapPreviewProps {
  geojson: any;
}

function extractAllCoords(geometry: any): number[][] {
  if (!geometry) return [];
  switch (geometry.type) {
    case 'Point':           return [geometry.coordinates];
    case 'MultiPoint':
    case 'LineString':      return geometry.coordinates;
    case 'MultiLineString':
    case 'Polygon':         return geometry.coordinates.flat(1);  // rings → coord pairs
    case 'MultiPolygon':    return geometry.coordinates.flat(2);  // polys → rings → coord pairs
    default:                return [];
  }
}

const LAYER_IDS = ['repaired-fill', 'repaired-outline', 'repaired-line', 'repaired-circle'];

export default function MapPreview({ geojson }: MapPreviewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const isMounted = useRef(true);   // Bug 25 fix: track mount state
  const [isLoaded, setIsLoaded] = useState(false);

  // Bug 25 fix: mark unmounted so the load callback doesn't setState after unmount
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm-layer', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 }],
      },
      center: [0, 20],
      zoom: 1,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    map.current.on('load', () => {
      if (isMounted.current) setIsLoaded(true);  // Bug 25 fix
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !isLoaded || !geojson) return;

    LAYER_IDS.forEach(id => {
      if (map.current!.getLayer(id)) map.current!.removeLayer(id);
    });
    if (map.current.getSource('repaired-data')) map.current.removeSource('repaired-data');

    map.current.addSource('repaired-data', { type: 'geojson', data: geojson });

    const geomTypes = new Set<string>(
      geojson.features.map((f: any) => f.geometry?.type).filter(Boolean)
    );
    const hasPolygon = [...geomTypes].some(t => t.includes('Polygon'));
    const hasLine    = [...geomTypes].some(t => t.includes('LineString'));
    const hasPoint   = [...geomTypes].some(t => t.includes('Point'));

    if (hasPolygon) {
      map.current.addLayer({
        id: 'repaired-fill',
        type: 'fill',
        source: 'repaired-data',
        filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.35 },
      });
      map.current.addLayer({
        id: 'repaired-outline',
        type: 'line',
        source: 'repaired-data',
        filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
        paint: { 'line-color': '#1d4ed8', 'line-width': 1.5 },
      });
    }

    if (hasLine) {
      map.current.addLayer({
        id: 'repaired-line',
        type: 'line',
        source: 'repaired-data',
        filter: ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
        paint: { 'line-color': '#3b82f6', 'line-width': 2.5 },
      });
    }

    if (hasPoint) {
      map.current.addLayer({
        id: 'repaired-circle',
        type: 'circle',
        source: 'repaired-data',
        filter: ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false],
        paint: {
          'circle-color': '#3b82f6',
          'circle-radius': 6,
          'circle-opacity': 0.85,
          'circle-stroke-color': '#1d4ed8',
          'circle-stroke-width': 1.5,
        },
      });
    }

    // Bug 19 fix: validate coords (finite numbers, length 2) before fitting bounds
    const allCoords = geojson.features
      .flatMap((f: any) => extractAllCoords(f.geometry))
      .filter(
        (c: any) =>
          Array.isArray(c) &&
          c.length >= 2 &&
          isFinite(c[0]) &&
          isFinite(c[1])
      );

    if (allCoords.length > 0) {
      const bounds = allCoords.reduce(
        (acc: maplibregl.LngLatBounds, coord: number[]) =>
          acc.extend(coord as [number, number]),
        new maplibregl.LngLatBounds(
          allCoords[0] as [number, number],
          allCoords[0] as [number, number]
        )
      );
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 16 });
    }
  }, [geojson, isLoaded]);

  return (
    <div className="relative w-full h-[600px] rounded-3xl overflow-hidden border border-slate-200 glass-card">
      <div ref={mapContainer} className="w-full h-full" />

      <div className="absolute top-4 left-4 flex flex-col space-y-2 z-10">
        <div className="p-2.5 rounded-xl bg-white/90 backdrop-blur-md border border-slate-200 text-slate-600 hover:bg-white hover:text-blue-600 transition-all cursor-pointer shadow-sm">
          <Layers className="w-4 h-4" />
        </div>
        <div className="p-2.5 rounded-xl bg-white/90 backdrop-blur-md border border-slate-200 text-slate-600 hover:bg-white hover:text-blue-600 transition-all cursor-pointer shadow-sm">
          <Maximize2 className="w-4 h-4" />
        </div>
      </div>

      {!geojson && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm z-10">
          <div className="p-6 rounded-full bg-white shadow-xl shadow-blue-500/5 mb-6 border border-slate-100">
            <MapIcon className="w-12 h-12 text-blue-500" />
          </div>
          <p className="text-slate-900 font-bold text-lg">Awaiting Repaired Data</p>
          <p className="text-slate-500 text-sm mt-1">Interactive preview will load here</p>
        </div>
      )}
    </div>
  );
}
