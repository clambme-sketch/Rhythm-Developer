
import React, { useState, useEffect, useMemo } from 'react';
import { LEVELS } from '../data/levels';
import { Level, Difficulty, GameConfig, HighScores } from '../types';

interface LevelSelectorProps {
  onSelect: (config: GameConfig) => void;
}

const LevelSelector: React.FC<LevelSelectorProps> = ({ onSelect }) => {
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);
  const [bpm, setBpm] = useState<number>(100);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [highScores, setHighScores] = useState<HighScores>({});
  const [isExiting, setIsExiting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('Fundamentals');

  useEffect(() => {
    const stored = localStorage.getItem('rhythmPulseScores');
    if (stored) {
      try {
        setHighScores(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load scores", e);
      }
    }
  }, []);

  const openConfig = (level: Level) => {
    setSelectedLevel(level);
    setBpm(level.bpm);
    setDifficulty(Difficulty.MEDIUM);
  };

  const handleStart = () => {
    if (selectedLevel) {
      setIsExiting(true);
      setTimeout(() => {
        onSelect({
          level: selectedLevel,
          bpm: bpm,
          difficulty: difficulty
        });
      }, 700);
    }
  };

  const renderScore = (levelId: string, diff: Difficulty) => {
    const entry = highScores[levelId]?.[diff];
    if (!entry) return <span className="text-white/20">-</span>;
    
    if (typeof entry === 'number') {
        return <span className="text-white/60 font-sans">{entry.toLocaleString()}</span>;
    }
    
    return (
        <div className="flex items-center gap-2 justify-end font-sans">
            <span className={`text-[10px] font-bold ${entry.accuracy >= 95 ? 'text-emerald-300' : 'text-white/40'}`}>
                {entry.accuracy.toFixed(0)}%
            </span>
            <span className="text-white/80">{entry.score.toLocaleString()}</span>
        </div>
    );
  };

  // Define categories order
  const categories = ['Fundamentals', 'Tresillo Rhythms', 'Latin Roots', 'Rudiments', 'Triplets'];

  // Filter levels for the active category
  const activeLevels = useMemo(() => {
    return LEVELS.filter(l => l.category === activeCategory);
  }, [activeCategory]);

  return (
    <>
      <div 
        className={`z-20 w-full max-w-[90rem] px-8 flex flex-col items-center pb-12 overflow-y-auto max-h-screen py-16
        ${isExiting ? 'animate-out fade-out zoom-out duration-700 fill-mode-forwards' : 'animate-in fade-in zoom-in duration-700'}
        ${selectedLevel ? 'blur-md brightness-50 pointer-events-none' : ''}`}
      >
          
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-7xl md:text-9xl font-serif italic text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 tracking-tighter drop-shadow-2xl">
                Rhythm
            </h1>
            <h2 className="text-2xl font-sans font-light tracking-[0.4em] text-slate-400 uppercase">
                Developer
            </h2>
          </div>

          {/* Category Navigation Tabs */}
          <div className="flex flex-wrap justify-center gap-2 md:gap-8 mb-12 relative z-30 border-b border-white/5 pb-4 w-full max-w-4xl">
            {categories.map((cat) => (
                <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`
                        relative px-4 py-2 text-[10px] md:text-xs font-sans tracking-[0.2em] uppercase transition-all duration-300
                        ${activeCategory === cat ? 'text-white' : 'text-slate-500 hover:text-slate-300'}
                    `}
                >
                    {cat}
                    {activeCategory === cat && (
                        <div className="absolute -bottom-[17px] left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_15px_white]"></div>
                    )}
                </button>
            ))}
          </div>

          <div className="w-full min-h-[50vh] flex flex-col items-center">
            {/* Animated Grid Container */}
            <div key={activeCategory} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeLevels.map((level) => (
                    <button
                        key={level.id}
                        onClick={() => openConfig(level)}
                        className="group relative h-[28rem] transition-all duration-500 hover:-translate-y-2 focus:outline-none perspective-1000"
                    >
                        {/* Glass Card */}
                        <div className={`absolute inset-0 bg-white/5 backdrop-blur-sm border border-white/5 overflow-hidden transition-all duration-500 group-hover:bg-white/10 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] shadow-xl flex flex-col`}>
                            
                            {/* Colored Accent */}
                            <div className={`h-1 w-full bg-${level.color}-500/50 group-hover:h-1.5 transition-all duration-500`}></div>
                            
                            <div className="p-6 flex flex-col items-start text-left relative z-10 h-full w-full">
                                
                                <div className="flex justify-between w-full items-baseline mb-3">
                                    <span className={`text-[9px] font-sans font-bold text-${level.color}-400 tracking-widest uppercase`}>{level.bpm} BPM</span>
                                    {level.isTwoDrum && (
                                        <span className="text-[9px] font-sans font-bold text-rose-400 border border-rose-500/30 px-1 py-0.5 rounded uppercase tracking-widest">
                                            2-Drum
                                        </span>
                                    )}
                                </div>

                                <h3 className="text-2xl font-serif text-slate-100 mb-4 leading-none italic group-hover:text-white transition-colors">
                                    {level.name}
                                </h3>
                                
                                <p className="text-slate-400 text-xs font-sans font-light leading-relaxed h-14 overflow-hidden shrink-0 border-l border-white/10 pl-3 mb-6">
                                    {level.description}
                                </p>
                                
                                {/* High Score Table */}
                                <div className="w-full mt-auto space-y-2 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                                    <div className="flex flex-col space-y-1.5 border-t border-white/5 pt-2">
                                        {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map((diff) => (
                                            <div key={diff} className="flex justify-between items-center text-[10px]">
                                                <span className="text-slate-500 font-serif italic">{diff.toLowerCase()}</span>
                                                <div className="text-right flex-1">{renderScore(level.id, diff)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
            {activeLevels.length === 0 && (
                <div className="text-slate-500 text-sm font-serif italic mt-12">No levels available in this category yet.</div>
            )}
          </div>

      </div>

      {/* Configuration Modal */}
      {selectedLevel && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isExiting ? 'animate-out fade-out duration-700' : ''}`}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-all duration-500" onClick={() => !isExiting && setSelectedLevel(null)} />
          
          <div className={`relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] p-12 flex flex-col space-y-10 ${isExiting ? '' : 'animate-in fade-in slide-in-from-bottom-12 duration-500'}`}>
             
             {/* Header */}
             <div className="text-center space-y-2">
                <div className={`text-xs font-sans font-bold text-${selectedLevel.color}-300 tracking-[0.2em] uppercase`}>{selectedLevel.category}</div>
                <h2 className="text-4xl font-serif italic text-white">{selectedLevel.name}</h2>
                {selectedLevel.isTwoDrum && (
                    <div className="mt-2 text-rose-400 text-xs font-bold tracking-widest border border-rose-500/30 inline-block px-3 py-1 uppercase">
                        Requires Left/Right Split Keys
                    </div>
                )}
             </div>

             {/* BPM Control */}
             <div className="space-y-6">
                <div className="flex justify-between items-baseline border-b border-white/10 pb-2">
                  <label className="text-slate-400 font-sans text-xs tracking-widest uppercase">Tempo</label>
                  <span className={`text-3xl font-serif italic text-${selectedLevel.color}-200`}>{bpm} <span className="text-xs font-sans text-slate-500 not-italic">BPM</span></span>
                </div>
                <input 
                  type="range" 
                  min="60" 
                  max="240" 
                  value={bpm} 
                  onChange={(e) => setBpm(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                />
             </div>

             {/* Difficulty Selector */}
             <div className="space-y-6">
                <label className="text-slate-400 font-sans text-xs tracking-widest uppercase block text-center">Difficulty</label>
                <div className="flex justify-center gap-4">
                   {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map((d) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`px-6 py-3 text-xs font-sans tracking-widest uppercase transition-all duration-300 border ${
                          difficulty === d 
                            ? `bg-white text-black border-white` 
                            : 'bg-transparent text-slate-500 border-white/10 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        {d}
                      </button>
                   ))}
                </div>
                <div className="text-center text-xs font-serif italic text-slate-400 min-h-[1.5em]">
                   {difficulty === Difficulty.EASY && "Great for learning! You have more time to hit the beat."}
                   {difficulty === Difficulty.MEDIUM && "A nice challenge. You need to be pretty accurate."}
                   {difficulty === Difficulty.HARD && "For experts only! You have to be perfect."}
                </div>
             </div>

             {/* Actions */}
             <div className="flex space-x-0 pt-8 border-t border-white/5">
               <button 
                  onClick={() => !isExiting && setSelectedLevel(null)}
                  className="flex-1 py-4 text-slate-500 hover:text-white transition-colors font-sans text-xs tracking-[0.2em] uppercase"
               >
                 Back
               </button>
               <div className="w-px bg-white/10 mx-4"></div>
               <button 
                  onClick={handleStart}
                  disabled={isExiting}
                  className={`flex-1 py-4 text-${selectedLevel.color}-300 hover:text-white transition-colors font-sans text-xs font-bold tracking-[0.2em] uppercase ${isExiting ? 'opacity-50 cursor-not-allowed' : ''}`}
               >
                 Start
               </button>
             </div>

          </div>
        </div>
      )}
    </>
  );
};

export default LevelSelector;
