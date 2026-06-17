import type { EffectPreset, EffectPresetGroup } from "./types";

export const PULSE_PRESETS: EffectPreset<"pulse">[] = [
  {
    // Pure concentric circles — zero deform, the clean radar ping.
    id: "pulse-sonar",
    name: "Sonar",
    previewColor: "#38bdf8",
    patch: {
      trigger: "beat",
      style: "glow",
      palette: "sonar",
      intensity: 0.7,
      reach: 0.7,
      lifetime: 1.1,
      thickness: 0.3,
      beatInterval: 1,
      velocityScale: 0.3,
      asymmetry: 0,
      chromatic: 0,
      flash: 0.3,
      harmonics: 0.15,
    },
  },
  {
    // Headline: hard directional Mach teardrop + chromatic fringe + flash.
    id: "pulse-shockwave",
    name: "Shockwave",
    previewColor: "#ff6000",
    patch: {
      trigger: "velocity",
      style: "glow",
      palette: "ember",
      intensity: 0.5,
      reach: 0.85,
      lifetime: 0.7,
      thickness: 0.6,
      velocityThreshold: 0.5,
      velocityScale: 0.9,
      asymmetry: 0.9,
      chromatic: 0.3,
      flash: 0.5,
      harmonics: 0.1,
    },
  },
  {
    // Beat-locked paired thump (lub-dub on each beat, gaps between) — the
    // rhythmic identity, distinct from Ripple's continuous flow.
    id: "pulse-heartbeat",
    name: "Heartbeat",
    previewColor: "#f0abfc",
    patch: {
      trigger: "beat",
      style: "glow",
      palette: "neon",
      intensity: 0.42,
      reach: 0.45,
      lifetime: 0.7,
      thickness: 0.45,
      beatInterval: 1,
      velocityScale: 0.5,
      asymmetry: 0.15,
      chromatic: 0.1,
      flash: 0.6,
      harmonics: 0.4,
    },
  },
  {
    // Soft continuous many-ring concentric flow — large, slow, no flash, no
    // deform. Pure water, distinct from Heartbeat's punchy beat thump.
    id: "pulse-ripple",
    name: "Ripple",
    previewColor: "#93c5fd",
    patch: {
      trigger: "continuous",
      style: "glow",
      palette: "ripple",
      intensity: 0.3,
      reach: 0.8,
      lifetime: 1.5,
      thickness: 0.5,
      velocityScale: 0.35,
      asymmetry: 0,
      chromatic: 0,
      flash: 0,
      harmonics: 0.9,
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
