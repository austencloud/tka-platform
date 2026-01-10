/**
 * Domain models for Ember Glow background
 */

import type { HeatIntensity, DensityPreset } from "../constants/ember-constants";

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
}

/** Smoke particle - larger, slower, darker */
export interface SmokeParticle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  opacity: number;
  color: { r: number; g: number; b: number };
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
  heatIntensity: HeatIntensity;
  densityPreset: DensityPreset;
}
