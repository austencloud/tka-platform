/**
 * Fire effect presets.
 *
 * Each preset sets a different FireColorCurve (4-stop temperature→color gradient)
 * that the WebGL fire renderer uses in its display shader. The curve controls
 * what the flames actually look like — cold embers through hot core.
 */

import type { EffectPreset, EffectPresetGroup } from "./types";
import type { AnimationVisibilityStateManager } from "../../../state/animation-visibility-state.svelte";
import type { FireColorCurve } from "../../../domain/types/FireTypes";

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

const GHOST_CURVE: FireColorCurve = {
  coldColor: [0.0, 0.12, 0.1],
  midColor: [0.0, 0.6, 0.4],
  hotColor: [0.2, 0.9, 0.7],
  coreColor: [0.7, 1.0, 0.9],
};

export const FIRE_PRESETS: EffectPreset[] = [
  {
    id: "fire-classic",
    name: "Classic Fire",
    previewColor: "#f97316",
    apply: (vm) => {
      vm.setFireColorCurve(CLASSIC_CURVE);
      vm.setFireIntensity(0.7);
      vm.setFireColorBlend(0);
    },
  },
  {
    id: "fire-blue-flame",
    name: "Blue Flame",
    previewColor: "#60a5fa",
    apply: (vm) => {
      vm.setFireColorCurve(BLUE_CURVE);
      vm.setFireIntensity(0.7);
      vm.setFireColorBlend(0);
    },
  },
  {
    id: "fire-spirit",
    name: "Spirit Fire",
    previewColor: "#a855f7",
    apply: (vm) => {
      vm.setFireColorCurve(SPIRIT_CURVE);
      vm.setFireIntensity(0.85);
      vm.setFireColorBlend(0);
    },
  },
  {
    id: "fire-ghost",
    name: "Ghost Fire",
    previewColor: "#34d399",
    apply: (vm) => {
      vm.setFireColorCurve(GHOST_CURVE);
      vm.setFireIntensity(0.6);
      vm.setFireColorBlend(0);
    },
  },
];

export const FIRE_PRESET_GROUP: EffectPresetGroup = {
  effectType: "fire",
  presets: FIRE_PRESETS,
  getSummary: (vm: AnimationVisibilityStateManager): string => {
    const intensityPct = Math.round(vm.getFireIntensity() * 100);
    const blend = vm.getFireColorBlend();
    const colorMode = blend < 0.15 ? "Natural" : blend < 0.5 ? "Tinted" : "Prop-colored";
    return `Intensity ${intensityPct}% · ${colorMode}`;
  },
};
