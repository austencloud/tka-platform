import type { EffectPreset, EffectPresetGroup } from "./types";

// Ghost has one visual identity with directly tunable color, intensity,
// persistence, and density. An empty group tells EffectsPanel to show those
// controls immediately instead of manufacturing named looks from four knobs.
export const GHOST_PRESETS: EffectPreset<"ghost">[] = [];

export const GHOST_PRESET_GROUP: EffectPresetGroup = {
  effectType: "ghost",
  presets: GHOST_PRESETS,
  getSummary: (state) => {
    const e = state.ghost;
    return `persistence ${e.decay} · density ${Math.round(e.interval * 100)}%`;
  },
};
