"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Book, FileJson, Lock, Globe, Server, Code, Play } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function ApiDocs() {
  const [backendStatus, setBackendStatus] = useState('checking');
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetch(`${API_URL}/api/health`).then(res => setBackendStatus(res.ok ? 'connected' : 'disconnected')).catch(() => setBackendStatus('disconnected'));
  }, [API_URL]);

  const endpoints = [
    {
      method: "POST",
      path: "/api/upload",
      title: "Upload GIS Data",
      desc: "Upload a ZIP (Shapefile), GeoJSON, GPKG, or KML file for processing.",
      body: { file: "Multipart/Form-Data" },
      response: { path: "string", format: "string" }
    },
    {
      method: "POST",
      path: "/api/validate",
      title: "Run Validation",
      desc: "Analyze geometry and structural integrity of a previously uploaded file.",
      body: { path: "string" },
      response: { issues: "Array", stats: "Object" }
    },
    {
      method: "POST",
      path: "/api/repair",
      title: "Execute Repair",
      desc: "Apply automated geometry fixes and spatial normalization.",
      body: { path: "string", options: "{ singlepart: boolean, target_crs: string }" },
      response: { repaired_path: "string", preview_geojson: "Object" }
    }
  ];

  return (
    <main className="min-h-screen flex flex-col bg-slate-50">
      <Navbar backendStatus={backendStatus} />
      
      <div className="w-full max-w-6xl mx-auto px-6 py-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-24"
        >
          <div className="inline-flex items-center space-x-3 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-bold uppercase tracking-[0.2em] mb-10">
            <img src="/logo.png" alt="SF" className="w-4 h-4 object-contain" />
            <span>REST API Reference</span>
          </div>
          <h2 className="text-7xl font-black text-slate-900 mb-6 tracking-tight leading-tight">
            Engine<span className="text-blue-600">Access</span>.
          </h2>
          <p className="text-xl text-slate-500 max-w-3xl leading-relaxed font-light">
            Integrate ShapeFixer's powerful repair engine directly into your own applications. 
            All endpoints are RESTful, secure, and return structured GIS JSON data.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          <div className="lg:col-span-1 space-y-4 sticky top-12 h-fit">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Endpoints</h4>
            {endpoints.map((ep, i) => (
              <a 
                key={i} 
                href={`#${ep.path}`}
                className="block p-4 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all text-sm font-medium text-slate-600 hover:text-blue-600"
              >
                <span className={`mr-3 font-bold text-[10px] ${ep.method === 'POST' ? 'text-green-600' : 'text-blue-600'}`}>{ep.method}</span>
                {ep.path}
              </a>
            ))}
          </div>

          <div className="lg:col-span-3 space-y-24">
            {endpoints.map((ep, i) => (
              <div key={i} id={ep.path} className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-black">{ep.method}</span>
                    <h3 className="text-2xl font-bold text-slate-900">{ep.title}</h3>
                  </div>
                  <p className="text-slate-500 text-lg leading-relaxed">{ep.desc}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Request Body</h4>
                    <pre className="p-6 rounded-2xl bg-slate-900 text-blue-300 font-mono text-xs border border-white/10 overflow-x-auto">
                      {JSON.stringify(ep.body, null, 2)}
                    </pre>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Response Schema</h4>
                    <pre className="p-6 rounded-2xl bg-slate-800 text-green-400 font-mono text-xs border border-white/5 overflow-x-auto">
                      {JSON.stringify(ep.response, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
