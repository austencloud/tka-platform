/** Ocean environment configuration and production defaults. */

import { OCEAN_WATER_DEPTH_METERS } from "../ocean-water-depth";
import type {
  FallingParticlesConfig,
  SkyGradientConfig,
} from "../environment-models";
import type {
  FogConfig,
  GroundConfig,
  HemisphereLightConfig,
  RuinsPlatformConfig,
  TreeRingConfig,
} from "./shared-scene-config";

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
  densityCurve: "flat" | "bell";
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

  qualityTier?: "auto" | "ultra" | "medium" | "low";

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

const OCEAN_KELP_RINGS: TreeRingConfig[] = [
  {
    radius: 12,
    count: 14,
    scaleBase: 1.2,
    scaleVariation: 0.4,
    radiusJitter: 1.0,
  },
  {
    radius: 16,
    count: 20,
    scaleBase: 1.0,
    scaleVariation: 0.3,
    radiusJitter: 1.5,
  },
  {
    radius: 20,
    count: 26,
    scaleBase: 0.8,
    scaleVariation: 0.25,
    radiusJitter: 2.0,
  },
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
      height: Math.ceil(OCEAN_WATER_DEPTH_METERS),
      speed: 0.3,
      swayAmount: 1.2,
    },
    caustics: null,
    waterSurface: {
      enabled: true,
      height: OCEAN_WATER_DEPTH_METERS,
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
      heightAboveSurface: 1.1,
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
      densityCurve: "bell",
    },
    meshyFormations: {
      enabled: true,
      count: 35,
      models: [
        {
          path: "basalt_pinnacle.glb",
          name: "Basalt Pinnacle",
          baseScale: 1.0,
          rotationRange: [0, Math.PI * 2],
          weight: 1.0,
          category: "landmark",
        },
        {
          path: "coral_encrusted_rock.glb",
          name: "Coral Encrusted Rock",
          baseScale: 0.8,
          rotationRange: [0, Math.PI * 2],
          weight: 1.5,
          category: "formation",
        },
        {
          path: "coral_mountain.glb",
          name: "Coral Mountain",
          baseScale: 1.2,
          rotationRange: [0, Math.PI * 2],
          weight: 1.0,
          category: "landmark",
        },
        {
          path: "neon_coral_summit.glb",
          name: "Neon Coral Summit",
          baseScale: 1.0,
          rotationRange: [0, Math.PI * 2],
          weight: 1.0,
          category: "landmark",
        },
        {
          path: "submerged_coral_citadel.glb",
          name: "Submerged Coral Citadel",
          baseScale: 1.0,
          rotationRange: [0, Math.PI * 2],
          weight: 1.2,
          category: "landmark",
        },
        {
          path: "sunlit_coral_arch.glb",
          name: "Sunlit Coral Arch",
          baseScale: 0.9,
          rotationRange: [0, Math.PI * 2],
          weight: 1.0,
          category: "landmark",
        },
        {
          path: "underwater_coral_arch.glb",
          name: "Underwater Coral Arch",
          baseScale: 0.9,
          rotationRange: [0, Math.PI * 2],
          weight: 1.0,
          category: "any",
        },
        {
          path: "underwater_rock_table.glb",
          name: "Underwater Rock Table",
          baseScale: 0.7,
          rotationRange: [0, Math.PI * 2],
          weight: 1.3,
          category: "formation",
        },
        {
          path: "photorealistic_coral_0.glb",
          name: "Photorealistic Coral A",
          baseScale: 0.8,
          rotationRange: [0, Math.PI * 2],
          weight: 1.0,
          category: "any",
        },
        {
          path: "photorealistic_coral_1.glb",
          name: "Photorealistic Coral B",
          baseScale: 0.8,
          rotationRange: [0, Math.PI * 2],
          weight: 1.0,
          category: "any",
        },
        {
          path: "photorealistic_coral_2.glb",
          name: "Photorealistic Coral C",
          baseScale: 0.7,
          rotationRange: [0, Math.PI * 2],
          weight: 1.0,
          category: "formation",
        },
        {
          path: "photorealistic_coral_3.glb",
          name: "Photorealistic Coral D",
          baseScale: 0.7,
          rotationRange: [0, Math.PI * 2],
          weight: 1.0,
          category: "formation",
        },
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
