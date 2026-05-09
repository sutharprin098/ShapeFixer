"use client";

import { useState, useEffect } from 'react';
import { Table as TableIcon, Save, Edit3, Plus, Trash2, LayoutGrid, Type, Undo, Redo } from 'lucide-react';

interface AttributeTableProps {
  data: any;
  onSave: (updatedData: any) => void;
}

export default function AttributeTable({ data, onSave }: AttributeTableProps) {
  const [features, setFeatures] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [past, setPast] = useState<{ features: any[], columns: string[] }[]>([]);
  const [future, setFuture] = useState<{ features: any[], columns: string[] }[]>([]);

  useEffect(() => {
    if (data && data.features) {
      const initialFeatures = JSON.parse(JSON.stringify(data.features));
      let initialCols: string[] = [];
      if (data.features.length > 0) {
        initialCols = Object.keys(data.features[0].properties ?? {});
      } else if (columns.length === 0) {
        initialCols = ['ID'];
      }
      
      setFeatures(initialFeatures);
      setColumns(initialCols);
      setPast([]);
      setFuture([]);
    }
  }, [data]);

  const saveToHistory = () => {
    setPast(prev => [...prev.slice(-49), { 
      features: JSON.parse(JSON.stringify(features)), 
      columns: [...columns] 
    }]);
    setFuture([]);
  };

  const undo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    
    setFuture(prev => [{ 
      features: JSON.parse(JSON.stringify(features)), 
      columns: [...columns] 
    }, ...prev.slice(0, 49)]);
    
    setFeatures(previous.features);
    setColumns(previous.columns);
    setPast(newPast);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast(prev => [...prev.slice(-49), { 
      features: JSON.parse(JSON.stringify(features)), 
      columns: [...columns] 
    }]);
    
    setFeatures(next.features);
    setColumns(next.columns);
    setFuture(newFuture);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [past, future, features, columns]);

  const handleCellChange = (featureIndex: number, key: string, value: string) => {
    saveToHistory();
    const updatedFeatures = [...features];
    if (!updatedFeatures[featureIndex].properties) {
      updatedFeatures[featureIndex].properties = {};
    }
    updatedFeatures[featureIndex].properties[key] = value;
    setFeatures(updatedFeatures);
  };

  const handleAddRow = () => {
    saveToHistory();
    const newProperties: any = {};
    columns.forEach(col => {
      newProperties[col] = col === 'ID' ? (features.length + 1).toString() : '';
    });
    
    const newFeature = {
      type: 'Feature',
      geometry: features.length > 0 ? JSON.parse(JSON.stringify(features[0].geometry)) : null,
      properties: newProperties
    };
    
    setFeatures([...features, newFeature]);
  };

  const handleDeleteRow = (idx: number) => {
    saveToHistory();
    const updated = features.filter((_, i) => i !== idx);
    setFeatures(updated);
  };

  const handleAddField = () => {
    const fieldName = prompt("Enter new field name:");
    if (!fieldName || columns.includes(fieldName)) return;

    saveToHistory();
    setColumns([...columns, fieldName]);
    const updatedFeatures = features.map(f => ({
      ...f,
      properties: { ...f.properties, [fieldName]: '' }
    }));
    setFeatures(updatedFeatures);
  };

  const handleDeleteField = (colToDelete: string) => {
    if (!confirm(`Are you sure you want to delete the field "${colToDelete}"?`)) return;
    
    saveToHistory();
    const updatedCols = columns.filter(c => c !== colToDelete);
    setColumns(updatedCols);
    
    const updatedFeatures = features.map(f => {
      const props = { ...f.properties };
      delete props[colToDelete];
      return { ...f, properties: props };
    });
    setFeatures(updatedFeatures);
  };

  const handleSaveChanges = () => {
    setIsSaving(true);
    const updatedGeoJSON = {
      ...data,
      features: features
    };
    onSave(updatedGeoJSON);
    setTimeout(() => setIsSaving(false), 1000);
  };

  if (!data || !data.features) return null;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
            <TableIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Attribute Table</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Manage feature data & properties
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button 
              onClick={undo}
              disabled={past.length === 0}
              className={`p-2 rounded-md transition-all flex items-center space-x-2 text-xs font-bold ${
                past.length === 0 ? 'text-slate-300' : 'text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-4 h-4" />
              <span className="hidden sm:inline">Undo</span>
            </button>
            <div className="w-px h-4 bg-slate-300 self-center mx-1" />
            <button 
              onClick={redo}
              disabled={future.length === 0}
              className={`p-2 rounded-md transition-all flex items-center space-x-2 text-xs font-bold ${
                future.length === 0 ? 'text-slate-300' : 'text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-4 h-4" />
              <span className="hidden sm:inline">Redo</span>
            </button>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button 
              onClick={handleAddRow}
              className="p-2 text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm rounded-md transition-all flex items-center space-x-2 text-xs font-bold"
              title="Add Row"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Row</span>
            </button>
            <div className="w-px h-4 bg-slate-300 self-center mx-1" />
            <button 
              onClick={handleAddField}
              className="p-2 text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm rounded-md transition-all flex items-center space-x-2 text-xs font-bold"
              title="Add Field"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Add Field</span>
            </button>
          </div>

          <div className="flex bg-red-50 p-1 rounded-lg border border-red-100">
            <button 
              onClick={() => {
                const id = prompt("Enter FID to remove:");
                if (id) handleDeleteRow(parseInt(id) - 1);
              }}
              className="p-2 text-red-400 hover:bg-white hover:text-red-600 hover:shadow-sm rounded-md transition-all flex items-center space-x-2 text-xs font-bold"
              title="Remove Row"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Remove Row</span>
            </button>
            <div className="w-px h-4 bg-red-200 self-center mx-1" />
            <button 
              onClick={() => {
                const field = prompt("Enter field name to remove:");
                if (field && columns.includes(field)) handleDeleteField(field);
              }}
              className="p-2 text-red-400 hover:bg-white hover:text-red-600 hover:shadow-sm rounded-md transition-all flex items-center space-x-2 text-xs font-bold"
              title="Remove Field"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Remove Field</span>
            </button>
          </div>

          <button 
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="btn-primary py-2.5 px-6 flex items-center space-x-2 text-sm shadow-blue-600/20 active:scale-95"
          >
            {isSaving ? (
              <span className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving...</span>
              </span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Commit Edits</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden border border-slate-200 shadow-xl shadow-slate-200/50">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest sticky top-0 bg-slate-50 z-10 w-16">
                  FID
                </th>
                {columns.map(col => (
                  <th key={col} className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest sticky top-0 bg-slate-50 z-10 border-l border-slate-200 group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Type className="w-3 h-3 text-slate-300" />
                        <span>{col}</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteField(col)}
                        className="opacity-40 hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all rounded"
                        title="Delete Field"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest sticky top-0 bg-slate-50 z-10 border-l border-slate-200 w-12 text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {features.map((feature, idx) => (
                <tr key={idx} className="hover:bg-blue-50/20 transition-colors group">
                  <td className="p-4 text-xs font-mono text-slate-400 bg-slate-50/30 font-bold">{idx + 1}</td>
                  {columns.map(col => (
                    <td key={col} className="p-1 border-l border-slate-100">
                      <input 
                        type="text" 
                        value={feature.properties?.[col] ?? ''} 
                        onChange={(e) => handleCellChange(idx, col, e.target.value)}
                        placeholder="null"
                        className="w-full p-3 bg-transparent border-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 rounded-lg text-sm text-slate-700 outline-none transition-all placeholder:text-slate-300"
                      />
                    </td>
                  ))}
                  <td className="p-1 border-l border-slate-100 text-center">
                    <button 
                      onClick={() => handleDeleteRow(idx)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-60 hover:opacity-100 rounded-lg transition-all"
                      title="Delete Row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {features.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <LayoutGrid className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-400 font-medium">No records found. Click "Add Row" to begin.</p>
            </div>
          )}
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          <div className="flex items-center space-x-6">
            <span>{features.length} Total Records</span>
            <span>{columns.length} Fields</span>
          </div>
          <span className="flex items-center space-x-2 text-blue-500 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            <Edit3 className="w-3 h-3" />
            <span>Interactive Editing Mode Active</span>
          </span>
        </div>
      </div>
    </div>
  );
}
