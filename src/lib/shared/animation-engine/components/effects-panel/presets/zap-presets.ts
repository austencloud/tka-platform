import type { EffectPreset, EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { ZapIntent } from "$lib/shared/effects/domain/EffectsConfig";
import type { EffectsPreset } from "$lib/shared/effects/domain/EffectsPreset";

function applyZap(
  state: EffectsConfigState,
  presetId: string,
  patch: Partial<ZapIntent>,
): void {
  state.updateEffect("zap", patch);
  // updateZap nulls activePresets.zap; restore it so the chip stays highlighted.
  state.applyPreset({
    id: presetId,
    effectType: "zap",
    patch: { activePresets: { ...state.activePresets, zap: presetId } },
  } as unknown as EffectsPreset);
}

export const ZAP_PRESETS: EffectPreset[] = [
  {
    id: "zap-thunder",
    name: "Thunder",
    previewColor: "#88ccff",
    apply: (state) => applyZap(state, "zap-thunder", {
      intensity: 0.9, leftColor: "#88ccff", rightColor: "#88ccff",
      frequency: 8, mode: "arc", branching: 0.4,
    }),
  },
  {
    id: "zap-tesla",
    name: "Tesla",
    previewColor: "#a855f7",
    apply: (state) => applyZap(state, "zap-tesla", {
      intensity: 1.0, leftColor: "#a855f7", rightColor: "#a855f7",
      frequency: 20, mode: "arc", branching: 0.6,
    }),
  },
  {
    id: "zap-plasma",
    name: "Plasma",
    previewColor: "#ec4899",
    apply: (state) => applyZap(state, "zap-plasma", {
      intensity: 0.7, leftColor: "#ec4899", rightColor: "#22d3ee",
      frequency: 16, mode: "crackle", branching: 0.2,
    }),
  },
  {
    id: "zap-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => {
      // "Custom" just opens the Customize panel - EffectsPanel routes Custom → customizeOpen.
    },
  },
];

export const ZAP_PRESET_GROUP: EffectPresetGroup = {
  effectType: "zap",
  presets: ZAP_PRESETS,
  getSummary: (state) => {
    const z = state.zap;
    return `${z.mode} · freq ${z.frequency}/s · ${Math.round(z.intensity * 100)}%`;
  },
};
