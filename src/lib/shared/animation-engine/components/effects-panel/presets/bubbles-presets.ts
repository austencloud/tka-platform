import type { EffectPreset, EffectPresetGroup } from "./types";

export const BUBBLES_PRESETS: EffectPreset<"bubbles">[] = [
  {
    id: "bubbles-classic",
    name: "Classic",
    previewColor: "#c8e0ff",
    patch: {
      palette: "soap",
      ambientEmission: 0.3,
      motionEmission: 0.5,
      intensity: 0.6,
      sizeJitter: 0.4,
      buoyancy: 0.5,
      trackingMode: "both_ends",
    },
  },
  {
    id: "bubbles-fizz",
    name: "Fizz",
    previewColor: "#f4e8c8",
    patch: {
      palette: "champagne",
      ambientEmission: 0.6,
      motionEmission: 0.5,
      intensity: 0.5,
      sizeJitter: 0.2,
      buoyancy: 0.9,
      trackingMode: "both_ends",
    },
  },
  {
    id: "bubbles-dream",
    name: "Dream",
    previewColor: "#e8f4ff",
    patch: {
      palette: "soap",
      ambientEmission: 0.5,
      motionEmission: 0.2,
      intensity: 0.9,
      sizeJitter: 0.7,
      buoyancy: 0.3,
      trackingMode: "both_ends",
    },
  },
  {
    id: "bubbles-iridescent",
    name: "Iridescent",
    previewColor: "#c080ff",
    patch: {
      palette: "oil",
      ambientEmission: 0.4,
      motionEmission: 0.4,
      intensity: 0.7,
      sizeJitter: 0.5,
      buoyancy: 0.5,
      trackingMode: "both_ends",
    },
  },
  {
    id: "bubbles-acid",
    name: "Acid Fizz",
    previewColor: "#b8ff6f",
    patch: {
      palette: "acid",
      ambientEmission: 0.5,
      motionEmission: 0.6,
      intensity: 0.6,
      sizeJitter: 0.3,
      buoyancy: 0.8,
      trackingMode: "both_ends",
    },
  },
  {
    id: "bubbles-spirit",
    name: "Spirit",
    previewColor: "#c0fff4",
    patch: {
      palette: "spirit",
      ambientEmission: 0.6,
      motionEmission: 0.3,
      intensity: 0.4,
      sizeJitter: 0.6,
      buoyancy: 0.4,
      trackingMode: "both_ends",
    },
  },
];

export const BUBBLES_PRESET_GROUP: EffectPresetGroup = {
  effectType: "bubbles",
  presets: BUBBLES_PRESETS,
  getSummary: (state) => {
    const b = state.bubbles;
    return `${b.palette} · amb ${Math.round(b.ambientEmission * 100)}% · mot ${Math.round(b.motionEmission * 100)}% · rise ${Math.round(b.buoyancy * 100)}%`;
  },
};
