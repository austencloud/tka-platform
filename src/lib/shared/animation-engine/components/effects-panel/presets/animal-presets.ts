import type { EffectPreset, EffectPresetGroup } from "./types";

// A deliberate silhouette ladder: Wisp is small and lively, Whisper is long
// and restrained, Serpent is heavy, the two dragons separate width from length,
// and Inchworm is short and broad. Both render backends consume this same set.
export const ANIMAL_PRESETS: EffectPreset<"animal">[] = [
  {
    id: "animal-wisp",
    name: "Wisp",
    previewColor: "#c080ff",
    patch: {
      creature: "snake",
      palette: "ethereal",
      intensity: 0.42,
      width: 0.18,
      bodyLength: 0.36,
      slither: 0.48,
      trackingMode: "right_end",
    },
  },
  {
    id: "animal-whisper",
    name: "Whisper",
    previewColor: "#101020",
    patch: {
      creature: "snake",
      palette: "shadow",
      intensity: 0.52,
      width: 0.24,
      bodyLength: 0.48,
      slither: 0.16,
      trackingMode: "right_end",
    },
  },
  {
    id: "animal-serpent",
    name: "Serpent",
    previewColor: "#600018",
    patch: {
      creature: "snake",
      palette: "velvet",
      intensity: 0.7,
      width: 0.4,
      bodyLength: 0.66,
      slither: 0.34,
      trackingMode: "right_end",
    },
  },
  {
    id: "animal-ember-drake",
    name: "Ember Drake",
    previewColor: "#ff6000",
    previewColor2: "#ffcc00",
    patch: {
      creature: "dragon",
      palette: "ember",
      intensity: 0.68,
      width: 0.44,
      bodyLength: 0.56,
      slither: 0.32,
      trackingMode: "right_end",
    },
  },
  {
    id: "animal-gilt-wyrm",
    name: "Gilt Wyrm",
    previewColor: "#ffd700",
    patch: {
      creature: "dragon",
      palette: "gold_leaf",
      intensity: 0.72,
      width: 0.34,
      bodyLength: 0.75,
      slither: 0.18,
      trackingMode: "right_end",
    },
  },
  {
    id: "animal-inchworm",
    name: "Inchworm",
    previewColor: "#c080ff",
    patch: {
      creature: "caterpillar",
      palette: "ethereal",
      intensity: 0.68,
      width: 0.52,
      bodyLength: 0.3,
      slither: 0.46,
      trackingMode: "right_end",
    },
  },
];

export const ANIMAL_PRESET_GROUP: EffectPresetGroup = {
  effectType: "animal",
  presets: ANIMAL_PRESETS,
  getSummary: (state) => {
    const s = state.animal;
    return `${s.creature} · ${s.palette} · length ${Math.round(s.bodyLength * 100)}% · slither ${Math.round(s.slither * 100)}%`;
  },
};
