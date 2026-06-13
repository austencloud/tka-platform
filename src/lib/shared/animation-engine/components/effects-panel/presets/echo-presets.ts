import type { EffectPreset, EffectPresetGroup } from "./types";

export const ECHO_PRESETS: EffectPreset<"echo">[] = [
  {
    id: "echo-stroboscope",
    name: "Stroboscope",
    previewColor: "#ffffff",
    patch: {
      intensity: 0.7,
      decay: 4,
      interval: 1,
      shape: "staff",
      colorMode: "solid",
      color: "#ffffff",
      thickness: 3,
    },
  },
  {
    id: "echo-rainbow-trail",
    name: "Rainbow Trail",
    previewColor: "rainbow",
    patch: {
      intensity: 0.75,
      decay: 6,
      interval: 1,
      shape: "staff",
      colorMode: "rainbow",
      color: "#ffffff",
      thickness: 3,
    },
  },
  {
    id: "echo-twin-ghosts",
    name: "Twin Ghosts",
    previewColor: "#a5b4fc",
    patch: {
      intensity: 0.65,
      decay: 3,
      interval: 1,
      shape: "both",
      colorMode: "prop-matched",
      color: "#ffffff",
      thickness: 3,
    },
  },
  {
    id: "echo-pulse",
    name: "Pulse",
    previewColor: "#22d3ee",
    patch: {
      intensity: 0.9,
      decay: 2,
      interval: 0.5,
      shape: "tips",
      colorMode: "solid",
      color: "#22d3ee",
      thickness: 5,
    },
  },
  {
    // "Custom" just opens the Customize panel - empty patch, marks the chip active.
    id: "echo-custom",
    name: "Custom",
    previewColor: "custom",
    patch: {},
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
