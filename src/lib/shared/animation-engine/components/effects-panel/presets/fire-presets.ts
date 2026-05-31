/**
 * Fire effect presets.
 *
 * Each preset sets a different FireColorCurve (4-stop temperature→color gradient)
 * that the WebGL fire renderer uses in its display shader. The curve controls
 * what the flames actually look like - cold embers through hot core.
 *
 * Presets are COLOR ONLY - they don't touch intensity, turbulence, or blend.
 * Those settings are controlled by the sliders and apply uniformly to all presets.
 * The 4th preset ("Custom") lets users pick their own fire color.
 */

import type { EffectPreset, EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { FireIntent } from "$lib/shared/effects/domain/effects-config";
import type { EffectsPreset } from "$lib/shared/effects/domain/effects-preset";
import type { FireColorCurve } from "../../../domain/types/fire-types";
import { hexToFlameColor } from "../../../domain/types/fire-types";

// RGB values are normalized [0-1] for shader consumption
const CLASSIC_CURVE: FireColorCurve = {
  coldColor: [0.2, 0.02, 0.0],
  midColor: [0.9, 0.15, 0.0],
  hotColor: [1.0, 0.55, 0.05],
  coreColor: [1.0, 0.9, 0.35],
};

const BLUE_CURVE: FireColorCurve = {
  coldColor: [0.0, 0.02, 0.2],
  midColor: [0.0, 0.15, 0.9],
  hotColor: [0.1, 0.5, 1.0],
  coreColor: [0.6, 0.85, 1.0],
};

const SPIRIT_CURVE: FireColorCurve = {
  coldColor: [0.15, 0.0, 0.2],
  midColor: [0.5, 0.0, 0.8],
  hotColor: [0.8, 0.2, 1.0],
  coreColor: [1.0, 0.7, 1.0],
};

// ── Custom fire color persistence ──────────────────────────────────────
const CUSTOM_FIRE_COLORS_KEY = "tka_custom_fire_colors";

export interface CustomFireColors {
  left: string;
  right: string;
}

const DEFAULT_CUSTOM_FIRE_COLORS: CustomFireColors = {
  left: "#34d399",
  right: "#f97316",
};

export function loadCustomFireColors(): CustomFireColors {
  try {
    const raw = localStorage.getItem(CUSTOM_FIRE_COLORS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.left && parsed.right) return parsed;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_CUSTOM_FIRE_COLORS };
}

export function saveCustomFireColors(colors: CustomFireColors): void {
  try {
    localStorage.setItem(CUSTOM_FIRE_COLORS_KEY, JSON.stringify(colors));
  } catch { /* ignore */ }
}

export function applyCustomFireColors(state: EffectsConfigState, colors: CustomFireColors): void {
  state.updateEffect("fire", {
    colorBlend: 1.0,
    propColors: [hexToFlameColor(colors.left), hexToFlameColor(colors.right)],
  });
}

// ── Helper (restores activePresets after updateEffect("fire") nulls it) ──────────

function applyFire(
  state: EffectsConfigState,
  presetId: string,
  patch: Partial<FireIntent>,
): void {
  state.updateEffect("fire", patch);
  state.applyPreset({
    id: presetId,
    effectType: "fire",
    patch: { activePresets: { ...state.activePresets, fire: presetId } },
  } as unknown as EffectsPreset);
}

// ── Presets (color only - no intensity/turbulence changes) ─────────────

export const FIRE_PRESETS: EffectPreset[] = [
  {
    id: "fire-classic",
    name: "Classic",
    previewColor: "#f97316",
    apply: (state) => applyFire(state, "fire-classic", {
      colorCurve: CLASSIC_CURVE, propColors: null,
    }),
  },
  {
    id: "fire-blue-flame",
    name: "Blue Flame",
    previewColor: "#60a5fa",
    apply: (state) => applyFire(state, "fire-blue-flame", {
      colorCurve: BLUE_CURVE, propColors: null,
    }),
  },
  {
    id: "fire-spirit",
    name: "Spirit",
    previewColor: "#a855f7",
    apply: (state) => applyFire(state, "fire-spirit", {
      colorCurve: SPIRIT_CURVE, propColors: null,
    }),
  },
  {
    id: "fire-custom",
    name: "Custom",
    previewColor: "custom",
    apply: (state) => {
      const colors = loadCustomFireColors();
      applyFire(state, "fire-custom", {
        colorBlend: 1.0,
        propColors: [hexToFlameColor(colors.left), hexToFlameColor(colors.right)],
      });
    },
  },
];

export const FIRE_PRESET_GROUP: EffectPresetGroup = {
  effectType: "fire",
  presets: FIRE_PRESETS,
  getSummary: (state): string => {
    const intensityPct = Math.round(state.fire.intensity * 100);
    const blend = state.fire.colorBlend;
    const colorMode = blend < 0.15 ? "Natural" : blend < 0.5 ? "Tinted" : "Prop-colored";
    return `Intensity ${intensityPct}% · ${colorMode}`;
  },
};
