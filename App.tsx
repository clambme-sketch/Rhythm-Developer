
import React from 'react';
import RhythmEngine from './components/RhythmEngine';

const App: React.FC = () => {
  return (
    <div className="relative w-screen h-screen bg-[#050508] overflow-hidden text-slate-100">
      
      {/* Ambient Light Source 1 */}
      <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-indigo-900/20 rounded-full blur-[120px] mix-blend-screen bg-breathe" style={{ animationDelay: '0s' }}></div>
      
      {/* Ambient Light Source 2 */}
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-rose-900/20 rounded-full blur-[100px] mix-blend-screen bg-breathe" style={{ animationDelay: '-5s' }}></div>

      {/* Grain texture for "Canvas" feel */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0 mix-blend-overlay" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
      }}></div>

      <RhythmEngine />

      {/* Footer Branding */}
      <div className="absolute bottom-8 left-8 z-50 opacity-40 hover:opacity-100 transition-opacity duration-700">
        <div className="font-serif italic text-sm text-slate-400 tracking-widest">
          Rhythm Developer <span className="not-italic text-[10px] font-sans ml-2 opacity-50">EST. 2025</span>
        </div>
      </div>
    </div>
  );
};

export default App;
