/**
 * Scene Configs
 *
 * Per-scene configuration objects used by ForestScene, WinterScene, etc.
 * Each scene exposes a config prop so the Scene Lab can drive it reactively
 * with sliders while production code uses the baked defaults.
 */

import type {
  FallingParticlesConfig,
  SkyGradientConfig,
} from "./environment-models";

// ============================================================================
// Shared building blocks
// ============================================================================

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
// Forest scene
// ============================================================================

export interface ForestSceneConfig {
  sky: SkyGradientConfig;
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

// ============================================================================
// Winter scene
// ============================================================================

export interface WinterSceneConfig {
  sky: SkyGradientConfig;
  fog: FogConfig;
  ground: GroundConfig;
  /** Falling snow. */
  snow: FallingParticlesConfig;
  /** Concentric tree rings. */
  treeRings: TreeRingConfig[];
  clearingRadius: number;
  rockCount: number;
  /** Frozen pond disc (decorative reflective plane). */
  pond: {
    enabled: boolean;
    position: { x: number; z: number };
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
}

// ============================================================================
// Default configs - preserve current baked values
// ============================================================================

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
  { radius: 14, count: 20, scaleBase: 1.4, scaleVariation: 0.4, radiusJitter: 1.0 },
  { radius: 17.5, count: 28, scaleBase: 1.25, scaleVariation: 0.35, radiusJitter: 1.5 },
  { radius: 21, count: 36, scaleBase: 1.1, scaleVariation: 0.3, radiusJitter: 1.75 },
  { radius: 25, count: 44, scaleBase: 0.9, scaleVariation: 0.25, radiusJitter: 2.0 },
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

// ----- Winter -----

const WINTER_TREE_RINGS: TreeRingConfig[] = [
  { radius: 14, count: 22, scaleBase: 1.5, scaleVariation: 0.35, radiusJitter: 1.0 },
  { radius: 17.5, count: 30, scaleBase: 1.3, scaleVariation: 0.3, radiusJitter: 1.5 },
  { radius: 21, count: 38, scaleBase: 1.1, scaleVariation: 0.3, radiusJitter: 1.75 },
  { radius: 25, count: 46, scaleBase: 0.9, scaleVariation: 0.25, radiusJitter: 2.0 },
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
  smokeCount: 30,
};

export function createDefaultWinterConfig(): WinterSceneConfig {
  return {
    sky: {
      topColor: "#0a1525",
      midColor: "#3a5c80",
      bottomColor: "#1a2838",
    },
    fog: { color: "#8ba3c0", density: 0.018 },
    ground: {
      color: "#eaf2fb",
      size: 50,
      textured: false,
      opacity: 1,
    },
    snow: {
      type: "snow",
      count: 400,
      area: { width: 30, height: 10, depth: 30 },
      speed: 0.2,
      // Four tints = four shape variants in the shader (classic 6-arm, 8-arm
      // delicate, tiny sparkle, soft blur). Per-particle variance makes the
      // field read as real snow instead of a uniform white mass.
      colors: ["#ffffff", "#f0f8ff", "#d8e8f8", "#c0d8ec"],
      sizeRange: [0.03, 0.16],
      spin: true,
    },
    treeRings: WINTER_TREE_RINGS,
    clearingRadius: 14,
    rockCount: 8,
    pond: {
      enabled: true,
      position: { x: -6, z: 5 },
      radius: 4.5,
      color: "#a8c4dc",
      roughness: 0.15,
    },
    campfire: DEFAULT_CAMPFIRE_WINTER,
    cabin: {
      enabled: false,
      position: { x: -5.0, z: -4.0 },
      scale: 2.25,
      rotationY: Math.PI * 0.65,
    },
    hemisphereLight: {
      skyColor: "#c8d8ec",
      groundColor: "#6a7488",
      intensity: 0.7,
    },
    moonLight: {
      enabled: true,
      color: "#d8e4f4",
      intensity: 0.8,
      position: [-20, 25, 15],
    },
  };
}
