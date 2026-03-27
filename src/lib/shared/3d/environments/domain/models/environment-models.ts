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
  | "smoke";

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
