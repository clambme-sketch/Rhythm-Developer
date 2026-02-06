
export enum GameState {
  IDLE = 'IDLE', // Level Selection
  STARTING = 'STARTING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  RESULTS = 'RESULTS'
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export type Hand = 'left' | 'right' | 'any';

export interface NoteEvent {
  beat: number;
  hand: Hand;
}

export interface Level {
  id: string;
  category: string;
  name: string;
  description: string;
  bpm: number;
  loopBeats: number; // Length of the pattern in beats
  pattern: NoteEvent[]; // Beat positions and hand requirement
  color: string; // Tailwind color class base
  hex: string; // Hex code for canvas
  isTwoDrum?: boolean; // If true, requires split keyboard/screen
}

export interface GameConfig {
  level: Level;
  bpm: number;
  difficulty: Difficulty;
}

export interface ScoreEntry {
  score: number;
  timestamp: number;
  label: string;
  color: string;
}

export interface HitEvent {
  offset: number; // ms difference
  timestamp: number; // relative to song start
  score: number;
  isMiss: boolean;
  beat: number;
  hand: Hand; // Which hand the user used
  expectedHand: Hand; // Which hand was expected
}

export interface GameStats {
  totalScore: number;
  combo: number;
  maxCombo: number;
  perfects: number;
  greats: number;
  goods: number;
  misses: number;
  averageAccuracy: number;
  history: HitEvent[];
}

export interface AnalysisStats {
  perfects: number;
  misses: number;
  averageAccuracy: number;
  earlyRate: number; 
  lateRate: number; 
  offbeatMisses: number;
  downbeatMisses: number;
  trend: 'improving' | 'degrading' | 'stable';
}

export interface HighScoreEntry {
  score: number;
  accuracy: number;
}

export interface HighScores {
  [levelId: string]: {
    [key in Difficulty]?: HighScoreEntry | number;
  };
}
