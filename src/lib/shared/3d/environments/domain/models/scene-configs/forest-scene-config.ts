/** Forest environment configuration and production defaults. */

import type {
  FallingParticlesConfig,
  SkyGradientConfig,
} from "../environment-models";
import type {
  MeteorStreaksConfig,
  MoonConfig,
  StarfieldConfig,
} from "./cosmic-scene-config";
import type {
  CampfireConfig,
  FogConfig,
  GroundConfig,
  HemisphereLightConfig,
  TreeRingConfig,
} from "./shared-scene-config";

export interface ForestSceneConfig {
  sky: SkyGradientConfig;
  /** Distant stars visible through the forest canopy. */
  starfield?: StarfieldConfig | null;
  /** Occasional cool-white streaks across the night sky. */
  shootingStars?: MeteorStreaksConfig | null;
  /** Camera-facing moon in the night sky. */
  moon?: MoonConfig | null;
  fog: FogConfig;
  ground: GroundConfig;
  /** Falling leaves. */
  leaves: FallingParticlesConfig;
  /** Firefly particles (null for autumn variant). */
  fireflies: FallingParticlesConfig | null;
  /** Concentric tree rings for depth. */
  treeRings: TreeRingConfig[];
  /** Inner clearing radius - rocks / bushes hug this edge. */
  clearingRadius: number;
  /** Rock count around clearing edge. */
  rockCount: number;
  /** Bush count filling gaps. */
  bushCount: number;
  campfire: CampfireConfig | null;
  tent: {
    enabled: boolean;
    position: { x: number; z: number };
    scale: number;
    rotationY: number;
  };
  /** Ambient hemisphere bounce. */
  hemisphereLight: HemisphereLightConfig;
}

/** The close frame belongs only to the authored default Forest composition. */
export function shouldShowForestNearFrame(
  config: ForestSceneConfig | undefined,
  clearingRadius: number | undefined
): boolean {
  return config === undefined && clearingRadius === undefined;
}

const DEFAULT_CAMPFIRE_FIREFLY: CampfireConfig = {
  enabled: true,
  position: { x: 5.5, z: -3.5 },
  modelScale: 2.5,
  fireScale: 0.9,
  fireHeight: 2.0,
  primaryLight: {
    color: "#ff6622",
    intensity: 50,
    distance: 20,
    decay: 1.2,
    heightOffset: 1.5,
  },
  fillLight: {
    color: "#ff4400",
    intensity: 30,
    distance: 15,
    decay: 1.5,
    heightOffset: 0.25,
  },
  smokeColors: ["#222222", "#1a1a1a", "#111111"],
  smokeCount: 40,
};

const DEFAULT_CAMPFIRE_AUTUMN: CampfireConfig = {
  ...DEFAULT_CAMPFIRE_FIREFLY,
  primaryLight: { ...DEFAULT_CAMPFIRE_FIREFLY.primaryLight, intensity: 35 },
  fillLight: { ...DEFAULT_CAMPFIRE_FIREFLY.fillLight, intensity: 20 },
  smokeColors: ["#443322", "#332211", "#221100"],
};

const FOREST_TREE_RINGS: TreeRingConfig[] = [
  {
    radius: 14,
    count: 20,
    scaleBase: 1.4,
    scaleVariation: 0.4,
    radiusJitter: 1.0,
  },
  {
    radius: 17.5,
    count: 28,
    scaleBase: 1.25,
    scaleVariation: 0.35,
    radiusJitter: 1.5,
  },
  {
    radius: 21,
    count: 36,
    scaleBase: 1.1,
    scaleVariation: 0.3,
    radiusJitter: 1.75,
  },
  {
    radius: 25,
    count: 44,
    scaleBase: 0.9,
    scaleVariation: 0.25,
    radiusJitter: 2.0,
  },
];

const FOREST_FLOOR_TEXTURES = {
  diffuseMap: "/textures/forest-floor/diffuse.jpg",
  normalMap: "/textures/forest-floor/normal.jpg",
  roughnessMap: "/textures/forest-floor/roughness.jpg",
};

export function createDefaultForestFireflyConfig(): ForestSceneConfig {
  return {
    sky: {
      topColor: "#0c1632",
      midColor: "#1a4a5a",
      bottomColor: "#0d2218",
    },
    starfield: {
      enabled: true,
      count: 1400,
      radius: 90,
      sizeRange: [0.5, 1.8],
      twinkleSpeed: 0.45,
    },
    shootingStars: {
      enabled: true,
      frequency: 30,
      speed: 12,
      colors: ["#ffffff", "#c8dcff", "#f8faff"],
      trailLength: 12,
      brightness: 2.5,
      headSize: 8,
    },
    moon: {
      enabled: true,
      texture: "/textures/moon.png",
      direction: [12, 22, -58],
      angularDiameterDegrees: 0.52,
      opacity: 0.9,
      glowScale: 1.12,
      glowOpacity: 0.025,
    },
    fog: { color: "#0a1210", density: 0.034 },
    ground: {
      color: "#99aa88",
      size: 50,
      textured: true,
      ...FOREST_FLOOR_TEXTURES,
      normalScale: 1.5,
      textureRepeat: 40,
    },
    leaves: {
      type: "leaves",
      count: 150,
      area: { width: 40, height: 5, depth: 40 },
      speed: 0.075,
      colors: ["#1a3a1a", "#0d2a15", "#153020", "#0f2518"],
      sizeRange: [0.075, 0.175],
      spin: true,
    },
    fireflies: {
      type: "fireflies",
      count: 60,
      area: { width: 8, height: 2, depth: 8 },
      speed: 0.005,
      colors: ["#d4e157"],
      sizeRange: [0.2, 0.4],
      spin: false,
    },
    treeRings: FOREST_TREE_RINGS,
    clearingRadius: 14,
    rockCount: 10,
    bushCount: 16,
    campfire: DEFAULT_CAMPFIRE_FIREFLY,
    tent: {
      enabled: true,
      position: { x: -5.0, z: -4.0 },
      scale: 2.25,
      rotationY: Math.PI * 0.65,
    },
    hemisphereLight: {
      skyColor: "#ff8844",
      groundColor: "#221100",
      intensity: 0.6,
    },
  };
}

export function createDefaultForestAutumnConfig(): ForestSceneConfig {
  return {
    sky: {
      topColor: "#1a1045",
      midColor: "#b5522a",
      bottomColor: "#3d1a10",
    },
    starfield: null,
    shootingStars: null,
    moon: null,
    fog: { color: "#1a1008", density: 0.028 },
    ground: {
      color: "#ddccbb",
      size: 50,
      textured: true,
      ...FOREST_FLOOR_TEXTURES,
      normalScale: 1.5,
      textureRepeat: 40,
    },
    leaves: {
      type: "leaves",
      count: 450,
      area: { width: 40, height: 5, depth: 40 },
      speed: 0.125,
      colors: ["#d97706", "#dc2626", "#ea580c", "#92400e"],
      sizeRange: [0.125, 0.275],
      spin: true,
    },
    fireflies: null,
    treeRings: FOREST_TREE_RINGS,
    clearingRadius: 14,
    rockCount: 10,
    bushCount: 16,
    campfire: DEFAULT_CAMPFIRE_AUTUMN,
    tent: {
      enabled: true,
      position: { x: -5.0, z: -4.0 },
      scale: 2.25,
      rotationY: Math.PI * 0.65,
    },
    hemisphereLight: {
      skyColor: "#ff8844",
      groundColor: "#221100",
      intensity: 0.4,
    },
  };
}
