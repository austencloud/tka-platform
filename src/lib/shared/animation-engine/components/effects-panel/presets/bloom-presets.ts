import type { EffectPreset, EffectPresetGroup } from "./types";

export const BLOOM_PRESETS: EffectPreset<"bloom">[] = [
  {
    id: "bloom-candle",
    name: "Candle",
    previewColor: "#fbbf24",
    patch: {
      intensity: 0.95,
      radius: 100,
      color: "#fbbf24",
      palette: ["#fbbf24", "#f59e0b", "#fde047"],
      colorMode: "solid",
      falloff: "smooth",
      pulse: 0.3,
      pulseRate: 0.8,
    },
  },
  {
    id: "bloom-halo",
    name: "Halo",
    previewColor: "#ffffff",
    patch: {
      intensity: 0.9,
      radius: 130,
      color: "#ffffff",
      palette: ["#f472b6", "#fbbf24", "#22d3ee"],
      colorMode: "solid",
      falloff: "ring",
      pulse: 0,
      pulseRate: 1,
    },
  },
  {
    id: "bloom-prism",
    name: "Prism",
    previewColor: "rainbow",
    patch: {
      intensity: 0.95,
      radius: 95,
      color: "#f472b6",
      palette: ["#f472b6", "#fbbf24", "#22d3ee", "#a855f7"],
      colorMode: "palette",
      falloff: "smooth",
      pulse: 0,
      pulseRate: 1,
    },
  },
  {
    id: "bloom-twin-stars",
    name: "Twin Stars",
    previewColor: "#a5b4fc",
    patch: {
      intensity: 1.0,
      radius: 110,
      color: "#ffffff",
      palette: ["#f472b6", "#fbbf24", "#22d3ee"],
      colorMode: "prop-matched",
      falloff: "sharp",
      pulse: 0,
      pulseRate: 1,
    },
  },
  {
    // "Custom" just opens the Customize panel - empty patch, marks the chip active.
    id: "bloom-custom",
    name: "Custom",
    previewColor: "custom",
    patch: {},
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
