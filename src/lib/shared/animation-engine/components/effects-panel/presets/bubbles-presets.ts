import type { EffectPreset, EffectPresetGroup } from "./types";

/**
 * Preset sizing note: `intensity` scales the base radius and `sizeJitter`
 * widens the spread above the floor rather than inflating every bubble.
 * These values were retuned when the renderer moved to a power-law size
 * distribution - the old numbers were calibrated against a growth model
 * that tripled each bubble's radius over its lifetime.
 */
export const BUBBLES_PRESETS: EffectPreset<"bubbles">[] = [
  {
    id: "bubbles-classic",
    name: "Classic",
    previewColor: "#c8e0ff",
    patch: {
      palette: "soap",
      ambientEmission: 0.3,
      motionEmission: 0.55,
      intensity: 0.42,
      sizeJitter: 0.45,
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
      ambientEmission: 0.85,
      motionEmission: 0.6,
      intensity: 0.25,
      sizeJitter: 0.15,
      buoyancy: 0.95,
      trackingMode: "both_ends",
    },
  },
  {
    id: "bubbles-dream",
    name: "Dream",
    previewColor: "#e8f4ff",
    patch: {
      palette: "soap",
      ambientEmission: 0.32,
      motionEmission: 0.2,
      intensity: 0.68,
      sizeJitter: 0.85,
      buoyancy: 0.2,
      trackingMode: "both_ends",
    },
  },
  {
    id: "bubbles-iridescent",
    name: "Iridescent",
    previewColor: "#c080ff",
    patch: {
      palette: "oil",
      ambientEmission: 0.35,
      motionEmission: 0.45,
      intensity: 0.5,
      sizeJitter: 0.6,
      buoyancy: 0.45,
      trackingMode: "both_ends",
    },
  },
  {
    id: "bubbles-acid",
    name: "Acid Fizz",
    previewColor: "#b8ff6f",
    patch: {
      palette: "acid",
      ambientEmission: 0.7,
      motionEmission: 0.7,
      intensity: 0.28,
      sizeJitter: 0.25,
      buoyancy: 0.85,
      trackingMode: "both_ends",
    },
  },
  {
    id: "bubbles-spirit",
    name: "Spirit",
    previewColor: "#c0fff4",
    patch: {
      palette: "spirit",
      ambientEmission: 0.45,
      motionEmission: 0.3,
      intensity: 0.4,
      sizeJitter: 0.7,
      buoyancy: 0.28,
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
