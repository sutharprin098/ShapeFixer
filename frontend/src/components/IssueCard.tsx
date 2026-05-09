"use client";

import { AlertTriangle, Info, XCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface Issue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  label: string;
  description: string;
  friendly_explanation: string;
}

interface IssueCardProps {
  issue: Issue;
}

const severityConfig = {
  critical: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  high: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  medium: { icon: Info, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  low: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  info: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' },
};

export default function IssueCard({ issue }: IssueCardProps) {
  // Bug 26 fix: fallback to 'info' for any unknown severity value
  const config = severityConfig[issue.severity] ?? severityConfig.info;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`p-5 rounded-2xl border ${config.border} ${config.bg} flex items-start space-x-5 shadow-sm`}
    >
      <div className={`p-3 rounded-xl bg-white shadow-sm ${config.color} border ${config.border}`}>
        <Icon className="w-6 h-6" />
      </div>
      
      <div className="flex-1">
        <h4 className="text-sm font-bold text-slate-900 mb-1 uppercase tracking-widest flex items-center justify-between">
          {issue.label}
          <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase ${config.bg} ${config.color} border ${config.border}`}>
            {issue.severity}
          </span>
        </h4>
        <p className="text-slate-500 text-sm mb-3 leading-relaxed">{issue.description}</p>
        <div className="p-4 rounded-xl bg-white/50 border border-slate-100">
          <p className="text-xs text-slate-700 leading-relaxed">
            <span className="font-black text-blue-600 mr-2 uppercase tracking-tighter">Quick Fix:</span>
            {issue.friendly_explanation}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
