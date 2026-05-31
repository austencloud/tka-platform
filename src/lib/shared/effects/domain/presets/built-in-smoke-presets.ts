import type { EffectsPreset } from "../effects-preset";

/**
 * Built-in smoke presets.
 *
 * Six identities, each anchored by a personality-laden palette. Palette
 * choice also sets lifetime / curl bias / rise bias - user-facing sliders
 * are multipliers on top. See SmokePalettes for the palette registry.
 *
 * Spec: docs/superpowers/specs/2026-04-15-effects-phase-1i-smoke-design.md
 */
export const BUILT_IN_SMOKE_PRESETS: EffectsPreset[] = [
  {
    id: "smoke-classic",
    name: "Classic",
    description: "Thin incense thread - gentle rise, soft curls.",
    effectType: "smoke",
    builtIn: true,
    previewColors: ["#d8d8d8", "#f0f0f0"],
    patch: {
      smoke: {
        palette: "incense",
        ambientEmission: 0.35,
        motionEmission: 0.5,
        intensity: 0.45,
        curlStrength: 0.5,
        riseSpeed: 0.6,
        trackingMode: "both_ends",
      },
    },
  },
  {
    id: "smoke-fog-wall",
    name: "Fog Wall",
    description: "Dense constant haze - slow lingering medium.",
    effectType: "smoke",
    builtIn: true,
    previewColors: ["#c0c0c8", "#e0e0e8"],
    patch: {
      smoke: {
        palette: "fog",
        ambientEmission: 0.7,
        motionEmission: 0.2,
        intensity: 0.55,
        curlStrength: 0.3,
        riseSpeed: 0.4,
        trackingMode: "both_ends",
      },
    },
  },
  {
    id: "smoke-genie-burst",
    name: "Genie Burst",
    description: "Motion-only magical swirl - fast colored puffs.",
    effectType: "smoke",
    builtIn: true,
    previewColors: ["#a060ff", "#ffe0ff"],
    patch: {
      smoke: {
        palette: "genie",
        ambientEmission: 0.1,
        motionEmission: 1.0,
        intensity: 0.6,
        curlStrength: 0.9,
        riseSpeed: 0.9,
        trackingMode: "both_ends",
      },
    },
  },
  {
    id: "smoke-cursed",
    name: "Cursed",
    description: "Heavy chaotic black - sinister curls.",
    effectType: "smoke",
    builtIn: true,
    previewColors: ["#202020", "#606060"],
    patch: {
      smoke: {
        palette: "cursed",
        ambientEmission: 0.25,
        motionEmission: 0.6,
        intensity: 0.5,
        curlStrength: 0.8,
        riseSpeed: 0.5,
        trackingMode: "both_ends",
      },
    },
  },
  {
    id: "smoke-spirit-veil",
    name: "Spirit Veil",
    description: "Ethereal translucent blue - ghostly drift.",
    effectType: "smoke",
    builtIn: true,
    previewColors: ["#80c8ff", "#ffffff"],
    patch: {
      smoke: {
        palette: "spirit",
        ambientEmission: 0.45,
        motionEmission: 0.3,
        intensity: 0.3,
        curlStrength: 0.5,
        riseSpeed: 0.6,
        trackingMode: "both_ends",
      },
    },
  },
  {
    id: "smoke-campfire",
    name: "Campfire",
    description: "Warm ash plume - pairs with fire.",
    effectType: "smoke",
    builtIn: true,
    previewColors: ["#706560", "#a09590"],
    patch: {
      smoke: {
        palette: "campfire",
        ambientEmission: 0.4,
        motionEmission: 0.55,
        intensity: 0.4,
        curlStrength: 0.6,
        riseSpeed: 0.7,
        trackingMode: "both_ends",
      },
    },
  },
];
