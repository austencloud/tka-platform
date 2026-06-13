import type { EffectPreset, EffectPresetGroup } from "./types";

export const BLOOM_PRESETS: EffectPreset<"bloom">[] = [
  {
    id: "bloom-supernova",
    name: "Supernova",
    previewColor: "#ffffff",
    previewColor2: "#a5b4fc",
    patch: {
      intensity: 1.0,
      radius: 120,
      color: "#ffffff",
      palette: ["#f472b6", "#fbbf24", "#22d3ee"],
      colorMode: "prop-matched",
      falloff: "sharp",
      pulse: 0,
      pulseRate: 1,
      streak: 0.4,
      spikes: 0.95,
      chromatic: 0.3,
      afterglow: 0.35,
    },
  },
  {
    id: "bloom-comet",
    name: "Comet",
    previewColor: "#fbbf24",
    previewColor2: "#f97316",
    patch: {
      intensity: 0.95,
      radius: 95,
      color: "#fbbf24",
      palette: ["#fbbf24", "#f59e0b", "#fde047"],
      colorMode: "solid",
      falloff: "smooth",
      pulse: 0,
      pulseRate: 1,
      streak: 0.9,
      spikes: 0.25,
      chromatic: 0.2,
      afterglow: 0.85,
    },
  },
  {
    id: "bloom-prism",
    name: "Prism",
    previewColor: "rainbow",
    patch: {
      intensity: 0.95,
      radius: 100,
      color: "#f472b6",
      palette: ["#f472b6", "#fbbf24", "#22d3ee", "#a855f7"],
      colorMode: "palette",
      falloff: "smooth",
      pulse: 0,
      pulseRate: 1,
      streak: 0.5,
      spikes: 0.45,
      chromatic: 0.9,
      afterglow: 0.5,
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
      pulse: 0.2,
      pulseRate: 0.8,
      streak: 0,
      spikes: 0,
      chromatic: 0,
      afterglow: 0.25,
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
    const layers: string[] = [];
    if (b.streak > 0) layers.push("streak");
    if (b.spikes > 0) layers.push("spikes");
    if (b.chromatic > 0) layers.push("dispersion");
    const lens = layers.length ? layers.join(" · ") : "halo";
    return `${b.colorMode} · ${lens} · glow ${Math.round(b.afterglow * 100)}%`;
  },
};
