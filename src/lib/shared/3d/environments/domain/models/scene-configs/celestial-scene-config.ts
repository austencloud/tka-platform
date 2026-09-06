/** Celestial environment configuration and production defaults. */

import type {
  FallingParticlesConfig,
  SkyCloudConfig,
  SkyGradientConfig,
} from "../environment-models";
import type {
  FogConfig,
  GroundConfig,
  HemisphereLightConfig,
  TreeRingConfig,
} from "./shared-scene-config";

export type CloudDomeConfig = SkyCloudConfig;

export interface CelestialGodRaysConfig {
  enabled: boolean;
  color: string;
  intensity: number;
  count: number;
  speed: number;
}

export interface CloudPlatformConfig {
  enabled: boolean;
  radius: number;
  glowColor: string;
  glowIntensity: number;
  noiseScale: number;
  driftSpeed: number;
}

export interface CloudIslandsConfig {
  enabled: boolean;
  count: number;
  driftSpeed: number;
  bobSpeed: number;
  heightRange: [number, number];
  spawnRadius: number;
  sizeRange: [number, number];
  color: string;
}

export interface CelestialPillarsConfig {
  enabled: boolean;
  rings: TreeRingConfig[];
  clearingRadius: number;
  glowColor: string;
  glowIntensity: number;
  baseColor: string;
  heightRange: [number, number];
}

export interface CelestialSceneConfig {
  sky: SkyGradientConfig;
  fog: FogConfig;
  ground: GroundConfig;

  cloudDome: CloudDomeConfig;
  godRays: CelestialGodRaysConfig;
  cloudPlatform: CloudPlatformConfig;
  cloudIslands: CloudIslandsConfig;
  celestialPillars: CelestialPillarsConfig;

  motes: FallingParticlesConfig;
  wisps: FallingParticlesConfig | null;

  hemisphereLight: HemisphereLightConfig;

  sunLight: {
    enabled: boolean;
    color: string;
    intensity: number;
    position: [number, number, number];
  } | null;
}

const CELESTIAL_PILLAR_RINGS: TreeRingConfig[] = [
  {
    radius: 10,
    count: 5,
    scaleBase: 1.0,
    scaleVariation: 0.3,
    radiusJitter: 1.0,
  },
  {
    radius: 16,
    count: 8,
    scaleBase: 0.7,
    scaleVariation: 0.2,
    radiusJitter: 1.5,
  },
];

export function createDefaultCelestialConfig(): CelestialSceneConfig {
  return {
    sky: {
      topColor: "#6797cf",
      midColor: "#a9c9e7",
      bottomColor: "#f4d6ab",
    },
    fog: { color: "#b7c9d7", density: 0.002 },
    ground: {
      color: "#8d9caf",
      size: 50,
      textured: false,
      opacity: 0.3,
    },
    cloudDome: {
      enabled: true,
      density: 0.58,
      coverage: 0.5,
      driftSpeed: 0.009,
      sunDirection: [0, 0.12, -1],
      litColor: "#fffaf0",
      shadowColor: "#879eb7",
      opacity: 0.4,
    },
    godRays: {
      enabled: false,
      color: "#ffe0a8",
      intensity: 0.17,
      count: 6,
      speed: 0.005,
    },
    cloudPlatform: {
      enabled: false,
      radius: 6,
      glowColor: "#d4a050",
      glowIntensity: 0.6,
      noiseScale: 2.0,
      driftSpeed: 0.015,
    },
    cloudIslands: {
      enabled: false,
      count: 18,
      driftSpeed: 0.1,
      bobSpeed: 0.3,
      heightRange: [-7, -3.5],
      spawnRadius: 15.5,
      sizeRange: [4.2, 7.4],
      color: "#f6f4f0",
    },
    celestialPillars: {
      enabled: false,
      rings: CELESTIAL_PILLAR_RINGS,
      clearingRadius: 10,
      glowColor: "#ffd080",
      glowIntensity: 0.8,
      baseColor: "#e8e0d8",
      heightRange: [2.0, 5.0],
    },
    motes: {
      type: "fireflies",
      count: 24,
      area: { width: 12, height: 6, depth: 12 },
      speed: 0.004,
      colors: ["#f6d7a4", "#ffffff", "#c9def8", "#f0c98d"],
      sizeRange: [0.07, 0.18],
      spin: false,
    },
    wisps: null,
    hemisphereLight: {
      skyColor: "#f2f7ff",
      groundColor: "#725f4d",
      intensity: 1.15,
    },
    sunLight: {
      enabled: true,
      color: "#fff0d4",
      intensity: 3.2,
      position: [-70, 85, 10],
    },
  };
}
