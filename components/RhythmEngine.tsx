
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, ScoreEntry, GameStats, Level, Difficulty, GameConfig, HighScores, HitEvent, Hand, NoteEvent, AnalysisStats } from '../types';
import Visualizer from './Visualizer';
import LevelSelector from './LevelSelector';

// Audio Scheduler Constants
const LOOKAHEAD = 25.0; // ms
const SCHEDULE_AHEAD_TIME = 0.1; // seconds
const GAME_DURATION = 30.0; // seconds

// Scoring Windows (ms) for [Perfect+, Perfect, Great, Good]
const SCORING_WINDOWS = {
  [Difficulty.EASY]:   [40, 70, 130, 200],
  [Difficulty.MEDIUM]: [25, 50, 100, 150],
  [Difficulty.HARD]:   [15, 30, 60, 100]
};

// Local Mentor logic for pedagogical feedback
const getLocalMentorFeedback = (stats: AnalysisStats, history: HitEvent[]): string => {
  const wrongDrums = history.filter(h => h.isMiss && h.hand !== h.expectedHand && h.expectedHand !== 'any').length;
  
  if (stats.averageAccuracy >= 98 && stats.misses === 0) {
    return "Virtuoso performance! Your internal clock is perfectly synchronized with the pulse.";
  }
  
  if (wrongDrums > 2) {
    return "Watch your coordination! You're hitting the wrong drum. Remember: Left keys for the blue drum, Right keys for the red drum.";
  }

  if (stats.earlyRate > 35) {
    return "You're rushing! Try to sit back in the pocket and breathe through the phrases. Wait for the sound to come to you.";
  }

  if (stats.lateRate > 35) {
    return "You're dragging slightly. Keep your momentum moving forward and try to stay lighter on the keys.";
  }

  if (stats.misses > stats.perfects) {
    return "Focus on the main downbeats first. Try counting '1 - 2 - 3 - 4' out loud to anchor your sense of time.";
  }

  if (stats.averageAccuracy >= 90) {
    return "Excellent precision. You've deeply locked into the groove of this pattern.";
  }

  if (stats.averageAccuracy >= 75) {
    return "Good progress. Focus on minimizing the timing drift (dragging/rushing) to reach the next level of mastery.";
  }

  return "Consistency is key. Rhythm is a physical skill built through focused repetition and active listening.";
};

const RhythmEngine: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  
  const [stats, setStats] = useState<GameStats>({
    totalScore: 0,
    combo: 0,
    maxCombo: 0,
    perfects: 0,
    greats: 0,
    goods: 0,
    misses: 0,
    averageAccuracy: 0,
    history: []
  });
  const [lastHit, setLastHit] = useState<ScoreEntry | null>(null);
  const [mentorComment, setMentorComment] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [isCountIn, setIsCountIn] = useState(false);
  const [countDown, setCountDown] = useState<number | null>(null);

  // Audio & Timing Refs
  const audioContext = useRef<AudioContext | null>(null);
  const noiseBuffer = useRef<AudioBuffer | null>(null);
  
  const nextNoteTime = useRef<number>(0.0); 
  const nextMetronomeTime = useRef<number>(0.0); 
  
  const currentBeatInPattern = useRef<number>(0);
  const timerID = useRef<number | null>(null);
  const loopStartTime = useRef<number>(0);
  const gameStartTime = useRef<number>(0); 
  
  const expectedHits = useRef<Array<{ time: number, beat: number, hand: Hand, processed: boolean }>>([]);
  const hitHistory = useRef<Array<HitEvent>>([]);
  const [beatTrigger, setBeatTrigger] = useState(0);

  const initAudio = async () => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContext.current.state === 'suspended') {
      await audioContext.current.resume();
    }

    if (!noiseBuffer.current) {
      const bufferSize = audioContext.current.sampleRate * 2.0;
      const buffer = audioContext.current.createBuffer(1, bufferSize, audioContext.current.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      noiseBuffer.current = buffer;
    }
  };

  const playKick = useCallback((time: number) => {
    if (!audioContext.current) return;
    const ctx = audioContext.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.1);
    gain.gain.setValueAtTime(0.3, time); 
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.2);
  }, []);

  const playClave = useCallback((hand: Hand, time: number) => {
      if (!audioContext.current) return;
      const ctx = audioContext.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const freq = (hand === 'left') ? 1800 : 2400; // Perfect Fourth tuning
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.6, time + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.15);
  }, []);

  const playGuideSnare = useCallback((hand: Hand, time: number) => {
    if (!audioContext.current || !noiseBuffer.current) return;
    const ctx = audioContext.current;
    const isHigh = (hand === 'right');
    const fundFreq = isHigh ? 250 : 180;
    const noiseFilterFreq = isHigh ? 2000 : 1000;
    
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.frequency.setValueAtTime(fundFreq, time);
    osc.frequency.exponentialRampToValueAtTime(fundFreq * 0.5, time + 0.1);
    oscGain.gain.setValueAtTime(0.2, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.2);

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer.current;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = noiseFilterFreq;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.2);
  }, []);

  const scheduleNote = useCallback((note: NoteEvent, time: number) => {
    expectedHits.current.push({ time: time, beat: note.beat, hand: note.hand, processed: false });
    const now = audioContext.current?.currentTime || 0;
    expectedHits.current = expectedHits.current.filter(hit => hit.time > now - 0.5);
    playGuideSnare(note.hand, time);
  }, [playGuideSnare]);

  const endGame = useCallback(() => {
    if (!gameConfig) return;
    if (timerID.current) window.clearTimeout(timerID.current);
    timerID.current = null;
    if (audioContext.current) audioContext.current.suspend();

    const history = hitHistory.current;
    const totalHits = history.length;
    const earlyCount = history.filter(h => h.offset < -15 && !h.isMiss).length;
    const lateCount = history.filter(h => h.offset > 15 && !h.isMiss).length;
    const earlyRate = totalHits > 0 ? (earlyCount / totalHits) * 100 : 0;
    const lateRate = totalHits > 0 ? (lateCount / totalHits) * 100 : 0;
    const totalScoreAccum = history.reduce((acc, h) => acc + h.score, 0);
    const approxAccuracy = totalHits > 0 ? totalScoreAccum / totalHits : 0;

    const analysisStats: AnalysisStats = {
        perfects: history.filter(h => h.score >= 90).length,
        misses: history.filter(h => h.isMiss).length,
        averageAccuracy: approxAccuracy,
        earlyRate,
        lateRate,
        offbeatMisses: history.filter(h => h.isMiss && h.beat % 1 !== 0).length,
        downbeatMisses: history.filter(h => h.isMiss && h.beat % 1 === 0).length,
        trend: 'stable'
    };

    setMentorComment(getLocalMentorFeedback(analysisStats, history));

    setStats(currentStats => {
        const stored = localStorage.getItem('rhythmPulseScores');
        let scores: HighScores = stored ? JSON.parse(stored) : {};
        const currentLevelScores = scores[gameConfig.level.id] || {};
        const previousBestScore = (currentLevelScores[gameConfig.difficulty] as any)?.score || 0;
        
        if (currentStats.totalScore > previousBestScore) {
          scores = { ...scores, [gameConfig.level.id]: { ...currentLevelScores, [gameConfig.difficulty]: { score: Math.floor(currentStats.totalScore), accuracy: currentStats.averageAccuracy } } };
          localStorage.setItem('rhythmPulseScores', JSON.stringify(scores));
        }
        return { ...currentStats, history }; 
    });

    setGameState(GameState.RESULTS);
  }, [gameConfig]);

  const scheduler = useCallback(() => {
    if (!gameConfig || !audioContext.current || gameState !== GameState.PLAYING) return;
    const currentTime = audioContext.current.currentTime;
    const elapsedTime = currentTime - gameStartTime.current;
    const beatDuration = 60 / gameConfig.bpm;
    
    if (elapsedTime < 0) {
        setIsCountIn(true);
        const beatsRemaining = Math.ceil(Math.abs(elapsedTime) / beatDuration);
        setCountDown(beatsRemaining <= gameConfig.level.loopBeats ? beatsRemaining : null);
    } else {
        setIsCountIn(false);
        setCountDown(null);
        const remaining = Math.max(0, GAME_DURATION - elapsedTime);
        setTimeLeft(remaining);
        if (remaining <= 0) { endGame(); return; }
    }

    while (nextMetronomeTime.current < currentTime + SCHEDULE_AHEAD_TIME) {
        playKick(nextMetronomeTime.current);
        const timeToNote = (nextMetronomeTime.current - currentTime) * 1000;
        setTimeout(() => { if (gameState === GameState.PLAYING) setBeatTrigger(prev => prev + 1); }, Math.max(0, timeToNote));
        nextMetronomeTime.current += beatDuration;
    }

    while (nextNoteTime.current < currentTime + SCHEDULE_AHEAD_TIME) {
        const pattern = gameConfig.level.pattern;
        const currentNote = pattern[currentBeatInPattern.current];
        scheduleNote(currentNote, nextNoteTime.current);
        let nextIndex = (currentBeatInPattern.current + 1) % pattern.length;
        let nextNote = pattern[nextIndex];
        let beatDiff = nextIndex === 0 ? gameConfig.level.loopBeats - currentNote.beat + nextNote.beat : nextNote.beat - currentNote.beat;
        if (beatDiff <= 0) beatDiff = 1; 
        nextNoteTime.current += beatDiff * beatDuration;
        currentBeatInPattern.current = nextIndex;
    }
    timerID.current = window.setTimeout(scheduler, LOOKAHEAD);
  }, [gameConfig, gameState, scheduleNote, playKick, endGame]);

  useEffect(() => {
      if (gameState === GameState.PLAYING && gameConfig && audioContext.current) {
          if (audioContext.current.state === 'suspended') { audioContext.current.resume().then(() => scheduler()); }
          else { scheduler(); }
      } else if (gameState === GameState.PAUSED && audioContext.current) {
          audioContext.current.suspend();
          if (timerID.current) window.clearTimeout(timerID.current);
      }
      return () => { if (timerID.current) window.clearTimeout(timerID.current); };
  }, [gameState, gameConfig, scheduler]);

  const selectLevel = (config: GameConfig) => { setGameConfig(config); startGame(config); };

  const startGame = async (config: GameConfig) => {
    await initAudio();
    setGameState(GameState.STARTING);
    setStats({ totalScore: 0, combo: 0, maxCombo: 0, perfects: 0, greats: 0, goods: 0, misses: 0, averageAccuracy: 0, history: [] });
    setMentorComment("");
    setLastHit(null);
    setTimeLeft(GAME_DURATION);
    setIsCountIn(true);
    setCountDown(null);
    expectedHits.current = [];
    hitHistory.current = [];

    setTimeout(() => {
      if (audioContext.current) {
          const now = audioContext.current.currentTime;
          const beatDuration = 60 / config.bpm;
          const countInDuration = beatDuration * config.level.loopBeats * 2; 
          const audioStartTime = now + 0.1;
          nextMetronomeTime.current = audioStartTime; 
          nextNoteTime.current = audioStartTime + (config.level.pattern[0].beat * beatDuration); 
          loopStartTime.current = audioStartTime;
          gameStartTime.current = audioStartTime + countInDuration; 
          currentBeatInPattern.current = 0;
      }
      setGameState(GameState.PLAYING);
    }, 1000);
  };

  const restartGame = useCallback(() => { if (gameConfig) { if (audioContext.current) audioContext.current.suspend(); startGame(gameConfig); } }, [gameConfig]);
  const togglePause = useCallback(() => { if (gameState === GameState.PLAYING) setGameState(GameState.PAUSED); else if (gameState === GameState.PAUSED) setGameState(GameState.PLAYING); }, [gameState]);
  const quitGame = useCallback(() => { if (audioContext.current) audioContext.current.suspend(); setGameState(GameState.IDLE); setGameConfig(null); }, []);

  const handleTap = useCallback((inputHand: Hand) => {
    if (gameState !== GameState.PLAYING || !audioContext.current || !gameConfig) return;
    if (audioContext.current.state === 'running') { playClave(inputHand, audioContext.current.currentTime); }
    const tapTime = audioContext.current.currentTime;
    if (tapTime < gameStartTime.current) return;
    const activeHits = expectedHits.current.filter(h => !h.processed);
    const windows = SCORING_WINDOWS[gameConfig.difficulty];
    const maxWindow = windows[3];
    const candidates = activeHits.filter(hit => Math.abs(hit.time - tapTime) * 1000 < maxWindow);
    let closestHit = null;

    if (candidates.length > 0) {
        candidates.sort((a, b) => {
            const aMatch = (a.hand === inputHand || a.hand === 'any');
            const bMatch = (b.hand === inputHand || b.hand === 'any');
            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
            return Math.abs(a.time - tapTime) - Math.abs(b.time - tapTime);
        });
        closestHit = candidates[0];
    }

    let score = 0, label = "Miss", color = "text-red-400", rawDiff = 0, isMiss = true;

    if (closestHit) {
        rawDiff = (tapTime - closestHit.time) * 1000;
        const diffMs = Math.abs(rawDiff);
        if (closestHit.hand !== 'any' && closestHit.hand !== inputHand) {
            closestHit.processed = true; score = 0; label = "Wrong Drum!"; color = "text-orange-500"; isMiss = true;
        } else {
            closestHit.processed = true; isMiss = false;
            if (diffMs < windows[0]) { score = 100; label = "Perfect"; color = "text-white shadow-lg"; }
            else if (diffMs < windows[1]) { score = 90; label = "Perfect"; color = `text-${gameConfig.level.color}-200`; }
            else if (diffMs < windows[2]) { score = 70; label = "Great"; color = `text-${gameConfig.level.color}-300`; }
            else { score = 40; label = "Good"; color = "text-yellow-200"; }
        }
    }

    hitHistory.current.push({ 
      offset: rawDiff, 
      isMiss, 
      beat: closestHit?.beat || 0, 
      timestamp: tapTime - gameStartTime.current, 
      score, 
      hand: inputHand, 
      expectedHand: closestHit?.hand || 'any' 
    });

    setStats(prev => {
      const newCombo = score > 0 ? prev.combo + 1 : 0;
      const totalTaps = prev.perfects + prev.greats + prev.goods + prev.misses + 1;
      const newAccuracy = (prev.averageAccuracy * (totalTaps - 1) + score) / totalTaps;
      return { ...prev, totalScore: prev.totalScore + score, combo: newCombo, maxCombo: Math.max(prev.maxCombo, newCombo), perfects: prev.perfects + (score >= 90 ? 1 : 0), greats: prev.greats + (score >= 70 && score < 90 ? 1 : 0), goods: prev.goods + (score > 10 && score < 70 ? 1 : 0), misses: prev.misses + (score <= 10 ? 1 : 0), averageAccuracy: newAccuracy };
    });
    setLastHit({ score, timestamp: performance.now(), label, color });
  }, [gameState, gameConfig, playClave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const leftKeys = ['KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX', 'KeyC'];
      const rightKeys = ['KeyJ', 'KeyK', 'KeyL', 'KeyM', 'Comma', 'Period', 'KeyN', 'KeyP'];
      if (e.code === 'Space') { e.preventDefault(); handleTap('right'); } 
      else if (leftKeys.includes(e.code)) { handleTap('left'); }
      else if (rightKeys.includes(e.code)) { handleTap('right'); }
      else if (e.code === 'Escape') { togglePause(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTap, togglePause]);

  const getTimingDistribution = (history: HitEvent[]) => {
      const validHits = history.filter(h => !h.isMiss);
      const early = validHits.filter(h => h.offset < -15).length;
      const late = validHits.filter(h => h.offset > 15).length;
      const perfect = validHits.length - early - late;
      const total = validHits.length || 1;
      return {
          earlyPct: (early / total) * 100,
          perfectPct: (perfect / total) * 100,
          latePct: (late / total) * 100
      };
  };

  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-center overflow-hidden font-sans touch-none">
      {gameState === GameState.PLAYING && (
          <div className="absolute inset-0 z-50 flex pointer-events-auto">
              <div className="w-1/2 h-full active:bg-cyan-500/10 transition-colors" onPointerDown={() => handleTap('left')}></div>
              <div className="w-1/2 h-full active:bg-rose-500/10 transition-colors" onPointerDown={() => handleTap('right')}></div>
          </div>
      )}

      {(gameState === GameState.PLAYING || gameState === GameState.PAUSED) && gameConfig && (
        <Visualizer isPlaying={gameState === GameState.PLAYING} level={gameConfig.level} bpm={gameConfig.bpm} audioContext={audioContext.current} loopStartTime={loopStartTime.current} lastHitTime={lastHit?.timestamp || null} hitScore={lastHit?.score || null} beatTrigger={beatTrigger} />
      )}

      {gameState === GameState.IDLE && <LevelSelector onSelect={selectLevel} />}

      {gameState === GameState.STARTING && gameConfig && (
        <div className="z-10 text-center animate-in fade-in duration-1000">
           <div className={`text-lg font-serif italic text-${gameConfig.level.color}-200 mb-4 opacity-70`}>Syncing...</div>
           <div className="text-8xl font-serif text-white tracking-tight">Ready</div>
        </div>
      )}

      {(gameState === GameState.PLAYING || gameState === GameState.PAUSED) && gameConfig && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full z-20"><div className="h-0.5 w-full bg-white/5"><div className={`h-full bg-${gameConfig.level.color}-300 shadow-lg transition-all duration-100 ease-linear`} style={{ width: `${(timeLeft / GAME_DURATION) * 100}%` }}></div></div></div>
          <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-[60] pointer-events-none">
             <div className="flex flex-col items-start"><div className="text-5xl font-serif text-white/90">{Math.floor(stats.totalScore).toLocaleString()}</div><div className="flex items-center gap-4 mt-2"><span className={`text-xs font-sans tracking-[0.2em] text-${gameConfig.level.color}-200 uppercase`}>{gameConfig.level.name}</span></div></div>
             <div className="flex items-start gap-8"><div className="flex flex-col items-end"><div className={`text-5xl font-serif ${stats.averageAccuracy > 95 ? 'text-white' : 'text-slate-300'}`}>{stats.averageAccuracy.toFixed(1)}<span className="text-2xl opacity-50">%</span></div></div>
             <button onClick={(e) => { e.stopPropagation(); togglePause(); }} className="pointer-events-auto bg-white/5 hover:bg-white/10 p-4 rounded-full border border-white/10 transition-colors backdrop-blur-sm group"><div className="flex gap-1"><div className="w-1 h-4 bg-slate-300 group-hover:bg-white transition-colors rounded-full"></div><div className="w-1 h-4 bg-slate-300 group-hover:bg-white transition-colors rounded-full"></div></div></button></div>
          </div>

          {gameState === GameState.PLAYING && (
            <div className="z-10 flex flex-col items-center absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                {isCountIn ? (
                  <div className="animate-pulse text-center"><div className="text-2xl font-serif italic text-white/50 mb-4">Listen...</div><div className={`text-9xl font-sans font-bold text-${gameConfig.level.color}-400/80`}>{countDown !== null ? countDown : "Get Ready"}</div></div>
                ) : (
                  <div className={`text-7xl font-serif italic transition-all duration-500 transform ${lastHit ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} ${lastHit?.color}`}>{lastHit?.label}</div>
                )}
            </div>
          )}

          {gameState === GameState.PAUSED && (
            <div className="absolute inset-0 z-[70] bg-black/80 backdrop-blur-lg flex flex-col items-center justify-center pointer-events-auto">
                <h2 className="text-6xl font-serif italic text-white mb-12">Paused</h2>
                <div className="flex flex-col space-y-8 w-72 items-center">
                    <button onClick={togglePause} className="w-full py-4 text-sm font-sans tracking-[0.3em] bg-white text-black uppercase rounded">Resume</button>
                    <button onClick={restartGame} className="w-full py-4 text-xs font-sans tracking-[0.3em] text-white border border-white/20 uppercase rounded">Restart Level</button>
                    <button onClick={quitGame} className="w-full py-4 text-xs font-sans tracking-[0.3em] text-slate-500 uppercase">Exit to Menu</button>
                </div>
            </div>
          )}
        </div>
      )}

      {gameState === GameState.RESULTS && gameConfig && (
        <div className="z-20 w-full max-w-4xl bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 p-8 shadow-2xl flex flex-col pointer-events-auto max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-end mb-6 border-b border-white/10 pb-4">
            <div><h2 className="text-4xl font-serif italic text-white mb-2">Results</h2><div className={`text-[10px] font-sans tracking-[0.3em] text-${gameConfig.level.color}-300 uppercase`}>{gameConfig.level.name}</div></div>
            <div className="text-right"><div className="text-3xl font-serif text-white">{stats.averageAccuracy.toFixed(1)}%</div><div className="text-[10px] font-sans text-slate-500 uppercase">Accuracy</div></div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             {/* Stats List */}
             <div className="space-y-3">
                <StatRow label="Perfect" count={stats.perfects} color="text-cyan-400" />
                <StatRow label="Great" count={stats.greats} color="text-emerald-300" />
                <StatRow label="Good" count={stats.goods} color="text-yellow-400" />
                <StatRow label="Miss" count={stats.misses} color="text-red-500" />
                
                <div className="pt-4 mt-4 border-t border-white/10">
                    <div className="text-[10px] font-sans text-slate-500 tracking-widest uppercase mb-1">Total Score</div>
                    <div className={`text-xl font-serif text-${gameConfig.level.color}-300`}>{Math.floor(stats.totalScore).toLocaleString()}</div>
                </div>
             </div>
             
             {/* Visual Charts */}
             <div className="lg:col-span-2 flex flex-col space-y-6">
                 {/* Timing Distribution */}
                 <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-sans uppercase tracking-widest text-slate-500">
                        <span>Rushing</span>
                        <span>Perfect</span>
                        <span>Dragging</span>
                    </div>
                    <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden flex">
                        {(() => {
                            const { earlyPct, perfectPct, latePct } = getTimingDistribution(stats.history);
                            return (
                                <>
                                    <div style={{ width: `${earlyPct}%` }} className="bg-cyan-500/60 h-full transition-all duration-1000"></div>
                                    <div style={{ width: `${perfectPct}%` }} className="bg-white/80 h-full shadow-[0_0_10px_white] transition-all duration-1000"></div>
                                    <div style={{ width: `${latePct}%` }} className="bg-orange-500/60 h-full transition-all duration-1000"></div>
                                </>
                            );
                        })()}
                    </div>
                 </div>

                 {/* Timing Deviation Chart (Scatter Plot) */}
                 <div className="h-40 bg-white/5 rounded-lg border border-white/5 relative p-4 overflow-hidden">
                    <div className="absolute top-2 left-2 text-[9px] font-sans uppercase tracking-widest text-slate-500 z-10">Timing Deviation (ms)</div>
                    <svg className="w-full h-full" viewBox={`0 0 ${GAME_DURATION} 200`} preserveAspectRatio="none">
                        {(() => {
                            const windows = SCORING_WINDOWS[gameConfig.difficulty];
                            const maxDev = windows[3];
                            const yScale = 80 / maxDev; // Scale to fit in half height (100)

                            return (
                                <>
                                    {/* Scoring Zones */}
                                    <rect x="0" y={100 - windows[2] * yScale} width={GAME_DURATION} height={windows[2] * yScale * 2} fill="rgba(255,255,255,0.02)" />
                                    <rect x="0" y={100 - windows[1] * yScale} width={GAME_DURATION} height={windows[1] * yScale * 2} fill="rgba(255,255,255,0.04)" />
                                    <rect x="0" y={100 - windows[0] * yScale} width={GAME_DURATION} height={windows[0] * yScale * 2} fill="rgba(255,255,255,0.06)" />

                                    {/* Center Line (Perfect) */}
                                    <line x1="0" y1="100" x2={GAME_DURATION} y2="100" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4" />
                                    
                                    {/* Hit Data Points */}
                                    {stats.history.map((hit, i) => {
                                        let cy = 100 - (hit.offset * yScale); 
                                        cy = Math.max(10, Math.min(190, cy));
                                        
                                        const absOff = Math.abs(hit.offset);
                                        let color = '#ffffff'; 
                                        if (hit.isMiss || absOff > windows[3]) color = '#ef4444';
                                        else if (absOff > windows[2]) color = '#facc15';
                                        else if (absOff > windows[1]) color = '#a7f3d0';
                                        else if (absOff > windows[0]) color = '#22d3ee';
                                        
                                        const opacity = hit.isMiss ? 0.3 : 0.8;
                                        const radius = hit.score >= 90 ? 3 : 2;
                                        
                                        return (
                                            <circle 
                                                key={i} 
                                                cx={hit.timestamp} 
                                                cy={cy} 
                                                r={radius} 
                                                fill={color} 
                                                opacity={opacity}
                                            />
                                        );
                                    })}
                                </>
                            );
                        })()}
                    </svg>
                    
                    <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-between text-[8px] text-slate-600 font-sans py-2 pointer-events-none">
                        <span>Late (+)</span>
                        <span>Early (-)</span>
                    </div>
                 </div>

                 <div className="bg-white/5 border-l-2 border-white/20 p-4">
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">Rhythm Mentor Feedback</div>
                    <div className="text-sm font-serif italic text-slate-200 leading-relaxed">"{mentorComment}"</div>
                 </div>
             </div>
          </div>

          <div className="flex justify-center gap-8 border-t border-white/10 pt-6 mt-6 shrink-0">
             <button onClick={quitGame} className="text-[10px] font-sans text-slate-500 hover:text-white uppercase tracking-widest">Back to Menu</button>
             <button onClick={() => startGame(gameConfig)} className={`text-[10px] font-sans text-${gameConfig.level.color}-300 hover:text-white uppercase font-bold tracking-widest`}>Retry Level</button>
          </div>
        </div>
      )}
    </div>
  );
};

const StatRow = ({ label, count, color }: { label: string, count: number, color: string }) => (
    <div className="flex justify-between items-baseline border-b border-white/5 pb-2"><span className={`text-[10px] font-sans uppercase opacity-60 ${color}`}>{label}</span><span className={`text-lg font-serif ${color}`}>{count}</span></div>
);

export default RhythmEngine;
