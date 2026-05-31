import type { EffectsPreset } from "../effects-preset";

/**
 * Built-in ink presets.
 *
 * Six identities anchored by their palette. Unlike smoke, behavioral
 * differences live in palette flags (watercolor, emissive) rather than
 * palette-baked multipliers - the user-facing sliders (ambient, motion,
 * intensity, viscosity, splatter) stay unchanged across palettes.
 *
 * Sprint 1 (1j.i) consumes: palette, ambientEmission, motionEmission,
 * intensity. viscosity + splatterIntensity are shipped on presets now
 * but don't affect the renderer until sprint 2 (1j.ii + 1j.iii).
 *
 * Spec: docs/superpowers/specs/2026-04-15-effects-phase-1j-ink-design.md
 */
export const BUILT_IN_INK_PRESETS: EffectsPreset[] = [
  {
    id: "ink-classic",
    name: "Classic",
    description: "Clean calligraphy - opaque india ink, firm line quality.",
    effectType: "ink",
    builtIn: true,
    previewColors: ["#0a0a0a", "#1a1a1a"],
    patch: {
      ink: {
        palette: "india",
        ambientEmission: 0.2,
        motionEmission: 0.8,
        intensity: 0.6,
        viscosity: 0.3,
        splatterIntensity: 0.3,
        trackingMode: "both_ends",
      },
    },
  },
  {
    id: "ink-drip",
    name: "Drip",
    description: "Loaded brush - sags + drips (sprint 2 feature).",
    effectType: "ink",
    builtIn: true,
    previewColors: ["#0a0a0a", "#1a1a1a"],
    patch: {
      ink: {
        palette: "india",
        ambientEmission: 0.3,
        motionEmission: 0.5,
        intensity: 0.8,
        viscosity: 0.7,
        splatterIntensity: 0.5,
        trackingMode: "both_ends",
      },
    },
  },
  {
    id: "ink-watercolor-wash",
    name: "Watercolor Wash",
    description: "Translucent blue wash - wide bleed, low opacity.",
    effectType: "ink",
    builtIn: true,
    previewColors: ["#4080c0", "#80b0e0"],
    patch: {
      ink: {
        palette: "watercolor",
        ambientEmission: 0.1,
        motionEmission: 0.7,
        intensity: 0.5,
        viscosity: 0.1,
        splatterIntensity: 0.1,
        trackingMode: "both_ends",
      },
    },
  },
  {
    id: "ink-neon-tag",
    name: "Neon Tag",
    description: "Graffiti - fast saturated glow, only emissive ink palette.",
    effectType: "ink",
    builtIn: true,
    previewColors: ["#ff2080", "#ff60a0"],
    patch: {
      ink: {
        palette: "neon",
        ambientEmission: 0.1,
        motionEmission: 1.0,
        intensity: 0.9,
        viscosity: 0.2,
        splatterIntensity: 0.4,
        trackingMode: "both_ends",
      },
    },
  },
  {
    id: "ink-splatter",
    name: "Splatter",
    description: "Jackson Pollock mode - blood palette, high splatter.",
    effectType: "ink",
    builtIn: true,
    previewColors: ["#8a1818", "#d93838"],
    patch: {
      ink: {
        palette: "blood",
        ambientEmission: 0.1,
        motionEmission: 0.6,
        intensity: 0.7,
        viscosity: 0.8,
        splatterIntensity: 1.0,
        trackingMode: "both_ends",
      },
    },
  },
  {
    id: "ink-toxic",
    name: "Toxic",
    description: "Acid green - pairs with acid water/bubbles.",
    effectType: "ink",
    builtIn: true,
    previewColors: ["#7fd94a", "#b8ff6f"],
    patch: {
      ink: {
        palette: "acid",
        ambientEmission: 0.2,
        motionEmission: 0.7,
        intensity: 0.6,
        viscosity: 0.5,
        splatterIntensity: 0.6,
        trackingMode: "both_ends",
      },
    },
  },
];
