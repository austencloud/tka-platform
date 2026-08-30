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
 * A directional glow banked along the horizon — a distant caldera, a city, a
 * fire beyond the ridge. Omitted, the sky dome renders exactly as before.
 */
export interface SkyHorizonGlowConfig {
  color: string;
  /** World direction the glow is centred on. Only its horizontal part is used. */
  direction: [number, number, number];
  /** Reach above the horizon, as a fraction of the way to the zenith. */
  height?: number;
  /** 1 wraps the whole horizon; 0 concentrates the glow on `direction`. */
  spread?: number;
  /** Zero disables the band. */
  intensity?: number;
}

/**
 * Sky gradient configuration
 */
export interface SkyGradientConfig {
  topColor: string;
  bottomColor: string;
  midColor?: string;
  radius?: number;
  horizonGlow?: SkyHorizonGlowConfig;
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

/** A camera-centred cloud field lit from the same direction as the sky Sun. */
export interface SkyCloudConfig {
  enabled: boolean;
  /** Visible cloud fraction from 0 (clear) to 1 (overcast). */
  coverage: number;
  /** Internal body and edge definition. */
  density: number;
  /** Sky-relative drift speed. */
  driftSpeed: number;
  sunDirection: [number, number, number];
  litColor: string;
  shadowColor: string;
  opacity: number;
  /** Size of the dominant cloud cells. Higher values create smaller forms. */
  scale?: number;
  /** Stable sky-space UV phase used to compose clouds around authored cameras. */
  offset?: [number, number];
  /** Existing visual system used to author the cloud layer. */
  visualSource?: "procedural" | "celestial-2d";
  /** Lowest sky latitude at which the field becomes visible. */
  horizonFade?: number;
  /** Keeps the cloud ceiling from becoming a solid cap above the camera. */
  zenithFade?: number;
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
