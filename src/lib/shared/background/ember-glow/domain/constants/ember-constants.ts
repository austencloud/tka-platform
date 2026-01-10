/**
 * Ember Glow Configuration Constants
 *
 * Centralized configuration for ember particle behavior, colors, and physics.
 * Extracted for easy tuning and AI-friendly selective reading.
 */

/** Particle counts per quality tier - reduced for chill ambient vibe */
export const EMBER_COUNTS = {
  high: 120,
  medium: 80,
  low: 50,
} as const;

/** Physics behavior constants - tuned for chill ambient vibe */
export const EMBER_PHYSICS = {
  /** Base rising speed (negative = upward) */
  RISING_SPEED_BASE: 0.2,   // Reduced from 0.3
  /** Additional random rising speed range */
  RISING_SPEED_RANGE: 0.5,  // Reduced from 0.8
  /** Horizontal drift amplitude - disabled for realistic rise */
  DRIFT_AMPLITUDE: 0,
  /** Glow radius multiplier (relative to ember size) */
  GLOW_MULTIPLIER: 10,      // Slightly reduced
  /** Flicker animation speed (radians per frame) */
  FLICKER_SPEED: 0.04,      // Reduced from 0.08 - slower flicker
  /** Minimum opacity during flicker (prevents invisible embers) */
  FLICKER_MIN_OPACITY: 0.5,
  /** Flicker intensity range (0.85 to 1.0) - gentler flicker */
  FLICKER_AMPLITUDE: 0.15,  // Reduced from 0.2
  /** Base flicker factor */
  FLICKER_BASE: 0.85,       // Raised from 0.8
} as const;

/** Ember size configuration */
export const EMBER_SIZE = {
  /** Minimum ember size */
  MIN: 2,
  /** Size range (added to minimum) */
  RANGE: 5,
} as const;

/** Ember opacity configuration */
export const EMBER_OPACITY = {
  /** Minimum base opacity */
  MIN: 0.6,
  /** Opacity range (added to minimum) */
  RANGE: 0.4,
  /** Core opacity multiplier (for solid center) */
  CORE_MULTIPLIER: 1.2,
} as const;

/** Color definitions for ember variants */
export const EMBER_COLORS = {
  /** Bright orange-red embers (30% probability) */
  ORANGE_RED: {
    r: 255,
    gMin: 120,
    gMax: 170,
    bMin: 20,
    bMax: 50,
    probability: 0.3,
  },
  /** Bright amber/orange embers (40% probability) */
  AMBER: {
    r: 255,
    gMin: 160,
    gMax: 220,
    bMin: 30,
    bMax: 70,
    probability: 0.7, // Cumulative with ORANGE_RED
  },
  /** Very bright white-hot embers (30% probability) */
  WHITE_HOT: {
    r: 255,
    gMin: 220,
    gMax: 255,
    bMin: 100,
    bMax: 150,
  },
} as const;

/** Gradient rendering constants */
export const EMBER_GRADIENT = {
  /** Inner gradient stop position */
  INNER_STOP: 0.4,
  /** Inner gradient opacity multiplier */
  INNER_OPACITY: 0.6,
} as const;

/** Respawn and wrap behavior */
export const EMBER_BOUNDS = {
  /** Buffer distance outside viewport for respawning */
  RESPAWN_BUFFER: 20,
} as const;

// ============================================================================
// Coal Bed Configuration (A+ Enhancement)
// ============================================================================

/** Coal bed - glowing heat source at bottom - tuned for subtle effect */
export const COAL_CONFIG = {
  /** Vertical position (bottom 10% of screen) */
  BOTTOM_ZONE: 0.10,
  /** Coal size range */
  SIZE_MIN: 12,
  SIZE_RANGE: 20, // 12-32px
  /** Glow radius multiplier */
  GLOW_MULTIPLIER: 2.5,
  /** Pulse animation - slower, gentler */
  PULSE_SPEED_MIN: 0.01,
  PULSE_SPEED_RANGE: 0.015, // 0.01-0.025 rad/frame
  PULSE_AMPLITUDE: 0.2, // ±20% intensity (reduced from 30%)
  /** Base intensity range */
  INTENSITY_MIN: 0.4,
  INTENSITY_RANGE: 0.4, // 0.4-0.8
  /** Flare (random hotspot) - less frequent */
  FLARE_CHANCE: 0.0005, // Half as frequent
  FLARE_DURATION_MIN: 40,
  FLARE_DURATION_RANGE: 60,
  FLARE_INTENSITY_BOOST: 0.3,
  /** Colors - slightly cooler */
  COLOR_COOL: { r: 160, g: 50, b: 25 },
  COLOR_HOT: { r: 230, g: 120, b: 40 },
  COLOR_FLARE: { r: 255, g: 200, b: 130 },
} as const;

/** Coal counts per quality tier */
export const COAL_COUNTS = {
  high: 25,
  medium: 18,
  low: 12,
  minimal: 8,
  "ultra-minimal": 5,
} as const;

/** Dark amber background gradient */
export const EMBER_BACKGROUND_GRADIENT = [
  { position: 0, color: "#1a0a0a" }, // Very dark brown-red
  { position: 0.3, color: "#2d1410" }, // Dark burgundy
  { position: 0.6, color: "#4a1f1a" }, // Dark amber
  { position: 1, color: "#3d1814" }, // Dark rust
] as const;

// ============================================================================
// Heat Intensity Configuration
// ============================================================================

export type HeatIntensity = "smolder" | "warm" | "hot" | "blazing";

/** Heat intensity affects color warmth, speed, and glow - tuned for chill vibe */
export const HEAT_INTENSITY_CONFIGS: Record<
  HeatIntensity,
  {
    speedMultiplier: number;
    glowMultiplier: number;
    colorShift: number; // 0 = cooler (more red), 1 = hotter (more yellow/white)
    sparkBonus: number; // Additional spark multiplier
  }
> = {
  smolder: {
    speedMultiplier: 0.4,  // Even slower for ultra-chill
    glowMultiplier: 0.5,   // Dimmer glow
    colorShift: 0,
    sparkBonus: -0.5,      // Fewer sparks
  },
  warm: {
    speedMultiplier: 0.7,  // Reduced from 1.0
    glowMultiplier: 0.8,
    colorShift: 0.2,
    sparkBonus: 0,
  },
  hot: {
    speedMultiplier: 1.0,
    glowMultiplier: 1.0,
    colorShift: 0.5,
    sparkBonus: 0.3,
  },
  blazing: {
    speedMultiplier: 1.3,
    glowMultiplier: 1.3,
    colorShift: 0.8,
    sparkBonus: 0.6,
  },
};

// ============================================================================
// Density Presets
// ============================================================================

export type DensityPreset = "sparse" | "normal" | "dense" | "inferno";

/** Density multipliers for particle counts */
export const DENSITY_MULTIPLIERS: Record<DensityPreset, number> = {
  sparse: 0.5,
  normal: 1.0,
  dense: 1.5,
  inferno: 2.0,
};

// ============================================================================
// Full Quality Configuration (like Pride background)
// ============================================================================

import type { QualityLevel } from "$lib/shared/background/shared/domain/types/background-types";

export interface EmberGlowQualityConfig {
  emberCount: number;
  smokeCount: number;
  sparkCount: number;
  glowIntensity: number;
  flickerEnabled: boolean;
  flickerSpeed: number;
}

export const EMBER_GLOW_QUALITY_CONFIGS: Record<QualityLevel, EmberGlowQualityConfig> = {
  high: {
    emberCount: 100,   // Reduced from 200
    smokeCount: 15,    // Reduced from 30
    sparkCount: 20,    // Reduced from 40
    glowIntensity: 1.0,
    flickerEnabled: true,
    flickerSpeed: 0.05, // Slower flicker
  },
  medium: {
    emberCount: 70,    // Reduced from 140
    smokeCount: 10,    // Reduced from 20
    sparkCount: 12,    // Reduced from 25
    glowIntensity: 0.9,
    flickerEnabled: true,
    flickerSpeed: 0.04,
  },
  low: {
    emberCount: 40,    // Reduced from 80
    smokeCount: 6,
    sparkCount: 8,
    glowIntensity: 0.7,
    flickerEnabled: true,
    flickerSpeed: 0.03,
  },
  minimal: {
    emberCount: 25,
    smokeCount: 3,
    sparkCount: 0,
    glowIntensity: 0.5,
    flickerEnabled: false,
    flickerSpeed: 0,
  },
  "ultra-minimal": {
    emberCount: 15,
    smokeCount: 0,
    sparkCount: 0,
    glowIntensity: 0.3,
    flickerEnabled: false,
    flickerSpeed: 0,
  },
};

// ============================================================================
// Smoke Particle Configuration
// ============================================================================

export const SMOKE_CONFIG = {
  /** Size range for smoke particles - larger for visibility */
  SIZE_MIN: 20,
  SIZE_RANGE: 30,
  /** Opacity range - increased for visibility */
  OPACITY_MIN: 0.12,
  OPACITY_RANGE: 0.15,
  /** Rise speed (slower than embers) */
  SPEED_BASE: 0.08,
  SPEED_RANGE: 0.1,
  /** Horizontal drift - disabled */
  DRIFT_AMPLITUDE: 0,
  /** Color range (dark grays with slight warmth) */
  COLOR_MIN: 40,
  COLOR_MAX: 70,
} as const;

// ============================================================================
// Spark Particle Configuration
// ============================================================================

export const SPARK_CONFIG = {
  /** Size range for sparks (small) */
  SIZE_MIN: 1,
  SIZE_RANGE: 1.5,
  /** Opacity (bright) */
  OPACITY_MIN: 0.8,
  OPACITY_RANGE: 0.2,
  /** Rise speed (faster than embers) */
  SPEED_BASE: 1.5,
  SPEED_RANGE: 1.0,
  /** Lifetime in frames (short-lived) */
  LIFETIME_MIN: 30,
  LIFETIME_RANGE: 40,
  /** Color: bright yellow to white */
  COLOR_R: 255,
  COLOR_G_MIN: 220,
  COLOR_G_MAX: 255,
  COLOR_B_MIN: 150,
  COLOR_B_MAX: 220,
} as const;
