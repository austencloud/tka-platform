/**
 * Environment Models
 *
 * Configuration interfaces for 3D environments and primitives.
 * Note: Environment selection now uses BackgroundType from settingsService
 * instead of a separate EnvironmentType. These interfaces are for
 * configuring individual scene primitives.
 */

import type { ForestVariant, CosmicVariant } from "../enums/environment-enums";

/**
 * Ground plane configuration
 */
export interface GroundPlaneConfig {
  color: string;
  opacity: number;
  size: number;
  segments?: number;
  position?: [number, number, number];
}

/**
 * Sky gradient configuration
 */
export interface SkyGradientConfig {
  topColor: string;
  bottomColor: string;
  midColor?: string;
  radius?: number;
}

/** A camera-centred solar disk rendered by the shared sky dome. */
export interface SkySunConfig {
  enabled: boolean;
  /** Direction from the viewer toward the Sun. */
  direction: [number, number, number];
  /** Apparent diameter in degrees. The real Sun is roughly 0.53 degrees. */
  angularDiameterDegrees?: number;
  color?: string;
  opacity?: number;
  /** Halo radius as a multiple of the disk radius. */
  glowScale?: number;
  glowOpacity?: number;
}

/**
 * Particle type for FallingParticles
 */
export type ParticleType =
  | "leaves"
  | "snow"
  | "petals"
  | "embers"
  | "stars"
  | "bubbles"
  | "fireflies"
  | "dust"
  | "smoke"
  | "steam";

/**
 * Falling particles configuration
 */
export interface FallingParticlesConfig {
  type: ParticleType;
  count: number;
  area: { width: number; height: number; depth: number };
  speed: number;
  colors: string[];
  sizeRange: [number, number];
  spin?: boolean;
}

/**
 * Forest scene configuration
 */
export interface ForestSceneConfig {
  variant: ForestVariant;
  ground: GroundPlaneConfig;
  sky: SkyGradientConfig;
  particles: FallingParticlesConfig;
}

/**
 * Cosmic scene configuration
 */
export interface CosmicSceneConfig {
  variant: CosmicVariant;
  sky: SkyGradientConfig;
  particles: FallingParticlesConfig;
}
