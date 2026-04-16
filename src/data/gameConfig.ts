/**
 * gameConfig.ts
 * Single source of truth for all game configuration values.
 * Change GAME_CONFIG to rebrand or resize the game without touching scene code.
 */

export const GAME_CONFIG = {
  /** Display name shown in MenuScene title */
  title: 'Pixel Cart Puzzle',

  /** Canvas width in pixels — portrait 9:16 base resolution */
  width: 480,

  /** Canvas height in pixels — portrait 9:16 base resolution */
  height: 854,

  /** CSS hex background color (also used as letterbox color) */
  backgroundColor: '#1a1a2e',

  /** Set true to show Phaser debug overlays and console logs */
  debug: false,

  /** Semantic version string displayed in BootScene / footer */
  version: '1.0.0',

  /** Phaser physics system to use */
  physics: 'arcade' as const,

  /** Target frame rate */
  targetFps: 60
} as const

export type GameConfig = typeof GAME_CONFIG
