/**
 * Charcoal effect presets.
 *
 * Each preset sets the CharcoalIntent including semantic values and optional
 * custom colors. The renderer derives CharcoalSparkParams from these via
 * semanticToCharcoalParams, passing color overrides if present.
 *
 * Colors are RGB 0-255 (the renderer normalizes to 0-1 for GPU).
 */

import type { EffectPreset, EffectPresetGroup } from "./types";

export const CHARCOAL_PRESETS: EffectPreset<"charcoal">[] = [
  {
    id: "charcoal-steel-wool",
    name: "Steel Wool",
    previewColor: "#fff1c7",
    patch: {
      intensity: 0.98,
      spread: 0.14,
      glow: 0.96,
      emissionStyle: "steel-wool",
      coreColor: [255, 252, 232],
      midColor: [255, 178, 78],
      coolColor: [125, 24, 4],
    },
  },
  {
    id: "charcoal-forge-cinder",
    name: "Forge Burst",
    previewColor: "#ff7a1a",
    patch: {
      intensity: 0.9,
      spread: 0.42,
      glow: 0.8,
      emissionStyle: "forge-burst",
      coreColor: [255, 238, 190],
      midColor: [255, 102, 20],
      coolColor: [138, 18, 0],
    },
  },
  {
    id: "charcoal-cinder-fan",
    name: "Cinder Fan",
    previewColor: "#ff4930",
    patch: {
      intensity: 1,
      spread: 1,
      glow: 0.68,
      emissionStyle: "cinder-fan",
      coreColor: [255, 230, 174],
      midColor: [255, 72, 20],
      coolColor: [112, 8, 2],
    },
  },
  {
    id: "charcoal-banked-ember",
    name: "Banked Ember",
    previewColor: "#d83b16",
    patch: {
      intensity: 0.62,
      spread: 0.25,
      glow: 0.56,
      emissionStyle: "banked-ember",
      coreColor: [255, 210, 142],
      midColor: [214, 52, 14],
      coolColor: [72, 6, 2],
    },
  },
  {
    id: "charcoal-violet-ember",
    name: "Violet Ember",
    previewColor: "#a855f7",
    patch: {
      intensity: 0.5,
      spread: 0.5,
      glow: 0.6,
      coreColor: [230, 180, 255], // bright lavender
      midColor: [160, 60, 220], // violet
      coolColor: [80, 10, 120], // deep purple
    },
  },
  {
    id: "charcoal-hot-coal",
    name: "Hot Coal",
    previewColor: "#ef4444",
    patch: {
      intensity: 0.88,
      spread: 0.88,
      glow: 0.8,
      coreColor: [255, 240, 200],
      midColor: [255, 80, 20],
      coolColor: [180, 20, 0],
    },
  },
  {
    id: "charcoal-jade-dust",
    name: "Jade Dust",
    previewColor: "#34d399",
    patch: {
      intensity: 0.4,
      spread: 0.7,
      glow: 0.5,
      coreColor: [200, 255, 220], // bright mint
      midColor: [40, 200, 120], // emerald
      coolColor: [10, 90, 50], // dark green
    },
  },
  {
    id: "charcoal-ash",
    name: "Ash",
    previewColor: "#9ca3af",
    patch: {
      intensity: 0.3,
      spread: 0.3,
      glow: 0.2,
      coreColor: [220, 220, 230], // near-white
      midColor: [140, 140, 155], // medium gray
      coolColor: [60, 60, 70], // dark gray
    },
  },
];

export const CHARCOAL_PRESET_GROUP: EffectPresetGroup = {
  effectType: "charcoal",
  presets: CHARCOAL_PRESETS,
  getSummary: (state): string => {
    const i = Math.round(state.charcoal.intensity * 100);
    const s = Math.round(state.charcoal.spread * 100);
    const g = Math.round(state.charcoal.glow * 100);
    return `Intensity ${i}% · Spread ${s}% · Glow ${g}%`;
  },
};
