import type { EffectPreset, EffectPresetGroup } from "./types";

export const SILK_PRESETS: EffectPreset<"silk">[] = [
  {
    id: "silk-classic",
    name: "Classic",
    previewColor: "#c0c0d0",
    patch: {
      form: "ribbon",
      palette: "satin",
      intensity: 0.7,
      width: 0.5,
      duration: 0.5,
      flutter: 0.3,
      tautness: 0.5,
      trackingMode: "both_ends",
    },
  },
  {
    id: "silk-streamer",
    name: "Streamer",
    previewColor: "#c080ff",
    patch: {
      form: "ribbon",
      palette: "ethereal",
      intensity: 0.6,
      width: 0.7,
      duration: 0.8,
      flutter: 0.7,
      tautness: 0.3,
      trackingMode: "both_ends",
    },
  },
  {
    id: "silk-whip",
    name: "Whip",
    previewColor: "#202830",
    patch: {
      form: "ribbon",
      palette: "shadow",
      intensity: 0.8,
      width: 0.4,
      duration: 0.3,
      flutter: 0.1,
      tautness: 0.9,
      trackingMode: "both_ends",
    },
  },
  {
    id: "silk-royal",
    name: "Royal",
    previewColor: "#ffd700",
    patch: {
      form: "ribbon",
      palette: "gold_leaf",
      intensity: 0.8,
      width: 0.7,
      duration: 0.6,
      flutter: 0.2,
      tautness: 0.4,
      trackingMode: "both_ends",
    },
  },
  {
    id: "silk-inferno",
    name: "Inferno",
    previewColor: "#ff6000",
    patch: {
      form: "ribbon",
      palette: "ember",
      intensity: 0.9,
      width: 0.5,
      duration: 0.5,
      flutter: 0.4,
      tautness: 0.7,
      trackingMode: "both_ends",
    },
  },
  {
    id: "silk-phantom",
    name: "Phantom",
    previewColor: "#101020",
    patch: {
      form: "ribbon",
      palette: "shadow",
      intensity: 0.3,
      width: 0.6,
      duration: 0.9,
      flutter: 0.5,
      tautness: 0.2,
      trackingMode: "both_ends",
    },
  },
  {
    id: "silk-serpent",
    name: "Serpent",
    previewColor: "#3aa655",
    patch: {
      form: "serpent",
      creature: "snake",
      palette: "velvet",
      intensity: 0.85,
      width: 0.55,
      bodyLength: 0.55,
      slither: 0.55,
      trackingMode: "right_end",
    },
  },
  {
    id: "silk-dragon",
    name: "Dragon",
    previewColor: "#ff6000",
    previewColor2: "#ffcc00",
    patch: {
      form: "serpent",
      creature: "dragon",
      palette: "ember",
      intensity: 0.9,
      width: 0.6,
      bodyLength: 0.7,
      slither: 0.45,
      trackingMode: "right_end",
    },
  },
];

export const SILK_PRESET_GROUP: EffectPresetGroup = {
  effectType: "silk",
  presets: SILK_PRESETS,
  getSummary: (state) => {
    const s = state.silk;
    if (s.form === "serpent") {
      return `${s.creature} · ${s.palette} · length ${Math.round(s.bodyLength * 100)}% · slither ${Math.round(s.slither * 100)}%`;
    }
    return `${s.palette} · width ${Math.round(s.width * 100)}% · taut ${Math.round(s.tautness * 100)}%`;
  },
};
