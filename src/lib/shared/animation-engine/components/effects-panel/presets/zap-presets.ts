import type { EffectPreset, EffectPresetGroup } from "./types";
import type { AnimationVisibilityStateManager } from "../../../state/animation-visibility-state.svelte";
import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";

function apply(presetId: string, patch: Partial<import("$lib/shared/effects/domain/EffectsConfig").ZapIntent>): void {
  const state = getEffectsConfigContext();
  if (!state) return;
  state.updateZap(patch);
  // Mark preset as active (updateZap nulls it first — restore it here).
  state.applyPreset({
    id: presetId,
    effectType: "zap",
    patch: { activePresets: { ...state.activePresets, zap: presetId } },
  } as unknown as import("$lib/shared/effects/domain/EffectsPreset").EffectsPreset);
}

export const ZAP_PRESETS: EffectPreset[] = [
  {
    id: "zap-thunder",
    name: "Thunder",
    previewColor: "#88ccff",
    apply: (_vm) => apply("zap-thunder", {
      intensity: 0.9, color: "#88ccff", frequency: 8, mode: "arc", branching: 0.4,
    }),
  },
  {
    id: "zap-tesla",
    name: "Tesla",
    previewColor: "#a855f7",
    apply: (_vm) => apply("zap-tesla", {
      intensity: 1.0, color: "#a855f7", frequency: 20, mode: "arc", branching: 0.6,
    }),
  },
  {
    id: "zap-plasma",
    name: "Plasma",
    previewColor: "#ec4899",
    apply: (_vm) => apply("zap-plasma", {
      intensity: 0.7, color: "#ec4899", frequency: 16, mode: "crackle", branching: 0.2,
    }),
  },
  {
    id: "zap-custom",
    name: "Custom",
    previewColor: "custom",
    apply: (_vm) => {
      // "Custom" just opens the Customize panel — no-op here; the EffectsPanel
      // routes Custom → customizeOpen.
    },
  },
];

export const ZAP_PRESET_GROUP: EffectPresetGroup = {
  effectType: "zap",
  presets: ZAP_PRESETS,
  getSummary: (_vm: AnimationVisibilityStateManager): string => {
    const state = getEffectsConfigContext();
    if (!state) return "";
    const z = state.zap;
    return `${z.mode} · freq ${z.frequency}/s · ${Math.round(z.intensity * 100)}%`;
  },
};
