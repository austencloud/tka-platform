import type { EffectPreset, EffectPresetGroup } from "./types";

export const PULSE_PRESETS: EffectPreset<"pulse">[] = [
  {
    id: "pulse-sonar",
    name: "Sonar",
    previewColor: "#38bdf8",
    patch: {
      trigger: "beat",
      style: "stroke",
      palette: "sonar",
      intensity: 0.7,
      reach: 0.7,
      lifetime: 1.0,
      thickness: 0.3,
      beatInterval: 1,
    },
  },
  {
    id: "pulse-shockwave",
    name: "Shockwave",
    previewColor: "#ff6000",
    patch: {
      trigger: "velocity",
      style: "glow",
      palette: "ember",
      intensity: 0.9,
      reach: 0.8,
      lifetime: 0.5,
      thickness: 0.6,
      velocityThreshold: 0.6,
    },
  },
  {
    id: "pulse-heartbeat",
    name: "Heartbeat",
    previewColor: "#f0abfc",
    patch: {
      trigger: "continuous",
      style: "glow",
      palette: "neon",
      intensity: 0.6,
      reach: 0.5,
      lifetime: 0.8,
      thickness: 0.4,
    },
  },
  {
    id: "pulse-radar",
    name: "Radar",
    previewColor: "#a855f7",
    patch: {
      trigger: "beat",
      style: "stroke",
      palette: "aurora",
      intensity: 0.5,
      reach: 0.9,
      lifetime: 1.5,
      thickness: 0.2,
      beatInterval: 2,
    },
  },
  {
    id: "pulse-ripple",
    name: "Ripple",
    previewColor: "#93c5fd",
    patch: {
      trigger: "continuous",
      style: "glow",
      palette: "ripple",
      intensity: 0.5,
      reach: 0.6,
      lifetime: 1.2,
      thickness: 0.5,
    },
  },
  {
    id: "pulse-void",
    name: "Void",
    previewColor: "#404060",
    patch: {
      trigger: "velocity",
      style: "stroke",
      palette: "void",
      intensity: 0.8,
      reach: 0.7,
      lifetime: 0.7,
      thickness: 0.4,
      velocityThreshold: 0.4,
    },
  },
  {
    // "Custom" just opens Customize - empty patch, marks the chip active.
    id: "pulse-custom",
    name: "Custom",
    previewColor: "custom",
    patch: {},
  },
];

export const PULSE_PRESET_GROUP: EffectPresetGroup = {
  effectType: "pulse",
  presets: PULSE_PRESETS,
  getSummary: (state) => {
    const p = state.pulse;
    return `${p.trigger} · ${p.style} · ${p.palette}`;
  },
};
