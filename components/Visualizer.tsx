
import React, { useEffect, useRef } from 'react';
import { Level } from '../types';

interface VisualizerProps {
  isPlaying: boolean;
  level: Level;
  bpm: number;
  audioContext: AudioContext | null;
  loopStartTime: number;
  lastHitTime: number | null;
  hitScore: number | null;
  beatTrigger: number;
}

const Visualizer: React.FC<VisualizerProps> = ({ 
  isPlaying, 
  level, 
  bpm,
  audioContext,
  loopStartTime,
  lastHitTime, 
  hitScore,
  beatTrigger 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Particles now represent "Paint Splashes"
  const particles = useRef<Array<{ 
    x: number, y: number, 
    vx: number, vy: number, 
    life: number, 
    color: string, 
    size: number,
    rotation: number 
  }>>([]);
  
  // Rings represent the ripples in the water
  const ripples = useRef<Array<{ r: number, alpha: number }>>([]);
  
  const lastBeatRef = useRef(beatTrigger);

  const getAngle = (beat: number, totalBeats: number) => {
    return (beat / totalBeats) * Math.PI * 2 - Math.PI / 2;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;

    const render = () => {
      const w = canvas.width = window.innerWidth;
      const h = canvas.height = window.innerHeight;
      const cx = w / 2;
      const cy = h / 2;
      const baseRadius = Math.min(w, h) * 0.30; 

      let loopProgress = 0;
      if (isPlaying && audioContext) {
          const now = audioContext.currentTime;
          const beatDuration = 60 / bpm;
          const loopDuration = beatDuration * level.loopBeats;
          loopProgress = ((now - loopStartTime) % loopDuration) / loopDuration;
          if (loopProgress < 0) loopProgress += 1;
      } else {
          loopProgress = (Date.now() % 8000) / 8000;
      }

      // Clear with a very slight trail for "wet paint" feel
      ctx.fillStyle = 'rgba(5, 5, 8, 0.2)'; 
      ctx.fillRect(0, 0, w, h);

      // --- Beat Ripples (Metronome) ---
      if (beatTrigger !== lastBeatRef.current) {
        ripples.current.push({ r: baseRadius * 0.8, alpha: 0.6 });
        lastBeatRef.current = beatTrigger;
      }

      // Draw Ripples
      ctx.lineWidth = 2;
      ripples.current = ripples.current.filter(ripple => ripple.alpha > 0);
      ripples.current.forEach(ripple => {
        ripple.r += 2;
        ripple.alpha -= 0.01;
        ctx.beginPath();
        ctx.arc(cx, cy, ripple.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${ripple.alpha * 0.2})`;
        ctx.stroke();
      });

      if (isPlaying) {
        // --- The Path (Orbit) ---
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // --- Beat Markers (Pearls) ---
        level.pattern.forEach(note => {
          const angle = getAngle(note.beat, level.loopBeats);
          const x = cx + Math.cos(angle) * baseRadius;
          const y = cy + Math.sin(angle) * baseRadius;

          const nodeProgress = note.beat / level.loopBeats;
          let diff = Math.abs(loopProgress - nodeProgress);
          if (diff > 0.5) diff = 1 - diff;
          
          const isActive = diff < 0.05; 
          const size = isActive ? 10 : 5;
          
          let noteColor = level.hex;
          if (note.hand === 'left') noteColor = '#22d3ee'; // Cyan
          if (note.hand === 'right') noteColor = '#fb7185'; // Rose
          
          // Glow around node
          if (isActive) {
             const gradient = ctx.createRadialGradient(x, y, 0, x, y, 30);
             gradient.addColorStop(0, `${noteColor}88`);
             gradient.addColorStop(1, 'transparent');
             ctx.fillStyle = gradient;
             ctx.beginPath();
             ctx.arc(x, y, 30, 0, Math.PI * 2);
             ctx.fill();
          }

          // The Node itself
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fillStyle = isActive ? '#fff' : `${noteColor}66`;
          ctx.fill();

          // Hand Indicator Ring (If specific hand required)
          if (note.hand !== 'any') {
             ctx.beginPath();
             ctx.arc(x, y, size + 4, 0, Math.PI * 2);
             ctx.strokeStyle = note.hand === 'left' ? '#22d3ee' : '#fb7185';
             ctx.lineWidth = 2;
             ctx.stroke();
          }
        });

        // --- The Cursor (The Brush Tip) ---
        const cursorAngle = (loopProgress * Math.PI * 2) - Math.PI / 2;
        const cursorX = cx + Math.cos(cursorAngle) * baseRadius;
        const cursorY = cy + Math.sin(cursorAngle) * baseRadius;

        // Glow
        const cursorGlow = ctx.createRadialGradient(cursorX, cursorY, 0, cursorX, cursorY, 20);
        cursorGlow.addColorStop(0, 'rgba(255,255,255,0.8)');
        cursorGlow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = cursorGlow;
        ctx.beginPath();
        ctx.arc(cursorX, cursorY, 20, 0, Math.PI * 2);
        ctx.fill();

        // Solid Center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cursorX, cursorY, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Paint Particles (Hits) ---
      // Use "screen" blend mode for luminous paint effect
      ctx.globalCompositeOperation = 'screen';
      
      particles.current = particles.current.filter(p => p.life > 0);
      particles.current.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        
        // Draw an elongated ellipse (brush stroke)
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 2, p.size, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();

        p.x += p.vx;
        p.y += p.vy;
        p.rotation += 0.02; // Slowly rotate the "brush dab"
        p.life -= 0.015; // Fade out slowly
        p.size *= 0.98; // Shrink slightly
      });
      
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, level, bpm, loopStartTime, audioContext, beatTrigger]);

  // Handle hit effects
  useEffect(() => {
     if (hitScore !== null && hitScore !== undefined) {
         const w = canvasRef.current?.width || window.innerWidth;
         const h = canvasRef.current?.height || window.innerHeight;
         const cx = w/2;
         const cy = h/2;
         
         // More particles for better scores
         const count = Math.floor(hitScore / 4) + 8;
         const isPerfect = hitScore >= 90;
         const color = isPerfect ? '#ffffff' : level.hex;
         
         for(let i=0; i<count; i++) {
             const angle = Math.random() * Math.PI * 2;
             // Faster speed for perfect hits
             const speed = (Math.random() * 4 + 2) * (isPerfect ? 1.5 : 1); 
             
             particles.current.push({
                 x: cx,
                 y: cy,
                 vx: Math.cos(angle) * speed,
                 vy: Math.sin(angle) * speed,
                 life: 1.0,
                 color: color,
                 size: Math.random() * 8 + 4,
                 rotation: Math.random() * Math.PI
             });
         }
     }
  }, [lastHitTime, hitScore, level.hex]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />;
};

export default Visualizer;
