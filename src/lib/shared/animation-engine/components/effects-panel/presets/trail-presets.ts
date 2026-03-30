/**
 * Trail effect presets.
 *
 * Each preset sets trail appearance (width, opacity, glow) and optionally
 * custom colors via animationSettings.setTrailAppearance(). The trail
 * renderer reads blueColor/redColor from TrailSettings — overriding them
 * here changes what the trails actually look like.
 */

import type { EffectPreset, EffectPresetGroup } from "./types";
import type { AnimationVisibilityStateManager } from "../../../state/animation-visibility-state.svelte";
import { animationSettings } from "../../../state/animation-settings-state.svelte";
import { getMotionColor } from "$lib/shared/utils/svg-color-utils";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

// Default prop colors (restore to these when "Clean Trace" is selected)
const DEFAULT_BLUE = getMotionColor(MotionColor.BLUE, "dark");
const DEFAULT_RED = getMotionColor(MotionColor.RED, "dark");

export const TRAIL_PRESETS: EffectPreset[] = [
  {
    id: "trail-clean-trace",
    name: "Clean Trace",
    previewColor: "#60a5fa",
    apply: (_vm) => {
      animationSettings.setTrailAppearance({
        lineWidth: 5,
        maxOpacity: 1.0,
        glowBlur: 3,
        blueColor: DEFAULT_BLUE,
        redColor: DEFAULT_RED,
      });
    },
  },
  {
    id: "trail-soft-glow",
    name: "Soft Glow",
    previewColor: "#818cf8",
    apply: (_vm) => {
      animationSettings.setTrailAppearance({
        lineWidth: 8,
        maxOpacity: 0.7,
        glowBlur: 8,
        blueColor: DEFAULT_BLUE,
        redColor: DEFAULT_RED,
      });
    },
  },
  {
    id: "trail-neon",
    name: "Neon",
    previewColor: "#00ffcc",
    previewColor2: "#ff00ff",
    apply: (_vm) => {
      animationSettings.setTrailAppearance({
        lineWidth: 4,
        maxOpacity: 1.0,
        glowBlur: 10,
        blueColor: "#00ffcc",
        redColor: "#ff00ff",
      });
    },
  },
  {
    id: "trail-ember",
    name: "Ember Trail",
    previewColor: "#f97316",
    previewColor2: "#fbbf24",
    apply: (_vm) => {
      animationSettings.setTrailAppearance({
        lineWidth: 6,
        maxOpacity: 0.9,
        glowBlur: 6,
        blueColor: "#f97316",
        redColor: "#fbbf24",
      });
    },
  },
];

export const TRAIL_PRESET_GROUP: EffectPresetGroup = {
  effectType: "trails",
  presets: TRAIL_PRESETS,
  getSummary: (_vm: AnimationVisibilityStateManager): string => {
    const lineWidth = animationSettings.trail.lineWidth;
    const brightnessPct = Math.round(animationSettings.trail.maxOpacity * 100);
    return `Width ${lineWidth}px · Brightness ${brightnessPct}%`;
  },
};
