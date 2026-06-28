/**
 * Trail effect presets.
 *
 * The colour-matched blue/red default is the personal Default chip (backed by
 * `effectsConfig.trails`), and custom colours are edited in the Trails Customize
 * panel — so trail no longer carries its own "Default" / "Custom" preset chips.
 * These named presets are the alternative looks.
 */

import type { EffectPreset, EffectPresetGroup } from "./types";

export const TRAIL_PRESETS: EffectPreset<"trails">[] = [
  {
    id: "trail-neon",
    name: "Neon",
    previewColor: "#00ffcc",
    previewColor2: "#ff00ff",
    patch: { thickness: 4, brightness: 1.0, blueColor: "#00ffcc", redColor: "#ff00ff" },
  },
  {
    id: "trail-ember",
    name: "Ember Trail",
    previewColor: "#f97316",
    previewColor2: "#fbbf24",
    patch: { thickness: 6, brightness: 0.9, blueColor: "#f97316", redColor: "#fbbf24" },
  },
];

export const TRAIL_PRESET_GROUP: EffectPresetGroup = {
  effectType: "trails",
  presets: TRAIL_PRESETS,
  getSummary: (state): string => {
    const lineWidth = state.trails.thickness;
    const brightnessPct = Math.round(state.trails.brightness * 100);
    return `Width ${lineWidth}px · Brightness ${brightnessPct}%`;
  },
};
