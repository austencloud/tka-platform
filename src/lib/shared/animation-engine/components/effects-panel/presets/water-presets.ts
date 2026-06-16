import type { EffectPreset, EffectPresetGroup } from "./types";

export const WATER_PRESETS: EffectPreset<"water">[] = [
  {
    id: "water-classic",
    name: "Classic",
    previewColor: "#3a7fd9",
    patch: {
      palette: "classic",
      ambientEmission: 0.4,
      motionEmission: 0.6,
      intensity: 0.6,
      clarity: 0.7,
      surfaceTension: 0.3,
      trackingMode: "both_ends",
    },
  },
  {
    id: "water-fountain",
    name: "Fountain",
    previewColor: "#6fb3ff",
    patch: {
      palette: "classic",
      ambientEmission: 0.9,
      motionEmission: 0.2,
      intensity: 0.7,
      clarity: 0.7,
      surfaceTension: 0.3,
      trackingMode: "both_ends",
    },
  },
  {
    id: "water-whip",
    name: "Whip",
    previewColor: "#e8f4ff",
    patch: {
      palette: "classic",
      ambientEmission: 0.0,
      motionEmission: 1.0,
      intensity: 0.8,
      clarity: 0.8,
      surfaceTension: 0.2,
      trackingMode: "both_ends",
    },
  },
  {
    id: "water-mercury",
    name: "Mercury",
    previewColor: "#9a9fa8",
    patch: {
      palette: "mercury",
      ambientEmission: 0.3,
      motionEmission: 0.5,
      intensity: 0.7,
      clarity: 0.2,
      surfaceTension: 1.0,
      trackingMode: "both_ends",
    },
  },
  {
    id: "water-acid",
    name: "Acid",
    previewColor: "#7fd94a",
    patch: {
      palette: "acid",
      ambientEmission: 0.6,
      motionEmission: 0.6,
      intensity: 0.8,
      clarity: 0.6,
      surfaceTension: 0.5,
      trackingMode: "both_ends",
    },
  },
  {
    id: "water-blood",
    name: "Ritual",
    previewColor: "#8a1818",
    patch: {
      palette: "blood",
      ambientEmission: 0.2,
      motionEmission: 0.3,
      intensity: 0.9,
      clarity: 0.4,
      surfaceTension: 0.8,
      trackingMode: "both_ends",
    },
  },
  {
    id: "water-spirit",
    name: "Spirit",
    previewColor: "#80ffe8",
    patch: {
      palette: "spirit",
      ambientEmission: 0.7,
      motionEmission: 0.3,
      intensity: 0.5,
      clarity: 0.9,
      surfaceTension: 0.0,
      trackingMode: "both_ends",
    },
  },
  {
    // "Custom" just opens the Customize panel - empty patch, marks the chip active.
    id: "water-custom",
    name: "Custom",
    previewColor: "custom",
    patch: {},
  },
];

export const WATER_PRESET_GROUP: EffectPresetGroup = {
  effectType: "water",
  presets: WATER_PRESETS,
  getSummary: (state) => {
    const w = state.water;
    return `${w.palette} · amb ${Math.round(w.ambientEmission * 100)}% · mot ${Math.round(w.motionEmission * 100)}%`;
  },
};
