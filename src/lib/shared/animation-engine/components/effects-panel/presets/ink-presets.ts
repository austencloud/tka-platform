import type { EffectPreset, EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { InkIntent } from "$lib/shared/effects/domain/EffectsConfig";
import type { EffectsPreset } from "$lib/shared/effects/domain/EffectsPreset";

function applyInk(
  state: EffectsConfigState,
  presetId: string,
  patch: Partial<InkIntent>,
): void {
  state.updateEffect("ink", patch);
  // updateInk nulls activePresets.ink; restore so the chip stays highlighted.
  state.applyPreset({
    id: presetId,
    effectType: "ink",
    patch: { activePresets: { ...state.activePresets, ink: presetId } },
  } as unknown as EffectsPreset);
}

export const INK_PRESETS: EffectPreset[] = [
  {
    id: "ink-classic",
    name: "Classic",
    previewColor: "#0a0a0a",
    apply: (state) =>
      applyInk(state, "ink-classic", {
        palette: "india",
        ambientEmission: 0.2,
        motionEmission: 0.8,
        intensity: 0.6,
        viscosity: 0.3,
        splatterIntensity: 0.3,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "ink-drip",
    name: "Drip",
    previewColor: "#1a1a1a",
    apply: (state) =>
      applyInk(state, "ink-drip", {
        palette: "india",
        ambientEmission: 0.3,
        motionEmission: 0.5,
        intensity: 0.8,
        viscosity: 0.7,
        splatterIntensity: 0.5,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "ink-watercolor-wash",
    name: "Watercolor",
    previewColor: "#4080c0",
    apply: (state) =>
      applyInk(state, "ink-watercolor-wash", {
        palette: "watercolor",
        ambientEmission: 0.1,
        motionEmission: 0.7,
        intensity: 0.5,
        viscosity: 0.1,
        splatterIntensity: 0.1,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "ink-neon-tag",
    name: "Neon Tag",
    previewColor: "#ff2080",
    apply: (state) =>
      applyInk(state, "ink-neon-tag", {
        palette: "neon",
        ambientEmission: 0.1,
        motionEmission: 1.0,
        intensity: 0.9,
        viscosity: 0.2,
        splatterIntensity: 0.4,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "ink-splatter",
    name: "Splatter",
    previewColor: "#8a1818",
    apply: (state) =>
      applyInk(state, "ink-splatter", {
        palette: "blood",
        ambientEmission: 0.1,
        motionEmission: 0.6,
        intensity: 0.7,
        viscosity: 0.8,
        splatterIntensity: 1.0,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "ink-toxic",
    name: "Toxic",
    previewColor: "#7fd94a",
    apply: (state) =>
      applyInk(state, "ink-toxic", {
        palette: "acid",
        ambientEmission: 0.2,
        motionEmission: 0.7,
        intensity: 0.6,
        viscosity: 0.5,
        splatterIntensity: 0.6,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "ink-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => {
      // "Custom" just opens Customize.
    },
  },
];

export const INK_PRESET_GROUP: EffectPresetGroup = {
  effectType: "ink",
  presets: INK_PRESETS,
  getSummary: (state) => {
    const s = state.ink;
    return `${s.palette} · amb ${Math.round(s.ambientEmission * 100)}% · mot ${Math.round(s.motionEmission * 100)}% · int ${Math.round(s.intensity * 100)}%`;
  },
};
