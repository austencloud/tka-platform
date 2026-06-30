import type { EffectPreset, EffectPresetGroup } from "./types";

// Ghost = decaying prop onion-skin. The only dials are opacity (intensity),
// trail length (decay = Persistence), and how many ghosts pack the trail
// (interval = Density). Presets sweep those three across distinct looks.
export const GHOST_PRESETS: EffectPreset<"ghost">[] = [
  {
    id: "ghost-stroboscope",
    name: "Ghost Trail",
    previewColor: "#a5b4fc",
    patch: { intensity: 0.85, decay: 8, interval: 0.5 },
  },
  {
    id: "ghost-rainbow-trail",
    name: "Long Exposure",
    previewColor: "#f0abfc",
    patch: { intensity: 0.7, decay: 10, interval: 0.75 },
  },
  {
    id: "ghost-twin-ghosts",
    name: "Tight Ghost",
    previewColor: "#67e8f9",
    patch: { intensity: 0.95, decay: 3, interval: 0.6 },
  },
  {
    id: "ghost-pulse",
    name: "Sparse Phantoms",
    previewColor: "#fcd34d",
    patch: { intensity: 0.95, decay: 7, interval: 0.2 },
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
