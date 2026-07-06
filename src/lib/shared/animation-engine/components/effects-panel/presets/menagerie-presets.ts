import type { EffectPreset, EffectPresetGroup } from "./types";

export const MENAGERIE_PRESETS: EffectPreset<"menagerie">[] = [
  {
    id: "menagerie-serpent",
    name: "Serpent",
    previewColor: "#3aa655",
    patch: {
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
    id: "menagerie-dragon",
    name: "Dragon",
    previewColor: "#ff6000",
    previewColor2: "#ffcc00",
    patch: {
      creature: "dragon",
      palette: "ember",
      intensity: 0.9,
      width: 0.6,
      bodyLength: 0.7,
      slither: 0.45,
      trackingMode: "right_end",
    },
  },
  {
    id: "menagerie-caterpillar",
    name: "Caterpillar",
    previewColor: "#9acd32",
    patch: {
      creature: "caterpillar",
      palette: "ethereal",
      intensity: 0.8,
      width: 0.6,
      bodyLength: 0.5,
      slither: 0.6,
      trackingMode: "right_end",
    },
  },
  {
    id: "menagerie-basilisk",
    name: "Basilisk",
    previewColor: "#101020",
    patch: {
      creature: "snake",
      palette: "shadow",
      intensity: 0.8,
      width: 0.5,
      bodyLength: 0.65,
      slither: 0.5,
      trackingMode: "right_end",
    },
  },
  {
    id: "menagerie-wyrm",
    name: "Wyrm",
    previewColor: "#ffd700",
    patch: {
      creature: "dragon",
      palette: "gold_leaf",
      intensity: 0.85,
      width: 0.6,
      bodyLength: 0.75,
      slither: 0.4,
      trackingMode: "right_end",
    },
  },
];

export const MENAGERIE_PRESET_GROUP: EffectPresetGroup = {
  effectType: "menagerie",
  presets: MENAGERIE_PRESETS,
  getSummary: (state) => {
    const s = state.menagerie;
    return `${s.creature} · ${s.palette} · length ${Math.round(s.bodyLength * 100)}% · slither ${Math.round(s.slither * 100)}%`;
  },
};
