/**
 * Domain models for Ember Glow background
 */

import type { HeatIntensity, DensityPreset } from "../constants/ember-constants";

// ============================================================================
// Coal Bed (A+ Enhancement)
// ============================================================================

/** Glowing coal in the coal bed */
export interface Coal {
  x: number;
  y: number;
  size: number;
  glowRadius: number;
  pulsePhase: number; // Offset so coals don't sync
  pulseSpeed: number;
  baseIntensity: number; // 0.5-1.0
  currentIntensity: number;
  isFlaring: boolean; // Random flare hotspot
  flareTimer: number;
  color: { r: number; g: number; b: number };
}

// ============================================================================
// Ember Types (A+ Enhancement)
// ============================================================================

export type EmberType = "normal" | "spiral" | "micro" | "lazy";

/** Rising ember particle */
export interface Ember {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  opacity: number;
  glowRadius: number;
  flickerOffset: number;
  color: { r: number; g: number; b: number };
  // A+ enhancements
  emberType: EmberType;
  angularVelocity?: number; // For spiral embers
  spiralRadius?: number; // For spiral embers
  spiralPhase?: number; // For spiral embers
  isPhoenix?: boolean; // Easter egg - rare special ember
}

/** Smoke particle - larger, slower, darker, with billowing behavior */
export interface SmokeParticle {
  x: number;
  y: number;
  size: number;
  baseSize: number; // Original size at spawn (for expansion calc)
  vx: number;
  vy: number;
  opacity: number;
  baseOpacity: number; // Original opacity (for fade calc)
  color: { r: number; g: number; b: number };
  // Billowing effect
  driftOffset: number; // Offset for sine wave drift
  driftFrequency: number; // How fast it drifts back and forth
  spawnY: number; // Where it spawned (for altitude-based expansion)
}

/** Trail point for spark trails */
export interface SparkTrailPoint {
  x: number;
  y: number;
  opacity: number;
}

/** Spark particle - small, fast, bright, short-lived */
export interface SparkParticle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  opacity: number;
  lifetime: number;
  maxLifetime: number;
  color: { r: number; g: number; b: number };
  trail: SparkTrailPoint[];
}

/** Layer visibility toggles */
export interface EmberGlowLayers {
  gradient: boolean;
  coalBed: boolean; // A+ - glowing heat source
  smoke: boolean;
  embers: boolean;
  sparks: boolean;
  // Enhancement layers
  vignette: boolean;
  bottomGlow: boolean;
  sparkTrails: boolean;
  breathing: boolean;
}

/** Stats for lab display */
export interface EmberGlowStats {
  embers: number;
  smoke: number;
  sparks: number;
  coals: number; // A+ - coal bed count
  heatIntensity: HeatIntensity;
  densityPreset: DensityPreset;
}
