/**
 * Charcoal effect presets.
 *
 * 4 quick-select presets for the discrete spark particle system.
 * Uses the semantic layer (intensity/spread/glow, each 0-1) to express
 * visually distinct spark behaviors without exposing raw physics params.
 */

import type { EffectPreset, EffectPresetGroup } from "./types";
import type { AnimationVisibilityStateManager } from "../../../state/animation-visibility-state.svelte";
import {
  semanticToCharcoalParams,
  charcoalParamsToSemantic,
} from "../../../domain/types/CharcoalSparkTypes";

export const CHARCOAL_PRESETS: EffectPreset[] = [
  {
    id: "charcoal-violet-ember",
    name: "Violet Ember",
    previewColor: "#a855f7",
    apply: (vm) => {
      vm.setCharcoalParams(
        semanticToCharcoalParams({ intensity: 0.5, spread: 0.5, glow: 0.6 })
      );
    },
  },
  {
    id: "charcoal-hot-coal",
    name: "Hot Coal",
    previewColor: "#ef4444",
    apply: (vm) => {
      vm.setCharcoalParams(
        semanticToCharcoalParams({ intensity: 0.8, spread: 0.4, glow: 0.8 })
      );
    },
  },
  {
    id: "charcoal-jade-dust",
    name: "Jade Dust",
    previewColor: "#34d399",
    apply: (vm) => {
      vm.setCharcoalParams(
        semanticToCharcoalParams({ intensity: 0.4, spread: 0.7, glow: 0.5 })
      );
    },
  },
  {
    id: "charcoal-ash",
    name: "Ash",
    previewColor: "#9ca3af",
    apply: (vm) => {
      vm.setCharcoalParams(
        semanticToCharcoalParams({ intensity: 0.3, spread: 0.3, glow: 0.2 })
      );
    },
  },
];

export const CHARCOAL_PRESET_GROUP: EffectPresetGroup = {
  effectType: "charcoal",
  presets: CHARCOAL_PRESETS,
  getSummary: (vm: AnimationVisibilityStateManager): string => {
    const semantic = charcoalParamsToSemantic(vm.getCharcoalParams());
    const intensityPct = Math.round(semantic.intensity * 100);
    const spreadPct = Math.round(semantic.spread * 100);
    const glowPct = Math.round(semantic.glow * 100);
    return `Intensity ${intensityPct}% · Spread ${spreadPct}% · Glow ${glowPct}%`;
  },
};
