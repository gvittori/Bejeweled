/**
 * Core type definitions for Bejeweled Classic
 */

export enum GemType {
  TOPAZ = 0,    // Yellow diamond
  DIAMOND = 1,  // White / silver sphere
  SAPPHIRE = 2, // Blue inverted triangle
  RUBY = 3,     // Red square
  AMETHYST = 4, // Purple triangle
  AMBER = 5,    // Orange hexagon
  EMERALD = 6,  // Green octagon
}

export enum SpecialType {
  NONE = 'none',
  FLAME = 'flame',         // Match 4: 3x3 blast explosion
  STAR = 'star',           // Match 5 / L/T shape: row & column cross laser
  HYPERCUBE = 'hypercube', // Match 5 in row: clears all gems of target color
}

export interface Tile {
  id: string;
  type: GemType;
  special: SpecialType;
  row: number;
  col: number;
  // Visual animation coordinates
  visualRow: number;
  visualCol: number;
  scale: number;
  alpha: number;
  rotAngle: number;
  animFrame: number;
  animTimer: number;
  animType: 'idle' | 'spin' | 'shine';
  // State flags
  isMatching?: boolean;
  isHinted?: boolean;
  isSelected?: boolean;
  fallSpeed?: number;
}

export type GameMode = 'classic' | 'blitz' | 'zen';

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  level: number;
  maxMultiplier: number;
  mode: GameMode;
  date: string;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  alpha: number;
  vy: number;
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  rotation: number;
  vRot: number;
  shape: 'shard' | 'sparkle' | 'circle';
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
  thickness: number;
}

export interface LaserBeam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface MatchResult {
  matchedTiles: Tile[];
  specialSpawns: { row: number; col: number; type: GemType; special: SpecialType }[];
  clearedCoords: { row: number; col: number }[];
  basePoints: number;
  flameDetonations: { row: number; col: number }[];
  starDetonations: { row: number; col: number }[];
  hypercubeColor?: GemType;
}

export interface GameState {
  score: number;
  level: number;
  progress: number;
  maxProgress: number;
  multiplier: number;
  cascadeCount: number;
  maxComboMultiplier: number;
  timeRemaining: number; // for Blitz or Classic
  maxTime: number;
  movesMade: number;
  isPaused: boolean;
  isGameOver: boolean;
  mode: GameMode;
}
