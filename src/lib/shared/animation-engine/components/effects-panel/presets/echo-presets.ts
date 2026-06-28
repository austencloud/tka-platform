import type { EffectPreset, EffectPresetGroup } from "./types";

export const ECHO_PRESETS: EffectPreset<"echo">[] = [
  {
    id: "echo-stroboscope",
    name: "Stroboscope",
    previewColor: "#ffffff",
    patch: {
      intensity: 0.85, decay: 5, interval: 1, shape: "staff",
      colorMode: "solid", color: "#ffffff", thickness: 3,
      glow: 0.6, depth: 0.5, flash: 0.7, streak: 0.15,
    },
  },
  {
    id: "echo-rainbow-trail",
    name: "Rainbow Trail",
    previewColor: "rainbow",
    patch: {
      intensity: 0.85, decay: 7, interval: 1, shape: "staff",
      colorMode: "rainbow", color: "#ffffff", thickness: 3,
      glow: 0.85, depth: 0.4, flash: 0.4, streak: 0.6,
    },
  },
  {
    id: "echo-twin-ghosts",
    name: "Twin Ghosts",
    previewColor: "#a5b4fc",
    patch: {
      intensity: 0.8, decay: 4, interval: 1, shape: "both",
      colorMode: "prop-matched", color: "#ffffff", thickness: 3,
      glow: 0.7, depth: 0.6, flash: 0.5, streak: 0.3,
    },
  },
  {
    id: "echo-pulse",
    name: "Pulse",
    previewColor: "#22d3ee",
    patch: {
      intensity: 0.9, decay: 3, interval: 0.5, shape: "tips",
      colorMode: "solid", color: "#22d3ee", thickness: 5,
      glow: 0.9, depth: 0.3, flash: 0.9, streak: 0.1,
    },
  },
];

export const ECHO_PRESET_GROUP: EffectPresetGroup = {
  effectType: "echo",
  presets: ECHO_PRESETS,
  getSummary: (state) => {
    const e = state.echo;
    return `${e.shape} · ${e.decay}b exposure · streak ${Math.round(e.streak * 100)}%`;
  },
};
