import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";

export const FIREFLY_COUNTS: Record<QualityLevel, number> = {
  high: 22, // +20% from 18
  medium: 14, // +20% from 12
  low: 10, // +20% from 8
  minimal: 6, // +20% from 5
  "ultra-minimal": 3,
} as const;

export const FIREFLY_PHYSICS = {
  // Wandering movement
  WANDER_SPEED_BASE: 0.12,
  WANDER_SPEED_RANGE: 0.18,
  WANDER_ANGLE_CHANGE: 0.02,
  WANDER_ANGLE_RANGE: 0.05,

  // Vertical zone constraints (percentage of canvas height)
  // Expanded to allow fireflies throughout the scene
  ZONE_TOP: 0.08,
  ZONE_BOTTOM: 0.92,

  // Glow properties - subtle, not attention-grabbing
  GLOW_MULTIPLIER: 5,
  GLOW_FADE_SPEED: 0.008,

  // Blinking behavior - gentle, lingering glows
  BLINK_CYCLE_MIN: 300, // frames (~5 seconds at 60fps)
  BLINK_CYCLE_RANGE: 420, // up to ~12 seconds total
  BLINK_ON_DURATION: 0.35, // 35% of cycle is lit (longer glow)
} as const;

export const FIREFLY_SIZE = {
  MIN: 2,
  RANGE: 2, // 2-4px (smaller, less prominent)
} as const;

export const FIREFLY_OPACITY = {
  MIN: 0.5,
  RANGE: 0.3, // 0.5-0.8 (more subtle)
  CORE_MULTIPLIER: 1.2,
} as const;

export const FIREFLY_COLORS = {
  // 50% probability: Yellow-green (classic firefly)
  YELLOW_GREEN: {
    r: 190,
    gMin: 230,
    gMax: 255,
    bMin: 80,
    bMax: 120,
    probability: 0.5,
  },
  // 30% probability: Bright green
  BRIGHT_GREEN: {
    r: 163,
    gMin: 220,
    gMax: 255,
    bMin: 50,
    bMax: 90,
    probability: 0.8,
  },
  // 20% probability: Warm gold
  WARM_GOLD: {
    rMin: 250,
    rMax: 255,
    gMin: 210,
    gMax: 240,
    bMin: 60,
    bMax: 100,
  },
} as const;

export const FIREFLY_BACKGROUND_GRADIENT = [
  // Night sky extending down toward horizon (horizon at 78%)
  // Sky stays dark blue-black until near the horizon, then transitions to green for meadow
  { position: 0, color: "#0a0e18" },    // Deep night sky (dark blue)
  { position: 0.35, color: "#0a1018" }, // Sky continues
  { position: 0.55, color: "#0a1118" }, // Still mostly sky
  { position: 0.70, color: "#0c1416" }, // Transition begins near horizon
  { position: 0.78, color: "#0e1814" }, // At horizon - slight green tint
  { position: 0.90, color: "#101a14" }, // Below horizon (ground color blends)
  { position: 1, color: "#0c1610" },    // Bottom edge
] as const;

// Stars in the upper sky area
export const STAR_CONFIG = {
  COUNT: {
    high: 40,
    medium: 25,
    low: 15,
    minimal: 8,
    "ultra-minimal": 4,
  } as Record<QualityLevel, number>,
  ZONE_BOTTOM: 0.4, // Stars only in top 40% of screen
  SIZE_MIN: 0.5,
  SIZE_RANGE: 1.5,
  OPACITY_MIN: 0.3,
  OPACITY_RANGE: 0.5,
  COLOR: "#c8d4e8", // Soft blue-white
} as const;

export const RESPAWN_BUFFER = 50;

// Easter egg: Rare special firefly (1% chance)
export const SPECIAL_FIREFLY = {
  CHANCE: 0.01, // 1% chance per firefly
  COLOR: { r: 255, g: 150, b: 220 }, // Rose/magenta glow
  SIZE_MULTIPLIER: 1.4, // Slightly larger
  GLOW_MULTIPLIER: 7, // More prominent glow
} as const;

// Easter egg: Shooting star
export const SHOOTING_STAR = {
  CHANCE_PER_FRAME: 0.00005, // ~1% per minute at 60fps
  MIN_INTERVAL_FRAMES: 1800, // At least 30 seconds between stars
  SPEED: 8, // Pixels per frame
  LENGTH: 80, // Trail length
  HEAD_SIZE: 2,
  DURATION_FRAMES: 60, // How long the animation lasts
  ZONE_TOP: 0.05, // Only in top portion of sky
  ZONE_BOTTOM: 0.25,
} as const;
