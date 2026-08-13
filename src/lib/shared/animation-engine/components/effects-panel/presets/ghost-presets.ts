import type { EffectPreset, EffectPresetGroup } from "./types";

// Ghost = decaying prop onion-skin. Presets vary brightness, persistence, and
// density while preserving the canonical blue/red Ghost identity.
export const GHOST_PRESETS: EffectPreset<"ghost">[] = [
  {
    id: "ghost-stroboscope",
    name: "Chrono-Frost",
    previewColor: "#3b82f6",
    previewColor2: "#ef4444",
    patch: {
      blueColor: "#3b82f6",
      redColor: "#ef4444",
      intensity: 0.85,
      decay: 8,
      interval: 0.5,
    },
  },
  {
    id: "ghost-rainbow-trail",
    name: "Long Exposure",
    previewColor: "#3b82f6",
    previewColor2: "#ef4444",
    patch: {
      blueColor: "#3b82f6",
      redColor: "#ef4444",
      intensity: 0.7,
      decay: 10,
      interval: 0.75,
    },
  },
  {
    id: "ghost-twin-ghosts",
    name: "Tight Ghost",
    previewColor: "#3b82f6",
    previewColor2: "#ef4444",
    patch: {
      blueColor: "#3b82f6",
      redColor: "#ef4444",
      intensity: 0.95,
      decay: 3,
      interval: 0.6,
    },
  },
  {
    id: "ghost-pulse",
    name: "Sparse Phantoms",
    previewColor: "#3b82f6",
    previewColor2: "#ef4444",
    patch: {
      blueColor: "#3b82f6",
      redColor: "#ef4444",
      intensity: 0.95,
      decay: 7,
      interval: 0.2,
    },
  },
];

export const GHOST_PRESET_GROUP: EffectPresetGroup = {
  effectType: "ghost",
  presets: GHOST_PRESETS,
  getSummary: (state) => {
    const e = state.ghost;
    return `persistence ${e.decay} · density ${Math.round(e.interval * 100)}%`;
  },
};
