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
  /** Log cabin position & scale. */
  cabin: {
    enabled: boolean;
    position: { x: number; z: number };
    scale: number;
    rotationY: number;
  };
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
  position: { x: 5.5, z: -3.5 },
  modelScale: 2.5,
  fireScale: 1.0,
  fireHeight: 2.0,
  primaryLight: {
    color: "#ff7744",
    intensity: 45,
    distance: 22,
    decay: 1.2,
    heightOffset: 1.5,
  },
  fillLight: {
    color: "#ff4400",
    intensity: 25,
    distance: 15,
    decay: 1.5,
    heightOffset: 0.25,
  },
  // Steam plume (heat meeting cold air) - bright white-blue, wispy, not grey smoke
  smokeColors: ["#ffffff", "#eaf4ff", "#c8dceb"],
  smokeCount: 14,
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
      position: { x: -14, z: 8 },
      radius: 6,
      color: "#8ab6d3",
      roughness: 0.22,
    },
    campfire: DEFAULT_CAMPFIRE_WINTER,
    cabin: {
      enabled: false,
      position: { x: -5.0, z: -4.0 },
      scale: 2.25,
      rotationY: Math.PI * 0.65,
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
