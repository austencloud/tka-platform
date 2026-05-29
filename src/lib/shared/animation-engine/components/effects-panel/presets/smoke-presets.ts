import type { EffectPreset, EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { SmokeIntent } from "$lib/shared/effects/domain/EffectsConfig";
import type { EffectsPreset } from "$lib/shared/effects/domain/EffectsPreset";

function applySmoke(
  state: EffectsConfigState,
  presetId: string,
  patch: Partial<SmokeIntent>,
): void {
  state.updateEffect("smoke", patch);
  // updateSmoke nulls activePresets.smoke; restore so the chip stays highlighted.
  state.applyPreset({
    id: presetId,
    effectType: "smoke",
    patch: { activePresets: { ...state.activePresets, smoke: presetId } },
  } as unknown as EffectsPreset);
}

export const SMOKE_PRESETS: EffectPreset[] = [
  {
    id: "smoke-classic",
    name: "Classic",
    previewColor: "#d8d8d8",
    apply: (state) =>
      applySmoke(state, "smoke-classic", {
        palette: "incense",
        ambientEmission: 0.5,
        motionEmission: 0.4,
        intensity: 0.5,
        curlStrength: 0.5,
        riseSpeed: 0.5,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "smoke-fog-wall",
    name: "Fog Wall",
    previewColor: "#c0c0c8",
    apply: (state) =>
      applySmoke(state, "smoke-fog-wall", {
        palette: "fog",
        ambientEmission: 0.9,
        motionEmission: 0.2,
        intensity: 0.8,
        curlStrength: 0.4,
        riseSpeed: 0.3,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "smoke-genie-burst",
    name: "Genie Burst",
    previewColor: "#a060ff",
    apply: (state) =>
      applySmoke(state, "smoke-genie-burst", {
        palette: "genie",
        ambientEmission: 0.2,
        motionEmission: 1.0,
        intensity: 0.7,
        curlStrength: 0.9,
        riseSpeed: 0.8,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "smoke-cursed",
    name: "Cursed",
    previewColor: "#202020",
    apply: (state) =>
      applySmoke(state, "smoke-cursed", {
        palette: "cursed",
        ambientEmission: 0.4,
        motionEmission: 0.5,
        intensity: 0.7,
        curlStrength: 0.8,
        riseSpeed: 0.4,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "smoke-spirit-veil",
    name: "Spirit Veil",
    previewColor: "#80c8ff",
    apply: (state) =>
      applySmoke(state, "smoke-spirit-veil", {
        palette: "spirit",
        ambientEmission: 0.6,
        motionEmission: 0.3,
        intensity: 0.4,
        curlStrength: 0.5,
        riseSpeed: 0.5,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "smoke-campfire",
    name: "Campfire",
    previewColor: "#805040",
    apply: (state) =>
      applySmoke(state, "smoke-campfire", {
        palette: "campfire",
        ambientEmission: 0.5,
        motionEmission: 0.5,
        intensity: 0.6,
        curlStrength: 0.6,
        riseSpeed: 0.6,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "smoke-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => {
      // "Custom" just opens Customize.
    },
  },
];

export const SMOKE_PRESET_GROUP: EffectPresetGroup = {
  effectType: "smoke",
  presets: SMOKE_PRESETS,
  getSummary: (state) => {
    const s = state.smoke;
    return `${s.palette} · amb ${Math.round(s.ambientEmission * 100)}% · mot ${Math.round(s.motionEmission * 100)}% · curl ${Math.round(s.curlStrength * 100)}%`;
  },
};
