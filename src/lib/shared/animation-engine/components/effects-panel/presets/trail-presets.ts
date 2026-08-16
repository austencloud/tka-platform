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
    previewColor: "#ff4d1c",
    previewColor2: "#ffc046",
    // The shipped 6 / 0.9 / orange+amber was Neon in a warm hue: brightness a
    // tenth off maximum is invisible against Neon's 1.0, and #f97316 next to
    // #fbbf24 is close enough in hue that the two props read as one doubled
    // stroke rather than two. Measured at tile size it covered 41% of the frame
    // against Neon's 23% - a solid glowing mass, not a dying coal.
    //
    // An ember is the wide dim look, so it now takes the low end of the
    // brightness range the panel exposes (0.3-1) and a wider ribbon, and the
    // pair is pushed apart to deep fire-red and gold so the two props stay
    // legible. brightness reaches 2D as maxOpacity with minOpacity at 30% of it
    // (foldTrailIntentIntoSettings), so lowering it shortens the visible tail
    // as well as dimming it - which is what makes it read as fading.
    patch: { thickness: 8, brightness: 0.55, blueColor: "#ff4d1c", redColor: "#ffc046" },
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
