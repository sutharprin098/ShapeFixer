"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileIcon, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  Download, 
  Trash2,
  Wrench,
  ShieldCheck,
  Zap
} from 'lucide-react';

export interface Task {
  id: string;
  filename: string;
  path: string;
  format: string;
  status: 'uploading' | 'validating' | 'repairing' | 'preview' | 'error';
  validationResults?: any;
  repairResults?: any;
  error?: string;
}

interface BatchDashboardProps {
  tasks: Task[];
  onSelect: (taskId: string) => void;
  onRemove: (taskId: string) => void;
  onRunAll: () => void;
  onDownloadAll: () => void;
  isProcessing: boolean;
}

export default function BatchDashboard({ 
  tasks, 
  onSelect, 
  onRemove, 
  onRunAll, 
  onDownloadAll,
  isProcessing 
}: BatchDashboardProps) {
  
  const completedCount = tasks.filter(t => t.status === 'preview').length;
  const errorCount = tasks.filter(t => t.status === 'error').length;

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="text-left">
          <h3 className="text-3xl font-black text-slate-900 tracking-tight">Batch Manager</h3>
          <p className="text-slate-500 mt-1">Manage and monitor {tasks.length} processing tasks</p>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={onDownloadAll}
            disabled={completedCount === 0}
            className="px-6 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all flex items-center space-x-2 disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            <span>Download All ({completedCount})</span>
          </button>
          
          <button 
            onClick={onRunAll}
            disabled={isProcessing || tasks.every(t => t.status === 'preview')}
            className="btn-primary py-3 px-8 flex items-center space-x-2 text-sm shadow-blue-600/20 active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            <span>Process Queue</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {tasks.map((task) => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`glass-card p-4 flex items-center justify-between group transition-all hover:shadow-lg border
                ${task.status === 'error' ? 'border-red-100 bg-red-50/10' : 'border-slate-100'}`}
            >
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <div className={`p-3 rounded-xl flex-shrink-0 transition-colors
                  ${task.status === 'preview' ? 'bg-green-100 text-green-600' : 
                    task.status === 'error' ? 'bg-red-100 text-red-600' : 
                    'bg-blue-50 text-blue-600'}`}>
                  <FileIcon className="w-6 h-6" />
                </div>
                
                <div className="text-left truncate">
                  <h4 className="font-bold text-slate-900 truncate pr-4">{task.filename}</h4>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{task.format}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                    <span className={`text-[10px] font-bold uppercase tracking-widest
                      ${task.status === 'preview' ? 'text-green-600' : 
                        task.status === 'error' ? 'text-red-600' : 
                        'text-blue-500 animate-pulse'}`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-6">
                {task.status === 'preview' && (
                   <div className="hidden md:flex items-center space-x-2 text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Healthy</span>
                  </div>
                )}

                {task.status === 'error' && (
                  <div className="hidden md:flex items-center space-x-2 text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                    <AlertCircle className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest truncate max-w-[150px]">
                      {task.error || 'Failed'}
                    </span>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  {task.status === 'preview' && (
                    <button 
                      onClick={() => onSelect(task.id)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex items-center space-x-2"
                      title="Inspect Data"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  )}
                  
                  <button 
                    onClick={() => onRemove(task.id)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Remove Task"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="glass-card p-6 text-left">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Completion</p>
          <div className="flex items-end space-x-3">
            <p className="text-4xl font-black text-slate-900">{Math.round((completedCount / (tasks.length || 1)) * 100)}%</p>
            <p className="text-xs text-slate-500 pb-1">Success rate</p>
          </div>
        </div>
        <div className="glass-card p-6 text-left">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Processing</p>
          <p className="text-4xl font-black text-slate-900">{tasks.filter(t => t.status !== 'preview' && t.status !== 'error').length}</p>
        </div>
        <div className="glass-card p-6 text-left">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Errors</p>
          <p className="text-4xl font-black text-red-600">{errorCount}</p>
        </div>
      </div>
    </div>
  );
}

