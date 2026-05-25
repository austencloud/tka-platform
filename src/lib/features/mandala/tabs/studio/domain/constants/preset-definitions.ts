import type { MandalaPreset } from "../models/mandala-preset";

/**
 * Built-in mandala presets for quick creation.
 */
export const MANDALA_PRESETS: MandalaPreset[] = [
  {
    id: "simple-quad",
    name: "Simple Quad",
    description: "4-fold symmetry with vertical mirror",
    isBuiltIn: true,
    config: {
      foldCount: 4,
      enableMirror: true,
      mirrorAxis: "vertical",
    },
  },
  {
    id: "classic-hex",
    name: "Classic Hexagon",
    description: "6-fold symmetry for balanced mandalas",
    isBuiltIn: true,
    config: {
      foldCount: 6,
      enableMirror: true,
      mirrorAxis: "vertical",
    },
  },
  {
    id: "snowflake",
    name: "Snowflake",
    description: "6-fold rotational symmetry, no mirrors",
    isBuiltIn: true,
    config: {
      foldCount: 6,
      enableMirror: false,
      mirrorAxis: "none",
    },
  },
  {
    id: "star-8",
    name: "8-Point Star",
    description: "8-fold symmetry for star patterns",
    isBuiltIn: true,
    config: {
      foldCount: 8,
      enableMirror: true,
      mirrorAxis: "both",
    },
  },
  {
    id: "zodiac",
    name: "Zodiac",
    description: "12-fold symmetry like a clock face",
    isBuiltIn: true,
    config: {
      foldCount: 12,
      enableMirror: true,
      mirrorAxis: "vertical",
    },
  },
  {
    id: "yin-yang",
    name: "Yin-Yang",
    description: "2-fold rotational symmetry",
    isBuiltIn: true,
    config: {
      foldCount: 2,
      enableMirror: false,
      mirrorAxis: "none",
    },
  },
  {
    id: "trinity",
    name: "Trinity",
    description: "3-fold symmetry for triangular patterns",
    isBuiltIn: true,
    config: {
      foldCount: 3,
      enableMirror: true,
      mirrorAxis: "vertical",
    },
  },
  {
    id: "kaleidoscope",
    name: "Kaleidoscope",
    description: "8-fold with full mirror symmetry",
    isBuiltIn: true,
    config: {
      foldCount: 8,
      enableMirror: true,
      mirrorAxis: "both",
      showGridDots: false,
    },
  },
];

/**
 * Get a preset by ID.
 */
export function getPresetById(id: string): MandalaPreset | undefined {
  return MANDALA_PRESETS.find((p) => p.id === id);
}

/**
 * Get all built-in presets.
 */
export function getBuiltInPresets(): MandalaPreset[] {
  return MANDALA_PRESETS.filter((p) => p.isBuiltIn);
}
