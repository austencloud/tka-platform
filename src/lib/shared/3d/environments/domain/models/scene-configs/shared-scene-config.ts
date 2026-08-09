/** Configuration shapes shared by more than one environment scene. */

export interface FogConfig {
  color: string;
  /** Fog density (ExpExp2). Typical range 0.01-0.05. */
  density: number;
}

export interface TreeRingConfig {
  /** Ring radius in meters. */
  radius: number;
  /** How many trees in this ring. */
  count: number;
  /** Base scale multiplier for trees in this ring. */
  scaleBase: number;
  /** Random scale variation added per tree. */
  scaleVariation: number;
  /** Random radial offset per tree (meters). */
  radiusJitter: number;
}

export interface HemisphereLightConfig {
  skyColor: string;
  groundColor: string;
  intensity: number;
}

export interface PointLightConfig {
  color: string;
  intensity: number;
  /** Light falloff distance (meters). */
  distance: number;
  decay: number;
  /** Height above ground (meters). */
  heightOffset: number;
}

export interface CampfireConfig {
  enabled: boolean;
  position: { x: number; z: number };
  /** Scale of the campfire pit model. */
  modelScale: number;
  /** Scale of the volumetric fire. */
  fireScale: number;
  /** Base height of the fire geometry before scaling (meters). */
  fireHeight: number;
  primaryLight: PointLightConfig;
  fillLight: PointLightConfig;
  smokeColors: string[];
  smokeCount: number;
}

export interface GroundConfig {
  color: string;
  /** Plane radius (meters). */
  size: number;
  /** If true, render as a textured PBR plane. */
  textured: boolean;
  diffuseMap?: string;
  normalMap?: string;
  roughnessMap?: string;
  normalScale?: number;
  textureRepeat?: number;
  opacity?: number;
}

// ============================================================================
// Per-scene platform configs
// ============================================================================

export interface IcePlatformConfig {
  enabled: boolean;
  radius: number;
  height: number;
  primaryColor: string;
  glowIntensity: number;
  frostDensity: number;
}

export interface RuinsPlatformConfig {
  enabled: boolean;
  width: number;
  depth: number;
  height: number;
  elevation?: number;
  stoneColor: string;
  runeGlowColor: string;
  glowIntensity: number;
  mossIntensity: number;
  columnCount: number;
  zOffset?: number;
}

export interface ObsidianPlatformConfig {
  enabled: boolean;
  radius: number;
  height: number;
  primaryColor: string;
  glowIntensity: number;
  crackIntensity: number;
  lavaSpeed: number;
}

export interface EngawaPlatformConfig {
  enabled: boolean;
  radius: number;
  height: number;
  primaryColor: string;
  glowIntensity: number;
}

export interface PrismPlatformConfig {
  enabled: boolean;
  radius: number;
  height: number;
  glowIntensity: number;
  spectrumSpeed: number;
}

export interface VoidPlatformConfig {
  enabled: boolean;
  radius: number;
  height: number;
  gridColor: string;
  glowIntensity: number;
  gridDensity: number;
}
