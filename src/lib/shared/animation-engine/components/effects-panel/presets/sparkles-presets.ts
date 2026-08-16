import type { EffectPreset, EffectPresetGroup } from "./types";

/**
 * Six looks, each occupying a distinct corner of the parameter space so no two
 * read as the same preset with a different hex code. The axes they spread
 * across: colorMode (solid / rainbow / palette), spawn mode (stream / trail /
 * burst), gravity (0.02 clinging → 0.9 falling), density, and glint size.
 *
 * On size: the dial maps 0→1 onto a 0.25–0.65 base scale, and the renderer
 * draws a star roughly 5x that in reference px. Anything past ~0.25 reads as
 * chunky diamonds rather than sparkle at the sizes these actually run at, so
 * five of the six sit at 0.07–0.20 and lean on RATE for presence instead.
 * Aurora is the deliberate exception - it exists to hold down the sparse-and-
 * large corner, and it buys that size by dropping rate to 0.16.
 *
 * Six rather than five so the two-up picker grid fills three even rows with no
 * orphan (see EffectPresetsSection).
 */
export const SPARKLES_PRESETS: EffectPreset<"sparkles">[] = [
  {
    // Warm, fine, near-weightless. The ambient shimmer that hangs in the air.
    id: "sparkles-fairy-dust",
    name: "Fairy Dust",
    previewColor: "#fde047",
    patch: {
      rate: 0.55, size: 0.16, lifetime: 1.8,
      color: "#fde047", colorMode: "solid",
      spread: 5, gravity: 0.05, mode: "stream",
    },
  },
  {
    // A dense multicolour stream off the tip that falls as it goes. Burst mode
    // was tried here first and reverted - it throws detached clumps that drift
    // off on their own, which reads as scattered debris rather than a ribbon of
    // confetti pouring off the prop.
    id: "sparkles-confetti",
    name: "Confetti",
    previewColor: "#ec4899",
    patch: {
      rate: 0.92, size: 0.12, lifetime: 1.5,
      colorMode: "palette",
      palette: ["#ec4899", "#22d3ee", "#fbbf24", "#4ade80", "#a855f7"],
      spread: 5, gravity: 0.5, mode: "stream",
    },
  },
  {
    // Full-spectrum drift. Showcases the hue band - particles alive at the same
    // instant differ from each other rather than sharing one global hue.
    id: "sparkles-prism",
    name: "Prism",
    previewColor: "rainbow",
    patch: {
      rate: 0.65, size: 0.15, lifetime: 1.5,
      colorMode: "rainbow",
      spread: 6, gravity: 0.18, mode: "stream",
    },
  },
  {
    // Cold and heavy, spawned along the tip path so glints peel off the arc and
    // rain down. The only trail-mode preset.
    id: "sparkles-starfall",
    name: "Starfall",
    previewColor: "#bfdbfe",
    patch: {
      rate: 0.6, size: 0.2, lifetime: 1.3,
      color: "#bfdbfe", colorMode: "solid",
      spread: 4, gravity: 0.9, mode: "trail",
    },
  },
  {
    // Micro-dust at maximum density and minimum hang, so it clings to the prop
    // as a moving sheath instead of drifting off as a field.
    id: "sparkles-glitter",
    name: "Glitter",
    previewColor: "#f1f5f9",
    patch: {
      rate: 1.0, size: 0.07, lifetime: 0.9,
      color: "#f1f5f9", colorMode: "solid",
      spread: 3, gravity: 0.02, mode: "stream",
    },
  },
  {
    // Large, slow, cold. The restrained one - big glints holding in the air
    // rather than a field of small ones. Rate was 0.16 first and the canvas
    // read as empty, which looks like a broken effect rather than a quiet one;
    // 0.42 is the floor where "sparse" still reads as deliberate.
    id: "sparkles-aurora",
    name: "Aurora",
    previewColor: "#67e8f9",
    patch: {
      rate: 0.42, size: 0.42, lifetime: 2.6,
      colorMode: "palette",
      palette: ["#67e8f9", "#5eead4", "#c4b5fd"],
      spread: 5, gravity: 0.04, mode: "stream",
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
