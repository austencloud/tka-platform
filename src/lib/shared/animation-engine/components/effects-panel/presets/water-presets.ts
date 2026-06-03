import type { EffectPreset, EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { WaterIntent } from "$lib/shared/effects/domain/effects-config";
import type { EffectsPreset } from "$lib/shared/effects/domain/effects-preset";

function applyWater(
  state: EffectsConfigState,
  presetId: string,
  patch: Partial<WaterIntent>,
): void {
  state.updateEffect("water", patch);
  // updateWater nulls activePresets.water; restore so the chip stays highlighted.
  state.applyPreset({
    id: presetId,
    effectType: "water",
    patch: { activePresets: { ...state.activePresets, water: presetId } },
  } as unknown as EffectsPreset);
}

export const WATER_PRESETS: EffectPreset[] = [
  {
    id: "water-classic",
    name: "Classic",
    previewColor: "#3a7fd9",
    apply: (state) =>
      applyWater(state, "water-classic", {
        palette: "classic",
        ambientEmission: 0.4,
        motionEmission: 0.6,
        intensity: 0.6,
        clarity: 0.7,
        surfaceTension: 0.3,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "water-fountain",
    name: "Fountain",
    previewColor: "#6fb3ff",
    apply: (state) =>
      applyWater(state, "water-fountain", {
        palette: "classic",
        ambientEmission: 0.9,
        motionEmission: 0.2,
        intensity: 0.7,
        clarity: 0.7,
        surfaceTension: 0.3,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "water-whip",
    name: "Whip",
    previewColor: "#e8f4ff",
    apply: (state) =>
      applyWater(state, "water-whip", {
        palette: "classic",
        ambientEmission: 0.0,
        motionEmission: 1.0,
        intensity: 0.8,
        clarity: 0.8,
        surfaceTension: 0.2,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "water-mercury",
    name: "Mercury",
    previewColor: "#9a9fa8",
    apply: (state) =>
      applyWater(state, "water-mercury", {
        palette: "mercury",
        ambientEmission: 0.3,
        motionEmission: 0.5,
        intensity: 0.7,
        clarity: 0.2,
        surfaceTension: 1.0,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "water-acid",
    name: "Acid",
    previewColor: "#7fd94a",
    apply: (state) =>
      applyWater(state, "water-acid", {
        palette: "acid",
        ambientEmission: 0.6,
        motionEmission: 0.6,
        intensity: 0.8,
        clarity: 0.6,
        surfaceTension: 0.5,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "water-blood",
    name: "Ritual",
    previewColor: "#8a1818",
    apply: (state) =>
      applyWater(state, "water-blood", {
        palette: "blood",
        ambientEmission: 0.2,
        motionEmission: 0.3,
        intensity: 0.9,
        clarity: 0.4,
        surfaceTension: 0.8,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "water-spirit",
    name: "Spirit",
    previewColor: "#80ffe8",
    apply: (state) =>
      applyWater(state, "water-spirit", {
        palette: "spirit",
        ambientEmission: 0.7,
        motionEmission: 0.3,
        intensity: 0.5,
        clarity: 0.9,
        surfaceTension: 0.0,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "water-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => {
      // "Custom" just opens the Customize panel - EffectsPanel routes Custom → customizeOpen.
    },
  },
];

export const WATER_PRESET_GROUP: EffectPresetGroup = {
  effectType: "water",
  presets: WATER_PRESETS,
  getSummary: (state) => {
    const w = state.water;
    return `${w.palette} · amb ${Math.round(w.ambientEmission * 100)}% · mot ${Math.round(w.motionEmission * 100)}%`;
  },
};
