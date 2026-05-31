/**
 * Charcoal effect presets.
 *
 * Each preset sets the CharcoalIntent including semantic values and optional
 * custom colors. The renderer derives CharcoalSparkParams from these via
 * semanticToCharcoalParams, passing color overrides if present.
 *
 * Colors are RGB 0-255 (the renderer normalizes to 0-1 for GPU).
 */

import type { EffectPreset, EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { CharcoalIntent } from "$lib/shared/effects/domain/effects-config";
import type { EffectsPreset } from "$lib/shared/effects/domain/effects-preset";

function applyCharcoal(
  state: EffectsConfigState,
  presetId: string,
  patch: Partial<CharcoalIntent>,
): void {
  state.updateEffect("charcoal", patch);
  // updateCharcoal nulls activePresets.charcoal; restore it so the chip stays highlighted.
  state.applyPreset({
    id: presetId,
    effectType: "charcoal",
    patch: { activePresets: { ...state.activePresets, charcoal: presetId } },
  } as unknown as EffectsPreset);
}

export const CHARCOAL_PRESETS: EffectPreset[] = [
  {
    id: "charcoal-violet-ember",
    name: "Violet Ember",
    previewColor: "#a855f7",
    apply: (state) => applyCharcoal(state, "charcoal-violet-ember", {
      intensity: 0.5,
      spread: 0.5,
      glow: 0.6,
      coreColor: [230, 180, 255], // bright lavender
      midColor: [160, 60, 220],   // violet
      coolColor: [80, 10, 120],   // deep purple
    }),
  },
  {
    id: "charcoal-hot-coal",
    name: "Hot Coal",
    previewColor: "#ef4444",
    apply: (state) => applyCharcoal(state, "charcoal-hot-coal", {
      intensity: 0.8,
      spread: 0.4,
      glow: 0.8,
      coreColor: [255, 240, 200], // white-hot
      midColor: [255, 80, 20],    // bright red-orange
      coolColor: [180, 20, 0],    // deep red
    }),
  },
  {
    id: "charcoal-jade-dust",
    name: "Jade Dust",
    previewColor: "#34d399",
    apply: (state) => applyCharcoal(state, "charcoal-jade-dust", {
      intensity: 0.4,
      spread: 0.7,
      glow: 0.5,
      coreColor: [200, 255, 220], // bright mint
      midColor: [40, 200, 120],   // emerald
      coolColor: [10, 90, 50],    // dark green
    }),
  },
  {
    id: "charcoal-ash",
    name: "Ash",
    previewColor: "#9ca3af",
    apply: (state) => applyCharcoal(state, "charcoal-ash", {
      intensity: 0.3,
      spread: 0.3,
      glow: 0.2,
      coreColor: [220, 220, 230], // near-white
      midColor: [140, 140, 155],  // medium gray
      coolColor: [60, 60, 70],    // dark gray
    }),
  },
];

export const CHARCOAL_PRESET_GROUP: EffectPresetGroup = {
  effectType: "charcoal",
  presets: CHARCOAL_PRESETS,
  getSummary: (state): string => {
    const i = Math.round(state.charcoal.intensity * 100);
    const s = Math.round(state.charcoal.spread * 100);
    const g = Math.round(state.charcoal.glow * 100);
    return `Intensity ${i}% · Spread ${s}% · Glow ${g}%`;
  },
};
