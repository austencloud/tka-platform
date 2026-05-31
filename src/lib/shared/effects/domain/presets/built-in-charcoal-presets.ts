import type { EffectsPreset } from "../effects-preset";

export const BUILT_IN_CHARCOAL_PRESETS: EffectsPreset[] = [
  {
    id: "charcoal-violet-ember",
    name: "Violet Ember",
    description: "Soft lavender embers with mid glow.",
    effectType: "charcoal",
    builtIn: true,
    previewColors: ["#a78bfa", "#c4b5fd"],
    patch: {
      charcoal: { intensity: 0.5, spread: 0.5, glow: 0.6 },
    },
  },
  {
    id: "charcoal-hot-coal",
    name: "Hot Coal",
    description: "Intense white-hot core, tight spread, heavy glow.",
    effectType: "charcoal",
    builtIn: true,
    previewColors: ["#ffffff", "#ef4444"],
    patch: {
      charcoal: { intensity: 0.8, spread: 0.4, glow: 0.8 },
    },
  },
  {
    id: "charcoal-jade-dust",
    name: "Jade Dust",
    description: "Cool mint sparks, wide spread, gentle glow.",
    effectType: "charcoal",
    builtIn: true,
    previewColors: ["#6ee7b7", "#10b981"],
    patch: {
      charcoal: { intensity: 0.4, spread: 0.7, glow: 0.5 },
    },
  },
  {
    id: "charcoal-ash",
    name: "Ash",
    description: "Muted gray sparks for a subtle falloff look.",
    effectType: "charcoal",
    builtIn: true,
    previewColors: ["#9ca3af", "#4b5563"],
    patch: {
      charcoal: { intensity: 0.3, spread: 0.3, glow: 0.2 },
    },
  },
];
