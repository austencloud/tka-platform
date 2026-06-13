import type { EffectPreset, EffectPresetGroup } from "./types";

export const INK_PRESETS: EffectPreset<"ink">[] = [
  {
    id: "ink-classic",
    name: "Classic",
    previewColor: "#0a0a0a",
    patch: {
      palette: "india",
      ambientEmission: 0.2,
      motionEmission: 0.8,
      intensity: 0.6,
      viscosity: 0.3,
      splatterIntensity: 0.3,
      trackingMode: "both_ends",
    },
  },
  {
    id: "ink-drip",
    name: "Drip",
    previewColor: "#1a1a1a",
    patch: {
      palette: "india",
      ambientEmission: 0.3,
      motionEmission: 0.5,
      intensity: 0.8,
      viscosity: 0.7,
      splatterIntensity: 0.5,
      trackingMode: "both_ends",
    },
  },
  {
    id: "ink-watercolor-wash",
    name: "Watercolor",
    previewColor: "#4080c0",
    patch: {
      palette: "watercolor",
      ambientEmission: 0.1,
      motionEmission: 0.7,
      intensity: 0.5,
      viscosity: 0.1,
      splatterIntensity: 0.1,
      trackingMode: "both_ends",
    },
  },
  {
    id: "ink-neon-tag",
    name: "Neon Tag",
    previewColor: "#ff2080",
    patch: {
      palette: "neon",
      ambientEmission: 0.1,
      motionEmission: 1.0,
      intensity: 0.9,
      viscosity: 0.2,
      splatterIntensity: 0.4,
      trackingMode: "both_ends",
    },
  },
  {
    id: "ink-splatter",
    name: "Splatter",
    previewColor: "#8a1818",
    patch: {
      palette: "blood",
      ambientEmission: 0.1,
      motionEmission: 0.6,
      intensity: 0.7,
      viscosity: 0.8,
      splatterIntensity: 1.0,
      trackingMode: "both_ends",
    },
  },
  {
    id: "ink-toxic",
    name: "Toxic",
    previewColor: "#7fd94a",
    patch: {
      palette: "acid",
      ambientEmission: 0.2,
      motionEmission: 0.7,
      intensity: 0.6,
      viscosity: 0.5,
      splatterIntensity: 0.6,
      trackingMode: "both_ends",
    },
  },
  {
    // "Custom" just opens Customize - empty patch, marks the chip active.
    id: "ink-custom",
    name: "Custom",
    previewColor: "custom",
    patch: {},
  },
];

export const INK_PRESET_GROUP: EffectPresetGroup = {
  effectType: "ink",
  presets: INK_PRESETS,
  getSummary: (state) => {
    const s = state.ink;
    return `${s.palette} · amb ${Math.round(s.ambientEmission * 100)}% · mot ${Math.round(s.motionEmission * 100)}% · int ${Math.round(s.intensity * 100)}%`;
  },
};
