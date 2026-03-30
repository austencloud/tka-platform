/**
 * Charcoal effect presets.
 *
 * Each preset sets the full CharcoalSparkParams including custom colors.
 * The renderer uses a 3-stop temperature gradient: coolColor → midColor → coreColor.
 * Colors are RGB 0-255 (the renderer normalizes to 0-1 for GPU).
 *
 * We build on DEFAULT_CHARCOAL_PARAMS for physics values and override
 * the semantic params (via semanticToCharcoalParams) + inject custom colors.
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
      const params = semanticToCharcoalParams({ intensity: 0.5, spread: 0.5, glow: 0.6 });
      params.coreColor = [230, 180, 255]; // bright lavender
      params.midColor = [160, 60, 220];   // violet
      params.coolColor = [80, 10, 120];   // deep purple
      vm.setCharcoalParams(params);
    },
  },
  {
    id: "charcoal-hot-coal",
    name: "Hot Coal",
    previewColor: "#ef4444",
    apply: (vm) => {
      const params = semanticToCharcoalParams({ intensity: 0.8, spread: 0.4, glow: 0.8 });
      params.coreColor = [255, 240, 200]; // white-hot
      params.midColor = [255, 80, 20];    // bright red-orange
      params.coolColor = [180, 20, 0];    // deep red
      vm.setCharcoalParams(params);
    },
  },
  {
    id: "charcoal-jade-dust",
    name: "Jade Dust",
    previewColor: "#34d399",
    apply: (vm) => {
      const params = semanticToCharcoalParams({ intensity: 0.4, spread: 0.7, glow: 0.5 });
      params.coreColor = [200, 255, 220]; // bright mint
      params.midColor = [40, 200, 120];   // emerald
      params.coolColor = [10, 90, 50];    // dark green
      vm.setCharcoalParams(params);
    },
  },
  {
    id: "charcoal-ash",
    name: "Ash",
    previewColor: "#9ca3af",
    apply: (vm) => {
      const params = semanticToCharcoalParams({ intensity: 0.3, spread: 0.3, glow: 0.2 });
      params.coreColor = [220, 220, 230]; // near-white
      params.midColor = [140, 140, 155];  // medium gray
      params.coolColor = [60, 60, 70];    // dark gray
      vm.setCharcoalParams(params);
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
