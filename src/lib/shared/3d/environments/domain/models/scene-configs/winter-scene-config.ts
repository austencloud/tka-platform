/** Winter environment configuration and production defaults. */

import type {
  FallingParticlesConfig,
  SkyGradientConfig,
} from "../environment-models";
import type { MoonConfig, StarfieldConfig } from "./cosmic-scene-config";
import type {
  CampfireConfig,
  FogConfig,
  GroundConfig,
  HemisphereLightConfig,
  IcePlatformConfig,
  TreeRingConfig,
} from "./shared-scene-config";

export interface WinterCabinConfig {
  /** The lodge mesh is embedded in the authored GLB; this enables its runtime signs of life. */
  enabled: boolean;
  position: { x: number; z: number };
  scale: number;
  rotationY: number;
  smoke: {
    enabled: boolean;
    position: { x: number; z: number };
    heightOffset: number;
    area: { width: number; height: number; depth: number };
    count: number;
    speed: number;
    colors: string[];
    sizeRange: [number, number];
    opacity: number;
  };
  windowLight: {
    enabled: boolean;
    position: { x: number; z: number };
    heightOffset: number;
    color: string;
    intensity: number;
    distance: number;
    decay: number;
  };
}

export interface WinterSceneConfig {
  sky: SkyGradientConfig;
  /** Shared night-sky stars, using the Forest scene owner. */
  starfield: StarfieldConfig;
  /** Shared camera-facing moon, using the Forest scene owner. */
  moon: MoonConfig;
  fog: FogConfig;
  ground: GroundConfig;
  /** Falling snow. */
  snow: FallingParticlesConfig;
  /** Authored scenery detail, from the base hollow (0) to the full tree belt (1). */
  forestDetail: number;
  /** @deprecated Kept so existing Scene Lab saves remain readable. */
  treeRings: TreeRingConfig[];
  /** @deprecated The authored clearing is fixed at eight metres. */
  clearingRadius: number;
  /** @deprecated Rocks are part of the authored Blender environment. */
  rockCount: number;
  /** Layered ice surface fitted to the authored pond basin. */
  pond: {
    enabled: boolean;
    /** @deprecated The authored basin owns the pond position. */
    position: { x: number; z: number };
    /** @deprecated The authored basin owns the pond radius. */
    radius: number;
    color: string;
    roughness: number;
  } | null;
  campfire: CampfireConfig | null;
  /** Runtime signs of life for the authored Winter Keeper's lodge. */
  cabin: WinterCabinConfig;
  hemisphereLight: HemisphereLightConfig;
  /** Optional directional key light for snow sparkle. */
  moonLight: {
    enabled: boolean;
    color: string;
    intensity: number;
    position: [number, number, number];
  } | null;
  platform: IcePlatformConfig;
}

const WINTER_TREE_RINGS: TreeRingConfig[] = [
  {
    radius: 14,
    count: 22,
    scaleBase: 1.5,
    scaleVariation: 0.35,
    radiusJitter: 1.0,
  },
  {
    radius: 17.5,
    count: 30,
    scaleBase: 1.3,
    scaleVariation: 0.3,
    radiusJitter: 1.5,
  },
  {
    radius: 21,
    count: 38,
    scaleBase: 1.1,
    scaleVariation: 0.3,
    radiusJitter: 1.75,
  },
  {
    radius: 25,
    count: 46,
    scaleBase: 0.9,
    scaleVariation: 0.25,
    radiusJitter: 2.0,
  },
];

const DEFAULT_CAMPFIRE_WINTER: CampfireConfig = {
  enabled: true,
  // The approved lodge-side hearth is clear of the performance route. The
  // Blender settlement contract owns the same (-34, -30) runtime coordinate.
  position: { x: -34, z: -30 },
  // The hearth pad is 2.45 m above the scene origin. Starting the flame inside
  // the upper split logs keeps it attached to the authored fire bed.
  groundOffset: 2.59,
  modelScale: 1,
  fireScale: 1.04,
  fireHeight: 1.7,
  primaryLight: {
    color: "#ff7744",
    intensity: 32,
    distance: 12,
    decay: 1.7,
    heightOffset: 1.15,
  },
  fillLight: {
    color: "#ff4400",
    intensity: 15,
    distance: 7,
    decay: 2,
    heightOffset: 0.18,
  },
  // Steam plume (heat meeting cold air) - bright white-blue, wispy, not grey smoke
  smokeColors: ["#ffffff", "#eaf4ff", "#c8dceb"],
  smokeCount: 10,
};

export function createDefaultWinterConfig(): WinterSceneConfig {
  return {
    sky: {
      topColor: "#050b1b",
      midColor: "#132d4b",
      bottomColor: "#102238",
    },
    starfield: {
      enabled: true,
      count: 1400,
      radius: 90,
      sizeRange: [0.5, 1.8],
      twinkleSpeed: 0.45,
    },
    moon: {
      enabled: true,
      texture: "/textures/moon.png",
      direction: [12, 14, -89],
      angularDiameterDegrees: 0.52,
      opacity: 0.9,
      glowScale: 1.12,
      glowOpacity: 0.025,
    },
    fog: { color: "#172c44", density: 0.014 },
    ground: {
      color: "#eaf2fb",
      size: 50,
      textured: false,
      opacity: 1,
    },
    snow: {
      type: "snow",
      count: 520,
      area: { width: 48, height: 15, depth: 48 },
      speed: 0.2,
      // Four tints = four shape variants in the shader (classic 6-arm, 8-arm
      // delicate, tiny sparkle, soft blur). Per-particle variance makes the
      // field read as real snow instead of a uniform white mass.
      colors: ["#ffffff", "#f0f8ff", "#d8e8f8", "#c0d8ec"],
      sizeRange: [0.03, 0.16],
      spin: true,
    },
    forestDetail: 1,
    treeRings: WINTER_TREE_RINGS,
    clearingRadius: 8,
    rockCount: 9,
    pond: {
      enabled: true,
      position: { x: 16, z: -10 },
      radius: 6,
      color: "#385b72",
      roughness: 0.62,
    },
    campfire: DEFAULT_CAMPFIRE_WINTER,
    cabin: {
      enabled: true,
      position: { x: -24, z: -38 },
      scale: 1,
      rotationY: 0.5633162614919681,
      smoke: {
        enabled: true,
        position: { x: -22.689492200301995, z: -39.951299389363584 },
        heightOffset: 7.49,
        area: { width: 1.2, height: 4.8, depth: 1.2 },
        count: 18,
        speed: 0.05,
        colors: ["#87909a", "#a7b0ba", "#c5cbd1"],
        sizeRange: [0.22, 0.56],
        opacity: 0.16,
      },
      windowLight: {
        enabled: true,
        position: { x: -22.266747748786507, z: -34.60024462149652 },
        heightOffset: 4.04,
        color: "#ff8a3d",
        intensity: 16,
        distance: 9,
        decay: 1.7,
      },
    },
    hemisphereLight: {
      skyColor: "#b9d8ff",
      groundColor: "#32445f",
      intensity: 0.58,
    },
    moonLight: {
      enabled: true,
      color: "#d8e4f4",
      intensity: 1,
      position: [-20, 25, 15],
    },
    platform: {
      enabled: true,
      radius: 5,
      height: 0.45,
      primaryColor: "#c8e8ff",
      glowIntensity: 0.6,
      frostDensity: 1.0,
    },
  };
}
