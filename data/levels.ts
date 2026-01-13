
import { Level } from '../types';

// Helper to quickly generate "Any" hand notes for simple levels
const simple = (beats: number[]) => beats.map(b => ({ beat: b, hand: 'any' as const }));

export const LEVELS: Level[] = [
  // --- Fundamentals (Simple / Single Drum) ---
  {
    id: 'basic-4-4',
    category: 'Fundamentals',
    name: 'Basic 4/4',
    description: 'Standard quarter notes. The fundamental beat.',
    bpm: 110,
    loopBeats: 4,
    pattern: simple([0, 1, 2, 3]),
    color: 'rose', 
    hex: '#f43f5e'
  },
  {
    id: 'waltz-time',
    category: 'Fundamentals',
    name: 'Waltz Time (3/4)',
    description: 'The classic dance rhythm. ONE-two-three, with the third beat accented on a different drum.',
    bpm: 100,
    loopBeats: 3,
    isTwoDrum: true,
    pattern: [
      { beat: 0, hand: 'right' },
      { beat: 1, hand: 'right' },
      { beat: 2, hand: 'left' }
    ],
    color: 'pink',
    hex: '#ec4899'
  },
  {
    id: 'offbeat-drift',
    category: 'Fundamentals',
    name: 'Offbeats (Ands)',
    description: 'Playing on the "and" of the beat. Eighth note syncopation.',
    bpm: 125,
    loopBeats: 4,
    pattern: simple([0.5, 1.5, 2.5, 3.5]), 
    color: 'orange', 
    hex: '#f97316'
  },
  {
    id: 'cha-cha-cha',
    category: 'Fundamentals',
    name: 'Cha Cha Cha',
    description: 'Straight beats on 1, 2, 3, followed by two eighth notes (4-and).',
    bpm: 120,
    loopBeats: 4,
    pattern: simple([0, 1, 2, 3, 3.5]),
    color: 'indigo', 
    hex: '#6366f1'
  },

  // --- Tresillo Rhythms (Single Drum) ---
  {
    id: 'tresillo-pulse',
    category: 'Tresillo Rhythms',
    name: 'Tresillo (3-3-2)',
    description: 'The primary rhythm of Reggaeton and Dancehall. Two dotted quarters followed by a quarter.',
    bpm: 95,
    loopBeats: 4,
    pattern: simple([0, 1.5, 3]), 
    color: 'amber', 
    hex: '#f59e0b'
  },
  {
    id: 'habanera',
    category: 'Tresillo Rhythms',
    name: 'Habanera',
    description: 'The classic Tango rhythm. A distinctive pulse derived from the Tresillo family.',
    bpm: 100,
    loopBeats: 4,
    pattern: simple([0, 1.5, 2, 3]), 
    color: 'red', 
    hex: '#ef4444'
  },
  {
    id: 'cinquillo',
    category: 'Tresillo Rhythms',
    name: 'Cinquillo',
    description: 'A five-beat syncopated pattern common in Cuban and Caribbean music.',
    bpm: 90,
    loopBeats: 4,
    pattern: simple([0, 1, 1.5, 2.5, 3]), 
    color: 'yellow', 
    hex: '#eab308'
  },

  // --- Latin Roots (Advanced / Two Drum) ---
  {
    id: 'tumbao',
    category: 'Latin Roots',
    name: 'Tumbao (Marcha)',
    description: 'Authentic Conga pattern. Left hand simulates the Bass/Heel (Low), Right hand simulates Slap/Open (High).',
    bpm: 100,
    loopBeats: 4,
    isTwoDrum: true,
    pattern: [
        { beat: 1.0, hand: 'right' }, // Slap
        { beat: 1.5, hand: 'left' },  // Bass
        { beat: 3.0, hand: 'right' }, // Open
        { beat: 3.5, hand: 'right' }  // Open
    ], 
    color: 'amber',
    hex: '#d97706'
  },
  {
    id: 'son-clave',
    category: 'Latin Roots',
    name: 'Son Clave (3-2)',
    description: 'The structural core of Afro-Cuban salsa. Played on Claves (High Pitch).',
    bpm: 180,
    loopBeats: 8, 
    pattern: [
        { beat: 0, hand: 'right' },
        { beat: 1.5, hand: 'right' },
        { beat: 3, hand: 'right' },
        { beat: 5, hand: 'right' },
        { beat: 6, hand: 'right' }
    ], 
    color: 'lime', 
    hex: '#84cc16',
    isTwoDrum: true
  },
  {
    id: 'cascara',
    category: 'Latin Roots',
    name: 'Cascara (2-3)',
    description: 'Timbale shell pattern. Right hand plays the shell rhythm, Left hand keeps the steady pulse.',
    bpm: 130, // Faster
    loopBeats: 8,
    isTwoDrum: true,
    pattern: [
        // Left hand pulse on 0, 2, 4, 6 (Downbeats)
        { beat: 0, hand: 'left' },
        { beat: 2, hand: 'left' },
        { beat: 4, hand: 'left' },
        { beat: 6, hand: 'left' },
        // Right hand Cascara
        { beat: 0, hand: 'right' },
        { beat: 1, hand: 'right' },
        { beat: 1.5, hand: 'right' },
        { beat: 4, hand: 'right' },
        { beat: 4.5, hand: 'right' },
        { beat: 6, hand: 'right' }
    ], 
    color: 'teal',
    hex: '#14b8a6'
  },
  {
    id: 'samba-batucada',
    category: 'Latin Roots',
    name: 'Samba Batucada',
    description: 'Simulating Surdo (Left/Low) and Tamborim (Right/High) interaction.',
    bpm: 100,
    loopBeats: 2,
    isTwoDrum: true,
    pattern: [
        { beat: 0, hand: 'right' },
        { beat: 0.75, hand: 'right' },
        { beat: 1.0, hand: 'left' }, // Surdo accent
        { beat: 1.75, hand: 'right' }
    ],
    color: 'green',
    hex: '#22c55e'
  },

  // --- Rudiments (Two Drum Training) ---
  {
    id: 'single-stroke',
    category: 'Rudiments',
    name: 'Single Stroke Roll',
    description: 'Alternating hands (RLRL). The most fundamental drum pattern.',
    bpm: 100,
    loopBeats: 4,
    isTwoDrum: true,
    pattern: [
        { beat: 0, hand: 'right' },
        { beat: 0.5, hand: 'left' },
        { beat: 1.0, hand: 'right' },
        { beat: 1.5, hand: 'left' },
        { beat: 2.0, hand: 'right' },
        { beat: 2.5, hand: 'left' },
        { beat: 3.0, hand: 'right' },
        { beat: 3.5, hand: 'left' },
    ],
    color: 'cyan',
    hex: '#06b6d4'
  },
  {
    id: 'double-stroke',
    category: 'Rudiments',
    name: 'Double Stroke Roll',
    description: 'Two hits per hand (RRLL). Essential for smooth rolls.',
    bpm: 100,
    loopBeats: 4,
    isTwoDrum: true,
    pattern: [
        { beat: 0, hand: 'right' },
        { beat: 0.5, hand: 'right' },
        { beat: 1.0, hand: 'left' },
        { beat: 1.5, hand: 'left' },
        { beat: 2.0, hand: 'right' },
        { beat: 2.5, hand: 'right' },
        { beat: 3.0, hand: 'left' },
        { beat: 3.5, hand: 'left' },
    ],
    color: 'sky',
    hex: '#0ea5e9'
  },
  {
    id: 'paradiddle',
    category: 'Rudiments',
    name: 'Paradiddle',
    description: 'Combining single and double strokes (RLRRLRLL).',
    bpm: 110,
    loopBeats: 4,
    isTwoDrum: true,
    pattern: [
        { beat: 0, hand: 'right' },
        { beat: 0.5, hand: 'left' },
        { beat: 1.0, hand: 'right' },
        { beat: 1.5, hand: 'right' }, // Diddle
        { beat: 2.0, hand: 'left' },
        { beat: 2.5, hand: 'right' },
        { beat: 3.0, hand: 'left' },
        { beat: 3.5, hand: 'left' }, // Diddle
    ],
    color: 'violet',
    hex: '#8b5cf6'
  },
  {
    id: 'inverted-paradiddle',
    category: 'Rudiments',
    name: 'Inverted Paradiddle',
    description: 'Shifting the accent (RLLR LRRL). Great for syncopation.',
    bpm: 110,
    loopBeats: 4,
    isTwoDrum: true,
    pattern: [
        { beat: 0, hand: 'right' },
        { beat: 0.5, hand: 'left' },
        { beat: 1.0, hand: 'left' }, // Diddle
        { beat: 1.5, hand: 'right' }, 
        { beat: 2.0, hand: 'left' },
        { beat: 2.5, hand: 'right' },
        { beat: 3.0, hand: 'right' }, // Diddle
        { beat: 3.5, hand: 'left' }, 
    ],
    color: 'purple',
    hex: '#a855f7'
  },
  {
    id: 'paradiddle-diddle',
    category: 'Rudiments',
    name: 'Paradiddle-Diddle',
    description: 'Classic 6-note triplet feel (RLRRLL). Smooth and flowing.',
    bpm: 100,
    loopBeats: 4, // 2 beats of triplets = 6 notes. Mapping to 4 beats for visual clarity as triplets in 4/4 is fine, but cleaner as straight 6 notes in a loop.
    // Let's use 6 notes over 4 beats? No, let's just make it triplets. 
    // 0, 0.33, 0.66, 1.0, 1.33, 1.66. Total 2 beats.
    isTwoDrum: true,
    pattern: [
        { beat: 0, hand: 'right' },
        { beat: 0.33, hand: 'left' },
        { beat: 0.66, hand: 'right' },
        { beat: 1.0, hand: 'right' }, // Diddle
        { beat: 1.33, hand: 'left' },
        { beat: 1.66, hand: 'left' }, // Diddle
        
        // Second half
        { beat: 2.0, hand: 'right' },
        { beat: 2.33, hand: 'left' },
        { beat: 2.66, hand: 'right' },
        { beat: 3.0, hand: 'right' }, 
        { beat: 3.33, hand: 'left' },
        { beat: 3.66, hand: 'left' }, 
    ],
    color: 'fuchsia',
    hex: '#d946ef'
  },
  {
    id: 'five-stroke',
    category: 'Rudiments',
    name: 'Five Stroke Roll',
    description: 'Two doubles and an accent (RRLL R).',
    bpm: 90,
    loopBeats: 4,
    isTwoDrum: true,
    pattern: [
        // RRLL R
        { beat: 0, hand: 'right' },
        { beat: 0.25, hand: 'right' },
        { beat: 0.5, hand: 'left' },
        { beat: 0.75, hand: 'left' },
        { beat: 1.0, hand: 'right' },
        // LLRR L
        { beat: 2, hand: 'left' },
        { beat: 2.25, hand: 'left' },
        { beat: 2.5, hand: 'right' },
        { beat: 2.75, hand: 'right' },
        { beat: 3.0, hand: 'left' },
    ],
    color: 'pink',
    hex: '#ec4899'
  }
];
