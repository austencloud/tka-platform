/**
 * Trail effect presets.
 *
 * 4 quick-select presets for prop-tip trail rendering. Trails are controlled
 * via `animationSettings` (not the visibility manager), but the `apply`
 * function still accepts `vm` for interface consistency with other preset
 * groups — it just doesn't use it.
 */

import type { EffectPreset, EffectPresetGroup } from "./types";
import type { AnimationVisibilityStateManager } from "../../../state/animation-visibility-state.svelte";
import { animationSettings } from "../../../state/animation-settings-state.svelte";

export const TRAIL_PRESETS: EffectPreset[] = [
  {
    id: "trail-clean-trace",
    name: "Clean Trace",
    previewColor: "#60a5fa",
    apply: (_vm) => {
      animationSettings.setTrailAppearance({
        lineWidth: 5,
        maxOpacity: 1.0,
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
        glowBlur: 5,
      });
    },
  },
  {
    id: "trail-thin-line",
    name: "Thin Line",
    previewColor: "#94a3b8",
    apply: (_vm) => {
      animationSettings.setTrailAppearance({
        lineWidth: 2,
        maxOpacity: 1.0,
      });
    },
  },
  {
    id: "trail-prop-match",
    name: "Prop Match",
    previewColor: "#4488ff",
    previewColor2: "#ff4444",
    apply: (_vm) => {
      animationSettings.setTrailAppearance({
        lineWidth: 5,
        maxOpacity: 0.9,
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
