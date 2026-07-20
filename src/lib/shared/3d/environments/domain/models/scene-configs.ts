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
// Per-scene platform configs
// ============================================================================

export interface IcePlatformConfig {
  enabled: boolean;
  radius: number;
  height: number;
  primaryColor: string;
  glowIntensity: number;
  frostDensity: number;
}

export interface RuinsPlatformConfig {
  enabled: boolean;
  width: number;
  depth: number;
  height: number;
  elevation?: number;
  stoneColor: string;
  runeGlowColor: string;
  glowIntensity: number;
  mossIntensity: number;
  columnCount: number;
  zOffset?: number;
}

export interface ObsidianPlatformConfig {
  enabled: boolean;
  radius: number;
  height: number;
  primaryColor: string;
  glowIntensity: number;
  crackIntensity: number;
  lavaSpeed: number;
}

export interface EngawaPlatformConfig {
  enabled: boolean;
  radius: number;
  height: number;
  primaryColor: string;
  glowIntensity: number;
}

export interface PrismPlatformConfig {
  enabled: boolean;
  radius: number;
  height: number;
  glowIntensity: number;
  spectrumSpeed: number;
}

export interface VoidPlatformConfig {
  enabled: boolean;
  radius: number;
  height: number;
  gridColor: string;
  glowIntensity: number;
  gridDensity: number;
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
// Autumn scene (standalone — replaces the ForestScene "autumn" variant)
// ============================================================================

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
  platform: IcePlatformConfig;
}

// ============================================================================
// Ocean scene
// ============================================================================

export interface OceanWaterSurfaceConfig {
  enabled: boolean;
  height: number;
  color: string;
  opacity: number;
  waveScale: number;
  waveSpeed: number;
  waveAmplitude: number;
  snellWindow: {
    enabled: boolean;
    skyColor: string;
    sunColor: string;
    sunSize: number;
    tirDarkness: number;
    edgeSoftness: number;
    noiseScale: number;
    noiseSpeed: number;
    noiseAmplitude: number;
  } | null;
}

export interface OceanGodRayShaftConfig {
  enabled: boolean;
  count: number;
  color: string;
  intensity: number;
  width: number;
  height: number;
  speed: number;
  swayAmount: number;
}

export interface OceanZonesConfig {
  /** Performance stage — clear, well-lit, nothing here */
  stageRadius: number;
  /** Sandy clearing — small decorations only (shells, starfish) */
  clearingRadius: number;
  /** Rocky reef zone — rocks, coral, kelp starts */
  reefInner: number;
  reefOuter: number;
  /** Kelp forest backdrop — dense kelp, bigger boulders */
  forestInner: number;
  forestOuter: number;
  /** Background silhouettes — fades into fog */
  backgroundRadius: number;
  reefAxisAngle: number;
}

export interface DLAConfig {
  gridSize: number;
  walkerCount: number;
  seeds: Array<{ angle: number; distanceNorm: number }>;
  outsideLeakFactor: number;
}

export interface CoralSpeciesConfig {
  speciesIndex: number;
  depthPreference: [number, number];
  currentAffinity?: number;
}

export interface PlacementConfig {
  slopeAware: boolean;
  dlaMacroShape: boolean;
  depthZonation: boolean;
  currentDrivenKelp: boolean;
  speciesClustering: boolean;
  rockAnchoredKelp: boolean;
  driftAccumulation: boolean;
  densityCurve: 'flat' | 'bell';
}

export interface MeshyModelEntry {
  path: string;
  name: string;
  baseScale: number;
  rotationRange: [number, number];
  weight: number;
  category: "formation" | "landmark" | "any";
}

export interface MeshyFormationsConfig {
  enabled: boolean;
  count: number;
  models: MeshyModelEntry[];
  tintColor: string;
  tintBlend: number;
}

export interface OceanSceneConfig {
  sky: SkyGradientConfig;
  fog: FogConfig;
  ground: GroundConfig;

  qualityTier?: 'auto' | 'ultra' | 'medium' | 'low';

  zones: OceanZonesConfig;

  coral: {
    enabled: boolean;
    count: number;
    glowColor: string;
    glowBlend: number;
  };

  kelp: {
    enabled: boolean;
    count: number;
    heroCount: number;
    midCount: number;
    backgroundCount: number;
    swaySpeed: number;
    swayAmplitude: number;
    currentDirection: [number, number];
  };

  fish: {
    enabled: boolean;
    count: number;
    targetSize: number;
    swimHeight: [number, number];
    speed: [number, number];
    currentStrength: number;
    swimFrequency: number;
    waveAmplitude: number;
    scatterRadius: number;
    scatterForce: number;
    scatterEnabled: boolean;
    scatterWaveSpeed: number;
    perceptionAngle: number;
    halfSpeedTime: number;
  };

  decorations: {
    enabled: boolean;
    count: number;
    targetSize: number;
  };

  rocks: {
    enabled: boolean;
    count: number;
    tintColor: string;
    tintBlend: number;
  };

  bubbles: FallingParticlesConfig;
  dust: FallingParticlesConfig | null;
  plankton: FallingParticlesConfig | null;

  jellyfish: {
    enabled: boolean;
    count: number;
    glowColor: string;
    driftSpeed: number;
    pulseRate: number;
    pulseAmplitude: number;
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

  godRayShafts: OceanGodRayShaftConfig | null;

  caustics: {
    enabled: boolean;
    intensity: number;
    speed: number;
    scale: number;
    color: string;
    voronoi: boolean;
  } | null;

  waterSurface: OceanWaterSurfaceConfig | null;

  boatSilhouette: OceanBoatSilhouetteConfig | null;

  hemisphereLight: HemisphereLightConfig;
  platform: RuinsPlatformConfig;
  currentDirection: { x: number; z: number };
  dla: DLAConfig;
  coralSpecies: CoralSpeciesConfig[];
  placement: PlacementConfig;
  meshyFormations: MeshyFormationsConfig;
}

export interface OceanBoatSilhouetteConfig {
  enabled: boolean;
  offsetX: number;
  offsetZ: number;
  heightAboveSurface: number;
  modelPath: string | null;
  length: number;
  width: number;
  depth: number;
  color: string;
  rotationY: number;
  animated: boolean;
  keelEnabled: boolean;
  godRayOcclusion: boolean;
  driftSpeed: number;
  driftRadius: number;
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

export interface LunarCrystalsConfig {
  enabled: boolean;
  clusterCount: number;
  ringRadius: number;
  color: string;
  glowColor: string;
  glowIntensity: number;
  heightRange: [number, number];
  opacity: number;
}

// Crystal Formations (Tier 1 upgrade — replaces LunarCrystals)

export interface CrystalSpeciesConfig {
  type: 'spire' | 'cluster' | 'plate' | 'branch';
  count: number;
  sizeRange: [number, number];
  palette: string[];
  glowIntensity: number;
}

export interface CrystalModelConfig {
  path: string;
  weight: number;
  glowIntensity: number;
}

export interface CrystalFormationsConfig {
  enabled: boolean;
  seed: number;
  placementRadius: [number, number];
  totalCount: number;
  sizeRange: [number, number];
  models: CrystalModelConfig[];
  species: CrystalSpeciesConfig[];
}

export interface PrismaticCausticsConfig {
  enabled: boolean;
  baseColor: string;
  intensity: number;
  scale: number;
  speed: number;
  spectrumShift: number;
}

export interface EarthGodRaysConfig {
  enabled: boolean;
  color: string;
  intensity: number;
  count: number;
  speed: number;
}

export interface LunarGroundConfig {
  enabled: boolean;
  veinColor: string;
  veinIntensity: number;
  veinPulseSpeed: number;
  veinDensity: number;
  bioColor?: string;
  bioIntensity?: number;
  frostColor?: string;
  frostIntensity?: number;
}

export interface StarfieldConfig {
  enabled: boolean;
  count: number;
  radius: number;
  sizeRange: [number, number];
  twinkleSpeed: number;
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
  crystals: LunarCrystalsConfig;
  crystalFormations: CrystalFormationsConfig;
  caustics: PrismaticCausticsConfig;
  godRays: EarthGodRaysConfig;
  lunarGround: LunarGroundConfig;
  starfield: StarfieldConfig;
}

// ============================================================================
// Rainbow scene
// ============================================================================

export interface RainbowSceneConfig {
  fog: FogConfig;
  hemisphereLight: HemisphereLightConfig;
  platform: PrismPlatformConfig;
}

// ============================================================================
// Pure Black scene
// ============================================================================

export interface VoidSceneConfig {
  ambientIntensity: number;
  platform: VoidPlatformConfig;
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

// ----- Autumn (standalone scene) -----

const AUTUMN_TREE_RINGS: TreeRingConfig[] = [
  { radius: 10, count: 8, scaleBase: 1.2, scaleVariation: 0.3, radiusJitter: 1.0 },
  { radius: 14, count: 14, scaleBase: 1.0, scaleVariation: 0.25, radiusJitter: 1.5 },
  { radius: 18, count: 20, scaleBase: 0.85, scaleVariation: 0.2, radiusJitter: 1.75 },
  { radius: 23, count: 28, scaleBase: 0.7, scaleVariation: 0.2, radiusJitter: 2.0 },
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

// ----- Ocean -----

const OCEAN_KELP_RINGS: TreeRingConfig[] = [
  { radius: 12, count: 14, scaleBase: 1.2, scaleVariation: 0.4, radiusJitter: 1.0 },
  { radius: 16, count: 20, scaleBase: 1.0, scaleVariation: 0.3, radiusJitter: 1.5 },
  { radius: 20, count: 26, scaleBase: 0.8, scaleVariation: 0.25, radiusJitter: 2.0 },
];

export function createDefaultOceanAbyssConfig(): OceanSceneConfig {
  return {
    sky: {
      topColor: "#1e6898",
      midColor: "#1a5580",
      bottomColor: "#0a2050",
    },
    fog: { color: "#1a5580", density: 0.008 },
    ground: {
      color: "#5a8898",
      size: 180,
      textured: false,
      opacity: 1,
    },
    zones: {
      stageRadius: 3,
      clearingRadius: 7,
      reefInner: 7,
      reefOuter: 18,
      forestInner: 14,
      forestOuter: 22,
      backgroundRadius: 24,
      reefAxisAngle: Math.PI,
    },
    coral: {
      enabled: false,
      count: 280,
      glowColor: "#e87090",
      glowBlend: 0.35,
    },
    kelp: {
      enabled: true,
      count: 300,
      heroCount: 4,
      midCount: 40,
      backgroundCount: 80,
      swaySpeed: 0.5,
      swayAmplitude: 0.2,
      currentDirection: [0.6, 0.3],
    },
    fish: {
      enabled: true,
      count: 150,
      targetSize: 0.7,
      swimHeight: [2, 7],
      speed: [0.5, 1.2],
      currentStrength: 0.3,
      swimFrequency: 5.0,
      waveAmplitude: 0.08,
      scatterRadius: 15.0,
      scatterForce: 30.0,
      scatterEnabled: true,
      scatterWaveSpeed: 0.08,
      perceptionAngle: 135,
      halfSpeedTime: 0.5,
    },
    decorations: {
      enabled: true,
      count: 160,
      targetSize: 1.0,
    },
    rocks: {
      enabled: true,
      count: 200,
      tintColor: "#708898",
      tintBlend: 0.15,
    },
    bubbles: {
      type: "bubbles",
      count: 35,
      area: { width: 18, height: 8, depth: 18 },
      speed: 0.04,
      colors: ["#88ddf0", "#60c8e0", "#70d0e8", "#a0e8f8"],
      sizeRange: [0.015, 0.05],
      spin: false,
    },
    dust: {
      type: "dust",
      count: 0,
      area: { width: 22, height: 10, depth: 22 },
      speed: 0.006,
      colors: ["#1a3848", "#15303e", "#0d2832"],
      sizeRange: [0.01, 0.035],
      spin: false,
    },
    plankton: {
      type: "fireflies",
      count: 80,
      area: { width: 25, height: 10, depth: 25 },
      speed: 0.003,
      colors: ["#66bb88", "#55aa77", "#77cc99"],
      sizeRange: [0.008, 0.02],
      spin: false,
    },
    jellyfish: {
      enabled: true,
      count: 5,
      glowColor: "#88ccff",
      driftSpeed: 0.15,
      pulseRate: 0.8,
      pulseAmplitude: 0.15,
      lightIntensity: 0.4,
      lightDistance: 8,
      spawnRadius: 25,
      heightRange: [4, 14],
    },
    godRays: {
      enabled: true,
      color: "#FFE499",
      intensity: 2.5,
      position: [4, 15, 2],
    },
    godRayShafts: {
      enabled: true,
      count: 14,
      color: "#b8d8e8",
      intensity: 0.4,
      width: 3.5,
      height: 18,
      speed: 0.3,
      swayAmount: 1.2,
    },
    caustics: null,
    waterSurface: {
      enabled: true,
      height: 12,
      color: "#0d3050",
      opacity: 0.12,
      waveScale: 5,
      waveSpeed: 0.35,
      waveAmplitude: 0.12,
      snellWindow: {
        enabled: true,
        skyColor: "#88ccee",
        sunColor: "#ffffdd",
        sunSize: 0.08,
        tirDarkness: 0.15,
        edgeSoftness: 0.06,
        noiseScale: 3.0,
        noiseSpeed: 0.4,
        noiseAmplitude: 0.04,
      },
    },
    boatSilhouette: {
      enabled: true,
      offsetX: 10,
      offsetZ: -2,
      heightAboveSurface: 1.10,
      modelPath: "/models/ocean/boat.glb",
      length: 8,
      width: 2.5,
      depth: 0.8,
      color: "#0a1520",
      rotationY: 0.3,
      animated: true,
      keelEnabled: true,
      godRayOcclusion: true,
      driftSpeed: 0.15,
      driftRadius: 8,
    },
    hemisphereLight: {
      skyColor: "#5090b0",
      groundColor: "#2a4058",
      intensity: 1.0,
    },
    platform: {
      enabled: true,
      width: 8,
      depth: 6,
      height: 0.5,
      elevation: 1.0,
      stoneColor: "#1a2028",
      runeGlowColor: "#44ddaa",
      glowIntensity: 0.5,
      mossIntensity: 0.8,
      columnCount: 6,
    },
    currentDirection: { x: 0, z: -1 },
    dla: {
      gridSize: 64,
      walkerCount: 1000,
      seeds: [
        { angle: Math.PI, distanceNorm: 0.3 },
        { angle: Math.PI * 0.8, distanceNorm: 0.5 },
        { angle: Math.PI * 1.2, distanceNorm: 0.4 },
        { angle: Math.PI * 0.6, distanceNorm: 0.6 },
      ],
      outsideLeakFactor: 0.1,
    },
    coralSpecies: [
      { speciesIndex: 0, depthPreference: [0.0, 0.4] },
      { speciesIndex: 1, depthPreference: [0.2, 0.6] },
      { speciesIndex: 2, depthPreference: [0.4, 0.8] },
      { speciesIndex: 3, depthPreference: [0.6, 1.0] },
      { speciesIndex: 4, depthPreference: [0.3, 0.9], currentAffinity: 2.0 },
      { speciesIndex: 5, depthPreference: [0.0, 0.5] },
      { speciesIndex: 6, depthPreference: [0.3, 0.7] },
      { speciesIndex: 7, depthPreference: [0.5, 1.0] },
    ],
    placement: {
      slopeAware: true,
      dlaMacroShape: true,
      depthZonation: true,
      currentDrivenKelp: true,
      speciesClustering: true,
      rockAnchoredKelp: true,
      driftAccumulation: true,
      densityCurve: 'bell',
    },
    meshyFormations: {
      enabled: true,
      count: 35,
      models: [
        { path: "basalt_pinnacle.glb", name: "Basalt Pinnacle", baseScale: 1.0, rotationRange: [0, Math.PI * 2], weight: 1.0, category: "landmark" },
        { path: "coral_encrusted_rock.glb", name: "Coral Encrusted Rock", baseScale: 0.8, rotationRange: [0, Math.PI * 2], weight: 1.5, category: "formation" },
        { path: "coral_mountain.glb", name: "Coral Mountain", baseScale: 1.2, rotationRange: [0, Math.PI * 2], weight: 1.0, category: "landmark" },
        { path: "neon_coral_summit.glb", name: "Neon Coral Summit", baseScale: 1.0, rotationRange: [0, Math.PI * 2], weight: 1.0, category: "landmark" },
        { path: "submerged_coral_citadel.glb", name: "Submerged Coral Citadel", baseScale: 1.0, rotationRange: [0, Math.PI * 2], weight: 1.2, category: "landmark" },
        { path: "sunlit_coral_arch.glb", name: "Sunlit Coral Arch", baseScale: 0.9, rotationRange: [0, Math.PI * 2], weight: 1.0, category: "landmark" },
        { path: "underwater_coral_arch.glb", name: "Underwater Coral Arch", baseScale: 0.9, rotationRange: [0, Math.PI * 2], weight: 1.0, category: "any" },
        { path: "underwater_rock_table.glb", name: "Underwater Rock Table", baseScale: 0.7, rotationRange: [0, Math.PI * 2], weight: 1.3, category: "formation" },
        { path: "photorealistic_coral_0.glb", name: "Photorealistic Coral A", baseScale: 0.8, rotationRange: [0, Math.PI * 2], weight: 1.0, category: "any" },
        { path: "photorealistic_coral_1.glb", name: "Photorealistic Coral B", baseScale: 0.8, rotationRange: [0, Math.PI * 2], weight: 1.0, category: "any" },
        { path: "photorealistic_coral_2.glb", name: "Photorealistic Coral C", baseScale: 0.7, rotationRange: [0, Math.PI * 2], weight: 1.0, category: "formation" },
        { path: "photorealistic_coral_3.glb", name: "Photorealistic Coral D", baseScale: 0.7, rotationRange: [0, Math.PI * 2], weight: 1.0, category: "formation" },
      ],
      tintColor: "#708898",
      tintBlend: 0.15,
    },
  };
}

export function createDefaultOceanReefConfig(): OceanSceneConfig {
  // Temporarily returns stripped config — will diverge from abyss once base is approved
  return createDefaultOceanAbyssConfig();
}

export function createDefaultOceanMysticalConfig(): OceanSceneConfig {
  return createDefaultOceanAbyssConfig();
}

export function createDefaultOceanCinematicConfig(): OceanSceneConfig {
  return createDefaultOceanAbyssConfig();
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
      position: [-40, 2, -60],
      radius: 8,
      rimColor: "#6ab4ff",
      rimIntensity: 1.2,
      rotationSpeed: 0.02,
    },
    nebula: {
      enabled: true,
      color1: "#1a1040",
      color2: "#2a1555",
      opacity: 0.15,
      scale: 2.5,
      animationSpeed: 0.08,
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
        // Rakes across the observatory terrace relief from the orrery flank
        // instead of backlighting from Earth's own direction.
        position: [28, 12, -19],
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
    crystals: {
      enabled: false,
      clusterCount: 8,
      ringRadius: 6.5,
      color: "#334466",
      glowColor: "#4488ff",
      glowIntensity: 0.8,
      heightRange: [0.8, 2.5],
      opacity: 0.6,
    },
    crystalFormations: {
      enabled: true,
      seed: 42,
      placementRadius: [7, 22],
      totalCount: 72,
      sizeRange: [0.6, 2.8],
      models: [
        { path: "/models/cosmic/crystal-spire-prismatic.glb", weight: 2.5, glowIntensity: 0.9 },
        { path: "/models/cosmic/crystal-pyramid-blue.glb", weight: 2.5, glowIntensity: 0.8 },
        { path: "/models/cosmic/crystal-cluster-aurora.glb", weight: 2, glowIntensity: 1.0 },
        { path: "/models/cosmic/crystal-branch-moonlit.glb", weight: 2, glowIntensity: 0.9 },
        { path: "/models/cosmic/crystal-spire-cyan.glb", weight: 2.5, glowIntensity: 0.85 },
        { path: "/models/cosmic/crystal-cluster-emerald.glb", weight: 2, glowIntensity: 1.0 },
        { path: "/models/cosmic/crystal-spire-amethyst.glb", weight: 2.5, glowIntensity: 0.95 },
      ],
      species: [],
    },
    caustics: {
      enabled: true,
      baseColor: "#4488ff",
      intensity: 0.35,
      scale: 1.2,
      speed: 1.0,
      spectrumShift: 0.02,
    },
    godRays: {
      enabled: true,
      color: "#4488ff",
      intensity: 0.15,
      count: 5,
      speed: 0.3,
    },
    lunarGround: {
      enabled: true,
      veinColor: "#4488ff",
      veinIntensity: 0.4,
      veinPulseSpeed: 0.5,
      veinDensity: 3.0,
      bioColor: "#2266cc",
      bioIntensity: 0.3,
      frostColor: "#aaccff",
      frostIntensity: 0.4,
    },
    starfield: {
      enabled: true,
      count: 1500,
      radius: 75,
      sizeRange: [0.5, 3.0],
      twinkleSpeed: 0.8,
    },
  };
}

// ============================================================================
// Blossom scene
// ============================================================================

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
      position: [-40, 2, -60],
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
        position: [28, 12, -19],
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
    crystals: {
      enabled: false,
      clusterCount: 10,
      ringRadius: 6.5,
      color: "#2a4455",
      glowColor: "#00ccaa",
      glowIntensity: 1.0,
      heightRange: [1.0, 3.0],
      opacity: 0.55,
    },
    crystalFormations: {
      enabled: true,
      seed: 99,
      placementRadius: [7, 22],
      totalCount: 84,
      sizeRange: [0.6, 3.0],
      models: [
        { path: "/models/cosmic/crystal-spire-prismatic.glb", weight: 2.5, glowIntensity: 1.0 },
        { path: "/models/cosmic/crystal-pyramid-blue.glb", weight: 2.5, glowIntensity: 0.9 },
        { path: "/models/cosmic/crystal-cluster-aurora.glb", weight: 2.5, glowIntensity: 1.2 },
        { path: "/models/cosmic/crystal-branch-moonlit.glb", weight: 2, glowIntensity: 1.0 },
        { path: "/models/cosmic/crystal-spire-cyan.glb", weight: 2.5, glowIntensity: 0.9 },
        { path: "/models/cosmic/crystal-cluster-emerald.glb", weight: 2.5, glowIntensity: 1.1 },
        { path: "/models/cosmic/crystal-spire-amethyst.glb", weight: 2.5, glowIntensity: 1.0 },
      ],
      species: [],
    },
    caustics: {
      enabled: true,
      baseColor: "#00ccaa",
      intensity: 0.4,
      scale: 1.0,
      speed: 1.2,
      spectrumShift: 0.03,
    },
    godRays: {
      enabled: true,
      color: "#44ddcc",
      intensity: 0.12,
      count: 4,
      speed: 0.25,
    },
    lunarGround: {
      enabled: true,
      veinColor: "#00ccaa",
      veinIntensity: 0.5,
      veinPulseSpeed: 0.4,
      veinDensity: 2.5,
      bioColor: "#00aa88",
      bioIntensity: 0.35,
      frostColor: "#88eedd",
      frostIntensity: 0.45,
    },
    starfield: {
      enabled: true,
      count: 1500,
      radius: 75,
      sizeRange: [0.5, 3.0],
      twinkleSpeed: 0.6,
    },
  };
}

// ============================================================================
// Ember scene
// ============================================================================

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
  angle: number;
  length: number;
  curvature: number;
  widthScale: number;
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
}

export interface ObsidianPillarsConfig {
  enabled: boolean;
  rings: TreeRingConfig[];
  clearingRadius: number;
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
  { radius: 8, count: 5, scaleBase: 1.2, scaleVariation: 0.3, radiusJitter: 0.8 },
  { radius: 14, count: 8, scaleBase: 0.9, scaleVariation: 0.25, radiusJitter: 1.2 },
];

export function createDefaultEmberConfig(): EmberSceneConfig {
  return {
    sky: {
      topColor: "#080204",
      midColor: "#1a0808",
      bottomColor: "#2a0c06",
    },
    fog: { color: "#0f0604", density: 0.022 },
    ground: {
      color: "#1a0a08",
      size: 50,
      textured: false,
      opacity: 1,
    },
    lavaCracks: {
      enabled: true,
      crackColor: "#ff4400",
      intensity: 0.35,
      speed: 0.015,
      scale: 3.0,
      pulseSpeed: 0.4,
      pulseIntensity: 0.6,
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
    lavaRivers: null,
    obsidianPillars: {
      enabled: true,
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
      enabled: true,
      count: 3,
      spawnRadius: 7,
      heightRange: [1.5, 4.5],
      driftSpeed: 0.25,
      pulseSpeed: 0.8,
      colors: ["#ff6600", "#ff4400", "#ffaa00"],
      lightIntensity: 12,
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
      color1: "#331100",
      color2: "#110000",
      opacity: 0.12,
      scale: 2.0,
      animationSpeed: 0.01,
      lightningInterval: 6.0,
      lightningIntensity: 0.8,
      innerGlowColor: "#ff4400",
    },
    embers: {
      type: "embers",
      count: 200,
      area: { width: 20, height: 6, depth: 20 },
      speed: 0.12,
      colors: ["#ff6b35", "#ff8c42", "#ffc145", "#ff4500", "#ff2200"],
      sizeRange: [0.015, 0.06],
      spin: false,
    },
    ash: {
      type: "dust",
      count: 150,
      area: { width: 25, height: 8, depth: 25 },
      speed: 0.04,
      colors: ["#3a2a2a", "#2a1a1a", "#4a3030", "#1a1010"],
      sizeRange: [0.02, 0.07],
      spin: false,
    },
    smoke: {
      type: "smoke",
      count: 40,
      area: { width: 8, height: 5, depth: 8 },
      speed: 0.03,
      colors: ["#1a0a0a", "#110808", "#0a0505", "#220e0e"],
      sizeRange: [0.15, 0.5],
      spin: false,
    },
    cinders: null,
    rockCount: 8,
    clearingRadius: 10,
    rockTintColor: "#1a0a08",
    rockTintBlend: 0.4,
    hemisphereLight: {
      skyColor: "#ff4422",
      groundColor: "#1a0808",
      intensity: 0.5,
    },
    skyLight: {
      enabled: true,
      color: "#ff6644",
      intensity: 0.4,
      position: [-15, 20, 10],
    },
    platform: {
      enabled: true,
      radius: 4.5,
      height: 0.5,
      primaryColor: "#1a1a1a",
      glowIntensity: 0.8,
      crackIntensity: 1.0,
      lavaSpeed: 0.5,
    },
  };
}

// ----- Blossom -----

const BLOSSOM_TREE_RINGS: TreeRingConfig[] = [
  { radius: 8, count: 5, scaleBase: 1.5, scaleVariation: 0.35, radiusJitter: 0.8 },
  { radius: 13, count: 8, scaleBase: 1.3, scaleVariation: 0.3, radiusJitter: 1.2 },
  { radius: 19, count: 12, scaleBase: 1.1, scaleVariation: 0.25, radiusJitter: 1.5 },
  { radius: 28, count: 14, scaleBase: 2.0, scaleVariation: 0.4, radiusJitter: 2.5 },
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
      { position: { x: 4, z: 5 }, scale: 0.9, lightColor: "#ffaa66", lightIntensity: 10, lightDistance: 8 },
      { position: { x: -4, z: -5 }, scale: 0.85, lightColor: "#ffaa66", lightIntensity: 10, lightDistance: 8 },
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

// ============================================================================
// Celestial scene
// ============================================================================

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
  { radius: 10, count: 5, scaleBase: 1.0, scaleVariation: 0.3, radiusJitter: 1.0 },
  { radius: 16, count: 8, scaleBase: 0.7, scaleVariation: 0.2, radiusJitter: 1.5 },
];

export function createDefaultCelestialConfig(): CelestialSceneConfig {
  return {
    sky: {
      topColor: "#0a1a4a",
      midColor: "#b89050",
      bottomColor: "#e8dcc8",
    },
    fog: { color: "#c8bca8", density: 0.012 },
    ground: {
      color: "#e8dcc8",
      size: 50,
      textured: false,
      opacity: 0.3,
    },
    cloudDome: {
      enabled: true,
      density: 0.6,
      coverage: 0.4,
      driftSpeed: 0.02,
      sunDirection: [0.5, 0.8, 0.3],
      litColor: "#ffffff",
      shadowColor: "#8090c0",
      opacity: 0.85,
    },
    godRays: {
      enabled: true,
      color: "#ffcc66",
      intensity: 0.35,
      count: 5,
      speed: 0.008,
    },
    cloudPlatform: {
      enabled: true,
      radius: 6,
      glowColor: "#d4a050",
      glowIntensity: 0.6,
      noiseScale: 2.0,
      driftSpeed: 0.015,
    },
    cloudIslands: {
      enabled: true,
      count: 5,
      driftSpeed: 0.1,
      bobSpeed: 0.3,
      heightRange: [4, 12],
      spawnRadius: 15,
      sizeRange: [1.5, 3.5],
      color: "#f0e8e0",
    },
    celestialPillars: {
      enabled: true,
      rings: CELESTIAL_PILLAR_RINGS,
      clearingRadius: 10,
      glowColor: "#ffd080",
      glowIntensity: 0.8,
      baseColor: "#e8e0d8",
      heightRange: [2.0, 5.0],
    },
    motes: {
      type: "fireflies",
      count: 60,
      area: { width: 12, height: 6, depth: 12 },
      speed: 0.008,
      colors: ["#ffd080", "#ffffff", "#d0e8ff", "#ffe0a0"],
      sizeRange: [0.1, 0.25],
      spin: false,
    },
    wisps: {
      type: "smoke",
      count: 50,
      area: { width: 15, height: 2, depth: 15 },
      speed: 0.015,
      colors: ["#ffffff", "#f0e8d8", "#e0d8c8", "#d8d0c0"],
      sizeRange: [0.2, 0.6],
      spin: false,
    },
    hemisphereLight: {
      skyColor: "#ffe0a0",
      groundColor: "#8090c0",
      intensity: 0.9,
    },
    sunLight: {
      enabled: true,
      color: "#ffd080",
      intensity: 1.2,
      position: [-10, 25, 15],
    },
  };
}

export function createDefaultRainbowConfig(): RainbowSceneConfig {
  return {
    fog: { color: "#08001a", density: 0.008 },
    hemisphereLight: {
      skyColor: "#ffffff",
      groundColor: "#222244",
      intensity: 0.7,
    },
    platform: {
      enabled: true,
      radius: 5,
      height: 0.4,
      glowIntensity: 0.7,
      spectrumSpeed: 0.15,
    },
  };
}

export function createDefaultVoidConfig(): VoidSceneConfig {
  return {
    ambientIntensity: 0.5,
    platform: {
      enabled: true,
      radius: 5,
      height: 0.35,
      gridColor: "#00aaff",
      glowIntensity: 0.6,
      gridDensity: 1.0,
    },
  };
}
