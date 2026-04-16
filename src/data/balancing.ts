/**
 * balancing.ts
 * All tunable gameplay numbers in one place.
 * Adjust here without touching system or scene code.
 */

export const BALANCING = {
  // ─── Spawning / Timing (Kept to prevent breaking MenuScene/ResultScene imports) ───────────────────
  initialSpawnInterval: 2000,
  minSpawnInterval: 500,
  sceneFadeDuration: 300,
  bootDelay: 100,
  difficultyRampTime: 60_000,
  maxDifficultyMultiplier: 3.0,
  
  // ─── Scoring ──────────────────────────────────────────────────────────────
  pointsPerCell: 10,
  pointsPerUnusedCart: 25,

  // ─── Puzzle Configuration ─────────────────────────────────────────────────
  PHASES: [
    { phase: 1, gridSize: 6, colors: 2, carts: 4, targetFill: 0.6 },
    { phase: 2, gridSize: 7, colors: 2, carts: 5, targetFill: 0.7 },
    { phase: 3, gridSize: 8, colors: 3, carts: 6, targetFill: 0.75 },
    { phase: 4, gridSize: 9, colors: 3, carts: 7, targetFill: 0.8 },
    { phase: 5, gridSize: 10, colors: 4, carts: 8, targetFill: 0.85 }
  ],
  
  // ─── Player (unused directly in puzzle but kept for types) ─────────────────
  startingLives: 3,
  playerSpeed: 300
} as const

export type Balancing = typeof BALANCING
