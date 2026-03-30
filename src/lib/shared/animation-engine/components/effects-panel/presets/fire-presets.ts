/**
 * Fire effect presets.
 *
 * 4 quick-select presets for the WebGL fire effect. Intensity controls
 * how vigorous the flames are; color blend shifts the palette from
 * natural orange toward the prop's assigned color.
 */

import type { EffectPreset, EffectPresetGroup } from "./types";
import type { AnimationVisibilityStateManager } from "../../../state/animation-visibility-state.svelte";

export const FIRE_PRESETS: EffectPreset[] = [
  {
    id: "fire-classic",
    name: "Classic Fire",
    previewColor: "#f97316",
    apply: (vm) => {
      vm.setFireIntensity(0.7);
      vm.setFireColorBlend(0);
    },
  },
  {
    id: "fire-blue-flame",
    name: "Blue Flame",
    previewColor: "#60a5fa",
    apply: (vm) => {
      vm.setFireIntensity(0.7);
      vm.setFireColorBlend(0.3);
    },
  },
  {
    id: "fire-spirit",
    name: "Spirit Fire",
    previewColor: "#a855f7",
    apply: (vm) => {
      vm.setFireIntensity(0.85);
      vm.setFireColorBlend(0.7);
    },
  },
  {
    id: "fire-ghost",
    name: "Ghost Fire",
    previewColor: "#34d399",
    apply: (vm) => {
      vm.setFireIntensity(0.6);
      vm.setFireColorBlend(0.15);
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
