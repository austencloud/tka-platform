/** Forest environment configuration and production defaults. */

import type {
  FallingParticlesConfig,
  SkyCloudConfig,
  SkyGradientConfig,
  SkySunConfig,
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
} from "./shared-scene-config";

export interface ForestSceneConfig {
  sky: SkyGradientConfig;
  /** Optional solar disk. Night and legacy configs omit it. */
  sun?: SkySunConfig | null;
  /** Daylight cloud field. Night omits it to preserve the Night Master. */
  clouds?: SkyCloudConfig | null;
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
  campfire: CampfireConfig | null;
  /** Ambient hemisphere bounce. */
  hemisphereLight: HemisphereLightConfig;
  /** Forest-owned motivated light rig. Omitted legacy configs use Night Master. */
  lighting?: ForestLightingConfig;
  /** High-canopy silhouette family for the current atmosphere. */
  canopyFlight?: "bats" | "birds" | "none";
  /** Per-anchor material grading. Night omits this to preserve revision 36. */
  materialResponse?: ForestMaterialResponseConfig;
}

export interface ForestMaterialResponseConfig {
  terrainTint: string;
  forestFloorTint: string;
  foliageTint: string;
  /** Time-of-day grade for bark, trunks, and woody branches. */
  woodyTint: string;
  /** Re-hues green-dominant canopy pixels while preserving bark in shared atlases. */
  foliageHighlightTint: string;
  foliageHighlightStrength: number;
  groundLifeTint: string;
  stageTint: string;
  campTint: string;
  emissiveScale: number;
}

export interface ForestLightingConfig {
  key: {
    color: string;
    intensity: number;
    direction: [number, number, number];
    shadowIntensity: number;
  };
  fill: {
    color: string;
    intensity: number;
  };
  ambient: {
    color: string;
    intensity: number;
  };
  stage: {
    color: string;
    intensity: number;
    distance: number;
  };
}

/** Exact revision-36 values. Other atmosphere anchors must not mutate them. */
export const FOREST_NIGHT_LIGHTING: ForestLightingConfig = {
  key: {
    color: "#b8cee8",
    intensity: 0.48,
    direction: [12, 22, -58],
    shadowIntensity: 0.42,
  },
  fill: {
    color: "#6f9991",
    intensity: 0.12,
  },
  ambient: {
    color: "#91aaa2",
    intensity: 0.06,
  },
  stage: {
    color: "#b9d9d2",
    intensity: 32,
    distance: 16,
  },
};

/** Widened hub callers omit the authored close frame; Scene Lab previews production. */
export function shouldShowForestNearFrame(
  clearingRadius: number | undefined
): boolean {
  return clearingRadius === undefined;
}

const DEFAULT_CAMPFIRE_FIREFLY: CampfireConfig = {
  enabled: true,
  // Mirrors the measured Forest campsite contract. The GLB owns the stone
  // bed; this coordinate keeps the live flame, smoke, and lights centered in it.
  position: { x: 34.0, z: 2.0 },
  groundOffset: 0.25,
  modelScale: 2.5,
  fireScale: 0.9,
  fireHeight: 2.0,
  primaryLight: {
    color: "#ff7a32",
    intensity: 28,
    distance: 14,
    decay: 2,
    heightOffset: 1.5,
  },
  fillLight: {
    color: "#ffc078",
    intensity: 6,
    distance: 12,
    decay: 2,
    heightOffset: 3.5,
  },
  smokeColors: ["#222222", "#1a1a1a", "#111111"],
  smokeCount: 40,
};

const DEFAULT_CAMPFIRE_AUTUMN: CampfireConfig = {
  ...DEFAULT_CAMPFIRE_FIREFLY,
  primaryLight: {
    color: "#ff6622",
    intensity: 35,
    distance: 20,
    decay: 1.2,
    heightOffset: 1.5,
  },
  fillLight: {
    color: "#ff4400",
    intensity: 20,
    distance: 15,
    decay: 1.5,
    heightOffset: 0.25,
  },
  smokeColors: ["#443322", "#332211", "#221100"],
};

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
    sun: null,
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
    fog: { color: "#0a171c", density: 0.024 },
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
    campfire: DEFAULT_CAMPFIRE_FIREFLY,
    hemisphereLight: {
      skyColor: "#809eb7",
      groundColor: "#162d24",
      intensity: 0.38,
    },
    lighting: {
      key: { ...FOREST_NIGHT_LIGHTING.key },
      fill: { ...FOREST_NIGHT_LIGHTING.fill },
      ambient: { ...FOREST_NIGHT_LIGHTING.ambient },
      stage: { ...FOREST_NIGHT_LIGHTING.stage },
    },
    canopyFlight: "bats",
  };
}

export function createDefaultForestAutumnConfig(): ForestSceneConfig {
  return {
    sky: {
      topColor: "#1a1045",
      midColor: "#b5522a",
      bottomColor: "#3d1a10",
    },
    sun: null,
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
    campfire: DEFAULT_CAMPFIRE_AUTUMN,
    hemisphereLight: {
      skyColor: "#ff8844",
      groundColor: "#221100",
      intensity: 0.4,
    },
    canopyFlight: "none",
  };
}
