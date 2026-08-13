import type { EffectPreset, EffectPresetGroup } from "./types";

export const BLOOM_PRESETS: EffectPreset<"bloom">[] = [
  {
    id: "bloom-supernova",
    name: "Supernova",
    previewColor: "#ffffff",
    previewColor2: "#a5b4fc",
    patch: {
      intensity: 0.82,
      coreStrength: 1,
      radius: 56,
      color: "#ffffff",
      palette: ["#f472b6", "#fbbf24", "#22d3ee"],
      colorMode: "prop-matched",
      falloff: "sharp",
      pulse: 0,
      pulseRate: 0.25,
      streak: 0,
      spikes: 1,
      chromatic: 0,
      afterglow: 0,
    },
  },
  {
    id: "bloom-comet",
    name: "Comet",
    previewColor: "#fbbf24",
    previewColor2: "#f97316",
    patch: {
      intensity: 0.68,
      coreStrength: 0.18,
      radius: 34,
      color: "#fbbf24",
      palette: ["#fbbf24", "#f59e0b", "#fde047"],
      colorMode: "solid",
      falloff: "smooth",
      pulse: 0,
      pulseRate: 1,
      streak: 1,
      spikes: 0,
      chromatic: 0,
      afterglow: 0.92,
    },
  },
  {
    id: "bloom-prism",
    name: "Aurora",
    previewColor: "rainbow",
    patch: {
      intensity: 0.68,
      coreStrength: 0.28,
      radius: 32,
      color: "#e8f7ff",
      palette: ["#ff1744", "#00e676", "#2979ff", "#ffd600"],
      colorMode: "solid",
      falloff: "smooth",
      pulse: 0,
      pulseRate: 1,
      streak: 0,
      spikes: 0,
      chromatic: 0.9,
      afterglow: 0,
    },
  },
  {
    id: "bloom-halo",
    name: "Halo",
    previewColor: "#ffffff",
    patch: {
      intensity: 0.58,
      coreStrength: 0.04,
      radius: 62,
      color: "#e0e7ff",
      palette: ["#f472b6", "#fbbf24", "#22d3ee"],
      colorMode: "solid",
      falloff: "smooth",
      pulse: 0,
      pulseRate: 0.5,
      streak: 0,
      spikes: 0,
      chromatic: 0,
      afterglow: 0,
    },
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
    if (b.chromatic > 0) layers.push("iridescence");
    const lens = layers.length ? layers.join(" · ") : "halo";
    return `${b.colorMode} · ${lens} · glow ${Math.round(b.afterglow * 100)}%`;
  },
};
