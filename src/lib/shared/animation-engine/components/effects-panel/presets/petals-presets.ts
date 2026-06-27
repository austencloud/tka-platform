import type { EffectPreset, EffectPresetGroup } from "./types";

export const PETALS_PRESETS: EffectPreset<"petals">[] = [
  {
    id: "petals-classic",
    name: "Classic",
    previewColor: "#ffc0d8",
    patch: {
      palette: "blossom",
      ambientEmission: 0.22,
      motionEmission: 0.8,
      intensity: 0.5,
      swayAmplitude: 0.6,
      carry: 0.72,
      streakLength: 0.6,
      fallSpeed: 0.4,
      trackingMode: "both_ends",
    },
  },
  {
    id: "petals-storm",
    name: "Storm",
    previewColor: "#d84820",
    patch: {
      palette: "autumn",
      ambientEmission: 0.45,
      motionEmission: 0.9,
      intensity: 0.55,
      swayAmplitude: 0.8,
      carry: 0.8,
      streakLength: 0.7,
      fallSpeed: 0.7,
      trackingMode: "both_ends",
    },
  },
  {
    id: "petals-jungle",
    name: "Jungle Drift",
    previewColor: "#408840",
    patch: {
      palette: "jungle",
      ambientEmission: 0.2,
      motionEmission: 0.8,
      intensity: 0.5,
      swayAmplitude: 0.5,
      carry: 0.7,
      streakLength: 0.6,
      fallSpeed: 0.5,
      trackingMode: "both_ends",
    },
  },
  {
    id: "petals-ember",
    name: "Ember Ash",
    previewColor: "#ff6020",
    patch: {
      palette: "ash",
      ambientEmission: 0.15,
      motionEmission: 0.85,
      intensity: 0.45,
      swayAmplitude: 0.7,
      carry: 0.7,
      streakLength: 0.55,
      fallSpeed: 0.5,
      trackingMode: "both_ends",
    },
  },
  {
    id: "petals-gilded",
    name: "Gilded",
    previewColor: "#ffd060",
    patch: {
      palette: "gold",
      ambientEmission: 0.28,
      motionEmission: 0.6,
      intensity: 0.55,
      swayAmplitude: 0.4,
      carry: 0.6,
      streakLength: 0.5,
      fallSpeed: 0.25,
      trackingMode: "both_ends",
    },
  },
  {
    id: "petals-tornado",
    name: "Tornado",
    previewColor: "#c86828",
    patch: {
      palette: "autumn",
      ambientEmission: 0.3,
      motionEmission: 1.0,
      intensity: 0.5,
      swayAmplitude: 1.0,
      carry: 0.95,
      streakLength: 0.9,
      fallSpeed: 0.8,
      trackingMode: "both_ends",
    },
  },
];

export const PETALS_PRESET_GROUP: EffectPresetGroup = {
  effectType: "petals",
  presets: PETALS_PRESETS,
  getSummary: (state) => {
    const p = state.petals;
    return `${p.palette} · amb ${Math.round(p.ambientEmission * 100)}% · mot ${Math.round(p.motionEmission * 100)}% · carry ${Math.round(p.carry * 100)}%`;
  },
};
