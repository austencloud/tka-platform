import type { EffectPreset, EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { EchoIntent } from "$lib/shared/effects/domain/effects-config";
import type { EffectsPreset } from "$lib/shared/effects/domain/effects-preset";

function applyEcho(
  state: EffectsConfigState,
  presetId: string,
  patch: Partial<EchoIntent>,
): void {
  state.updateEffect("echo", patch);
  // updateEcho nulls activePresets.echo; restore it so the chip stays highlighted.
  state.applyPreset({
    id: presetId,
    effectType: "echo",
    patch: { activePresets: { ...state.activePresets, echo: presetId } },
  } as unknown as EffectsPreset);
}

export const ECHO_PRESETS: EffectPreset[] = [
  {
    id: "echo-stroboscope",
    name: "Stroboscope",
    previewColor: "#ffffff",
    apply: (state) =>
      applyEcho(state, "echo-stroboscope", {
        intensity: 0.7,
        decay: 4,
        interval: 1,
        shape: "staff",
        colorMode: "solid",
        color: "#ffffff",
        thickness: 3,
      }),
  },
  {
    id: "echo-rainbow-trail",
    name: "Rainbow Trail",
    previewColor: "rainbow",
    apply: (state) =>
      applyEcho(state, "echo-rainbow-trail", {
        intensity: 0.75,
        decay: 6,
        interval: 1,
        shape: "staff",
        colorMode: "rainbow",
        color: "#ffffff",
        thickness: 3,
      }),
  },
  {
    id: "echo-twin-ghosts",
    name: "Twin Ghosts",
    previewColor: "#a5b4fc",
    apply: (state) =>
      applyEcho(state, "echo-twin-ghosts", {
        intensity: 0.65,
        decay: 3,
        interval: 1,
        shape: "both",
        colorMode: "prop-matched",
        color: "#ffffff",
        thickness: 3,
      }),
  },
  {
    id: "echo-pulse",
    name: "Pulse",
    previewColor: "#22d3ee",
    apply: (state) =>
      applyEcho(state, "echo-pulse", {
        intensity: 0.9,
        decay: 2,
        interval: 0.5,
        shape: "tips",
        colorMode: "solid",
        color: "#22d3ee",
        thickness: 5,
      }),
  },
  {
    id: "echo-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => {
      // "Custom" just opens the Customize panel - EffectsPanel routes Custom → customizeOpen.
    },
  },
];

export const ECHO_PRESET_GROUP: EffectPresetGroup = {
  effectType: "echo",
  presets: ECHO_PRESETS,
  getSummary: (state) => {
    const e = state.echo;
    return `${e.shape} · decay ${e.decay}b · every ${e.interval}b`;
  },
};
