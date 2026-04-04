/**
 * Trail effect presets.
 *
 * Each preset sets trail appearance (width, opacity, glow) and optionally
 * custom colors via animationSettings.setTrailAppearance(). The trail
 * renderer reads blueColor/redColor from TrailSettings — overriding them
 * here changes what the trails actually look like.
 *
 * The 4th preset ("Custom") lets users pick their own colors. Those
 * choices persist in localStorage so the custom preset survives reloads.
 */

import type { EffectPreset, EffectPresetGroup } from "./types";
import type { AnimationVisibilityStateManager } from "../../../state/animation-visibility-state.svelte";
import { animationSettings } from "../../../state/animation-settings-state.svelte";
import { getMotionColor } from "$lib/shared/utils/svg-color-utils";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

// Default prop colors (restore to these when "Clean Trace" is selected)
const DEFAULT_BLUE = getMotionColor(MotionColor.BLUE, "dark");
const DEFAULT_RED = getMotionColor(MotionColor.RED, "dark");

// ── Custom preset persistence ──────────────────────────────────────────
const CUSTOM_TRAIL_COLORS_KEY = "tka_custom_trail_colors";

export interface CustomTrailColors {
  blue: string;
  red: string;
}

const DEFAULT_CUSTOM_COLORS: CustomTrailColors = {
  blue: "#8b5cf6",
  red: "#ec4899",
};

export function loadCustomTrailColors(): CustomTrailColors {
  try {
    const raw = localStorage.getItem(CUSTOM_TRAIL_COLORS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.blue && parsed.red) return parsed;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_CUSTOM_COLORS };
}

export function saveCustomTrailColors(colors: CustomTrailColors): void {
  try {
    localStorage.setItem(CUSTOM_TRAIL_COLORS_KEY, JSON.stringify(colors));
  } catch { /* ignore */ }
}

export function applyCustomTrailColors(colors: CustomTrailColors): void {
  animationSettings.setTrailAppearance({
    lineWidth: 5,
    maxOpacity: 1.0,
    glowBlur: 5,
    blueColor: colors.blue,
    redColor: colors.red,
  });
}

// ── Presets ─────────────────────────────────────────────────────────────

export const TRAIL_PRESETS: EffectPreset[] = [
  {
    id: "trail-default",
    name: "Default",
    previewColor: DEFAULT_BLUE,
    previewColor2: DEFAULT_RED,
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
  {
    id: "trail-custom",
    name: "Custom",
    previewColor: "custom",
    apply: (_vm) => {
      const colors = loadCustomTrailColors();
      applyCustomTrailColors(colors);
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
