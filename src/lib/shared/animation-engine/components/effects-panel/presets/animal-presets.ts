import type { EffectPreset, EffectPresetGroup } from "./types";

// Tuned-down candidate set (2026-07-06). Thinner, shorter, calmer, more
// translucent than the original bold lineup — the creature reads as a garnish,
// not the main subject. width·25+5 = px half-thickness; bodyLength·360+120 = px;
// slither·42 = px wag; intensity = layer alpha. Austen picks favorites; losers
// get pruned.
export const ANIMAL_PRESETS: EffectPreset<"animal">[] = [
  {
    id: "animal-wisp",
    name: "Wisp",
    previewColor: "#c080ff",
    patch: {
      creature: "snake",
      palette: "ethereal",
      intensity: 0.45,
      width: 0.25,
      bodyLength: 0.45,
      slither: 0.4,
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
      intensity: 0.5,
      width: 0.28,
      bodyLength: 0.4,
      slither: 0.3,
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
      intensity: 0.65,
      width: 0.32,
      bodyLength: 0.5,
      slither: 0.35,
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
      intensity: 0.6,
      width: 0.35,
      bodyLength: 0.55,
      slither: 0.28,
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
      intensity: 0.6,
      width: 0.3,
      bodyLength: 0.6,
      slither: 0.25,
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
      intensity: 0.6,
      width: 0.35,
      bodyLength: 0.35,
      slither: 0.38,
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
