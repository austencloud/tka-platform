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
// Ocean scene
// ============================================================================

export interface OceanSceneConfig {
  sky: SkyGradientConfig;
  fog: FogConfig;
  ground: GroundConfig;

  coral: {
    enabled: boolean;
    count: number;
    clearingRadius: number;
    glowColor: string;
    glowBlend: number;
  };

  kelp: {
    enabled: boolean;
    rings: TreeRingConfig[];
    clearingRadius: number;
    swaySpeed: number;
    swayAmplitude: number;
  };

  rockCount: number;
  rockTintColor: string;
  rockTintBlend: number;

  bubbles: FallingParticlesConfig;
  dust: FallingParticlesConfig | null;
  plankton: FallingParticlesConfig | null;

  jellyfish: {
    enabled: boolean;
    count: number;
    glowColor: string;
    driftSpeed: number;
    pulseRate: number;
    lightIntensity: number;
    lightDistance: number;
    spawnRadius: number;
    heightRange: [number, number];
  } | null;

  godRays: {
    enabled: boolean;
    color: string;
    intensity: number;
    position: [number, number, number];
  } | null;

  caustics: {
    enabled: boolean;
    intensity: number;
    speed: number;
    scale: number;
    color: string;
  } | null;

  hemisphereLight: HemisphereLightConfig;
}

// ============================================================================
// Cosmic scene
// ============================================================================

export interface PlatformConfig {
  enabled: boolean;
  shape: "circle" | "hexagon" | "octagon";
  /** Platform radius (meters). */
  radius: number;
  /** Platform height/thickness (meters). */
  height: number;
  metallic: number;
  roughness: number;
  baseColor: string;
  emissiveColor: string;
  emissiveIntensity: number;
  /** Width of the glowing edge rim (meters). */
  edgeGlowWidth: number;
  /** Pulse animation speed (Hz). */
  pulseSpeed: number;
  /** Hexagonal grid line density on top surface. 0 = no grid. */
  gridDensity: number;
  /** Grid line emissive intensity (separate from edge glow). */
  gridIntensity: number;
  /** Number of accent lights around platform edge. 0 = disabled. */
  accentLightCount: number;
  /** Intensity of each accent light. */
  accentLightIntensity: number;
  /** Falloff distance of each accent light (meters). */
  accentLightDistance: number;
  /** Audience seating enabled. */
  seatingEnabled: boolean;
  /** Number of seating rows. */
  seatingRows: number;
  /** Seating emissive accent color. Falls back to emissiveColor if empty. */
  seatingAccentColor: string;
}

export interface EarthConfig {
  enabled: boolean;
  position: [number, number, number];
  /** Sphere radius (meters). */
  radius: number;
  rimColor: string;
  rimIntensity: number;
  /** Y-axis rotation speed (rad/s). */
  rotationSpeed: number;
}

export interface NebulaConfig {
  enabled: boolean;
  color1: string;
  color2: string;
  opacity: number;
  scale: number;
  animationSpeed: number;
}

export interface EnergyParticlesConfig {
  enabled: boolean;
  count: number;
  /** Upward drift speed (m/s). */
  riseSpeed: number;
  colors: string[];
  sizeRange: [number, number];
  /** Spawn area radius around platform (meters). */
  spawnRadius: number;
  /** Maximum height before recycling (meters). */
  maxHeight: number;
}

export interface MeteorStreaksConfig {
  enabled: boolean;
  /** Average interval between meteors (seconds). */
  frequency: number;
  /** Travel speed (m/s). */
  speed: number;
  colors: string[];
  /** Trail length (meters). */
  trailLength: number;
}

export interface CosmicSceneConfig {
  sky: SkyGradientConfig;
  fog: FogConfig;
  ground: GroundConfig;
  platform: PlatformConfig;
  earth: EarthConfig;
  nebula: NebulaConfig;
  particles: {
    /** Slow-drifting star field. */
    starDrift: FallingParticlesConfig;
    /** Optional cosmic dust layer. */
    cosmicDust: FallingParticlesConfig | null;
    /** Optional rising energy motes near platform. */
    energyParticles: EnergyParticlesConfig | null;
    /** Optional meteor streaks across the sky. */
    meteorStreaks: MeteorStreaksConfig | null;
  };
  lighting: {
    ambient: HemisphereLightConfig;
    coldDirectional: {
      enabled: boolean;
      color: string;
      intensity: number;
      position: [number, number, number];
    };
    warmStation: PointLightConfig & { enabled: boolean };
    accentEmissive: {
      enabled: boolean;
      color: string;
      intensity: number;
      /** Pulse animation speed (Hz). */
      pulseSpeed: number;
    };
  };
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

// ----- Ocean -----

const OCEAN_KELP_RINGS: TreeRingConfig[] = [
  { radius: 12, count: 14, scaleBase: 1.2, scaleVariation: 0.4, radiusJitter: 1.0 },
  { radius: 16, count: 20, scaleBase: 1.0, scaleVariation: 0.3, radiusJitter: 1.5 },
  { radius: 20, count: 26, scaleBase: 0.8, scaleVariation: 0.25, radiusJitter: 2.0 },
];

export function createDefaultOceanDeepConfig(): OceanSceneConfig {
  return {
    sky: {
      topColor: "#002844",
      midColor: "#004477",
      bottomColor: "#000a14",
    },
    fog: { color: "#002244", density: 0.035 },
    ground: {
      color: "#1a3a4a",
      size: 50,
      textured: false,
      opacity: 1,
    },
    coral: {
      enabled: true,
      count: 12,
      clearingRadius: 10,
      glowColor: "#40a0c0",
      glowBlend: 0.25,
    },
    kelp: {
      enabled: true,
      rings: OCEAN_KELP_RINGS,
      clearingRadius: 10,
      swaySpeed: 0.8,
      swayAmplitude: 0.15,
    },
    rockCount: 8,
    rockTintColor: "#1a3a4a",
    rockTintBlend: 0.30,
    bubbles: {
      type: "bubbles",
      count: 80,
      area: { width: 6, height: 4, depth: 6 },
      speed: 0.075,
      colors: ["#60c0e0", "#80d0f0", "#40a0c0", "#a0e0ff"],
      sizeRange: [0.04, 0.12],
      spin: false,
    },
    dust: {
      type: "dust",
      count: 120,
      area: { width: 15, height: 6, depth: 15 },
      speed: 0.015,
      colors: ["#406080", "#506878", "#385868"],
      sizeRange: [0.02, 0.06],
      spin: false,
    },
    plankton: {
      type: "fireflies",
      count: 60,
      area: { width: 10, height: 4, depth: 10 },
      speed: 0.005,
      colors: ["#60e0ff", "#40c0ff", "#80ffff"],
      sizeRange: [0.1, 0.25],
      spin: false,
    },
    jellyfish: {
      enabled: true,
      count: 4,
      glowColor: "#a064ff",
      driftSpeed: 0.3,
      pulseRate: 0.5,
      lightIntensity: 8,
      lightDistance: 8,
      spawnRadius: 8,
      heightRange: [2, 6],
    },
    godRays: {
      enabled: true,
      color: "#4090b0",
      intensity: 1.5,
      position: [5, 25, 5],
    },
    caustics: {
      enabled: true,
      intensity: 0.12,
      speed: 0.02,
      scale: 4.0,
      color: "#60c0e0",
    },
    hemisphereLight: {
      skyColor: "#1a3a5a",
      groundColor: "#0a1a2a",
      intensity: 0.8,
    },
  };
}

export function createDefaultOceanReefConfig(): OceanSceneConfig {
  return {
    sky: {
      topColor: "#003355",
      midColor: "#006688",
      bottomColor: "#001a33",
    },
    fog: { color: "#004466", density: 0.018 },
    ground: {
      color: "#3a5a6a",
      size: 50,
      textured: false,
      opacity: 1,
    },
    coral: {
      enabled: true,
      count: 16,
      clearingRadius: 10,
      glowColor: "#ff8080",
      glowBlend: 0.15,
    },
    kelp: {
      enabled: true,
      rings: [
        { radius: 14, count: 12, scaleBase: 1.0, scaleVariation: 0.35, radiusJitter: 1.0 },
        { radius: 18, count: 18, scaleBase: 0.8, scaleVariation: 0.25, radiusJitter: 1.5 },
      ],
      clearingRadius: 12,
      swaySpeed: 1.0,
      swayAmplitude: 0.12,
    },
    rockCount: 10,
    rockTintColor: "#2a4a5a",
    rockTintBlend: 0.20,
    bubbles: {
      type: "bubbles",
      count: 120,
      area: { width: 8, height: 4, depth: 8 },
      speed: 0.09,
      colors: ["#60c0e0", "#80d0f0", "#40a0c0", "#a0e0ff"],
      sizeRange: [0.02, 0.07],
      spin: false,
    },
    dust: {
      type: "dust",
      count: 80,
      area: { width: 12, height: 5, depth: 12 },
      speed: 0.02,
      colors: ["#608090", "#708898", "#587888"],
      sizeRange: [0.015, 0.04],
      spin: false,
    },
    plankton: {
      type: "fireflies",
      count: 30,
      area: { width: 8, height: 3, depth: 8 },
      speed: 0.008,
      colors: ["#40e0c0", "#60ffd0"],
      sizeRange: [0.08, 0.18],
      spin: false,
    },
    jellyfish: {
      enabled: true,
      count: 3,
      glowColor: "#64c0ff",
      driftSpeed: 0.4,
      pulseRate: 0.6,
      lightIntensity: 6,
      lightDistance: 6,
      spawnRadius: 10,
      heightRange: [1.5, 5],
    },
    godRays: {
      enabled: true,
      color: "#80c0e0",
      intensity: 1.2,
      position: [5, 20, 5],
    },
    caustics: {
      enabled: true,
      intensity: 0.25,
      speed: 0.03,
      scale: 3.0,
      color: "#80d0f0",
    },
    hemisphereLight: {
      skyColor: "#4080b0",
      groundColor: "#1a3040",
      intensity: 1.0,
    },
  };
}

// ----- Cosmic -----

const LUNAR_TEXTURES = {
  diffuseMap: "/textures/terrain/rock/diffuse.jpg",
  normalMap: "/textures/terrain/rock/normal.jpg",
  roughnessMap: "/textures/terrain/rock/roughness.jpg",
};

export function createDefaultCosmicNightConfig(): CosmicSceneConfig {
  return {
    sky: {
      topColor: "#050510",
      midColor: "#0d0d2a",
      bottomColor: "#1a1040",
    },
    fog: { color: "#080818", density: 0.008 },
    ground: {
      color: "#1a1a2e",
      size: 60,
      textured: true,
      ...LUNAR_TEXTURES,
      normalScale: 2.0,
      textureRepeat: 30,
      opacity: 0.9,
    },
    platform: {
      enabled: true,
      shape: "octagon",
      radius: 3.5,
      height: 0.4,
      metallic: 0.8,
      roughness: 0.2,
      baseColor: "#0a0a1a",
      emissiveColor: "#4488ff",
      emissiveIntensity: 0.6,
      edgeGlowWidth: 0.04,
      pulseSpeed: 0.5,
      gridDensity: 8,
      gridIntensity: 0.3,
      accentLightCount: 8,
      accentLightIntensity: 15,
      accentLightDistance: 6,
      seatingEnabled: true,
      seatingRows: 3,
      seatingAccentColor: "#4488ff",
    },
    earth: {
      enabled: true,
      position: [-40, 12, -60],
      radius: 8,
      rimColor: "#6ab4ff",
      rimIntensity: 1.2,
      rotationSpeed: 0.02,
    },
    nebula: {
      enabled: false,
      color1: "#000000",
      color2: "#000000",
      opacity: 0,
      scale: 1,
      animationSpeed: 0,
    },
    particles: {
      starDrift: {
        type: "stars",
        count: 200,
        area: { width: 80, height: 50, depth: 80 },
        speed: 0.005,
        colors: ["#ffffff", "#aaccff", "#ccbbee", "#8877cc"],
        sizeRange: [0.02, 0.12],
        spin: false,
      },
      cosmicDust: {
        type: "dust",
        count: 100,
        area: { width: 40, height: 20, depth: 40 },
        speed: 0.015,
        colors: ["#4466aa", "#3355aa", "#2244aa", "#5577cc"],
        sizeRange: [0.01, 0.06],
        spin: false,
      },
      energyParticles: {
        enabled: true,
        count: 50,
        riseSpeed: 0.3,
        colors: ["#4488ff", "#66aaff", "#88ccff", "#aaddff"],
        sizeRange: [0.03, 0.08],
        spawnRadius: 2.5,
        maxHeight: 6,
      },
      meteorStreaks: {
        enabled: true,
        frequency: 8,
        speed: 15,
        colors: ["#ffffff", "#aaccff", "#88aaee"],
        trailLength: 4,
      },
    },
    lighting: {
      ambient: {
        skyColor: "#2a2a55",
        groundColor: "#151525",
        intensity: 0.7,
      },
      coldDirectional: {
        enabled: true,
        color: "#8899dd",
        intensity: 1.2,
        position: [-30, 20, -40],
      },
      warmStation: {
        enabled: true,
        color: "#6688bb",
        intensity: 25,
        distance: 12,
        decay: 1.5,
        heightOffset: 0.5,
      },
      accentEmissive: {
        enabled: true,
        color: "#4488ff",
        intensity: 0.4,
        pulseSpeed: 0.5,
      },
    },
  };
}

export function createDefaultCosmicAuroraConfig(): CosmicSceneConfig {
  return {
    sky: {
      topColor: "#030810",
      midColor: "#0a2a2a",
      bottomColor: "#102030",
    },
    fog: { color: "#061818", density: 0.006 },
    ground: {
      color: "#0a1a1a",
      size: 60,
      textured: true,
      ...LUNAR_TEXTURES,
      normalScale: 2.0,
      textureRepeat: 30,
      opacity: 0.9,
    },
    platform: {
      enabled: true,
      shape: "octagon",
      radius: 3.5,
      height: 0.4,
      metallic: 0.8,
      roughness: 0.2,
      baseColor: "#0a1a1a",
      emissiveColor: "#00ccaa",
      emissiveIntensity: 0.6,
      edgeGlowWidth: 0.04,
      pulseSpeed: 0.4,
      gridDensity: 8,
      gridIntensity: 0.3,
      accentLightCount: 8,
      accentLightIntensity: 15,
      accentLightDistance: 6,
      seatingEnabled: true,
      seatingRows: 3,
      seatingAccentColor: "#00ccaa",
    },
    earth: {
      enabled: true,
      position: [-40, 12, -60],
      radius: 8,
      rimColor: "#44ddcc",
      rimIntensity: 1.4,
      rotationSpeed: 0.02,
    },
    nebula: {
      enabled: true,
      color1: "#00aaaa",
      color2: "#aa44aa",
      opacity: 0.2,
      scale: 1.5,
      animationSpeed: 0.02,
    },
    particles: {
      starDrift: {
        type: "stars",
        count: 200,
        area: { width: 80, height: 50, depth: 80 },
        speed: 0.005,
        colors: ["#44ffee", "#ff66cc", "#33ddbb", "#ee88aa"],
        sizeRange: [0.02, 0.12],
        spin: false,
      },
      cosmicDust: {
        type: "dust",
        count: 120,
        area: { width: 40, height: 20, depth: 40 },
        speed: 0.02,
        colors: ["#00aa88", "#aa44aa", "#00ccaa", "#cc66cc"],
        sizeRange: [0.01, 0.06],
        spin: false,
      },
      energyParticles: {
        enabled: true,
        count: 60,
        riseSpeed: 0.25,
        colors: ["#00ccaa", "#44eedd", "#00ffbb", "#66ffcc"],
        sizeRange: [0.03, 0.08],
        spawnRadius: 2.5,
        maxHeight: 6,
      },
      meteorStreaks: {
        enabled: true,
        frequency: 6,
        speed: 18,
        colors: ["#44ffee", "#ff66cc", "#88ffdd"],
        trailLength: 5,
      },
    },
    lighting: {
      ambient: {
        skyColor: "#1a4444",
        groundColor: "#0c1a1a",
        intensity: 0.8,
      },
      coldDirectional: {
        enabled: true,
        color: "#66cccc",
        intensity: 1.1,
        position: [-30, 20, -40],
      },
      warmStation: {
        enabled: true,
        color: "#33bb99",
        intensity: 28,
        distance: 12,
        decay: 1.5,
        heightOffset: 0.5,
      },
      accentEmissive: {
        enabled: true,
        color: "#00ccaa",
        intensity: 0.5,
        pulseSpeed: 0.4,
      },
    },
  };
}
