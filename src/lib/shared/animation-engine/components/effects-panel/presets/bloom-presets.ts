import type { EffectPreset, EffectPresetGroup } from "./types";

export const BLOOM_PRESETS: EffectPreset<"bloom">[] = [
  {
    id: "bloom-supernova",
    name: "Supernova",
    previewColor: "#ffffff",
    previewColor2: "#a5b4fc",
    patch: {
      intensity: 1,
      radius: 50,
      color: "#ffffff",
      palette: ["#f472b6", "#fbbf24", "#22d3ee"],
      colorMode: "prop-matched",
      falloff: "sharp",
      pulse: 0,
      pulseRate: 0.25,
      streak: 0.3,
      spikes: 0.4,
      chromatic: 0.4,
      afterglow: 0.4,
    },
  },
  {
    id: "bloom-comet",
    name: "Comet",
    previewColor: "#fbbf24",
    previewColor2: "#f97316",
    patch: {
      intensity: 0.55,
      radius: 44,
      color: "#fbbf24",
      palette: ["#fbbf24", "#f59e0b", "#fde047"],
      colorMode: "solid",
      falloff: "smooth",
      pulse: 0,
      pulseRate: 1,
      streak: 1,
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
      intensity: 0.7,
      radius: 30,
      color: "#f472b6",
      palette: ["#f472b6", "#fbbf24", "#22d3ee", "#a855f7"],
      colorMode: "rainbow",
      falloff: "smooth",
      pulse: 0.4,
      pulseRate: 1,
      streak: 0.25,
      spikes: 1,
      chromatic: 0.9,
      afterglow: 0,
    },
  },
  {
    id: "bloom-halo",
    name: "Halo",
    previewColor: "#ffffff",
    patch: {
      intensity: 0.7,
      radius: 32,
      color: "#ffffff",
      palette: ["#f472b6", "#fbbf24", "#22d3ee"],
      colorMode: "solid",
      falloff: "sharp",
      pulse: 0.7,
      pulseRate: 0.5,
      streak: 0.5,
      spikes: 0,
      chromatic: 0.4,
      afterglow: 0.6,
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
