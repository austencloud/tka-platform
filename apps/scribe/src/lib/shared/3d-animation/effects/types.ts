/**
 * Effect Types for 3D Animation
 *
 * Shared type definitions for all visual effects (trails, particles, etc.)
 */

import type { Vector3 } from "three";

// =============================================================================
// Trail Point & History
// =============================================================================

/**
 * A single point in the position history trail
 */
export interface TrailPoint {
  /** World position at this point */
  position: Vector3;
  /** Timestamp when this position was recorded (ms) */
  timestamp: number;
  /** Velocity magnitude at this point (units per second) */
  velocity: number;
}

/**
 * Position history for a single prop
 */
export interface PropPositionHistory {
  /** Recent trail points, newest first */
  points: TrailPoint[];
  /** Current velocity magnitude */
  currentVelocity: number;
}

// =============================================================================
// Base Effect Configuration
// =============================================================================

/**
 * Base configuration shared by all effects
 */
export interface EffectConfig {
  /** Whether the effect is enabled */
  enabled: boolean;
  /** Effect intensity (0-1) */
  intensity: number;
}

// =============================================================================
// Trail Effect Configuration
// =============================================================================

/**
 * Which prop end(s) to track for trails
 */
export enum TrackingMode {
  LEFT_END = "left_end", // Track only left end (base)
  RIGHT_END = "right_end", // Track only right end (tip)
  BOTH_ENDS = "both_ends", // Track both ends
}

/**
 * Trail rendering style
 */
export enum TrailStyle {
  RIBBON = "ribbon", // Physics-based ribbon (default)
  TUBE = "tube", // Simple tube geometry (legacy)
}

/**
 * Configuration for trail/ribbon effects
 */
export interface TrailConfig extends EffectConfig {
  /** Number of ribbon segments */
  length: number;
  /** Trail/ribbon width in world units */
  width: number;
  /** Trail color - hex color or 'rainbow' for HSL cycling */
  color: string;
  /** Whether trail should fade out towards the end */
  fadeOut: boolean;
  /** Opacity of the trail (0-1) */
  opacity: number;
  /** Which end(s) to track */
  trackingMode: TrackingMode;
  /** Rendering style */
  style: TrailStyle;
  /** Gravity strength for physics ribbon */
  gravity: number;
  /** Air drag for physics ribbon (0-1) */
  drag: number;
}

/**
 * Default trail configuration
 */
export const DEFAULT_TRAIL_CONFIG: TrailConfig = {
  enabled: false,
  intensity: 1,
  length: 12, // Ribbon segments
  width: 3, // Appropriate for 3D scene scale
  color: "rainbow",
  fadeOut: true,
  opacity: 0.85,
  trackingMode: TrackingMode.BOTH_ENDS,
  style: TrailStyle.RIBBON,
  gravity: 50,
  drag: 0.03,
};

// =============================================================================
// Particle Effect Configuration
// =============================================================================

/**
 * Configuration for particle emission effects
 */
export interface ParticleConfig extends EffectConfig {
  /** Particles spawned per second */
  spawnRate: number;
  /** Particle lifetime in seconds */
  lifetime: number;
  /** Base particle size in world units */
  size: number;
  /** Particle color - hex color or 'prop' to match prop color */
  color: string;
  /** Whether particles should emit based on velocity */
  velocityBased: boolean;
  /** Minimum velocity to emit particles (if velocityBased) */
  velocityThreshold: number;
}

/**
 * Default particle configuration
 */
export const DEFAULT_PARTICLE_CONFIG: ParticleConfig = {
  enabled: false,
  intensity: 1,
  spawnRate: 30,
  lifetime: 1,
  size: 0.02,
  color: "prop",
  velocityBased: true,
  velocityThreshold: 0.5,
};

// =============================================================================
// Glow Effect Configuration
// =============================================================================

/**
 * Configuration for glow/bloom effects on props
 */
export interface GlowConfig extends EffectConfig {
  /** Glow radius in world units */
  radius: number;
  /** Glow color - hex color or 'prop' to match prop color */
  color: string;
  /** Whether glow pulses with velocity */
  pulsesWithVelocity: boolean;
}

/**
 * Default glow configuration
 */
export const DEFAULT_GLOW_CONFIG: GlowConfig = {
  enabled: false,
  intensity: 0.5,
  radius: 0.1,
  color: "prop",
  pulsesWithVelocity: true,
};

// =============================================================================
// Fire Effect Configuration
// =============================================================================

/**
 * Configuration for fire/flame effects
 */
export interface FireConfig extends EffectConfig {
  /** Flame height in world units */
  height: number;
  /** Flame spread angle in radians */
  spread: number;
  /** Inner color (hottest part) */
  innerColor: string;
  /** Outer color (cooler part) */
  outerColor: string;
  /** Whether flames react to velocity */
  velocityReactive: boolean;
}

/**
 * Default fire configuration
 */
export const DEFAULT_FIRE_CONFIG: FireConfig = {
  enabled: false,
  intensity: 1,
  height: 0.3,
  spread: Math.PI / 6,
  innerColor: "#ffffff",
  outerColor: "#ff4400",
  velocityReactive: true,
};

// =============================================================================
// Sparkle Effect Configuration
// =============================================================================

/**
 * Configuration for sparkle/star effects
 */
export interface SparkleConfig extends EffectConfig {
  /** Sparkles per second */
  rate: number;
  /** Sparkle size in world units */
  size: number;
  /** Sparkle lifetime in seconds */
  lifetime: number;
  /** Sparkle color */
  color: string;
}

/**
 * Default sparkle configuration
 */
export const DEFAULT_SPARKLE_CONFIG: SparkleConfig = {
  enabled: false,
  intensity: 1,
  rate: 20,
  size: 0.03,
  lifetime: 0.5,
  color: "#ffffff",
};

// =============================================================================
// Electricity Effect Configuration
// =============================================================================

/**
 * Configuration for electricity/lightning effects
 */
export interface ElectricityConfig extends EffectConfig {
  /** Arc length in world units */
  arcLength: number;
  /** Number of arc segments */
  segments: number;
  /** Arc color */
  color: string;
  /** Arcs per second */
  frequency: number;
}

/**
 * Default electricity configuration
 */
export const DEFAULT_ELECTRICITY_CONFIG: ElectricityConfig = {
  enabled: false,
  intensity: 1,
  arcLength: 0.2,
  segments: 5,
  color: "#88ccff",
  frequency: 10,
};

// =============================================================================
// Combined Effects State
// =============================================================================

/**
 * All effect configurations for a prop
 */
export interface AllEffectConfigs {
  trail: TrailConfig;
  particles: ParticleConfig;
  glow: GlowConfig;
  fire: FireConfig;
  sparkle: SparkleConfig;
  electricity: ElectricityConfig;
}

/**
 * Default configuration for all effects
 */
export const DEFAULT_ALL_EFFECTS: AllEffectConfigs = {
  trail: DEFAULT_TRAIL_CONFIG,
  particles: DEFAULT_PARTICLE_CONFIG,
  glow: DEFAULT_GLOW_CONFIG,
  fire: DEFAULT_FIRE_CONFIG,
  sparkle: DEFAULT_SPARKLE_CONFIG,
  electricity: DEFAULT_ELECTRICITY_CONFIG,
};

// =============================================================================
// Prop Identifier
// =============================================================================

/**
 * Prop identifier for effects
 */
export type PropId = "blue" | "red";
