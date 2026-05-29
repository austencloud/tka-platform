import type { EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { FrostIntent } from "$lib/shared/effects/domain/EffectsConfig";
import type { EffectsPreset } from "$lib/shared/effects/domain/EffectsPreset";

function applyFrost(
  state: EffectsConfigState,
  presetId: string,
  patch: Partial<FrostIntent>,
): void {
  state.updateEffect("frost", patch);
  state.applyPreset({
    id: presetId,
    effectType: "frost",
    patch: { activePresets: { ...state.activePresets, frost: presetId } },
  } as unknown as EffectsPreset);
}

export const FROST_PRESETS = [
  {
    id: "frost-classic",
    name: "Classic",
    previewColor: "#a0d8ff",
    apply: (state: EffectsConfigState) =>
      applyFrost(state, "frost-classic", {
        palette: "glacial",
        ambientEmission: 0.4,
        motionEmission: 0.5,
        intensity: 0.6,
        crystallinity: 0.7,
        spreadRate: 0.5,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "frost-breath",
    name: "Breath",
    previewColor: "#d0e8f0",
    apply: (state: EffectsConfigState) =>
      applyFrost(state, "frost-breath", {
        palette: "breath",
        ambientEmission: 0.7,
        motionEmission: 0.3,
        intensity: 0.4,
        crystallinity: 0.0,
        spreadRate: 0.0,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "frost-flash-freeze",
    name: "Flash Freeze",
    previewColor: "#e0f4ff",
    apply: (state: EffectsConfigState) =>
      applyFrost(state, "frost-flash-freeze", {
        palette: "glacial",
        ambientEmission: 0.2,
        motionEmission: 0.9,
        intensity: 0.8,
        crystallinity: 1.0,
        spreadRate: 1.0,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "frost-black-ice",
    name: "Black Ice",
    previewColor: "#202830",
    apply: (state: EffectsConfigState) =>
      applyFrost(state, "frost-black-ice", {
        palette: "black_ice",
        ambientEmission: 0.3,
        motionEmission: 0.6,
        intensity: 0.5,
        crystallinity: 0.6,
        spreadRate: 0.6,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "frost-aurora",
    name: "Aurora",
    previewColor: "#60ff80",
    apply: (state: EffectsConfigState) =>
      applyFrost(state, "frost-aurora", {
        palette: "aurora",
        ambientEmission: 0.5,
        motionEmission: 0.4,
        intensity: 0.7,
        crystallinity: 0.8,
        spreadRate: 0.5,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "frost-cursed",
    name: "Cursed",
    previewColor: "#4020a0",
    apply: (state: EffectsConfigState) =>
      applyFrost(state, "frost-cursed", {
        palette: "cursed",
        ambientEmission: 0.3,
        motionEmission: 0.5,
        intensity: 0.7,
        crystallinity: 0.9,
        spreadRate: 0.4,
        trackingMode: "both_ends",
      }),
  },
  {
    id: "frost-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => {},
  },
];

export const FROST_PRESET_GROUP: EffectPresetGroup = {
  effectType: "frost",
  presets: FROST_PRESETS,
  getSummary: (state) => {
    const f = state.frost;
    return `${f.palette} · size ${Math.round(f.crystallinity * 100)}% · trail ${Math.round(f.spreadRate * 100)}%`;
  },
};
