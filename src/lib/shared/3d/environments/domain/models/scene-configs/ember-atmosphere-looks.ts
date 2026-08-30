import type {
  FallingParticlesConfig,
  SkyGradientConfig,
} from "../environment-models";
import type { FogConfig, HemisphereLightConfig } from "./shared-scene-config";
import type {
  LavaRiversConfig,
  VolcanicHazeConfig,
} from "./ember-scene-config";

export const EMBER_ATMOSPHERE_LOOK_IDS = [
  "blackglass-inferno",
  "furnace-storm",
  "sulfur-caldera",
] as const;

export type EmberAtmosphereLookId = (typeof EMBER_ATMOSPHERE_LOOK_IDS)[number];

export const DEFAULT_EMBER_ATMOSPHERE_LOOK: EmberAtmosphereLookId =
  "blackglass-inferno";

export interface EmberDirectionalLightConfig {
  position: [number, number, number];
  color: string;
  intensity: number;
}

export interface EmberPointLightConfig extends EmberDirectionalLightConfig {
  distance: number;
  decay: number;
}

export interface EmberHeatFieldConfig {
  position: { x: number; z: number };
  radius: number;
  height: number;
  intensity: number;
}

export interface EmberPlumeConfig {
  position: [number, number, number];
  count: number;
  area: { width: number; height: number; depth: number };
  speed: number;
  colors: string[];
  sizeRange: [number, number];
  opacity: number;
  motionScale: number;
}

interface EmberMaterialLayerConfig {
  tint: string;
  tintBlend: number;
  emissive: string;
  emissiveBlend: number;
  emissiveIntensity: number;
  roughnessScale: number;
  metalnessAdd: number;
}

export interface EmberMaterialTreatmentConfig {
  world: EmberMaterialLayerConfig;
  playableSurface: EmberMaterialLayerConfig;
  meshyGeology: EmberMaterialLayerConfig;
  mineral: EmberMaterialLayerConfig;
}

export interface EmberAtmosphereRigConfig {
  id: EmberAtmosphereLookId;
  label: string;
  directionals: EmberDirectionalLightConfig[];
  points: EmberPointLightConfig[];
  calderaLight: EmberPointLightConfig;
  heatFields: EmberHeatFieldConfig[];
  plumes: EmberPlumeConfig[];
  materials: EmberMaterialTreatmentConfig;
}

export interface EmberAtmosphereLookPreset {
  id: EmberAtmosphereLookId;
  label: string;
  sky: SkyGradientConfig;
  fog: FogConfig;
  lavaRivers: Pick<
    LavaRiversConfig,
    | "baseColor"
    | "hotColor"
    | "crustColor"
    | "flowSpeed"
    | "warpIntensity"
    | "crustCoverage"
  >;
  volcanicHaze: VolcanicHazeConfig;
  embers: FallingParticlesConfig;
  ash: FallingParticlesConfig;
  smoke: FallingParticlesConfig;
  hemisphereLight: HemisphereLightConfig;
  skyLight: {
    enabled: true;
    color: string;
    intensity: number;
    position: [number, number, number];
  };
  rig: EmberAtmosphereRigConfig;
}

const BLACKGLASS_INFERNO: EmberAtmosphereLookPreset = {
  id: "blackglass-inferno",
  label: "Blackglass Inferno",
  sky: {
    topColor: "#020508",
    midColor: "#11151a",
    bottomColor: "#70200e",
  },
  fog: { color: "#160d0e", density: 0.0049 },
  lavaRivers: {
    baseColor: "#e33a05",
    hotColor: "#ffd05b",
    crustColor: "#070303",
    flowSpeed: 0.06,
    warpIntensity: 0.68,
    crustCoverage: 0.46,
  },
  volcanicHaze: {
    enabled: true,
    color1: "#7b2b16",
    color2: "#090b0f",
    opacity: 0.19,
    scale: 2.7,
    animationSpeed: 0.022,
    lightningInterval: 7.5,
    lightningIntensity: 0.16,
    innerGlowColor: "#ff5a12",
    radius: 260,
  },
  embers: {
    type: "embers",
    count: 64,
    area: { width: 28, height: 8, depth: 34 },
    speed: 0.15,
    colors: ["#ff3a08", "#ff6a0a", "#ff9c20", "#ffd070"],
    sizeRange: [0.008, 0.024],
    spin: false,
  },
  ash: {
    type: "dust",
    count: 82,
    area: { width: 34, height: 11, depth: 42 },
    speed: 0.038,
    colors: ["#66514a", "#3d3434", "#796059", "#2c292d"],
    sizeRange: [0.014, 0.055],
    spin: false,
  },
  smoke: {
    type: "smoke",
    count: 24,
    area: { width: 34, height: 10, depth: 38 },
    speed: 0.018,
    colors: ["#160b0b", "#23100d", "#0b080b", "#32120d"],
    sizeRange: [0.12, 0.38],
    spin: false,
  },
  hemisphereLight: {
    skyColor: "#8799a2",
    groundColor: "#2f0d08",
    intensity: 1.32,
  },
  skyLight: {
    enabled: true,
    color: "#ffd2b0",
    intensity: 2.05,
    position: [-18, 24, -10],
  },
  rig: {
    id: "blackglass-inferno",
    label: "Blackglass Inferno",
    directionals: [
      { position: [18, 15, 18], color: "#ffc18c", intensity: 0.72 },
      { position: [-20, 10, 12], color: "#7fa9bd", intensity: 1.22 },
      { position: [0, 24, -6], color: "#ffeadb", intensity: 0.38 },
      { position: [-34, 20, 90], color: "#c84620", intensity: 0.68 },
    ],
    points: [
      {
        position: [-8, 4.6, 15],
        color: "#ff5b13",
        intensity: 118,
        distance: 34,
        decay: 2,
      },
      {
        position: [5, 2.8, 11],
        color: "#ff8a20",
        intensity: 28,
        distance: 20,
        decay: 2,
      },
      {
        position: [-5, 1.1, -1],
        color: "#ff4210",
        intensity: 26,
        distance: 12,
        decay: 2,
      },
      {
        position: [-12, 10, 30],
        color: "#587b91",
        intensity: 96,
        distance: 46,
        decay: 2,
      },
      {
        position: [2, 5, -108],
        color: "#ff4610",
        intensity: 86,
        distance: 44,
        decay: 2,
      },
    ],
    calderaLight: {
      position: [-25, 18, 145],
      color: "#ff3d0b",
      intensity: 168,
      distance: 58,
      decay: 2,
    },
    heatFields: [
      { position: { x: 14, z: 2 }, radius: 3.4, height: 5.2, intensity: 0.035 },
      { position: { x: 8, z: 40 }, radius: 4.8, height: 8, intensity: 0.028 },
      {
        position: { x: -12, z: -72 },
        radius: 5.4,
        height: 7.5,
        intensity: 0.024,
      },
      { position: { x: -25, z: 145 }, radius: 9, height: 15, intensity: 0.024 },
    ],
    plumes: [
      {
        position: [-25, 44, 145],
        count: 64,
        area: { width: 18, height: 34, depth: 16 },
        speed: 0.034,
        colors: ["#2c1a18", "#3c2420", "#171417", "#553029"],
        sizeRange: [1.2, 3.1],
        opacity: 0.12,
        motionScale: 0.7,
      },
      {
        position: [34, 15, -74],
        count: 24,
        area: { width: 8, height: 18, depth: 8 },
        speed: 0.026,
        colors: ["#211719", "#3b2320", "#151216"],
        sizeRange: [0.65, 1.55],
        opacity: 0.075,
        motionScale: 0.6,
      },
      {
        position: [-37, 12, 28],
        count: 18,
        area: { width: 6, height: 12, depth: 6 },
        speed: 0.022,
        colors: ["#271817", "#3d201a", "#171215"],
        sizeRange: [0.45, 1.1],
        opacity: 0.07,
        motionScale: 0.56,
      },
      {
        position: [2, 12, -108],
        count: 32,
        area: { width: 10, height: 22, depth: 9 },
        speed: 0.028,
        colors: ["#231719", "#34201d", "#121216", "#4b271f"],
        sizeRange: [0.8, 1.9],
        opacity: 0.09,
        motionScale: 0.64,
      },
    ],
    materials: {
      world: {
        tint: "#03070a",
        tintBlend: 0.52,
        emissive: "#3a0903",
        emissiveBlend: 0.08,
        emissiveIntensity: 0.16,
        roughnessScale: 1.34,
        metalnessAdd: -0.35,
      },
      playableSurface: {
        tint: "#070b0d",
        tintBlend: 0.34,
        emissive: "#681704",
        emissiveBlend: 0.025,
        emissiveIntensity: 0.05,
        roughnessScale: 1.8,
        metalnessAdd: -0.4,
      },
      meshyGeology: {
        tint: "#151a1c",
        tintBlend: 0.08,
        emissive: "#4a0d03",
        emissiveBlend: 0.06,
        emissiveIntensity: 0.14,
        roughnessScale: 0.88,
        metalnessAdd: 0.05,
      },
      mineral: {
        tint: "#482119",
        tintBlend: 0.035,
        emissive: "#2a0904",
        emissiveBlend: 0.01,
        emissiveIntensity: 0.025,
        roughnessScale: 0.9,
        metalnessAdd: 0,
      },
    },
  },
};

const FURNACE_STORM: EmberAtmosphereLookPreset = {
  ...BLACKGLASS_INFERNO,
  id: "furnace-storm",
  label: "Furnace Storm",
  sky: { topColor: "#120707", midColor: "#46140a", bottomColor: "#b23a10" },
  fog: { color: "#32130d", density: 0.0115 },
  lavaRivers: {
    ...BLACKGLASS_INFERNO.lavaRivers,
    baseColor: "#e74306",
    hotColor: "#ffd057",
    crustCoverage: 0.58,
  },
  volcanicHaze: {
    ...BLACKGLASS_INFERNO.volcanicHaze,
    color1: "#b93b13",
    color2: "#260807",
    opacity: 0.18,
    scale: 2.8,
    animationSpeed: 0.032,
    lightningInterval: 4.6,
    lightningIntensity: 0.3,
  },
  embers: {
    ...BLACKGLASS_INFERNO.embers,
    count: 150,
    speed: 0.22,
  },
  ash: {
    ...BLACKGLASS_INFERNO.ash,
    count: 124,
    colors: ["#8d5541", "#5c3b35", "#aa704e", "#392b2c"],
  },
  smoke: {
    ...BLACKGLASS_INFERNO.smoke,
    count: 38,
    colors: ["#35130e", "#541d12", "#1e1010", "#6b2514"],
  },
  hemisphereLight: {
    skyColor: "#b87056",
    groundColor: "#8e240b",
    intensity: 1.18,
  },
  skyLight: {
    enabled: true,
    color: "#ffb677",
    intensity: 1.9,
    position: [-12, 22, -8],
  },
  rig: {
    ...BLACKGLASS_INFERNO.rig,
    id: "furnace-storm",
    label: "Furnace Storm",
    directionals: [
      { position: [16, 18, 12], color: "#ffad65", intensity: 0.86 },
      { position: [-18, 12, 14], color: "#a06f6a", intensity: 0.54 },
      { position: [0, 26, -4], color: "#ffe1bf", intensity: 0.42 },
      { position: [-30, 18, 86], color: "#ff5520", intensity: 0.82 },
    ],
    points: BLACKGLASS_INFERNO.rig.points.map((light) => ({
      ...light,
      intensity: light.intensity * 1.25,
      color: "#ff6720",
    })),
    plumes: BLACKGLASS_INFERNO.rig.plumes.map((plume) => ({
      ...plume,
      count: Math.max(12, Math.floor(plume.count * 0.72)),
    })),
    calderaLight: {
      ...BLACKGLASS_INFERNO.rig.calderaLight,
      intensity: 215,
      distance: 68,
    },
    materials: {
      ...BLACKGLASS_INFERNO.rig.materials,
      world: {
        ...BLACKGLASS_INFERNO.rig.materials.world,
        tint: "#4b1b0f",
        tintBlend: 0.16,
        emissiveIntensity: 0.24,
      },
      playableSurface: {
        ...BLACKGLASS_INFERNO.rig.materials.playableSurface,
        tint: "#32100b",
        tintBlend: 0.22,
        emissiveIntensity: 0.32,
      },
    },
  },
};

const SULFUR_CALDERA: EmberAtmosphereLookPreset = {
  ...BLACKGLASS_INFERNO,
  id: "sulfur-caldera",
  label: "Sulfur Caldera",
  sky: { topColor: "#080b08", midColor: "#27301a", bottomColor: "#7f5a13" },
  fog: { color: "#293019", density: 0.0105 },
  lavaRivers: {
    ...BLACKGLASS_INFERNO.lavaRivers,
    baseColor: "#bd3704",
    hotColor: "#ffd65a",
    crustColor: "#0b0904",
    crustCoverage: 0.7,
  },
  volcanicHaze: {
    ...BLACKGLASS_INFERNO.volcanicHaze,
    color1: "#767023",
    color2: "#12150c",
    opacity: 0.135,
    scale: 1.85,
    animationSpeed: 0.018,
    lightningIntensity: 0.08,
    innerGlowColor: "#e8b83d",
  },
  embers: {
    ...BLACKGLASS_INFERNO.embers,
    count: 78,
    colors: ["#ff6a0a", "#ffa21b", "#ffd84e", "#fff09a"],
  },
  ash: {
    ...BLACKGLASS_INFERNO.ash,
    count: 112,
    colors: ["#77735b", "#505241", "#91855b", "#363a31"],
  },
  smoke: {
    ...BLACKGLASS_INFERNO.smoke,
    count: 30,
    colors: ["#22251b", "#3a3c25", "#151812", "#4b4524"],
  },
  hemisphereLight: {
    skyColor: "#879078",
    groundColor: "#60541e",
    intensity: 1.12,
  },
  skyLight: {
    enabled: true,
    color: "#e5e1b0",
    intensity: 1.72,
    position: [-20, 25, -4],
  },
  rig: {
    ...BLACKGLASS_INFERNO.rig,
    id: "sulfur-caldera",
    label: "Sulfur Caldera",
    directionals: [
      { position: [18, 16, 14], color: "#d9d3a5", intensity: 0.64 },
      { position: [-22, 11, 16], color: "#789082", intensity: 0.68 },
      { position: [0, 25, -5], color: "#fff3cb", intensity: 0.34 },
      { position: [-34, 20, 88], color: "#a88724", intensity: 0.62 },
    ],
    points: BLACKGLASS_INFERNO.rig.points.map((light, index) => ({
      ...light,
      color: index === 3 ? "#698c86" : "#df9b25",
      intensity: light.intensity * 0.88,
    })),
    calderaLight: {
      ...BLACKGLASS_INFERNO.rig.calderaLight,
      color: "#e6a82a",
      intensity: 150,
    },
    materials: {
      ...BLACKGLASS_INFERNO.rig.materials,
      world: {
        ...BLACKGLASS_INFERNO.rig.materials.world,
        tint: "#2f311d",
        tintBlend: 0.13,
        emissive: "#48400f",
      },
      mineral: {
        ...BLACKGLASS_INFERNO.rig.materials.mineral,
        tint: "#9d7c23",
        tintBlend: 0.28,
        emissive: "#6c5310",
      },
    },
  },
};

const LOOKS: Record<EmberAtmosphereLookId, EmberAtmosphereLookPreset> = {
  "blackglass-inferno": BLACKGLASS_INFERNO,
  "furnace-storm": FURNACE_STORM,
  "sulfur-caldera": SULFUR_CALDERA,
};

export function isEmberAtmosphereLookId(
  value: string | null | undefined
): value is EmberAtmosphereLookId {
  return EMBER_ATMOSPHERE_LOOK_IDS.includes(value as EmberAtmosphereLookId);
}

export function getEmberAtmosphereLook(
  id: EmberAtmosphereLookId = DEFAULT_EMBER_ATMOSPHERE_LOOK
): EmberAtmosphereLookPreset {
  return LOOKS[id];
}
