import type { EffectPreset, EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { SparklesIntent } from "$lib/shared/effects/domain/EffectsConfig";
import type { EffectsPreset } from "$lib/shared/effects/domain/EffectsPreset";

function applySparkles(
  state: EffectsConfigState,
  presetId: string,
  patch: Partial<SparklesIntent>,
): void {
  state.updateSparkles(patch);
  // updateSparkles nulls activePresets.sparkles; restore it so the chip stays highlighted.
  state.applyPreset({
    id: presetId,
    effectType: "sparkles",
    patch: { activePresets: { ...state.activePresets, sparkles: presetId } },
  } as unknown as EffectsPreset);
}

export const SPARKLES_PRESETS: EffectPreset[] = [
  {
    id: "sparkles-fairy-dust",
    name: "Fairy Dust",
    previewColor: "#fde047",
    apply: (state) => applySparkles(state, "sparkles-fairy-dust", {
      rate: 0.4, size: 0.4, lifetime: 1.8,
      color: "#fde047", colorMode: "solid",
      spread: 10, gravity: 0.1, mode: "stream",
    }),
  },
  {
    id: "sparkles-pixie",
    name: "Pixie Sparks",
    previewColor: "#67e8f9",
    apply: (state) => applySparkles(state, "sparkles-pixie", {
      rate: 0.8, size: 0.3, lifetime: 0.6,
      color: "#67e8f9", colorMode: "solid",
      spread: 6, gravity: 0.5, mode: "burst",
    }),
  },
  {
    id: "sparkles-confetti",
    name: "Confetti",
    previewColor: "#ec4899",
    apply: (state) => applySparkles(state, "sparkles-confetti", {
      rate: 0.7, size: 0.6, lifetime: 2.0,
      colorMode: "palette",
      palette: ["#ec4899", "#22d3ee", "#fbbf24", "#22c55e", "#a855f7"],
      spread: 12, gravity: 0.8, mode: "stream",
    }),
  },
  {
    id: "sparkles-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => {
      // "Custom" just opens the Customize panel - EffectsPanel routes Custom → customizeOpen.
    },
  },
];

export const SPARKLES_PRESET_GROUP: EffectPresetGroup = {
  effectType: "sparkles",
  presets: SPARKLES_PRESETS,
  getSummary: (state) => {
    const s = state.sparkles;
    return `${s.mode} · ${Math.round(s.rate * 100)}% · ${s.lifetime}s`;
  },
};
