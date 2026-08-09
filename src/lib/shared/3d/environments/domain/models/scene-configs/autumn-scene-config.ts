/** Standalone autumn environment configuration and production defaults. */

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

export interface AutumnStreamConfig {
  enabled: boolean;
  color: string;
  width: number;
}

export interface AutumnMushroomConfig {
  enabled: boolean;
  count: number;
  ringRadius: number;
  capColors: string[];
  stemColor: string;
  glowColor: string;
  glowIntensity: number;
}

export interface AutumnMistConfig {
  enabled: boolean;
  count: number;
  area: number;
  color: string;
  opacity: number;
  speed: number;
}

export interface AutumnSceneConfig {
  sky: SkyGradientConfig;
  fog: FogConfig;
  ground: GroundConfig;
  leaves: FallingParticlesConfig;
  distantLeaves: FallingParticlesConfig | null;
  treeRings: TreeRingConfig[];
  clearingRadius: number;
  stream: AutumnStreamConfig;
  mushrooms: AutumnMushroomConfig;
  mist: AutumnMistConfig;
  sunLight: {
    enabled: boolean;
    color: string;
    intensity: number;
    position: [number, number, number];
  } | null;
  hemisphereLight: HemisphereLightConfig;
}

const AUTUMN_TREE_RINGS: TreeRingConfig[] = [
  {
    radius: 10,
    count: 8,
    scaleBase: 1.2,
    scaleVariation: 0.3,
    radiusJitter: 1.0,
  },
  {
    radius: 14,
    count: 14,
    scaleBase: 1.0,
    scaleVariation: 0.25,
    radiusJitter: 1.5,
  },
  {
    radius: 18,
    count: 20,
    scaleBase: 0.85,
    scaleVariation: 0.2,
    radiusJitter: 1.75,
  },
  {
    radius: 23,
    count: 28,
    scaleBase: 0.7,
    scaleVariation: 0.2,
    radiusJitter: 2.0,
  },
];

export function createDefaultAutumnConfig(): AutumnSceneConfig {
  return {
    sky: {
      topColor: "#1a0f30",
      midColor: "#c45a2a",
      bottomColor: "#d4903a",
    },
    fog: { color: "#1a1008", density: 0.022 },
    ground: {
      color: "#2a1f15",
      size: 50,
      textured: false,
    },
    leaves: {
      type: "leaves",
      count: 300,
      area: { width: 30, height: 6, depth: 30 },
      speed: 0.1,
      colors: ["#d4a030", "#d97706", "#c2410c", "#b91c1c", "#92400e"],
      sizeRange: [0.1, 0.25],
      spin: true,
    },
    distantLeaves: {
      type: "leaves",
      count: 120,
      area: { width: 50, height: 8, depth: 50 },
      speed: 0.06,
      colors: ["#d4a030", "#d97706", "#c2410c", "#7c2d12"],
      sizeRange: [0.05, 0.12],
      spin: true,
    },
    treeRings: AUTUMN_TREE_RINGS,
    clearingRadius: 10,
    stream: {
      enabled: true,
      color: "#1a3a4a",
      width: 1.8,
    },
    mushrooms: {
      enabled: true,
      count: 8,
      ringRadius: 7,
      capColors: ["#b5651d", "#8b4513", "#cd853f", "#a0522d"],
      stemColor: "#e8dcc8",
      glowColor: "#d4a040",
      glowIntensity: 0.15,
    },
    mist: {
      enabled: true,
      count: 25,
      area: 30,
      color: "#c8b8a0",
      opacity: 0.06,
      speed: 0.15,
    },
    sunLight: {
      enabled: true,
      color: "#ffb060",
      intensity: 0.8,
      position: [-20, 8, -15],
    },
    hemisphereLight: {
      skyColor: "#ff9944",
      groundColor: "#331a08",
      intensity: 0.5,
    },
  };
}
