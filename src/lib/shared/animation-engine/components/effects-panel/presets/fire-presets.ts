/**
 * Fire effect presets.
 *
 * Each preset sets a different FireColorCurve (4-stop temperature→color gradient)
 * that the WebGL fire renderer uses in its display shader. The curve controls
 * what the flames actually look like - cold embers through hot core.
 *
 * Classic, Blue Flame, and Spirit use the natural flame profile. Liquid Fire
 * restores the broad flowing renderer with its intended classic palette.
 * Presets don't touch intensity, turbulence, or blend. Those settings are
 * controlled by the sliders and apply uniformly to all presets.
 * Custom prop colours are edited in the Fire Customize panel (which sets
 * `propColors` + `colorBlend`), not via a preset chip.
 */

import type { EffectPreset, EffectPresetGroup } from "./types";
import type { FireColorCurve } from "../../../domain/types/fire-types";

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

// ── Presets (color only - no intensity/turbulence changes) ─────────────

export const FIRE_PRESETS: EffectPreset<"fire">[] = [
  {
    id: "fire-classic",
    name: "Classic",
    previewColor: "#f97316",
    patch: {
      renderingStyle: "natural",
      colorCurve: CLASSIC_CURVE,
      propColors: null,
    },
  },
  {
    id: "fire-blue-flame",
    name: "Blue Flame",
    previewColor: "#60a5fa",
    patch: {
      renderingStyle: "natural",
      colorCurve: BLUE_CURVE,
      propColors: null,
    },
  },
  {
    id: "fire-spirit",
    name: "Spirit",
    previewColor: "#a855f7",
    patch: {
      renderingStyle: "natural",
      colorCurve: SPIRIT_CURVE,
      propColors: null,
    },
  },
  {
    id: "fire-liquid",
    name: "Liquid Fire",
    previewColor: "#ea580c",
    patch: {
      renderingStyle: "liquid",
      colorBlend: 0,
      colorCurve: CLASSIC_CURVE,
      propColors: null,
    },
  },
];

export const FIRE_PRESET_GROUP: EffectPresetGroup = {
  effectType: "fire",
  presets: FIRE_PRESETS,
  getSummary: (state): string => {
    const style =
      state.fire.renderingStyle === "liquid" ? "Liquid Fire" : "Natural Fire";
    const intensityPct = Math.round(state.fire.intensity * 100);
    const blend = state.fire.colorBlend;
    const colorMode =
      blend < 0.15 ? "Natural" : blend < 0.5 ? "Tinted" : "Prop-colored";
    return `${style} · Intensity ${intensityPct}% · ${colorMode}`;
  },
};
