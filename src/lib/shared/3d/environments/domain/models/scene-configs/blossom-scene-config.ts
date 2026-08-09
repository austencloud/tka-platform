/** Blossom environment configuration and production defaults. */

import type {
  FallingParticlesConfig,
  SkyGradientConfig,
} from "../environment-models";
import type {
  EngawaPlatformConfig,
  FogConfig,
  GroundConfig,
  HemisphereLightConfig,
  TreeRingConfig,
} from "./shared-scene-config";

export interface StoneLanternConfig {
  position: { x: number; z: number };
  scale: number;
  lightColor: string;
  lightIntensity: number;
  lightDistance: number;
}

export interface ToriiGateConfig {
  enabled: boolean;
  position: { x: number; z: number };
  scale: number;
  rotationY: number;
  color: string;
}

export interface HangingLanternDef {
  x: number;
  z: number;
  height: number;
  scale: number;
}

export interface HangingLanternsConfig {
  enabled: boolean;
  bodyColor: string;
  glowColor: string;
  lightIntensity: number;
  lightDistance: number;
  lanterns: HangingLanternDef[];
}

export interface SteppingStoneConfig {
  x: number;
  z: number;
  radius: number;
  rotationY: number;
}

export interface BlossomSceneConfig {
  sky: SkyGradientConfig;
  fog: FogConfig;
  ground: GroundConfig;
  petals: FallingParticlesConfig;
  distantPetals: FallingParticlesConfig | null;
  fireflies: FallingParticlesConfig | null;
  treeRings: TreeRingConfig[];
  clearingRadius: number;
  rockCount: number;
  bushCount: number;
  pond: {
    enabled: boolean;
    position: { x: number; z: number };
    radius: number;
    color: string;
    roughness: number;
  } | null;
  steppingStones: SteppingStoneConfig[];
  lanterns: StoneLanternConfig[];
  toriiGate: ToriiGateConfig;
  hangingLanterns: HangingLanternsConfig;
  hemisphereLight: HemisphereLightConfig;
  moonLight: {
    enabled: boolean;
    color: string;
    intensity: number;
    position: [number, number, number];
  } | null;
  platform: EngawaPlatformConfig;
}

const BLOSSOM_TREE_RINGS: TreeRingConfig[] = [
  {
    radius: 8,
    count: 5,
    scaleBase: 1.5,
    scaleVariation: 0.35,
    radiusJitter: 0.8,
  },
  {
    radius: 13,
    count: 8,
    scaleBase: 1.3,
    scaleVariation: 0.3,
    radiusJitter: 1.2,
  },
  {
    radius: 19,
    count: 12,
    scaleBase: 1.1,
    scaleVariation: 0.25,
    radiusJitter: 1.5,
  },
  {
    radius: 28,
    count: 14,
    scaleBase: 2.0,
    scaleVariation: 0.4,
    radiusJitter: 2.5,
  },
];

export function createDefaultBlossomConfig(): BlossomSceneConfig {
  return {
    sky: {
      topColor: "#0f0a20",
      midColor: "#4a2050",
      bottomColor: "#1a0e18",
    },
    fog: { color: "#18081a", density: 0.02 },
    ground: {
      color: "#201518",
      size: 50,
      textured: false,
      opacity: 1,
    },
    petals: {
      type: "petals",
      count: 120,
      area: { width: 18, height: 5, depth: 18 },
      speed: 0.07,
      colors: ["#ffb7c5", "#ffc0cb", "#ff69b4", "#fff0f5"],
      sizeRange: [0.04, 0.11],
      spin: true,
    },
    distantPetals: {
      type: "petals",
      count: 60,
      area: { width: 40, height: 8, depth: 40 },
      speed: 0.035,
      colors: ["#e8a0b0", "#d090a0", "#c08090", "#f0c0d0"],
      sizeRange: [0.02, 0.05],
      spin: true,
    },
    fireflies: {
      type: "fireflies",
      count: 20,
      area: { width: 10, height: 3, depth: 10 },
      speed: 0.004,
      colors: ["#ffddaa"],
      sizeRange: [0.15, 0.28],
      spin: false,
    },
    treeRings: BLOSSOM_TREE_RINGS,
    clearingRadius: 7,
    rockCount: 0,
    bushCount: 0,
    pond: {
      enabled: true,
      position: { x: -5, z: 4 },
      radius: 3.5,
      color: "#d4a0b8",
      roughness: 0.1,
    },
    steppingStones: [
      { x: -1.5, z: 1.0, radius: 0.2, rotationY: 0.3 },
      { x: -2.2, z: 1.8, radius: 0.22, rotationY: -0.2 },
      { x: -2.8, z: 2.7, radius: 0.18, rotationY: 0.5 },
      { x: -3.5, z: 3.3, radius: 0.2, rotationY: -0.1 },
      { x: -4.2, z: 3.8, radius: 0.19, rotationY: 0.4 },
    ],
    lanterns: [
      {
        position: { x: 4, z: 5 },
        scale: 0.9,
        lightColor: "#ffaa66",
        lightIntensity: 10,
        lightDistance: 8,
      },
      {
        position: { x: -4, z: -5 },
        scale: 0.85,
        lightColor: "#ffaa66",
        lightIntensity: 10,
        lightDistance: 8,
      },
    ],
    toriiGate: {
      enabled: false,
      position: { x: 0, z: -8 },
      scale: 1.0,
      rotationY: 0,
      color: "#aa2222",
    },
    hangingLanterns: {
      enabled: false,
      bodyColor: "#cc4444",
      glowColor: "#ffaa44",
      lightIntensity: 6,
      lightDistance: 5,
      lanterns: [],
    },
    hemisphereLight: {
      skyColor: "#d0a0c0",
      groundColor: "#150a10",
      intensity: 0.7,
    },
    moonLight: {
      enabled: true,
      color: "#c0b0e0",
      intensity: 0.5,
      position: [-15, 20, 10],
    },
    platform: {
      enabled: true,
      radius: 5,
      height: 0.35,
      primaryColor: "#c4915a",
      glowIntensity: 0.3,
    },
  };
}
