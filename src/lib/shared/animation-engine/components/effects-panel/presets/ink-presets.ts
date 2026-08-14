import type { EffectPreset, EffectPresetGroup } from "./types";

export const INK_PRESETS: EffectPreset<"ink">[] = [
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
    previewColor: "#a84255",
    patch: {
      palette: "blood",
      ambientEmission: 0.04,
      motionEmission: 0.88,
      intensity: 0.68,
      viscosity: 0.34,
      splatterIntensity: 0.34,
      trackingMode: "both_ends",
    },
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
