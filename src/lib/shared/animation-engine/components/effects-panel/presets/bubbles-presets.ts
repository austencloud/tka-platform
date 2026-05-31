import type { EffectPreset, EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { BubblesIntent } from "$lib/shared/effects/domain/effects-config";
import type { EffectsPreset } from "$lib/shared/effects/domain/effects-preset";

function applyBubbles(
  state: EffectsConfigState,
  presetId: string,
  patch: Partial<BubblesIntent>,
): void {
  state.updateEffect("bubbles", patch);
  // updateBubbles nulls activePresets.bubbles; restore so the chip stays highlighted.
  state.applyPreset({
    id: presetId,
    effectType: "bubbles",
    patch: { activePresets: { ...state.activePresets, bubbles: presetId } },
  } as unknown as EffectsPreset);
}

export const BUBBLES_PRESETS: EffectPreset[] = [
  {
    id: "bubbles-classic",
    name: "Classic",
    previewColor: "#c8e0ff",
    apply: (state) =>
      applyBubbles(state, "bubbles-classic", {
        palette: "soap",
        ambientEmission: 0.3,
        motionEmission: 0.5,
        intensity: 0.6,
        sizeJitter: 0.4,
        buoyancy: 0.5,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "bubbles-fizz",
    name: "Fizz",
    previewColor: "#f4e8c8",
    apply: (state) =>
      applyBubbles(state, "bubbles-fizz", {
        palette: "champagne",
        ambientEmission: 0.6,
        motionEmission: 0.5,
        intensity: 0.5,
        sizeJitter: 0.2,
        buoyancy: 0.9,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "bubbles-dream",
    name: "Dream",
    previewColor: "#e8f4ff",
    apply: (state) =>
      applyBubbles(state, "bubbles-dream", {
        palette: "soap",
        ambientEmission: 0.5,
        motionEmission: 0.2,
        intensity: 0.9,
        sizeJitter: 0.7,
        buoyancy: 0.3,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "bubbles-iridescent",
    name: "Iridescent",
    previewColor: "#c080ff",
    apply: (state) =>
      applyBubbles(state, "bubbles-iridescent", {
        palette: "oil",
        ambientEmission: 0.4,
        motionEmission: 0.4,
        intensity: 0.7,
        sizeJitter: 0.5,
        buoyancy: 0.5,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "bubbles-acid",
    name: "Acid Fizz",
    previewColor: "#b8ff6f",
    apply: (state) =>
      applyBubbles(state, "bubbles-acid", {
        palette: "acid",
        ambientEmission: 0.5,
        motionEmission: 0.6,
        intensity: 0.6,
        sizeJitter: 0.3,
        buoyancy: 0.8,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "bubbles-spirit",
    name: "Spirit",
    previewColor: "#c0fff4",
    apply: (state) =>
      applyBubbles(state, "bubbles-spirit", {
        palette: "spirit",
        ambientEmission: 0.6,
        motionEmission: 0.3,
        intensity: 0.4,
        sizeJitter: 0.6,
        buoyancy: 0.4,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "bubbles-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => {
      // "Custom" just opens Customize.
    },
  },
];

export const BUBBLES_PRESET_GROUP: EffectPresetGroup = {
  effectType: "bubbles",
  presets: BUBBLES_PRESETS,
  getSummary: (state) => {
    const b = state.bubbles;
    return `${b.palette} · amb ${Math.round(b.ambientEmission * 100)}% · mot ${Math.round(b.motionEmission * 100)}% · rise ${Math.round(b.buoyancy * 100)}%`;
  },
};
