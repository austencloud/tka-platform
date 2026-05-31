import type { EffectsPreset } from "../effects-preset";

export const BUILT_IN_TRAIL_PRESETS: EffectsPreset[] = [
  {
    id: "trail-default",
    name: "Default",
    description: "Standard trail with canonical blue and red colors.",
    effectType: "trails",
    builtIn: true,
    previewColors: ["#3D44B8", "#DC2626"],
    patch: {
      trails: {
        thickness: 5,
        brightness: 1.0,
        blueColor: "#3D44B8",
        redColor: "#DC2626",
        rainbow: false,
      },
    },
  },
  {
    id: "trail-neon",
    name: "Neon",
    description: "Bright cyan and magenta with a strong glow.",
    effectType: "trails",
    builtIn: true,
    previewColors: ["#00ffcc", "#ff00ff"],
    patch: {
      trails: {
        thickness: 4,
        brightness: 1.0,
        blueColor: "#00ffcc",
        redColor: "#ff00ff",
        rainbow: false,
      },
    },
  },
  {
    id: "trail-ember",
    name: "Ember",
    description: "Warm orange and amber, gently faded.",
    effectType: "trails",
    builtIn: true,
    previewColors: ["#f97316", "#fbbf24"],
    patch: {
      trails: {
        thickness: 6,
        brightness: 0.9,
        blueColor: "#f97316",
        redColor: "#fbbf24",
        rainbow: false,
      },
    },
  },
];
