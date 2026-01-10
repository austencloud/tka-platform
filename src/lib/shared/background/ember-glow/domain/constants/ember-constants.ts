/**
 * Ember Glow Configuration Constants
 *
 * Centralized configuration for ember particle behavior, colors, and physics.
 * Extracted for easy tuning and AI-friendly selective reading.
 */

/** Particle counts per quality tier */
export const EMBER_COUNTS = {
  high: 200,
  medium: 140,
  low: 80,
} as const;

/** Physics behavior constants */
export const EMBER_PHYSICS = {
  /** Base rising speed (negative = upward) */
  RISING_SPEED_BASE: 0.3,
  /** Additional random rising speed range */
  RISING_SPEED_RANGE: 0.8,
  /** Horizontal drift amplitude */
  DRIFT_AMPLITUDE: 0.3,
  /** Glow radius multiplier (relative to ember size) */
  GLOW_MULTIPLIER: 12,
  /** Flicker animation speed (radians per frame) */
  FLICKER_SPEED: 0.08,
  /** Minimum opacity during flicker (prevents invisible embers) */
  FLICKER_MIN_OPACITY: 0.4,
  /** Flicker intensity range (0.8 to 1.0) */
  FLICKER_AMPLITUDE: 0.2,
  /** Base flicker factor */
  FLICKER_BASE: 0.8,
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

/** Heat intensity affects color warmth, speed, and glow */
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
    speedMultiplier: 0.6,
    glowMultiplier: 0.7,
    colorShift: 0,
    sparkBonus: 0,
  },
  warm: {
    speedMultiplier: 1.0,
    glowMultiplier: 1.0,
    colorShift: 0.3,
    sparkBonus: 0,
  },
  hot: {
    speedMultiplier: 1.3,
    glowMultiplier: 1.3,
    colorShift: 0.6,
    sparkBonus: 0.5,
  },
  blazing: {
    speedMultiplier: 1.6,
    glowMultiplier: 1.6,
    colorShift: 1.0,
    sparkBonus: 1.0,
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
    emberCount: 200,
    smokeCount: 30,
    sparkCount: 40,
    glowIntensity: 1.2,
    flickerEnabled: true,
    flickerSpeed: 0.08,
  },
  medium: {
    emberCount: 140,
    smokeCount: 20,
    sparkCount: 25,
    glowIntensity: 1.0,
    flickerEnabled: true,
    flickerSpeed: 0.06,
  },
  low: {
    emberCount: 80,
    smokeCount: 10,
    sparkCount: 15,
    glowIntensity: 0.8,
    flickerEnabled: true,
    flickerSpeed: 0.04,
  },
  minimal: {
    emberCount: 40,
    smokeCount: 5,
    sparkCount: 0,
    glowIntensity: 0.6,
    flickerEnabled: false,
    flickerSpeed: 0,
  },
  "ultra-minimal": {
    emberCount: 20,
    smokeCount: 0,
    sparkCount: 0,
    glowIntensity: 0.4,
    flickerEnabled: false,
    flickerSpeed: 0,
  },
};

// ============================================================================
// Smoke Particle Configuration
// ============================================================================

export const SMOKE_CONFIG = {
  /** Size range for smoke particles */
  SIZE_MIN: 8,
  SIZE_RANGE: 12,
  /** Opacity range (low for wispy effect) */
  OPACITY_MIN: 0.08,
  OPACITY_RANGE: 0.12,
  /** Rise speed (slower than embers) */
  SPEED_BASE: 0.1,
  SPEED_RANGE: 0.15,
  /** Horizontal drift */
  DRIFT_AMPLITUDE: 0.2,
  /** Color range (dark grays) */
  COLOR_MIN: 30,
  COLOR_MAX: 60,
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
