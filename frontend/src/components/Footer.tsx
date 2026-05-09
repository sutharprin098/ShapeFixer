import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-auto w-full py-16 px-6 border-t border-slate-100 text-center text-slate-400 text-sm bg-white">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <p>© 2026 ShapeFixer Engine. Built for the GIS community.</p>
        <div className="flex items-center space-x-6">
          <a href="#" className="hover:text-slate-900 transition-colors">Privacy</a>
          <a href="#" className="hover:text-slate-900 transition-colors">Terms</a>
          <a href="#" className="hover:text-slate-900 transition-colors">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
