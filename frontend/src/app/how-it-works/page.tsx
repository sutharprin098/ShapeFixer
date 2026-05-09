"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Wrench, CheckCircle2, ShieldCheck, Zap, ArrowRight, Layers, Database, Globe } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function HowItWorks() {
  const [backendStatus, setBackendStatus] = useState('checking');
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetch(`${API_URL}/api/health`).then(res => setBackendStatus(res.ok ? 'connected' : 'disconnected')).catch(() => setBackendStatus('disconnected'));
  }, [API_URL]);

  const steps = [
    {
      icon: Search,
      title: "Structural Audit",
      desc: "First, we verify the integrity of your upload. For Shapefiles, we ensure all mandatory components (.shp, .shx, .dbf) are present. If a helper file is missing, our engine attempts to reconstruct it from the core geometry.",
      color: "bg-blue-50 text-blue-600 border-blue-100"
    },
    {
      icon: ShieldCheck,
      title: "Geometry Validation",
      desc: "Our engine performs a deep scan for OGC SFS (Simple Feature Specification) compliance. We detect self-intersections, ring orientation issues, sliver polygons, and unclosed rings that cause errors in GIS software.",
      color: "bg-purple-50 text-purple-600 border-purple-100"
    },
    {
      icon: Wrench,
      title: "Self-Healing Repair",
      desc: "Using advanced computational geometry algorithms (Snapping, MakeValid, and Buffering), we automatically fix topology errors while preserving the original spatial intent and precision of your data.",
      color: "bg-green-50 text-green-600 border-green-100"
    },
    {
      icon: Globe,
      title: "CRS Normalization",
      desc: "Missing projections are the #1 cause of GIS headaches. ShapeFixer automatically identifies coordinate systems and reprojects data to WGS84 (EPSG:4326) for seamless web integration.",
      color: "bg-orange-50 text-orange-600 border-orange-100"
    }
  ];

  return (
    <main className="min-h-screen flex flex-col bg-slate-50">
      <Navbar backendStatus={backendStatus} />
      
      <div className="w-full max-w-5xl mx-auto px-6 py-24">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-24"
        >
          <div className="inline-flex items-center space-x-3 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-bold uppercase tracking-[0.2em] mb-10 mx-auto">
            <img src="/logo.png" alt="SF" className="w-4 h-4 object-contain" />
            <span>Architecture & Pipeline</span>
          </div>
          <h2 className="text-7xl font-black text-slate-900 mb-6 tracking-tight leading-tight">
            Engine<span className="text-blue-600">Logic</span>.
          </h2>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-light">
            ShapeFixer combines the power of GeoPandas, Shapely, and PySHP into a 
            seamless automated pipeline for spatial data engineering.
          </p>
        </motion.div>

        <div className="space-y-12">
          {steps.map((step, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex flex-col md:flex-row items-center gap-12 p-10 rounded-[40px] bg-white border border-slate-100 shadow-xl shadow-slate-200/50"
            >
              <div className={`w-24 h-24 rounded-3xl flex items-center justify-center flex-shrink-0 border ${step.color}`}>
                <step.icon className="w-10 h-10" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl font-bold text-slate-900 mb-4">{step.title}</h3>
                <p className="text-slate-500 leading-relaxed text-lg">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-32 p-16 rounded-[60px] bg-blue-600 text-white text-center relative overflow-hidden shadow-2xl shadow-blue-600/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
          <h3 className="text-4xl font-bold mb-8">Ready to repair?</h3>
          <p className="text-blue-100 text-xl mb-12 max-w-xl mx-auto">Upload your files now and let our automated engine handle the complexity.</p>
          <button onClick={() => window.location.href = '/'} className="px-10 py-5 rounded-2xl bg-white text-blue-600 font-bold text-lg hover:scale-105 transition-transform">
            Start Free Upload
          </button>
        </div>
      </div>

      <Footer />
    </main>
  );
}
