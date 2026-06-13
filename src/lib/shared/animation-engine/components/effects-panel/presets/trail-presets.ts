/**
 * Trail effect presets.
 *
 * Each preset sets trail appearance. The 4th preset ("Custom") reads
 * user-picked colors from localStorage at apply time via `resolvePatch`;
 * those choices persist so the custom preset survives reloads. The
 * Customize panel reads/writes them through the exported helpers below.
 */

import type { EffectPreset, EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import { getMotionColor } from "$lib/shared/utils/svg-color-utils";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

// Default prop colors (restore to these when "Default" is selected)
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

export function applyCustomTrailColors(state: EffectsConfigState, colors: CustomTrailColors): void {
  state.updateEffect("trails", {
    thickness: 5,
    brightness: 1.0,
    blueColor: colors.blue,
    redColor: colors.red,
  });
}

// ── Presets ─────────────────────────────────────────────────────────────

export const TRAIL_PRESETS: EffectPreset<"trails">[] = [
  {
    id: "trail-default",
    name: "Default",
    previewColor: DEFAULT_BLUE,
    previewColor2: DEFAULT_RED,
    patch: { thickness: 5, brightness: 1.0, blueColor: DEFAULT_BLUE, redColor: DEFAULT_RED },
  },
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
  {
    id: "trail-custom",
    name: "Custom",
    previewColor: "custom",
    resolvePatch: () => {
      const colors = loadCustomTrailColors();
      return { thickness: 5, brightness: 1.0, blueColor: colors.blue, redColor: colors.red };
    },
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
