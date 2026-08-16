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
      afterglow: 0.92,
    },
  },
  {
    id: "bloom-halo",
    name: "Halo",
    previewColor: "#ffffff",
    patch: {
      // Measured against the real renderer at production stage scale: the
      // shipped 0.58/0.04 peaked at 66 of 255, so Halo was a smudge on a dark
      // stage while Supernova hit 255. 0.95/0.20 peaks at 249 and still reads
      // as Halo - a soft diffuse orb. Raising coreStrength further (0.30, 0.35)
      // turns the core into a pinpoint and the preset stops being a halo.
      intensity: 0.95,
      coreStrength: 0.2,
      radius: 62,
      color: "#e0e7ff",
      palette: ["#f472b6", "#fbbf24", "#22d3ee"],
      colorMode: "solid",
      falloff: "smooth",
      pulse: 0,
      pulseRate: 0.5,
      streak: 0,
      spikes: 0,
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
    const lens = layers.length ? layers.join(" · ") : "halo";
    return `${b.colorMode} · ${lens} · glow ${Math.round(b.afterglow * 100)}%`;
  },
};
