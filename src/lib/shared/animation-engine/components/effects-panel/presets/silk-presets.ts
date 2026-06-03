import type { EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { SilkIntent } from "$lib/shared/effects/domain/effects-config";
import type { EffectsPreset } from "$lib/shared/effects/domain/effects-preset";

function applySilk(
  state: EffectsConfigState,
  presetId: string,
  patch: Partial<SilkIntent>,
): void {
  state.updateEffect("silk", patch);
  state.applyPreset({
    id: presetId,
    effectType: "silk",
    patch: { activePresets: { ...state.activePresets, silk: presetId } },
  } as unknown as EffectsPreset);
}

export const SILK_PRESETS = [
  {
    id: "silk-classic",
    name: "Classic",
    previewColor: "#c0c0d0",
    apply: (state: EffectsConfigState) =>
      applySilk(state, "silk-classic", {
        palette: "satin",
        intensity: 0.7,
        width: 0.5,
        duration: 0.5,
        flutter: 0.3,
        tautness: 0.5,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "silk-streamer",
    name: "Streamer",
    previewColor: "#c080ff",
    apply: (state: EffectsConfigState) =>
      applySilk(state, "silk-streamer", {
        palette: "ethereal",
        intensity: 0.6,
        width: 0.7,
        duration: 0.8,
        flutter: 0.7,
        tautness: 0.3,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "silk-whip",
    name: "Whip",
    previewColor: "#202830",
    apply: (state: EffectsConfigState) =>
      applySilk(state, "silk-whip", {
        palette: "shadow",
        intensity: 0.8,
        width: 0.4,
        duration: 0.3,
        flutter: 0.1,
        tautness: 0.9,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "silk-royal",
    name: "Royal",
    previewColor: "#ffd700",
    apply: (state: EffectsConfigState) =>
      applySilk(state, "silk-royal", {
        palette: "gold_leaf",
        intensity: 0.8,
        width: 0.7,
        duration: 0.6,
        flutter: 0.2,
        tautness: 0.4,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "silk-inferno",
    name: "Inferno",
    previewColor: "#ff6000",
    apply: (state: EffectsConfigState) =>
      applySilk(state, "silk-inferno", {
        palette: "ember",
        intensity: 0.9,
        width: 0.5,
        duration: 0.5,
        flutter: 0.4,
        tautness: 0.7,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "silk-phantom",
    name: "Phantom",
    previewColor: "#101020",
    apply: (state: EffectsConfigState) =>
      applySilk(state, "silk-phantom", {
        palette: "shadow",
        intensity: 0.3,
        width: 0.6,
        duration: 0.9,
        flutter: 0.5,
        tautness: 0.2,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "silk-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => {},
  },
];

export const SILK_PRESET_GROUP: EffectPresetGroup = {
  effectType: "silk",
  presets: SILK_PRESETS,
  getSummary: (state) => {
    const s = state.silk;
    return `${s.palette} · width ${Math.round(s.width * 100)}% · taut ${Math.round(s.tautness * 100)}%`;
  },
};
