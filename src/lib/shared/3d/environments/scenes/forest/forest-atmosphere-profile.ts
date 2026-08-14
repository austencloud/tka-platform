import type { ForestSceneConfig } from "../../domain/models/scene-configs/forest-scene-config";
import { createDefaultForestFireflyConfig } from "../../domain/models/scene-configs/forest-scene-config";

export const FOREST_ATMOSPHERE_ANCHOR_IDS = [
  "dawn",
  "day",
  "goldenHour",
  "dusk",
  "night",
] as const;

export type ForestAtmosphereAnchorId =
  (typeof FOREST_ATMOSPHERE_ANCHOR_IDS)[number];

export interface ForestAtmosphereAnchor {
  id: ForestAtmosphereAnchorId;
  label: string;
  hour: number;
  config: ForestSceneConfig;
}

interface AnchorValues {
  id: Exclude<ForestAtmosphereAnchorId, "night">;
  label: string;
  hour: number;
  sky: ForestSceneConfig["sky"];
  sun: NonNullable<ForestSceneConfig["sun"]>;
  clouds: NonNullable<ForestSceneConfig["clouds"]>;
  fog: ForestSceneConfig["fog"];
  hemisphere: ForestSceneConfig["hemisphereLight"];
  lighting: NonNullable<ForestSceneConfig["lighting"]>;
  campfireLightScale: number;
  fireflies: ForestSceneConfig["fireflies"];
  canopyFlight: NonNullable<ForestSceneConfig["canopyFlight"]>;
  leafColors: string[];
  materials: NonNullable<ForestSceneConfig["materialResponse"]>;
}

const ANCHOR_VALUES: Record<
  Exclude<ForestAtmosphereAnchorId, "night">,
  AnchorValues
> = {
  dawn: {
    id: "dawn",
    label: "Dawn",
    hour: 5.75,
    sky: {
      topColor: "#5b769d",
      midColor: "#e7a47f",
      bottomColor: "#f5c48e",
    },
    sun: {
      enabled: true,
      direction: [-26, 5, -58],
      angularDiameterDegrees: 0.7,
      color: "#ffd4a0",
      opacity: 0.92,
      glowScale: 8,
      glowOpacity: 0.2,
    },
    clouds: {
      enabled: true,
      coverage: 0.6,
      density: 0.76,
      driftSpeed: 0.012,
      sunDirection: [-26, 5, -58],
      litColor: "#ffe2c2",
      shadowColor: "#74849d",
      opacity: 0.58,
      scale: 5.4,
      offset: [0.1, 0],
      visualSource: "celestial-2d",
      horizonFade: -0.04,
      zenithFade: 0.94,
    },
    fog: { color: "#667a70", density: 0.014 },
    hemisphere: {
      skyColor: "#98b4c5",
      groundColor: "#344b35",
      intensity: 1,
    },
    lighting: {
      key: {
        color: "#ffc58f",
        intensity: 1.55,
        direction: [-26, 5, -58],
        shadowIntensity: 0.58,
      },
      fill: { color: "#78999f", intensity: 0.5 },
      ambient: { color: "#9aaca0", intensity: 0.18 },
      stage: { color: "#e2ba86", intensity: 20, distance: 15 },
    },
    campfireLightScale: 0.34,
    fireflies: null,
    canopyFlight: "none",
    leafColors: ["#315f2d", "#2a5127", "#3b6b35", "#244825"],
    materials: {
      terrainTint: "#d1ccb2",
      forestFloorTint: "#b7b998",
      foliageTint: "#c5d1a8",
      woodyTint: "#d4c0a9",
      foliageHighlightTint: "#70885d",
      foliageHighlightStrength: 0.35,
      groundLifeTint: "#bdc9a2",
      stageTint: "#d9b58b",
      campTint: "#d3c8bb",
      emissiveScale: 0.2,
    },
  },
  day: {
    id: "day",
    label: "Day",
    hour: 12.5,
    sky: {
      topColor: "#2278b7",
      midColor: "#72becf",
      bottomColor: "#c8d9a6",
    },
    sun: {
      enabled: true,
      direction: [-20, 55, -44],
      angularDiameterDegrees: 0.64,
      color: "#fff4d2",
      opacity: 0.96,
      glowScale: 5.5,
      glowOpacity: 0.12,
    },
    clouds: {
      enabled: true,
      coverage: 0.54,
      density: 0.88,
      driftSpeed: 0.014,
      sunDirection: [-20, 55, -44],
      litColor: "#ffffff",
      shadowColor: "#8ca3b5",
      opacity: 0.82,
      scale: 5,
      offset: [0, 0],
      visualSource: "celestial-2d",
      horizonFade: -0.08,
      zenithFade: 0.96,
    },
    fog: { color: "#6f8678", density: 0.006 },
    hemisphere: {
      skyColor: "#c8e7ed",
      groundColor: "#3b5335",
      intensity: 1,
    },
    lighting: {
      key: {
        color: "#ffe8b5",
        intensity: 2.4,
        direction: [-20, 55, -44],
        shadowIntensity: 0.78,
      },
      fill: { color: "#8fa79c", intensity: 0.32 },
      ambient: { color: "#c4d1c4", intensity: 0.11 },
      stage: { color: "#dce6cf", intensity: 0, distance: 0 },
    },
    campfireLightScale: 0,
    fireflies: null,
    canopyFlight: "none",
    leafColors: ["#3b7334", "#2f642d", "#4b8140", "#28572a"],
    materials: {
      terrainTint: "#ffffff",
      forestFloorTint: "#ffffff",
      foliageTint: "#ffffff",
      woodyTint: "#d0a477",
      foliageHighlightTint: "#61a84f",
      foliageHighlightStrength: 0.78,
      groundLifeTint: "#ffffff",
      stageTint: "#e2b263",
      campTint: "#cfdfd4",
      emissiveScale: 0,
    },
  },
  goldenHour: {
    id: "goldenHour",
    label: "Golden Hour",
    hour: 18.25,
    sky: {
      topColor: "#477aa0",
      midColor: "#c96f3f",
      bottomColor: "#edbd73",
    },
    sun: {
      enabled: true,
      direction: [30, 8, -58],
      angularDiameterDegrees: 0.74,
      color: "#ffca78",
      opacity: 0.95,
      glowScale: 8.5,
      glowOpacity: 0.24,
    },
    clouds: {
      enabled: true,
      coverage: 0.6,
      density: 0.78,
      driftSpeed: 0.011,
      sunDirection: [30, 8, -58],
      litColor: "#ffd9aa",
      shadowColor: "#8e7479",
      opacity: 0.64,
      scale: 5.2,
      offset: [-0.1, 0],
      visualSource: "celestial-2d",
      horizonFade: -0.02,
      zenithFade: 0.94,
    },
    fog: { color: "#75634e", density: 0.016 },
    hemisphere: {
      skyColor: "#bdc5bd",
      groundColor: "#4f4b31",
      intensity: 1.05,
    },
    lighting: {
      key: {
        color: "#ffb86b",
        intensity: 1.8,
        direction: [30, 8, -58],
        shadowIntensity: 0.66,
      },
      fill: { color: "#829a9a", intensity: 0.45 },
      ambient: { color: "#b7aa8b", intensity: 0.16 },
      stage: { color: "#f1b76d", intensity: 18, distance: 16 },
    },
    campfireLightScale: 0.2,
    fireflies: null,
    canopyFlight: "none",
    leafColors: ["#496b30", "#36592a", "#65763b", "#2f4d27"],
    materials: {
      terrainTint: "#d1c39a",
      forestFloorTint: "#b2aa79",
      foliageTint: "#d1c998",
      woodyTint: "#d9ad83",
      foliageHighlightTint: "#7d8950",
      foliageHighlightStrength: 0.35,
      groundLifeTint: "#c5b88e",
      stageTint: "#e2b875",
      campTint: "#e2c29a",
      emissiveScale: 0.18,
    },
  },
  dusk: {
    id: "dusk",
    label: "Dusk",
    hour: 20.25,
    sky: {
      topColor: "#1d2c55",
      midColor: "#714c78",
      bottomColor: "#d7806b",
    },
    sun: {
      enabled: true,
      direction: [32, 2.4, -60],
      angularDiameterDegrees: 0.8,
      color: "#ff9a62",
      opacity: 0.74,
      glowScale: 10,
      glowOpacity: 0.2,
    },
    clouds: {
      enabled: true,
      coverage: 0.52,
      density: 0.72,
      driftSpeed: 0.008,
      sunDirection: [32, 2.4, -60],
      litColor: "#d99aa0",
      shadowColor: "#3e4764",
      opacity: 0.5,
      scale: 5.6,
      offset: [0.14, 0],
      visualSource: "celestial-2d",
      horizonFade: 0,
      zenithFade: 0.92,
    },
    fog: { color: "#394248", density: 0.021 },
    hemisphere: {
      skyColor: "#7d91ab",
      groundColor: "#25382e",
      intensity: 0.8,
    },
    lighting: {
      key: {
        color: "#cf8e85",
        intensity: 1.1,
        direction: [32, 2.4, -60],
        shadowIntensity: 0.5,
      },
      fill: { color: "#687f8b", intensity: 0.32 },
      ambient: { color: "#829095", intensity: 0.14 },
      stage: { color: "#a9c7c3", intensity: 32, distance: 16 },
    },
    campfireLightScale: 0.64,
    fireflies: {
      type: "fireflies",
      count: 26,
      area: { width: 8, height: 2, depth: 8 },
      speed: 0.004,
      colors: ["#d4e157"],
      sizeRange: [0.16, 0.31],
      spin: false,
    },
    canopyFlight: "bats",
    leafColors: ["#28452b", "#213b28", "#345033", "#1d3425"],
    materials: {
      terrainTint: "#b5b2bd",
      forestFloorTint: "#929d91",
      foliageTint: "#adb9b2",
      woodyTint: "#b7a8aa",
      foliageHighlightTint: "#58705e",
      foliageHighlightStrength: 0.24,
      groundLifeTint: "#aab6af",
      stageTint: "#bb9da2",
      campTint: "#b7a5a7",
      emissiveScale: 0.5,
    },
  },
};

function scaleCampfire(
  campfire: ForestSceneConfig["campfire"],
  scale: number
): ForestSceneConfig["campfire"] {
  if (!campfire) return null;
  return {
    ...campfire,
    primaryLight: {
      ...campfire.primaryLight,
      intensity: campfire.primaryLight.intensity * scale,
    },
    fillLight: {
      ...campfire.fillLight,
      intensity: campfire.fillLight.intensity * scale,
    },
  };
}

function createAnchor(values: AnchorValues): ForestAtmosphereAnchor {
  const night = createDefaultForestFireflyConfig();
  return {
    id: values.id,
    label: values.label,
    hour: values.hour,
    config: {
      ...night,
      sky: { ...values.sky },
      sun: { ...values.sun },
      clouds: {
        ...values.clouds,
        offset: values.clouds.offset
          ? ([...values.clouds.offset] as [number, number])
          : undefined,
      },
      moon: null,
      starfield: null,
      shootingStars: null,
      fog: { ...values.fog },
      hemisphereLight: { ...values.hemisphere },
      lighting: {
        key: { ...values.lighting.key },
        fill: { ...values.lighting.fill },
        ambient: { ...values.lighting.ambient },
        stage: { ...values.lighting.stage },
      },
      campfire: scaleCampfire(night.campfire, values.campfireLightScale),
      fireflies: values.fireflies
        ? {
            ...values.fireflies,
            area: { ...values.fireflies.area },
            colors: [...values.fireflies.colors],
            sizeRange: [...values.fireflies.sizeRange] as [number, number],
          }
        : null,
      canopyFlight: values.canopyFlight,
      materialResponse: { ...values.materials },
      leaves: {
        ...night.leaves,
        colors: [...values.leafColors],
      },
    },
  };
}

export function isForestAtmosphereAnchorId(
  value: string | null
): value is ForestAtmosphereAnchorId {
  return FOREST_ATMOSPHERE_ANCHOR_IDS.some((id) => id === value);
}

export function createForestAtmosphereAnchor(
  id: ForestAtmosphereAnchorId
): ForestAtmosphereAnchor {
  if (id === "night") {
    return {
      id,
      label: "Night",
      hour: 23,
      config: createDefaultForestFireflyConfig(),
    };
  }
  return createAnchor(ANCHOR_VALUES[id]);
}

export function createForestAtmosphereAnchors(): ForestAtmosphereAnchor[] {
  return FOREST_ATMOSPHERE_ANCHOR_IDS.map(createForestAtmosphereAnchor);
}
