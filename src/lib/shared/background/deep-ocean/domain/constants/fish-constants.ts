/**
 * Fish Behavior & Animation Constants
 *
 * All magic numbers extracted and documented for maintainability.
 * Values are tuned for a calm, ambient deep ocean aesthetic.
 */

// =============================================================================
// DEPTH LAYER CONFIGURATION
// =============================================================================

import type { DepthLayer } from "../models/DeepOceanModels";

/**
 * Depth layer visual properties.
 * Far fish appear smaller/slower (parallax effect simulating distance).
 * Near fish are larger/faster and more prominent.
 */
export const DEPTH_LAYER_CONFIG: Record<
  DepthLayer,
  {
    /** Scale range [min, max] as fraction of sprite size */
    scale: [number, number];
    /** Speed multiplier (1.0 = base speed) */
    speedMultiplier: number;
    /** Opacity range [min, max] */
    opacity: [number, number];
    /** Vertical band as fraction of screen height [min, max] */
    verticalBand: [number, number];
  }
> = {
  far: {
    scale: [0.3, 0.45],
    speedMultiplier: 0.5,
    opacity: [0.6, 0.75],
    verticalBand: [0.1, 0.4], // Upper background
  },
  mid: {
    scale: [0.45, 0.65],
    speedMultiplier: 0.75,
    opacity: [0.85, 0.95],
    verticalBand: [0.25, 0.65], // Middle
  },
  near: {
    scale: [0.65, 0.85],
    speedMultiplier: 1.0,
    opacity: [1.0, 1.0],
    verticalBand: [0.4, 0.85], // Foreground
  },
};

/**
 * Probability distribution for depth layer assignment.
 * More fish in mid layer creates natural depth distribution.
 */
export const DEPTH_LAYER_DISTRIBUTION = {
  /** Probability of far layer (0-25%) */
  farThreshold: 0.25,
  /** Probability of mid layer (25-70%) */
  midThreshold: 0.7,
  // near = remaining (70-100%)
};

// =============================================================================
// MOVEMENT PHYSICS
// =============================================================================

export const FISH_MOVEMENT = {
  /** Base horizontal speed range [min, max] in pixels per second */
  baseSpeed: [10, 22] as const,

  /** Vertical drift range (pixels per second, centered at 0) */
  verticalDrift: 4,

  /** Bobbing animation amplitude range [min, max] in pixels */
  bobAmplitude: [2, 5] as const,

  /** Bobbing animation speed range [min, max] (radians per frame at 60fps) */
  bobSpeed: [0.008, 0.02] as const,

  /** Maximum spawn offset from screen edge (pixels or fraction of width) */
  spawnOffset: { pixels: 140, fractionOfWidth: 0.2 },
};

// =============================================================================
// BEHAVIOR STATE MACHINE
// =============================================================================

export const BEHAVIOR_CONFIG = {
  /**
   * Cruising: Normal swimming state
   * Fish swim in one direction with gentle bob motion
   */
  cruising: {
    /** Duration range [min, max] in seconds before behavior change */
    duration: [8, 20] as const,
  },

  /**
   * Turning: Fish reverses direction
   * Triggered randomly or when approaching screen edge
   */
  turning: {
    /** Fixed duration in seconds */
    duration: 1.5,
    /** Speed multiplier during turn (slows down) */
    speedMultiplier: 0.3,
    /** Maximum rotation angle in radians */
    maxRotation: 0.3,
  },

  /**
   * Darting: Sudden burst of speed (startled reaction)
   * Brief, fast movement in current direction
   */
  darting: {
    /** Fixed duration in seconds */
    duration: 0.8,
    /** Speed multiplier range [min, max] */
    speedMultiplier: [2.5, 4.0] as const,
  },

  /**
   * Schooling: Fish follow group leader
   * Maintains formation while cruising
   */
  schooling: {
    /** Duration range [min, max] in seconds */
    duration: [10, 25] as const,
  },
};

/**
 * Probability of transitioning to each behavior from cruising.
 * Probabilities are checked in order; remaining = continue cruising.
 */
export const BEHAVIOR_TRANSITION_PROBABILITY = {
  /** Chance to initiate a turn (8%) */
  turn: 0.08,
  /** Chance to dart/startle (4%) - checked after turn */
  dart: 0.04,
  // Remaining 88% = continue cruising
};

/**
 * Edge awareness thresholds.
 * Fish are more likely to turn when approaching screen edges.
 */
export const EDGE_AWARENESS = {
  /** Distance from edge (as fraction of screen width) to start considering turn */
  warningZone: 0.15,
  /** Multiplier for turn probability when in warning zone */
  turnProbabilityMultiplier: 5,
};

// =============================================================================
// FLOCKING (SCHOOLING) BEHAVIOR - Boids Algorithm Parameters
// =============================================================================

export const FLOCKING_CONFIG = {
  /**
   * Separation: Steer to avoid crowding nearby fish
   */
  separation: {
    /** Radius within which separation force applies (pixels) */
    radius: 50,
    /** Strength of separation force */
    weight: 1.5,
  },

  /**
   * Alignment: Steer towards average heading of nearby fish
   */
  alignment: {
    /** Radius within which alignment force applies (pixels) */
    radius: 80,
    /** Strength of alignment force */
    weight: 1.0,
  },

  /**
   * Cohesion: Steer towards center of mass of nearby fish
   */
  cohesion: {
    /** Radius within which cohesion force applies (pixels) */
    radius: 100,
    /** Strength of cohesion force */
    weight: 0.8,
  },

  /** Maximum steering force per frame (limits sudden turns) */
  maxSteeringForce: 0.5,

  /** School formation */
  school: {
    /** Target number of fish per school */
    size: [2, 4] as const,
    /** Percentage of fish population to form into schools */
    populationFraction: 0.35,
  },
};

// =============================================================================
// VISUAL PROPERTIES
// =============================================================================

export const FISH_VISUALS = {
  /** Tail wiggle animation speed multiplier (relative to movement speed) */
  tailWiggleSpeed: 0.15,

  /** Maximum tail skew for wiggle effect */
  maxTailSkew: 0.02,

  /** Rotation response to vertical drift (tilt when swimming up/down) */
  driftRotationFactor: 0.02,

  /** Rotation smoothing factor (0-1, lower = smoother) */
  rotationSmoothing: 0.1,
};

// =============================================================================
// SPAWN & LIFECYCLE
// =============================================================================

export const SPAWN_CONFIG = {
  /** Delay range [min, max] in seconds before respawning off-screen fish */
  respawnDelay: [2, 8] as const,

  /** Buffer zone beyond screen edge before fish is considered "off-screen" */
  offScreenBuffer: 100,
};

// =============================================================================
// QUALITY-BASED COUNTS
// =============================================================================

export const FISH_COUNTS: Record<string, number> = {
  minimal: 3,
  low: 5,
  medium: 8,
  high: 12,
};

export const JELLYFISH_COUNTS: Record<string, number> = {
  minimal: 1,
  low: 2,
  medium: 3,
  high: 5,
};
