/** Celestial environment configuration and production defaults. */

import type {
  FallingParticlesConfig,
  SkyGradientConfig,
} from "../environment-models";
import type {
  FogConfig,
  GroundConfig,
  HemisphereLightConfig,
  TreeRingConfig,
} from "./shared-scene-config";

export interface CloudDomeConfig {
  enabled: boolean;
  density: number;
  coverage: number;
  driftSpeed: number;
  sunDirection: [number, number, number];
  litColor: string;
  shadowColor: string;
  opacity: number;
}

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
      topColor: "#0a1a4a",
      midColor: "#b89050",
      bottomColor: "#e8dcc8",
    },
    fog: { color: "#c8bca8", density: 0.012 },
    ground: {
      color: "#e8dcc8",
      size: 50,
      textured: false,
      opacity: 0.3,
    },
    cloudDome: {
      enabled: true,
      density: 0.6,
      coverage: 0.4,
      driftSpeed: 0.02,
      sunDirection: [0.5, 0.8, 0.3],
      litColor: "#ffffff",
      shadowColor: "#8090c0",
      opacity: 0.85,
    },
    godRays: {
      enabled: true,
      color: "#ffcc66",
      intensity: 0.35,
      count: 5,
      speed: 0.008,
    },
    cloudPlatform: {
      enabled: true,
      radius: 6,
      glowColor: "#d4a050",
      glowIntensity: 0.6,
      noiseScale: 2.0,
      driftSpeed: 0.015,
    },
    cloudIslands: {
      enabled: true,
      count: 5,
      driftSpeed: 0.1,
      bobSpeed: 0.3,
      heightRange: [4, 12],
      spawnRadius: 15,
      sizeRange: [1.5, 3.5],
      color: "#f0e8e0",
    },
    celestialPillars: {
      enabled: true,
      rings: CELESTIAL_PILLAR_RINGS,
      clearingRadius: 10,
      glowColor: "#ffd080",
      glowIntensity: 0.8,
      baseColor: "#e8e0d8",
      heightRange: [2.0, 5.0],
    },
    motes: {
      type: "fireflies",
      count: 60,
      area: { width: 12, height: 6, depth: 12 },
      speed: 0.008,
      colors: ["#ffd080", "#ffffff", "#d0e8ff", "#ffe0a0"],
      sizeRange: [0.1, 0.25],
      spin: false,
    },
    wisps: {
      type: "smoke",
      count: 50,
      area: { width: 15, height: 2, depth: 15 },
      speed: 0.015,
      colors: ["#ffffff", "#f0e8d8", "#e0d8c8", "#d8d0c0"],
      sizeRange: [0.2, 0.6],
      spin: false,
    },
    hemisphereLight: {
      skyColor: "#ffe0a0",
      groundColor: "#8090c0",
      intensity: 0.9,
    },
    sunLight: {
      enabled: true,
      color: "#ffd080",
      intensity: 1.2,
      position: [-10, 25, 15],
    },
  };
}
