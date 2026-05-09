"use client";

import { memo } from 'react';
import Link from 'next/link';
import { Zap, Code } from 'lucide-react';

interface NavbarProps {
  backendStatus: string;
}

function Navbar({ backendStatus }: NavbarProps) {
  return (
    <header className="w-full max-w-7xl px-6 py-8 flex justify-between items-center z-10 mx-auto">
      <div className="flex items-center space-x-6">
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/10 border border-slate-100 overflow-hidden group-hover:scale-105 transition-transform">
            <img src="/logo.png" alt="ShapeFixer" className="w-8 h-8 object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Shape<span className="text-blue-600">Fixer</span></h1>
        </Link>

        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-all duration-500 ${
          backendStatus === 'connected'    ? 'bg-green-100 border-green-200 text-green-700' :
          backendStatus === 'disconnected' ? 'bg-red-100 border-red-200 text-red-700' :
                                            'bg-yellow-100 border-yellow-200 text-yellow-700'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            backendStatus === 'connected'    ? 'bg-green-500 animate-pulse' :
            backendStatus === 'disconnected' ? 'bg-red-500' :
                                              'bg-yellow-500 animate-bounce'
          }`} />
          <span>Engine: {backendStatus}</span>
        </div>
      </div>

      <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-500">
        <Link href="/how-it-works" className="hover:text-slate-900 transition-colors">How it works</Link>
        <Link href="/docs" className="hover:text-slate-900 transition-colors">API Docs</Link>
        <button className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700">
          <Code className="w-5 h-5" />
        </button>
      </nav>
    </header>
  );
}

// memo: only re-renders when backendStatus prop changes
export default memo(Navbar);
