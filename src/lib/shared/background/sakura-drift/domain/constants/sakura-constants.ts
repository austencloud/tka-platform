/**
 * Sakura Drift Configuration Constants
 *
 * Centralized configuration for cherry blossom behavior, colors, and physics.
 * Extracted for easy tuning and AI-friendly selective reading.
 */

/** Particle counts per quality tier */
export const SAKURA_COUNTS = {
  high: 150,
  medium: 100,
  low: 60,
} as const;

/** Mobile particle counts (reduced for performance and visual comfort) */
export const SAKURA_COUNTS_MOBILE = {
  high: 75, // 50% of desktop
  medium: 50,
  low: 30,
} as const;

/** Flower vs petal distribution */
export const SAKURA_DISTRIBUTION = {
  /** Probability of spawning a full flower (vs single petal) */
  FLOWER_PROBABILITY: 0.3,
} as const;

/** Physics behavior constants */
export const SAKURA_PHYSICS = {
  /** Base falling speed */
  FALLING_SPEED_BASE: 0.3,
  /** Additional random falling speed range */
  FALLING_SPEED_RANGE: 0.5,

  /** Tumble-drag coupling - how much tumble affects fall speed */
  TUMBLE_DRAG_FACTOR: 0.6, // At max tumble, speed reduces by this factor
  /** Tumble speed range */
  TUMBLE_SPEED_MIN: 0.015,
  TUMBLE_SPEED_RANGE: 0.025,

  /** Primary sway (slow, wide oscillation) */
  SWAY_SPEED: 0.012,
  SWAY_AMPLITUDE_MIN: 25,
  SWAY_AMPLITUDE_RANGE: 35,

  /** Secondary sway (faster, smaller - adds complexity) */
  SECONDARY_SWAY_SPEED: 0.031,
  SECONDARY_SWAY_FACTOR: 0.4, // Relative to primary amplitude

  /** Flutter effect (rapid micro-movements) */
  FLUTTER_SPEED: 0.08,
  FLUTTER_AMPLITUDE: 0.3,

  /** Horizontal drift */
  DRIFT_AMPLITUDE: 0.25,
  DRIFT_BIAS_RANGE: 0.15, // Tendency to drift one direction

  /** How much rotation speed varies with tumble */
  ROTATION_TUMBLE_FACTOR: 0.5,
} as const;

/** Mobile physics (slower wobble for comfort on small screens) */
export const SAKURA_PHYSICS_MOBILE = {
  /** Base falling speed */
  FALLING_SPEED_BASE: 0.3,
  /** Additional random falling speed range */
  FALLING_SPEED_RANGE: 0.5,

  /** Tumble-drag coupling - how much tumble affects fall speed */
  TUMBLE_DRAG_FACTOR: 0.6,
  /** Tumble speed range */
  TUMBLE_SPEED_MIN: 0.015,
  TUMBLE_SPEED_RANGE: 0.025,

  /** Primary sway (slower on mobile - was 0.012) */
  SWAY_SPEED: 0.006,
  SWAY_AMPLITUDE_MIN: 25,
  SWAY_AMPLITUDE_RANGE: 35,

  /** Secondary sway (slower on mobile - was 0.031) */
  SECONDARY_SWAY_SPEED: 0.015,
  SECONDARY_SWAY_FACTOR: 0.4,

  /** Flutter effect (rapid micro-movements) */
  FLUTTER_SPEED: 0.08,
  FLUTTER_AMPLITUDE: 0.3,

  /** Horizontal drift */
  DRIFT_AMPLITUDE: 0.25,
  DRIFT_BIAS_RANGE: 0.15,

  /** How much rotation speed varies with tumble */
  ROTATION_TUMBLE_FACTOR: 0.5,
} as const;

/** Size configuration */
export const SAKURA_SIZE = {
  /** Flower size range - notably larger than petals */
  FLOWER: {
    MIN: 12,
    RANGE: 10,
  },
  /** Single petal size range - smaller, more delicate */
  PETAL: {
    MIN: 4,
    RANGE: 5,
  },
} as const;

/** Rotation configuration */
export const SAKURA_ROTATION = {
  /** Flower rotation speed (slower than petals) */
  FLOWER_SPEED: 0.015,
  /** Petal rotation speed */
  PETAL_SPEED: 0.04,
  /** Rotation speed randomness factor */
  RANDOMNESS: 0.5,
} as const;

/** Opacity configuration */
export const SAKURA_OPACITY = {
  /** Flower opacity range */
  FLOWER: {
    MIN: 0.8,
    RANGE: 0.2,
  },
  /** Petal opacity range */
  PETAL: {
    MIN: 0.6,
    RANGE: 0.3,
  },
} as const;

/** Color definitions for sakura variants */
export const SAKURA_COLORS = {
  /** Vibrant magenta-pink flowers (40% probability) - the showstoppers */
  FLOWER_MAGENTA: {
    r: 255,
    gMin: 100,
    gMax: 150,
    bMin: 180,
    bMax: 220,
    probability: 0.4,
  },
  /** Bright cherry pink flowers (35% probability) */
  FLOWER_PINK: {
    r: 255,
    gMin: 150,
    gMax: 190,
    bMin: 190,
    bMax: 220,
    probability: 0.75, // Cumulative
  },
  /** Soft blush flowers (25% probability) - lighter accent */
  FLOWER_BLUSH: {
    r: 255,
    gMin: 200,
    gMax: 230,
    bMin: 210,
    bMax: 240,
  },
  /** Deep rose petals (25% probability) - adds depth */
  PETAL_ROSE: {
    r: 255,
    gMin: 140,
    gMax: 180,
    bMin: 170,
    bMax: 200,
    probability: 0.25,
  },
  /** Soft pink petals (35% probability) */
  PETAL_PINK: {
    r: 255,
    gMin: 190,
    gMax: 220,
    bMin: 210,
    bMax: 240,
    probability: 0.6, // Cumulative with PETAL_ROSE
  },
  /** Cream/off-white petals (25% probability) - contrast */
  PETAL_CREAM: {
    r: 255,
    gMin: 240,
    gMax: 255,
    bMin: 245,
    bMax: 255,
    probability: 0.85, // Cumulative
  },
  /** Soft lavender petals (15% probability) - subtle variety */
  PETAL_LAVENDER: {
    r: 245,
    rRange: 10,
    gMin: 200,
    gMax: 225,
    b: 255,
  },
} as const;

/** Flower rendering configuration */
export const SAKURA_FLOWER = {
  /** Number of petals per flower */
  PETAL_COUNT: 5,
  /** Glow effect for flowers - subtle ambient light */
  GLOW: {
    /** Glow radius multiplier (relative to flower size) */
    RADIUS: 2.0,
    /** Glow opacity */
    OPACITY: 0.12,
    /** Inner glow opacity */
    INNER_OPACITY: 0.2,
  },
  /** Petal gradient inner position */
  GRADIENT_INNER: 0,
  /** Petal gradient mid position */
  GRADIENT_MID: 0.5,
  /** Petal gradient outer position */
  GRADIENT_OUTER: 1,
  /** Mid gradient opacity multiplier */
  MID_OPACITY: 0.9,
  /** Outer gradient opacity multiplier */
  OUTER_OPACITY: 0.4,
  /** Heart-shaped petal curve positions */
  CURVE: {
    WIDTH_FACTOR: 0.3,
    TOP_Y: 0.2,
    MID_Y: 0.5,
    BOTTOM_Y: 0.7,
    END_Y: 0.6,
  },
  /** Center (stamen) configuration */
  CENTER: {
    /** Center radius multiplier (relative to flower size) */
    RADIUS_MULTIPLIER: 0.15,
    /** Center color */
    COLOR: { r: 255, g: 220, b: 100 },
    /** Center outer color */
    OUTER_COLOR: { r: 255, g: 200, b: 80 },
    /** Center outer opacity multiplier */
    OUTER_OPACITY: 0.6,
  },
} as const;

/** Single petal rendering configuration */
export const SAKURA_PETAL = {
  /** Petal gradient positions */
  GRADIENT: {
    INNER: 0,
    MID: 0.7,
    OUTER: 1,
  },
  /** Gradient opacity multipliers */
  OPACITY: {
    MID: 0.8,
    OUTER: 0.3,
  },
  /** Ellipse dimensions (relative to size) */
  ELLIPSE: {
    PRIMARY: { width: 0.6, height: 1.0 },
    SECONDARY: { width: 0.4, height: 0.8, rotation: Math.PI / 4 },
  },
} as const;

/** Respawn and wrap behavior */
export const SAKURA_BOUNDS = {
  /** Buffer distance outside viewport for respawning */
  RESPAWN_BUFFER: 20,
} as const;

/** Wind gust configuration - very calm, occasional gentle breeze */
export const SAKURA_WIND = {
  // Frames between gusts (very long intervals for calm atmosphere)
  gustIntervalMin: 900,  // ~15 seconds at 60fps
  gustIntervalMax: 1800, // ~30 seconds at 60fps
  // Gust duration in frames (longer, gentler gusts)
  gustDurationMin: 120,
  gustDurationMax: 240,
  // Gust strength (horizontal acceleration) - very gentle
  gustStrengthMin: 0.15,
  gustStrengthMax: 0.4,
  // Decay rate per frame
  gustDecay: 0.01,
  // Base ambient wind (very subtle constant drift)
  ambientStrength: 0.015,
  ambientVariation: 0.008,
} as const;

/** Mobile wind settings - even calmer */
export const SAKURA_WIND_MOBILE = {
  gustIntervalMin: 1200, // ~20 seconds
  gustIntervalMax: 2400, // ~40 seconds
  gustDurationMin: 150,
  gustDurationMax: 300,
  gustStrengthMin: 0.1,
  gustStrengthMax: 0.3,
  gustDecay: 0.008,
  ambientStrength: 0.01,
  ambientVariation: 0.005,
} as const;

/** Soft twilight background gradient */
export const SAKURA_BACKGROUND_GRADIENT = [
  { position: 0, color: "#2a1f2e" }, // Dark purple
  { position: 0.3, color: "#3d2f42" }, // Medium purple
  { position: 0.6, color: "#4a3d52" }, // Soft lavender
  { position: 1, color: "#362d40" }, // Dark lavender
] as const;
