import type { EffectPreset, EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { PetalsIntent } from "$lib/shared/effects/domain/effects-config";
import type { EffectsPreset } from "$lib/shared/effects/domain/effects-preset";

function applyPetals(
  state: EffectsConfigState,
  presetId: string,
  patch: Partial<PetalsIntent>,
): void {
  state.updateEffect("petals", patch);
  // updatePetals nulls activePresets.petals; restore so the chip stays highlighted.
  state.applyPreset({
    id: presetId,
    effectType: "petals",
    patch: { activePresets: { ...state.activePresets, petals: presetId } },
  } as unknown as EffectsPreset);
}

export const PETALS_PRESETS: EffectPreset[] = [
  {
    id: "petals-classic",
    name: "Classic",
    previewColor: "#ffc0d8",
    apply: (state) =>
      applyPetals(state, "petals-classic", {
        palette: "blossom",
        ambientEmission: 0.5,
        motionEmission: 0.4,
        intensity: 0.6,
        swayAmplitude: 0.6,
        fallSpeed: 0.4,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "petals-storm",
    name: "Storm",
    previewColor: "#d84820",
    apply: (state) =>
      applyPetals(state, "petals-storm", {
        palette: "autumn",
        ambientEmission: 0.8,
        motionEmission: 0.6,
        intensity: 0.7,
        swayAmplitude: 0.8,
        fallSpeed: 0.7,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "petals-jungle",
    name: "Jungle Drift",
    previewColor: "#408840",
    apply: (state) =>
      applyPetals(state, "petals-jungle", {
        palette: "jungle",
        ambientEmission: 0.4,
        motionEmission: 0.3,
        intensity: 0.7,
        swayAmplitude: 0.5,
        fallSpeed: 0.5,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "petals-ember",
    name: "Ember Ash",
    previewColor: "#ff6020",
    apply: (state) =>
      applyPetals(state, "petals-ember", {
        palette: "ash",
        ambientEmission: 0.3,
        motionEmission: 0.7,
        intensity: 0.5,
        swayAmplitude: 0.7,
        fallSpeed: 0.5,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "petals-gilded",
    name: "Gilded",
    previewColor: "#ffd060",
    apply: (state) =>
      applyPetals(state, "petals-gilded", {
        palette: "gold",
        ambientEmission: 0.2,
        motionEmission: 0.4,
        intensity: 0.9,
        swayAmplitude: 0.4,
        fallSpeed: 0.2,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "petals-tornado",
    name: "Tornado",
    previewColor: "#c86828",
    apply: (state) =>
      applyPetals(state, "petals-tornado", {
        palette: "autumn",
        ambientEmission: 0.4,
        motionEmission: 1.0,
        intensity: 0.6,
        swayAmplitude: 1.0,
        fallSpeed: 0.8,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "petals-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => {
      // "Custom" just opens Customize.
    },
  },
];

export const PETALS_PRESET_GROUP: EffectPresetGroup = {
  effectType: "petals",
  presets: PETALS_PRESETS,
  getSummary: (state) => {
    const p = state.petals;
    return `${p.palette} · amb ${Math.round(p.ambientEmission * 100)}% · mot ${Math.round(p.motionEmission * 100)}% · sway ${Math.round(p.swayAmplitude * 100)}%`;
  },
};
