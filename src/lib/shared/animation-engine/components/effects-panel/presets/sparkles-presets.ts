import type { EffectPreset, EffectPresetGroup } from "./types";

/**
 * Five looks, each occupying a distinct corner of the parameter space so no two
 * read as the same preset with a different hex code. The axes they spread
 * across: colorMode (solid / rainbow / palette), spawn mode (stream / trail /
 * burst), gravity (0.05 floaty → 0.85 heavy), density, and glint size.
 */
export const SPARKLES_PRESETS: EffectPreset<"sparkles">[] = [
  {
    // Warm, dense, near-weightless. The ambient shimmer that hangs in the air.
    id: "sparkles-fairy-dust",
    name: "Fairy Dust",
    previewColor: "#fde047",
    patch: {
      rate: 0.42, size: 0.4, lifetime: 2.0,
      color: "#fde047", colorMode: "solid",
      spread: 8, gravity: 0.06, mode: "stream",
    },
  },
  {
    // Cool and heavy, spawned along the tip path so glints peel off the arc and
    // rain down. The only trail-mode preset.
    id: "sparkles-starfall",
    name: "Starfall",
    previewColor: "#dbeafe",
    patch: {
      rate: 0.6, size: 0.3, lifetime: 1.5,
      color: "#dbeafe", colorMode: "solid",
      spread: 5, gravity: 0.8, mode: "trail",
    },
  },
  {
    // Full-spectrum drift. Showcases the hue band — particles alive at the same
    // instant differ from each other rather than sharing one global hue.
    id: "sparkles-prism",
    name: "Prism",
    previewColor: "#a78bfa",
    patch: {
      rate: 0.5, size: 0.5, lifetime: 1.7,
      colorMode: "rainbow",
      spread: 9, gravity: 0.2, mode: "stream",
    },
  },
  {
    // Big, loud, heavy, and only on motion — pops when the prop moves and
    // settles when it doesn't.
    id: "sparkles-confetti",
    name: "Confetti",
    previewColor: "#ec4899",
    patch: {
      rate: 0.75, size: 0.72, lifetime: 2.2,
      colorMode: "palette",
      palette: ["#ec4899", "#22d3ee", "#fbbf24", "#4ade80", "#a855f7"],
      spread: 14, gravity: 0.85, mode: "burst",
    },
  },
  {
    // Sparse, large, slow, cold. The restrained one — a few big glints holding
    // in the air rather than a field of small ones.
    id: "sparkles-aurora",
    name: "Aurora",
    previewColor: "#67e8f9",
    patch: {
      rate: 0.24, size: 0.85, lifetime: 2.8,
      colorMode: "palette",
      palette: ["#67e8f9", "#5eead4", "#c4b5fd"],
      spread: 6, gravity: 0.05, mode: "stream",
    },
  },
];

export const SPARKLES_PRESET_GROUP: EffectPresetGroup = {
  effectType: "sparkles",
  presets: SPARKLES_PRESETS,
  getSummary: (state) => {
    const s = state.sparkles;
    return `${s.mode} · ${Math.round(s.rate * 100)}% · ${s.lifetime}s`;
  },
};
