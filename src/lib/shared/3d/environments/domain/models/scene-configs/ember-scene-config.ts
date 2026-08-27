/** Ember environment configuration and production defaults. */

import type {
  FallingParticlesConfig,
  SkyGradientConfig,
} from "../environment-models";
import type {
  CampfireConfig,
  FogConfig,
  GroundConfig,
  HemisphereLightConfig,
  ObsidianPlatformConfig,
  TreeRingConfig,
} from "./shared-scene-config";
import volcanicWorldR6 from "./ember-volcanic-world-r6.json";

export interface LavaPoolConfig {
  enabled: boolean;
  position: { x: number; z: number };
  radius: number;
  baseColor: string;
  hotColor: string;
  crustColor: string;
  flowSpeed: number;
  lightIntensity: number;
  lightDistance: number;
  pulseSpeed: number;
  warpIntensity: number;
  craterDepth?: number;
  craterWallColor?: string;
}

export interface LavaCracksConfig {
  enabled: boolean;
  crackColor: string;
  intensity: number;
  speed: number;
  scale: number;
  pulseSpeed: number;
  pulseIntensity: number;
}

export interface LavaRiverChannelConfig {
  angle?: number;
  length?: number;
  curvature?: number;
  widthScale: number;
  /** Runtime X, Z, and height above the performer ground plane. */
  points?: [number, number, number][];
}

export interface LavaRiversConfig {
  enabled: boolean;
  channels: LavaRiverChannelConfig[];
  baseColor: string;
  hotColor: string;
  crustColor: string;
  flowSpeed: number;
  width: number;
  warpIntensity: number;
  crustCoverage: number;
}

/**
 * A corridor the ring generator must leave empty, in the pillar group's own
 * local XZ space. `points` is a polyline; anything whose centre lands within
 * `radius` of it is dropped.
 */
export interface PillarKeepOut {
  points: [number, number][];
  radius: number;
}

export interface ObsidianPillarsConfig {
  enabled: boolean;
  rings: TreeRingConfig[];
  clearingRadius: number;
  /**
   * Optional. The rings are laid out by angle alone, so in a scene where people
   * walk THROUGH the ring rather than standing inside it, whole pillars land in
   * the walkway. Listing the walked route here punches a gate in the ring
   * instead. Omit it and placement is unchanged.
   */
  keepOut?: PillarKeepOut[];
  veinColor: string;
  veinIntensity: number;
  baseColor: string;
  heightRange: [number, number];
  pulseSpeed: number;
  pulseColor: string;
}

export interface FireWispsConfig {
  enabled: boolean;
  count: number;
  spawnRadius: number;
  heightRange: [number, number];
  driftSpeed: number;
  pulseSpeed: number;
  colors: string[];
  lightIntensity: number;
  lightDistance: number;
}

export interface EmberFountainsConfig {
  enabled: boolean;
  count: number;
  riseSpeed: number;
  colors: string[];
  sizeRange: [number, number];
  spawnRadius: number;
  maxHeight: number;
  gravity: number;
  burstInterval: number;
  burstCount: number;
}

export interface VolcanicHazeConfig {
  enabled: boolean;
  color1: string;
  color2: string;
  opacity: number;
  scale: number;
  animationSpeed: number;
  lightningInterval: number;
  lightningIntensity: number;
  innerGlowColor: string;
  radius: number;
}

export interface EmberSceneConfig {
  sky: SkyGradientConfig;
  fog: FogConfig;
  ground: GroundConfig;

  lavaCracks: LavaCracksConfig;
  lavaPool: LavaPoolConfig;
  lavaRivers: LavaRiversConfig | null;
  obsidianPillars: ObsidianPillarsConfig;

  fireVent: CampfireConfig | null;
  fireWisps: FireWispsConfig | null;
  emberFountains: EmberFountainsConfig | null;
  volcanicHaze: VolcanicHazeConfig | null;

  embers: FallingParticlesConfig;
  ash: FallingParticlesConfig | null;
  smoke: FallingParticlesConfig | null;
  cinders: FallingParticlesConfig | null;

  rockCount: number;
  clearingRadius: number;
  rockTintColor: string;
  rockTintBlend: number;

  hemisphereLight: HemisphereLightConfig;

  skyLight: {
    enabled: boolean;
    color: string;
    intensity: number;
    position: [number, number, number];
  } | null;
  platform: ObsidianPlatformConfig;
}

const EMBER_PILLAR_RINGS: TreeRingConfig[] = [
  {
    radius: 8,
    count: 5,
    scaleBase: 1.2,
    scaleVariation: 0.3,
    radiusJitter: 0.8,
  },
  {
    radius: 14,
    count: 8,
    scaleBase: 0.9,
    scaleVariation: 0.25,
    radiusJitter: 1.2,
  },
];

export function createDefaultEmberConfig(): EmberSceneConfig {
  return {
    sky: {
      topColor: "#080a0c",
      midColor: "#172126",
      bottomColor: "#594039",
    },
    fog: { color: "#1d292b", density: 0.006 },
    ground: {
      color: "#151a19",
      size: 380,
      textured: false,
      opacity: 1,
    },
    lavaCracks: {
      enabled: false,
      crackColor: "#ff4400",
      intensity: 0.09,
      speed: 0.015,
      scale: 4.8,
      pulseSpeed: 0.4,
      pulseIntensity: 0.24,
    },
    lavaPool: {
      enabled: false,
      position: { x: -5, z: 4.5 },
      radius: 5.0,
      baseColor: "#cc2200",
      hotColor: "#ff6600",
      crustColor: "#3a1208",
      flowSpeed: 0.08,
      lightIntensity: 50,
      lightDistance: 22,
      pulseSpeed: 0.3,
      warpIntensity: 4.0,
      craterDepth: 0.6,
      craterWallColor: "#1a0806",
    },
    lavaRivers: {
      enabled: true,
      channels: [
        {
          widthScale: 1,
          points: volcanicWorldR6.lavaRiver.pointsRuntimeXZHeight.map(
            ([x, z, height]) => [x, z, height]
          ) as [number, number, number][],
        },
      ],
      baseColor: "#cf2b08",
      hotColor: "#ffb13b",
      crustColor: "#170f0d",
      flowSpeed: volcanicWorldR6.lavaRiver.flowSpeed,
      width: volcanicWorldR6.lavaRiver.width,
      warpIntensity: volcanicWorldR6.lavaRiver.warpIntensity,
      crustCoverage: volcanicWorldR6.lavaRiver.crustCoverage,
    },
    obsidianPillars: {
      enabled: false,
      rings: EMBER_PILLAR_RINGS,
      clearingRadius: 8,
      veinColor: "#ff4400",
      veinIntensity: 0.6,
      baseColor: "#0a0808",
      heightRange: [2.0, 6.0],
      pulseSpeed: 0.8,
      pulseColor: "#ff6600",
    },
    fireVent: null,
    fireWisps: {
      enabled: false,
      count: 2,
      spawnRadius: 7,
      heightRange: [1.5, 4.5],
      driftSpeed: 0.25,
      pulseSpeed: 0.8,
      colors: ["#ff6600", "#ff4400", "#ffaa00"],
      lightIntensity: 6,
      lightDistance: 6,
    },
    emberFountains: {
      enabled: false,
      count: 40,
      riseSpeed: 0.6,
      colors: ["#ff4400", "#ff6600", "#ffaa00", "#ff2200"],
      sizeRange: [0.03, 0.08],
      spawnRadius: 3,
      maxHeight: 8,
      gravity: 0.3,
      burstInterval: 3.5,
      burstCount: 12,
    },
    volcanicHaze: {
      enabled: true,
      color1: "#33474a",
      color2: "#100d0d",
      opacity: 0.052,
      scale: 2.6,
      animationSpeed: 0.014,
      lightningInterval: 6.0,
      lightningIntensity: 0.12,
      innerGlowColor: "#ff5418",
      radius: 260,
    },
    embers: {
      type: "embers",
      count: 72,
      area: { width: 20, height: 6, depth: 20 },
      speed: 0.12,
      colors: ["#ff6b35", "#ff8c42", "#ffc145", "#ff4500", "#ff2200"],
      sizeRange: [0.012, 0.045],
      spin: false,
    },
    ash: {
      type: "dust",
      count: 90,
      area: { width: 25, height: 8, depth: 25 },
      speed: 0.04,
      colors: ["#46515e", "#303b48", "#56616c", "#202b38"],
      sizeRange: [0.012, 0.045],
      spin: false,
    },
    smoke: {
      type: "smoke",
      count: 14,
      area: { width: 18, height: 6, depth: 18 },
      speed: 0.022,
      colors: ["#101820", "#0a1018", "#070b10", "#17222b"],
      sizeRange: [0.06, 0.18],
      spin: false,
    },
    cinders: null,
    rockCount: 0,
    clearingRadius: 10,
    rockTintColor: "#1a0a08",
    rockTintBlend: 0.4,
    hemisphereLight: {
      skyColor: "#b8c4c0",
      groundColor: "#2b1c18",
      intensity: 1.05,
    },
    skyLight: {
      enabled: true,
      color: "#e3ddd1",
      intensity: 1.65,
      position: [-10, 18, -6],
    },
    platform: {
      enabled: false,
      radius: 4.5,
      height: 0.5,
      primaryColor: "#1a1a1a",
      glowIntensity: 0.8,
      crackIntensity: 1.0,
      lavaSpeed: 0.5,
    },
  };
}
