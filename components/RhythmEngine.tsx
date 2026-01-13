
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, ScoreEntry, GameStats, Level, Difficulty, GameConfig, HighScores, HitEvent, Hand, NoteEvent } from '../types';
import Visualizer from './Visualizer';
import LevelSelector from './LevelSelector';
import { getAICommentary, AnalysisStats } from '../services/geminiService';

// Audio Scheduler Constants
const LOOKAHEAD = 25.0; // ms
const SCHEDULE_AHEAD_TIME = 0.1; // seconds
const GAME_DURATION = 30.0; // seconds

// 808 Tuning
const LOW_TOM_FREQ = 130;
const HIGH_TOM_FREQ = 154.5; // Minor 3rd up from 130Hz

// Scoring Windows (ms) for [Perfect+, Perfect, Great, Good]
const SCORING_WINDOWS = {
  [Difficulty.EASY]:   [40, 70, 130, 200],
  [Difficulty.MEDIUM]: [25, 50, 100, 150],
  [Difficulty.HARD]:   [15, 30, 60, 100]
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
  const [aiComment, setAiComment] = useState<string>("");
  const [loadingAI, setLoadingAI] = useState(false);
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
  const gameStartTime = useRef<number>(0); // When scoring actually begins
  
  // Queue for scoring
  const expectedHits = useRef<Array<{ time: number, beat: number, hand: Hand, processed: boolean }>>([]);
  // Detailed hit history for analysis
  const hitHistory = useRef<Array<HitEvent>>([]);
  const [beatTrigger, setBeatTrigger] = useState(0);

  // Initialize Audio
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
    
    gain.gain.setValueAtTime(0.3, time); // Softer kick for metronome
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.2);
  }, []);

  const play808Tom = useCallback((hand: Hand, time: number) => {
      if (!audioContext.current) return;
      const ctx = audioContext.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Tuning: Minor 3rd apart
      const freq = (hand === 'left') ? LOW_TOM_FREQ : HIGH_TOM_FREQ;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      // Pitch envelope for "thud"
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, time + 0.15);

      gain.gain.setValueAtTime(0.7, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.3);
  }, []);

  const playHiHat = useCallback((time: number) => {
    if (!audioContext.current || !noiseBuffer.current) return;
    const ctx = audioContext.current;

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer.current;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, time); // Very Quiet helper hat
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(time);
    source.stop(time + 0.1);
  }, []);

  const scheduleNote = useCallback((note: NoteEvent, time: number) => {
    // Store beat info (integer part is downbeat, decimal is offbeat)
    expectedHits.current.push({ time: time, beat: note.beat, hand: note.hand, processed: false });
    const now = audioContext.current?.currentTime || 0;
    expectedHits.current = expectedHits.current.filter(hit => hit.time > now - 0.5);
    
    // Play guide sound (optional, maybe just HiHat for timing)
    playHiHat(time);
  }, [playHiHat]);

  const endGame = useCallback(() => {
    if (!gameConfig) return;

    // 1. Halt Audio & Loop
    if (timerID.current) window.clearTimeout(timerID.current);
    timerID.current = null;
    if (audioContext.current) audioContext.current.suspend();

    // 2. Derive Stats from History Ref (prevents stale closure issues)
    const history = hitHistory.current;
    const totalHits = history.length;
    
    // Timing Bias
    const earlyCount = history.filter(h => h.offset < -15).length;
    const lateCount = history.filter(h => h.offset > 15).length;
    const earlyRate = totalHits > 0 ? (earlyCount / totalHits) * 100 : 0;
    const lateRate = totalHits > 0 ? (lateCount / totalHits) * 100 : 0;

    // Specific Miss Types
    const offbeatMisses = history.filter(h => h.isMiss && h.beat % 1 !== 0).length;
    const downbeatMisses = history.filter(h => h.isMiss && h.beat % 1 === 0).length;

    // Trend Analysis
    let trend: 'improving' | 'degrading' | 'stable' = 'stable';
    if (totalHits > 4) {
      const midPoint = Math.floor(totalHits / 2);
      const firstHalf = history.slice(0, midPoint);
      const secondHalf = history.slice(midPoint);
      
      const getAvgAbsDiff = (arr: typeof history) => arr.reduce((acc, curr) => acc + Math.abs(curr.offset), 0) / (arr.length || 1);
      const firstAvg = getAvgAbsDiff(firstHalf);
      const secondAvg = getAvgAbsDiff(secondHalf);

      if (secondAvg > firstAvg * 1.2) trend = 'degrading';
      else if (secondAvg < firstAvg * 0.8) trend = 'improving';
    }

    // 3. Update State & LocalStorage
    setStats(currentStats => {
        // High Score Logic
        const stored = localStorage.getItem('rhythmPulseScores');
        let scores: HighScores = stored ? JSON.parse(stored) : {};
        
        const currentLevelScores = scores[gameConfig.level.id] || {};
        const previousEntry = currentLevelScores[gameConfig.difficulty];
        const previousBestScore = typeof previousEntry === 'number' ? previousEntry : (previousEntry?.score || 0);
        
        if (currentStats.totalScore > previousBestScore) {
          scores = {
            ...scores,
            [gameConfig.level.id]: {
              ...currentLevelScores,
              [gameConfig.difficulty]: {
                  score: Math.floor(currentStats.totalScore),
                  accuracy: currentStats.averageAccuracy
              }
            }
          };
          localStorage.setItem('rhythmPulseScores', JSON.stringify(scores));
        }

        return { ...currentStats, history }; 
    });

    const totalScoreAccum = history.reduce((acc, h) => acc + h.score, 0);
    const approxAccuracy = totalHits > 0 ? totalScoreAccum / totalHits : 0;
    const missesCount = history.filter(h => h.isMiss).length;
    const perfectsCount = history.filter(h => h.score >= 90).length;

    const analysisStats: AnalysisStats = {
        perfects: perfectsCount,
        misses: missesCount,
        averageAccuracy: approxAccuracy,
        earlyRate,
        lateRate,
        offbeatMisses,
        downbeatMisses,
        trend
    };

    setLoadingAI(true);
    getAICommentary(analysisStats)
      .then(comment => {
          setAiComment(comment);
          setLoadingAI(false);
      })
      .catch(err => {
          console.error("AI Error", err);
          setLoadingAI(false);
      });

    setGameState(GameState.RESULTS);
  }, [gameConfig]);

  const scheduler = useCallback(() => {
    if (!gameConfig || !audioContext.current || gameState !== GameState.PLAYING) return;
    if (audioContext.current.state === 'suspended') return;

    const currentTime = audioContext.current.currentTime;
    
    // Timer Logic
    const elapsedTime = currentTime - gameStartTime.current;
    const beatDuration = 60 / gameConfig.bpm;
    
    if (elapsedTime < 0) {
        setIsCountIn(true);
        setTimeLeft(GAME_DURATION); 
        // Calculate beats remaining in countdown
        const beatsRemaining = Math.ceil(Math.abs(elapsedTime) / beatDuration);
        setCountDown(beatsRemaining <= 4 ? beatsRemaining : null);
    } else {
        setIsCountIn(false);
        setCountDown(null);
        const remaining = Math.max(0, GAME_DURATION - elapsedTime);
        setTimeLeft(remaining);
        if (remaining <= 0) {
            endGame();
            return;
        }
    }

    // Metronome (Downbeats)
    while (nextMetronomeTime.current < currentTime + SCHEDULE_AHEAD_TIME) {
        playKick(nextMetronomeTime.current);
        const timeToNote = (nextMetronomeTime.current - currentTime) * 1000;
        setTimeout(() => {
            if (gameState === GameState.PLAYING) setBeatTrigger(prev => prev + 1);
        }, Math.max(0, timeToNote));
        nextMetronomeTime.current += beatDuration;
    }

    // Game Notes
    while (nextNoteTime.current < currentTime + SCHEDULE_AHEAD_TIME) {
        const pattern = gameConfig.level.pattern;
        const currentNote = pattern[currentBeatInPattern.current];
        
        scheduleNote(currentNote, nextNoteTime.current);
        
        let nextIndex = (currentBeatInPattern.current + 1) % pattern.length;
        let nextNote = pattern[nextIndex];
        
        // Calculate time diff based on beat difference
        let beatDiff = nextIndex === 0 
             ? gameConfig.level.loopBeats - currentNote.beat + nextNote.beat 
             : nextNote.beat - currentNote.beat;
             
        // Safety for malformed patterns (shouldn't happen with correct data)
        if (beatDiff <= 0) beatDiff = 1; 

        nextNoteTime.current += beatDiff * beatDuration;
        currentBeatInPattern.current = nextIndex;
    }
    timerID.current = window.setTimeout(scheduler, LOOKAHEAD);
  }, [gameConfig, gameState, scheduleNote, playKick, endGame]);

  useEffect(() => {
      let isActive = true;
      if (gameState === GameState.PLAYING && gameConfig && audioContext.current) {
          if (audioContext.current.state === 'suspended') {
              audioContext.current.resume().then(() => { if (isActive) scheduler(); });
          } else { scheduler(); }
      } else if (gameState === GameState.PAUSED && audioContext.current) {
          audioContext.current.suspend();
          if (timerID.current) window.clearTimeout(timerID.current);
      }
      return () => {
          isActive = false;
          if (timerID.current) window.clearTimeout(timerID.current);
      };
  }, [gameState, gameConfig, scheduler]);

  const selectLevel = (config: GameConfig) => {
      setGameConfig(config);
      startGame(config);
  };

  const startGame = async (config: GameConfig) => {
    await initAudio();
    setGameState(GameState.STARTING);
    setStats({
      totalScore: 0, combo: 0, maxCombo: 0, perfects: 0, greats: 0, goods: 0, misses: 0, averageAccuracy: 0, history: []
    });
    setAiComment("");
    setLastHit(null);
    setTimeLeft(GAME_DURATION);
    setIsCountIn(true);
    setCountDown(null);
    expectedHits.current = [];
    hitHistory.current = []; // Clear history

    setTimeout(() => {
      if (audioContext.current) {
          const now = audioContext.current.currentTime;
          const beatDuration = 60 / config.bpm;
          const countInDuration = beatDuration * 8; 
          
          const audioStartTime = now + 0.1;
          
          nextMetronomeTime.current = audioStartTime; 
          // Find first note
          nextNoteTime.current = audioStartTime + (config.level.pattern[0].beat * beatDuration); 
          loopStartTime.current = audioStartTime;
          
          gameStartTime.current = audioStartTime + countInDuration; 
          currentBeatInPattern.current = 0;
      }
      setGameState(GameState.PLAYING);
    }, 1000);
  };

  const restartGame = useCallback(() => {
    if (gameConfig) {
      if (audioContext.current) audioContext.current.suspend();
      startGame(gameConfig);
    }
  }, [gameConfig]);

  const togglePause = useCallback(() => {
      if (gameState === GameState.PLAYING) setGameState(GameState.PAUSED);
      else if (gameState === GameState.PAUSED) setGameState(GameState.PLAYING);
  }, [gameState]);

  const quitGame = useCallback(() => {
      if (audioContext.current) audioContext.current.suspend();
      setGameState(GameState.IDLE);
      setGameConfig(null);
  }, []);

  const handleTap = useCallback((inputHand: Hand) => {
    if (gameState !== GameState.PLAYING || !audioContext.current || !gameConfig) return;
    
    // Play feedback sound immediately
    if (audioContext.current.state === 'running') {
        play808Tom(inputHand, audioContext.current.currentTime);
    }

    const tapTime = audioContext.current.currentTime;
    if (tapTime < gameStartTime.current) return;

    // Get all unprocessed hits
    const activeHits = expectedHits.current.filter(h => !h.processed);
    
    // Config values
    const windows = SCORING_WINDOWS[gameConfig.difficulty];
    const maxWindow = windows[3]; // Max allowed error in seconds (converted from ms)

    // Find candidates within the valid window
    const candidates = activeHits.filter(hit => {
        const diff = Math.abs(hit.time - tapTime) * 1000;
        return diff < maxWindow;
    });

    let closestHit = null;

    if (candidates.length > 0) {
        // Prioritize hits that match the hand
        // If user hits LEFT, and we have a LEFT note nearby, prefer it over a slightly closer RIGHT note.
        // Sort candidates by priority: 
        // 1. Matches Hand? (Primary sort key)
        // 2. Absolute time difference (Secondary sort key)
        
        candidates.sort((a, b) => {
            const aMatch = (a.hand === inputHand || a.hand === 'any');
            const bMatch = (b.hand === inputHand || b.hand === 'any');
            
            // If one matches and the other doesn't, the matching one comes first
            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;

            // Otherwise, sort by time difference
            const diffA = Math.abs(a.time - tapTime);
            const diffB = Math.abs(b.time - tapTime);
            return diffA - diffB;
        });

        closestHit = candidates[0];
    }

    let score = 0;
    let label = "Miss";
    let color = "text-red-400";
    let rawDiff = 0;
    let isMiss = true;

    if (closestHit) {
        rawDiff = (tapTime - closestHit.time) * 1000;
        const diffMs = Math.abs(rawDiff);

        // Hand Check!
        if (closestHit.hand !== 'any' && closestHit.hand !== inputHand) {
            // Wrong hand!
            closestHit.processed = true;
            score = 0;
            label = "Wrong Drum!";
            color = "text-orange-500";
            isMiss = true;
        } else {
            closestHit.processed = true;
            isMiss = false;
            if (diffMs < windows[0]) {
                 score = 100; label = "Perfect"; color = "text-white drop-shadow-[0_0_10px_white]";
            } else if (diffMs < windows[1]) {
                 score = 90 + Math.floor((windows[1] - diffMs)/(windows[1]-windows[0]) * 10);
                 label = "Perfect"; color = `text-${gameConfig.level.color}-200`;
            } else if (diffMs < windows[2]) {
                 score = 70 + Math.floor((windows[2] - diffMs)/(windows[2]-windows[1]) * 20);
                 label = "Great"; color = `text-${gameConfig.level.color}-300`;
            } else {
                 score = 40 + Math.floor((windows[3] - diffMs)/(windows[3]-windows[2]) * 30);
                 label = "Good"; color = "text-yellow-200";
            }
        }
    } else {
        // Stray tap (no note nearby)
        score = 0; label = "Miss"; color = "text-red-400/50";
    }

    // Record stats
    if (closestHit) {
      hitHistory.current.push({
        offset: rawDiff,
        isMiss: isMiss,
        beat: closestHit.beat,
        timestamp: tapTime - gameStartTime.current,
        score: score,
        hand: inputHand,
        expectedHand: closestHit.hand
      });
    }

    setStats(prev => {
      const newCombo = score > 0 ? prev.combo + 1 : 0;
      const totalTaps = prev.perfects + prev.greats + prev.goods + prev.misses + 1;
      const newAccuracy = (prev.averageAccuracy * (totalTaps - 1) + score) / totalTaps;
      return {
        ...prev,
        totalScore: prev.totalScore + score * (1 + Math.floor(newCombo / 10) * 0.1),
        combo: newCombo,
        maxCombo: Math.max(prev.maxCombo, newCombo),
        perfects: prev.perfects + (score >= 90 ? 1 : 0),
        greats: prev.greats + (score >= 70 && score < 90 ? 1 : 0),
        goods: prev.goods + (score > 10 && score < 70 ? 1 : 0),
        misses: prev.misses + (score <= 10 ? 1 : 0),
        averageAccuracy: newAccuracy
      };
    });

    setLastHit({ score, timestamp: performance.now(), label, color });
  }, [gameState, gameConfig, play808Tom]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return; // Prevent hold-to-spam

      // Keys for Left Drum
      const leftKeys = ['KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX', 'KeyC'];
      // Keys for Right Drum
      const rightKeys = ['KeyJ', 'KeyK', 'KeyL', 'KeyM', 'Comma', 'Period', 'KeyN', 'KeyP'];

      if (e.code === 'Space') { 
          // Space is "any" or defaults to right for simplicity in menu, but acts as 'any' in game?
          // Let's make space act as "Right" for single drum, or maybe restrict space usage in 2-drum.
          // For UX, space is usually dominant hand. 
          e.preventDefault(); 
          handleTap('right'); 
      } 
      else if (leftKeys.includes(e.code)) { handleTap('left'); }
      else if (rightKeys.includes(e.code)) { handleTap('right'); }
      
      else if (e.code === 'Escape') { if (gameState === GameState.PLAYING || gameState === GameState.PAUSED) togglePause(); } 
      else if (e.code === 'KeyQ') { if (gameState === GameState.PAUSED) quitGame(); }
      else if (e.code === 'KeyR') { if (gameState === GameState.PAUSED) restartGame(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTap, togglePause, gameState, quitGame, restartGame]);

  // Helper to calculate percentages for chart
  const getTimingStats = (history: HitEvent[]) => {
      const early = history.filter(h => h.offset < -15).length;
      const late = history.filter(h => h.offset > 15).length;
      const total = history.length || 1;
      return {
          earlyPct: (early / total) * 100,
          latePct: (late / total) * 100,
          perfectPct: 100 - ((early + late) / total * 100)
      };
  };

  return (
    <div 
      className="relative w-full h-screen flex flex-col items-center justify-center overflow-hidden font-sans touch-none"
    >
      {/* Mobile Touch Zones */}
      {gameState === GameState.PLAYING && (
          <div className="absolute inset-0 z-50 flex pointer-events-auto">
              <div 
                className="w-1/2 h-full active:bg-cyan-500/10 transition-colors"
                onPointerDown={(e) => { e.preventDefault(); handleTap('left'); }}
              ></div>
              <div 
                className="w-1/2 h-full active:bg-rose-500/10 transition-colors"
                onPointerDown={(e) => { e.preventDefault(); handleTap('right'); }}
              ></div>
          </div>
      )}

      {(gameState === GameState.PLAYING || gameState === GameState.PAUSED) && gameConfig && (
        <Visualizer 
            isPlaying={gameState === GameState.PLAYING} 
            level={gameConfig.level}
            bpm={gameConfig.bpm}
            audioContext={audioContext.current}
            loopStartTime={loopStartTime.current}
            lastHitTime={lastHit?.timestamp || null}
            hitScore={lastHit?.score || null}
            beatTrigger={beatTrigger}
        />
      )}

      {gameState === GameState.IDLE && (
         <LevelSelector onSelect={selectLevel} />
      )}

      {gameState === GameState.STARTING && gameConfig && (
        <div className="z-10 text-center animate-in fade-in duration-1000 fill-mode-forwards">
           <div className={`text-lg font-serif italic text-${gameConfig.level.color}-200 mb-4 opacity-70`}>Syncing...</div>
           <div className="text-8xl font-serif text-white tracking-tight">Ready</div>
        </div>
      )}

      {(gameState === GameState.PLAYING || gameState === GameState.PAUSED) && gameConfig && (
        <div className="absolute inset-0 pointer-events-none animate-in fade-in duration-1000">
          <div className="absolute top-0 left-0 w-full z-20">
             <div className="h-0.5 w-full bg-white/5">
                <div 
                  className={`h-full bg-${gameConfig.level.color}-300 shadow-[0_0_15px_currentColor] transition-all duration-100 ease-linear`}
                  style={{ width: `${(timeLeft / GAME_DURATION) * 100}%` }}
                ></div>
             </div>
          </div>

          <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-10 pointer-events-none">
             <div className="flex flex-col items-start">
                 <div className="text-5xl font-serif text-white/90">
                     {Math.floor(stats.totalScore).toLocaleString()}
                 </div>
                 <div className="flex items-center gap-4 mt-2">
                    <span className={`text-xs font-sans tracking-[0.2em] text-${gameConfig.level.color}-200 uppercase`}>{gameConfig.level.name}</span>
                    <span className="text-xs font-serif italic text-slate-500">{gameConfig.difficulty}</span>
                 </div>
                 {/* Drum Guide */}
                 {gameConfig.level.isTwoDrum && (
                     <div className="mt-4 flex gap-4 text-[10px] uppercase tracking-widest text-white/40">
                         <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-400"></div> Left: A,S,D</div>
                         <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-400"></div> Right: J,K,L</div>
                     </div>
                 )}
             </div>
             
             <div className="flex flex-col items-end">
                 <div className={`text-5xl font-serif ${stats.averageAccuracy > 95 ? 'text-white' : 'text-slate-300'}`}>
                     {stats.averageAccuracy.toFixed(1)}<span className="text-2xl opacity-50">%</span>
                 </div>
                 <div className="text-xs font-sans text-slate-500 tracking-[0.2em] mt-2 uppercase">Accuracy</div>
             </div>
          </div>

          {gameState === GameState.PLAYING && (
            <div className="z-10 flex flex-col items-center pointer-events-none select-none absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                {isCountIn ? (
                  <div className="animate-pulse text-center">
                    <div className="text-2xl font-serif italic text-white/50 mb-4">Listen...</div>
                    <div className={`text-9xl font-sans font-bold text-${gameConfig.level.color}-400/80 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]`}>
                        {countDown !== null ? countDown : "Get Ready"}
                    </div>
                  </div>
                ) : (
                  <div className={`text-7xl font-serif italic transition-all duration-500 transform ${lastHit ? 'scale-100 opacity-100 translate-y-0 blur-0' : 'scale-95 opacity-0 translate-y-2 blur-sm'} ${lastHit?.color}`}>
                    {lastHit?.label}
                  </div>
                )}
            </div>
          )}

          {gameState === GameState.PAUSED && (
            <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-lg flex flex-col items-center justify-center animate-in fade-in duration-500 pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
                <h2 className="text-5xl font-serif italic text-white mb-12">Paused</h2>
                <div className="flex flex-col space-y-6 w-64 items-center">
                    <button onClick={(e) => { e.stopPropagation(); togglePause(); }} className="text-sm font-sans tracking-[0.3em] text-white hover:scale-105 transition-transform uppercase">
                        Resume
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); restartGame(); }} className="text-xs font-sans tracking-[0.3em] text-slate-300 hover:text-white hover:scale-105 transition-all uppercase">
                        Restart Level
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); quitGame(); }} className="text-xs font-sans tracking-[0.3em] text-slate-500 hover:text-white transition-colors uppercase pt-4 border-t border-white/10 w-full text-center">
                        Exit
                    </button>
                </div>
            </div>
          )}

          {stats.combo > 5 && gameState === GameState.PLAYING && !isCountIn && (
              <div className="absolute bottom-1/4 z-10 animate-pulse duration-1000 w-full text-center">
                  <div className={`text-3xl font-serif italic text-${gameConfig.level.color}-300 opacity-60`}>
                      {stats.combo} Combo
                  </div>
              </div>
          )}
        </div>
      )}

      {gameState === GameState.RESULTS && gameConfig && (
        <div className="z-20 w-full max-w-4xl bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-700 overflow-hidden flex flex-col pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
          
          <div className="flex justify-between items-end mb-6 border-b border-white/10 pb-4">
            <div>
                <h2 className="text-4xl font-serif italic text-white mb-2">Results</h2>
                <div className={`text-[10px] font-sans tracking-[0.3em] text-${gameConfig.level.color}-300 uppercase`}>
                    {gameConfig.level.name}
                </div>
            </div>
            <div className="text-right">
                <div className="text-3xl font-serif text-white">{stats.averageAccuracy.toFixed(1)}%</div>
                <div className="text-[10px] font-sans text-slate-500 tracking-widest uppercase">Accuracy</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             
             {/* Left Column: Stats */}
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
             
             {/* Middle Column: Detailed Visuals */}
             <div className="lg:col-span-2 flex flex-col space-y-6">
                 
                 {/* Timing Distribution Bar */}
                 <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-sans uppercase tracking-widest text-slate-400">
                        <span>Rushing</span>
                        <span>Perfect</span>
                        <span>Dragging</span>
                    </div>
                    <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex">
                        {(() => {
                            const { earlyPct, perfectPct, latePct } = getTimingStats(stats.history);
                            return (
                                <>
                                    <div style={{ width: `${earlyPct}%` }} className="bg-cyan-500/70 h-full"></div>
                                    <div style={{ width: `${perfectPct}%` }} className="bg-white/90 h-full shadow-[0_0_10px_white]"></div>
                                    <div style={{ width: `${latePct}%` }} className="bg-orange-500/70 h-full"></div>
                                </>
                            );
                        })()}
                    </div>
                    <div className="flex justify-between text-[10px] font-serif italic text-slate-500">
                        <span className="text-cyan-400">{getTimingStats(stats.history).earlyPct.toFixed(0)}%</span>
                        <span className="text-orange-400">{getTimingStats(stats.history).latePct.toFixed(0)}%</span>
                    </div>
                 </div>

                 {/* Timing Deviation Chart */}
                 <div className="h-32 bg-white/5 rounded-lg border border-white/5 relative p-2 overflow-hidden">
                    <div className="absolute top-2 left-2 text-[9px] font-sans uppercase tracking-widest text-slate-500 z-10">Deviation</div>
                    <svg className="w-full h-full" viewBox={`0 0 ${GAME_DURATION} 200`} preserveAspectRatio="none">
                        {(() => {
                            const windows = SCORING_WINDOWS[gameConfig.difficulty];
                            const maxDev = windows[3];
                            // Scale so maxDev is near the edge (say +/- 90px from center, leaving 10px margin)
                            const yScale = 90 / maxDev;

                            return (
                                <>
                                    {/* Zones Backgrounds */}
                                    <rect x="0" y={100 - windows[2] * yScale} width={GAME_DURATION} height={windows[2] * yScale * 2} fill="rgba(255,255,255,0.03)" />
                                    <rect x="0" y={100 - windows[1] * yScale} width={GAME_DURATION} height={windows[1] * yScale * 2} fill="rgba(255,255,255,0.05)" />
                                    <rect x="0" y={100 - windows[0] * yScale} width={GAME_DURATION} height={windows[0] * yScale * 2} fill="rgba(255,255,255,0.08)" />

                                    <line x1="0" y1="100" x2={GAME_DURATION} y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 4" />
                                    
                                    {/* Data Points */}
                                    {stats.history.map((hit, i) => {
                                        let cy = 100 - (hit.offset * yScale); 
                                        cy = Math.max(5, Math.min(195, cy));
                                        
                                        const absOff = Math.abs(hit.offset);
                                        let color = '#ffffff'; 
                                        if (hit.isMiss || absOff > windows[3]) color = '#ef4444'; // Miss (Red)
                                        else if (absOff > windows[2]) color = '#facc15'; // Good (Yellow)
                                        else if (absOff > windows[1]) color = '#a7f3d0'; // Great (Green-ish)
                                        else if (absOff > windows[0]) color = '#22d3ee'; // Perfect (Cyan)
                                        
                                        const opacity = hit.isMiss ? 0.4 : 0.9;
                                        
                                        return (
                                            <circle 
                                                key={i} 
                                                cx={hit.timestamp} 
                                                cy={cy} 
                                                r={hit.score >= 90 ? 2.5 : 1.5} 
                                                fill={color} 
                                                opacity={opacity}
                                            />
                                        );
                                    })}
                                </>
                            );
                        })()}
                    </svg>
                    
                    <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-between text-[8px] text-slate-600 font-sans py-2 pointer-events-none">
                        <span>Late</span>
                        <span>Early</span>
                    </div>
                 </div>

                 {/* Coach Feedback */}
                 <div className="bg-white/5 border-l-2 border-white/20 p-4">
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">Rhythm Coach Feedback</div>
                    <div className="text-sm font-serif italic text-slate-200 leading-relaxed">
                        {loadingAI ? <span className="animate-pulse">Thinking...</span> : `"${aiComment}"`}
                    </div>
                 </div>

             </div>
          </div>

          <div className="flex justify-center gap-8 border-t border-white/10 pt-6 mt-6">
             <button onClick={(e) => { e.stopPropagation(); quitGame(); }} className="text-[10px] font-sans text-slate-500 hover:text-white transition-colors tracking-[0.2em] uppercase">
                Back to Menu
              </button>
              <button onClick={(e) => { e.stopPropagation(); startGame(gameConfig); }} className={`text-[10px] font-sans text-${gameConfig.level.color}-300 hover:text-white transition-colors tracking-[0.2em] uppercase font-bold`}>
                Retry Level
              </button>
          </div>
        </div>
      )}
    </div>
  );
};

const StatRow = ({ label, count, color }: { label: string, count: number, color: string }) => (
    <div className="flex justify-between items-baseline group border-b border-white/5 pb-2 last:border-0">
        <span className={`text-[10px] font-sans tracking-widest uppercase opacity-60 ${color}`}>{label}</span>
        <span className={`text-lg font-serif ${color}`}>{count}</span>
    </div>
);

export default RhythmEngine;
