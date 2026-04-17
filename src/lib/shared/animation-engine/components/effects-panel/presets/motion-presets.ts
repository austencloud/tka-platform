import type { EffectPreset, EffectPresetGroup } from "./types";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import type { MotionIntent } from "$lib/shared/effects/domain/EffectsConfig";
import type { EffectsPreset } from "$lib/shared/effects/domain/EffectsPreset";

function applyMotion(
  state: EffectsConfigState | null,
  presetId: string,
  patch: Partial<MotionIntent>,
): void {
  if (!state) return;
  state.updateMotion(patch);
  // updateMotion nulls activePresets.motion; restore it so the chip stays highlighted.
  state.applyPreset({
    id: presetId,
    effectType: "motion",
    patch: { activePresets: { ...state.activePresets, motion: presetId } },
  } as unknown as EffectsPreset);
}

export const MOTION_PRESETS: EffectPreset[] = [
  {
    id: "motion-anime",
    name: "Anime",
    previewColor: "#ffffff",
    apply: (_vm, state) => applyMotion(state, "motion-anime", {
      blur: 0.1, speedLines: 0.9, threshold: 0.25,
      color: "#ffffff", colorMode: "solid",
      length: 0.7, count: 8,
    }),
  },
  {
    id: "motion-ghost",
    name: "Ghost",
    previewColor: "#a5b4fc",
    apply: (_vm, state) => applyMotion(state, "motion-ghost", {
      blur: 0.9, speedLines: 0, threshold: 0.1,
      color: "#a5b4fc", colorMode: "prop-matched",
      length: 0.6, count: 4,
    }),
  },
  {
    id: "motion-comet",
    name: "Comet",
    previewColor: "rainbow",
    apply: (_vm, state) => applyMotion(state, "motion-comet", {
      blur: 0.7, speedLines: 0.7, threshold: 0.15,
      color: "#ffffff", colorMode: "velocity",
      length: 1.0, count: 6,
    }),
  },
  {
    id: "motion-sonic-boom",
    name: "Sonic Boom",
    previewColor: "#fde047",
    apply: (_vm, state) => applyMotion(state, "motion-sonic-boom", {
      blur: 0.3, speedLines: 1.0, threshold: 0.55,
      color: "#fde047", colorMode: "solid",
      length: 1.0, count: 12,
    }),
  },
  {
    id: "motion-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => {
      // "Custom" just opens the Customize panel — EffectsPanel routes Custom → customizeOpen.
    },
  },
];

export const MOTION_PRESET_GROUP: EffectPresetGroup = {
  effectType: "motion",
  presets: MOTION_PRESETS,
  getSummary: (_vm, state) => {
    if (!state) return "";
    const m = state.motion;
    return `${m.colorMode} · blur ${Math.round(m.blur * 100)}% · lines ${Math.round(m.speedLines * 100)}%`;
  },
};
