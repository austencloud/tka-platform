import type { EffectPreset, EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { BloomIntent } from "$lib/shared/effects/domain/EffectsConfig";
import type { EffectsPreset } from "$lib/shared/effects/domain/EffectsPreset";

function applyBloom(
  state: EffectsConfigState,
  presetId: string,
  patch: Partial<BloomIntent>,
): void {
  state.updateEffect("bloom", patch);
  // updateBloom nulls activePresets.bloom; restore it so the chip stays highlighted.
  state.applyPreset({
    id: presetId,
    effectType: "bloom",
    patch: { activePresets: { ...state.activePresets, bloom: presetId } },
  } as unknown as EffectsPreset);
}

export const BLOOM_PRESETS: EffectPreset[] = [
  {
    id: "bloom-candle",
    name: "Candle",
    previewColor: "#fbbf24",
    apply: (state) =>
      applyBloom(state, "bloom-candle", {
        intensity: 0.95,
        radius: 100,
        color: "#fbbf24",
        palette: ["#fbbf24", "#f59e0b", "#fde047"],
        colorMode: "solid",
        falloff: "smooth",
        pulse: 0.3,
        pulseRate: 0.8,
      }),
  },
  {
    id: "bloom-halo",
    name: "Halo",
    previewColor: "#ffffff",
    apply: (state) =>
      applyBloom(state, "bloom-halo", {
        intensity: 0.9,
        radius: 130,
        color: "#ffffff",
        palette: ["#f472b6", "#fbbf24", "#22d3ee"],
        colorMode: "solid",
        falloff: "ring",
        pulse: 0,
        pulseRate: 1,
      }),
  },
  {
    id: "bloom-prism",
    name: "Prism",
    previewColor: "rainbow",
    apply: (state) =>
      applyBloom(state, "bloom-prism", {
        intensity: 0.95,
        radius: 95,
        color: "#f472b6",
        palette: ["#f472b6", "#fbbf24", "#22d3ee", "#a855f7"],
        colorMode: "palette",
        falloff: "smooth",
        pulse: 0,
        pulseRate: 1,
      }),
  },
  {
    id: "bloom-twin-stars",
    name: "Twin Stars",
    previewColor: "#a5b4fc",
    apply: (state) =>
      applyBloom(state, "bloom-twin-stars", {
        intensity: 1.0,
        radius: 110,
        color: "#ffffff",
        palette: ["#f472b6", "#fbbf24", "#22d3ee"],
        colorMode: "prop-matched",
        falloff: "sharp",
        pulse: 0,
        pulseRate: 1,
      }),
  },
  {
    id: "bloom-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => {
      // "Custom" just opens the Customize panel - EffectsPanel routes Custom → customizeOpen.
    },
  },
];

export const BLOOM_PRESET_GROUP: EffectPresetGroup = {
  effectType: "bloom",
  presets: BLOOM_PRESETS,
  getSummary: (state) => {
    const b = state.bloom;
    return `${b.colorMode} · ${b.falloff} · r${b.radius}px`;
  },
};
