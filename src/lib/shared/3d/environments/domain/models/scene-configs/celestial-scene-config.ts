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
      topColor: "#5f7fb4",
      midColor: "#a9c3e2",
      bottomColor: "#b7c3d3",
    },
    fog: { color: "#8696ae", density: 0.017 },
    ground: {
      color: "#8d9caf",
      size: 50,
      textured: false,
      opacity: 0.3,
    },
    cloudDome: {
      enabled: true,
      density: 0.7,
      coverage: 0.46,
      driftSpeed: 0.012,
      sunDirection: [0.1, 0.55, -1],
      litColor: "#fffaf0",
      shadowColor: "#70829f",
      opacity: 0.52,
    },
    godRays: {
      enabled: true,
      color: "#ffe0a8",
      intensity: 0.13,
      count: 5,
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
      enabled: true,
      count: 16,
      driftSpeed: 0.1,
      bobSpeed: 0.3,
      heightRange: [0.2, 1.8],
      spawnRadius: 10.8,
      sizeRange: [2.8, 5.4],
      color: "#eaf1fa",
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
      count: 34,
      area: { width: 12, height: 6, depth: 12 },
      speed: 0.004,
      colors: ["#f6d7a4", "#ffffff", "#c9def8", "#f0c98d"],
      sizeRange: [0.07, 0.18],
      spin: false,
    },
    wisps: null,
    hemisphereLight: {
      skyColor: "#e8f2ff",
      groundColor: "#526984",
      intensity: 1.1,
    },
    sunLight: {
      enabled: true,
      color: "#ffe1ad",
      intensity: 3.2,
      position: [-4, 16, -14],
    },
  };
}
