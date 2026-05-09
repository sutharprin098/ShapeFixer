"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Wrench,
  Download,
  Layers,
  ArrowRight,
  Zap,
  Globe,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  FileJson,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import UploadZone from '@/components/UploadZone';
import IssueCard from '@/components/IssueCard';
import AttributeTable from '@/components/AttributeTable';
import BatchDashboard, { Task } from '@/components/BatchDashboard';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// MapLibre GL is ~1.4 MB — load only when the preview step is reached
const MapPreview = dynamic(() => import('@/components/MapPreview'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] rounded-3xl glass-card flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
        <p className="text-slate-500 text-sm">Loading map…</p>
      </div>
    </div>
  ),
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Bug 13 fix: safe JSON parse — never throws on non-JSON responses */
async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return { error: `Server returned non-JSON response (status ${res.status})` };
  }
}

/** Bug 22 fix: download via fetch+blob so errors can be surfaced */
async function triggerDownload(url: string, fallbackName: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(body.error || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  const contentDisp = res.headers.get('content-disposition') || '';
  const match = contentDisp.match(/filename="?([^"]+)"?/);
  a.download = match ? match[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export default function Home() {
  const [step, setStep] = useState<'upload' | 'batch' | 'preview'>('upload');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  const activeTask = tasks.find(t => t.id === activeTaskId);

  useEffect(() => {
    let current: typeof backendStatus = 'checking';
    const checkBackend = async () => {
      let next: typeof backendStatus;
      try {
        const res = await fetch(`${API_URL}/api/health`, { cache: 'no-store' });
        next = res.ok ? 'connected' : 'disconnected';
      } catch {
        next = 'disconnected';
      }
      // Only re-render when status actually changes
      if (next !== current) {
        current = next;
        setBackendStatus(next);
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUploadComplete = async (results: any[]) => {
    const newTasks: Task[] = results.map(res => ({
      id: crypto.randomUUID(),
      filename: res.filename,
      path: res.path,
      format: res.format,
      status: res.error ? 'error' : 'uploading',
      error: res.error
    }));

    setTasks(prev => [...prev, ...newTasks]);
    setStep('batch');
    setError(null);
  };

  const processTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === 'preview' || task.status === 'error') return;

    try {
      // 1. Validate
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'validating' } : t));
      const valRes = await fetch(`${API_URL}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: task.path }),
      });
      const valResults = await safeJson(valRes);
      if (!valRes.ok) throw new Error(valResults.error || 'Validation failed');

      // 2. Repair
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'repairing', validationResults: valResults } : t));
      const repRes = await fetch(`${API_URL}/api/repair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: valResults.stats?.path || task.path,
          options: { singlepart: true, target_crs: 'EPSG:4326' },
        }),
      });
      const repResults = await safeJson(repRes);
      if (!repRes.ok) throw new Error(repResults.error || 'Repair failed');

      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        status: 'preview', 
        repairResults: repResults 
      } : t));
    } catch (err: any) {
      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        status: 'error', 
        error: err.message 
      } : t));
    }
  };

  const runAllTasks = async () => {
    setIsLoading(true);
    // Process sequentially to avoid server overload
    for (const task of tasks) {
      if (task.status !== 'preview' && task.status !== 'error') {
        await processTask(task.id);
      }
    }
    setIsLoading(false);
  };

  const handleSaveEdits = async (updatedGeoJSON: any) => {
    if (!activeTask) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/save_changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: activeTask.repairResults?.repaired_path,
          geojson: updatedGeoJSON,
        }),
      });
      const results = await safeJson(res);
      if (!res.ok) throw new Error(results.error || 'Save failed');
      
      setTasks(prev => prev.map(t => t.id === activeTaskId ? {
        ...t,
        repairResults: { ...t.repairResults, repaired_path: results.repaired_path }
      } : t));
    } catch (err: any) {
      setError(err.message || 'Failed to save edits.');
    }
  };

  const handleDownloadAll = async () => {
    const completed = tasks.filter(t => t.status === 'preview');
    for (const task of completed) {
      const fname = task.repairResults.repaired_path.replace(/\\/g, '/').split('/').pop() || 'repaired';
      await triggerDownload(
        `${API_URL}/api/download?path=${encodeURIComponent(task.repairResults.repaired_path)}`,
        fname,
      );
      // Small delay between downloads to prevent browser blocking
      await new Promise(r => setTimeout(r, 500));
    }
  };

  const handleDownloadSingle = async () => {
    if (!activeTask?.repairResults) return;
    try {
      const fname = activeTask.repairResults.repaired_path.replace(/\\/g, '/').split('/').pop() || 'repaired';
      await triggerDownload(
        `${API_URL}/api/download?path=${encodeURIComponent(activeTask.repairResults.repaired_path)}`,
        fname,
      );
    } catch (err: any) {
      setError(err.message || 'Download failed.');
    }
  };

  const handleDownloadGeoJSON = async () => {
    if (!activeTask?.repairResults) return;
    try {
      const fname = activeTask.repairResults.repaired_path.replace(/\\/g, '/').split('/').pop()?.replace(/\.[^.]+$/, '.geojson') || 'repaired.geojson';
      await triggerDownload(
        `${API_URL}/api/export?path=${encodeURIComponent(activeTask.repairResults.repaired_path)}&format=geojson`,
        fname,
      );
    } catch (err: any) {
      setError(err.message || 'GeoJSON export failed.');
    }
  };

  const resetWorkflow = () => {
    setStep('upload');
    setTasks([]);
    setActiveTaskId(null);
    setError(null);
  };

  return (
    <main className="min-h-screen relative overflow-hidden flex flex-col items-center bg-slate-50">
      {/* Reduced blur-[150px]→blur-[80px] and added translate-z(0) to keep on GPU layer */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-100 blur-[80px] rounded-full opacity-60 pointer-events-none" style={{ transform: 'translateZ(0)' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-100 blur-[80px] rounded-full opacity-60 pointer-events-none" style={{ transform: 'translateZ(0)' }} />

      <Navbar backendStatus={backendStatus} />

      <div className="w-full max-w-6xl px-6 py-24 text-center z-10 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full"
        >
          {/* Progress Stepper */}
          <div className="w-full max-w-lg mx-auto flex items-center justify-between mb-20 relative">
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-200 -translate-y-1/2 z-0" />
            {['Upload', 'Batch Manager', 'Inspect Results'].map((s, i) => {
              const active =
                (step === 'upload' && i === 0) ||
                (step === 'batch' && i === 1) ||
                (step === 'preview' && i === 2);
              const completed =
                (step === 'batch' && i < 1) ||
                (step === 'preview' && i < 2);
              return (
                <div key={s} className="relative z-10 flex flex-col items-center space-y-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                    active ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : completed ? 'bg-green-500 border-green-500 text-white'
                    : 'bg-white border-slate-200 text-slate-400'
                  }`}>
                    {completed ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-xs font-black">{i + 1}</span>}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${active ? 'text-blue-600' : 'text-slate-400'}`}>{s}</span>
                </div>
              );
            })}
          </div>

          <div className="inline-flex items-center space-x-3 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-bold uppercase tracking-[0.2em] mb-10">
            <img src="/logo.png" alt="SF" className="w-4 h-4 object-contain" />
            <span>Advanced GIS Engine</span>
          </div>

          <h2 className="text-7xl md:text-9xl font-black tracking-tightest mb-10 leading-[0.9] text-slate-900">
            Shape<span className="text-blue-600">Fixer</span>.
          </h2>

          <p className="text-2xl text-slate-500 max-w-3xl mx-auto leading-relaxed mb-20 font-light tracking-wide">
            The world&apos;s most intuitive GIS utility. Automatically detect and fix
            <span className="text-slate-900 font-medium"> geometry errors</span>,
            <span className="text-slate-900 font-medium"> missing spatial indexes</span>, and
            <span className="text-slate-900 font-medium"> corrupt topology</span> in seconds.
          </p>
        </motion.div>

        {/* Global error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-2xl mb-8 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start space-x-3"
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-left flex-1">
                <p className="font-semibold text-sm">Something went wrong</p>
                <p className="text-xs mt-0.5 text-red-600">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.5 }}
              className="w-full space-y-32"
            >
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-200 to-purple-200 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
                <div className="relative">
                  <UploadZone onUploadComplete={handleUploadComplete} isLoading={isLoading} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-left">
                {[
                  { icon: ShieldCheck, title: "Deep Validation", desc: "Checks over 15+ GIS integrity rules instantly.", color: "text-blue-600" },
                  { icon: Wrench, title: "Auto Repair", desc: "Self-healing topology and geometry normalization.", color: "text-purple-600" },
                  { icon: Globe, title: "CRS Detection", desc: "Automatic coordinate system guessing engine.", color: "text-green-600" },
                  { icon: Download, title: "Multi-Export", desc: "Download as ZIP Shapefile, GeoJSON, or GeoPackage.", color: "text-orange-600" },
                ].map((feat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -10 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: i * 0.1 }}
                    className="p-8 rounded-3xl glass-card hover:border-blue-200 transition-all duration-500 group relative overflow-hidden"
                  >
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 blur-3xl rounded-full group-hover:bg-blue-100 transition-all" />
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-blue-50 transition-colors border border-slate-100">
                      <feat.icon className={`w-7 h-7 ${feat.color} group-hover:scale-110 transition-transform`} />
                    </div>
                    <h4 className="text-xl font-bold mb-3 tracking-tight text-slate-900">{feat.title}</h4>
                    <p className="text-slate-500 text-sm leading-relaxed">{feat.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'batch' && (
            <motion.div
              key="batch"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-5xl mx-auto"
            >
              <BatchDashboard 
                tasks={tasks}
                onSelect={(id) => {
                  setActiveTaskId(id);
                  setStep('preview');
                }}
                onRemove={(id) => {
                  setTasks(prev => prev.filter(t => t.id !== id));
                  if (tasks.length <= 1) setStep('upload');
                }}
                onRunAll={runAllTasks}
                onDownloadAll={handleDownloadAll}
                isProcessing={isLoading}
              />
            </motion.div>
          )}

          {step === 'preview' && activeTask && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-6xl mx-auto space-y-12"
            >
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setStep('batch')}
                  className="flex items-center space-x-2 text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  <span className="text-sm font-bold uppercase tracking-widest">Back to Dashboard</span>
                </button>
                <div className="text-right">
                  <h3 className="text-xl font-bold text-slate-900">{activeTask.filename}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Inspecting File Results</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2">
                  <MapPreview geojson={activeTask.repairResults?.preview_geojson} />
                </div>
                <div className="space-y-8">
                  <div className="glass-card p-10 text-left space-y-8">
                    <div>
                      <h3 className="text-3xl font-bold text-slate-900 mb-3">Repair Status</h3>
                      <p className="text-slate-500 leading-relaxed text-sm">
                        Detailed validation and geometry corrections for this specific file.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {[
                        { label: 'Feature Count', value: activeTask.validationResults?.stats?.feature_count ?? '—' },
                        { label: 'CRS Detected', value: activeTask.validationResults?.stats?.crs || 'None', isCrs: true },
                        { label: 'Issues Found', value: activeTask.validationResults?.issues?.length || 0, color: 'text-red-500' },
                      ].map(({ label, value, color, isCrs }) => (
                        <div key={label} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex-shrink-0 pr-4">{label}</span>
                          <span 
                            className={`text-sm font-black truncate max-w-[180px] ${color || 'text-slate-900'}`}
                            title={isCrs ? String(value) : undefined}
                          >
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <button
                        onClick={handleDownloadSingle}
                        disabled={!activeTask.repairResults?.repaired_path}
                        className="w-full btn-primary py-4 flex items-center justify-center space-x-4 text-lg disabled:opacity-50"
                      >
                        <Download className="w-6 h-6" />
                        <span>Download Result</span>
                      </button>

                      <button
                        onClick={handleDownloadGeoJSON}
                        disabled={!activeTask.repairResults?.repaired_path}
                        className="w-full py-4 rounded-xl border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/30 transition-all flex items-center justify-center space-x-3 disabled:opacity-40"
                      >
                        <FileJson className="w-5 h-5" />
                        <span className="text-sm font-semibold">Export as GeoJSON</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Structural Issues</h4>
                    <div className="max-h-[300px] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                      {activeTask.validationResults?.issues?.map((issue: any, i: number) => (
                        <IssueCard key={i} issue={issue} />
                      ))}
                      {(!activeTask.validationResults?.issues || activeTask.validationResults.issues.length === 0) && (
                        <div className="p-8 rounded-2xl bg-green-50 border border-green-100 text-center">
                          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                          <p className="text-green-700 text-xs font-bold">Healthy Data</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-12 border-t border-slate-200">
                <AttributeTable
                  data={activeTask.repairResults?.preview_geojson}
                  onSave={handleSaveEdits}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Footer />
    </main>
  );
}
