import type { EffectsPreset } from "../effects-preset";
import type { FireColorCurve } from "$lib/shared/animation-engine/domain/types/fire-types";

const CLASSIC_CURVE: FireColorCurve = {
  coldColor: [0.2, 0.02, 0.0],
  midColor: [0.9, 0.15, 0.0],
  hotColor: [1.0, 0.55, 0.05],
  coreColor: [1.0, 0.9, 0.35],
};

const BLUE_CURVE: FireColorCurve = {
  coldColor: [0.0, 0.02, 0.2],
  midColor: [0.0, 0.15, 0.9],
  hotColor: [0.1, 0.5, 1.0],
  coreColor: [0.6, 0.85, 1.0],
};

const SPIRIT_CURVE: FireColorCurve = {
  coldColor: [0.15, 0.0, 0.2],
  midColor: [0.5, 0.0, 0.8],
  hotColor: [0.8, 0.2, 1.0],
  coreColor: [1.0, 0.7, 1.0],
};

export const BUILT_IN_FIRE_PRESETS: EffectsPreset[] = [
  {
    id: "fire-classic",
    name: "Classic",
    description: "Orange temperature gradient from cold ember to hot core.",
    effectType: "fire",
    builtIn: true,
    previewColors: ["#f97316", "#fbbf24"],
    patch: {
      fire: {
        colorCurve: CLASSIC_CURVE,
        propColors: null,
      },
    },
  },
  {
    id: "fire-blue-flame",
    name: "Blue Flame",
    description: "Cold-to-hot blue gradient, like a gas torch.",
    effectType: "fire",
    builtIn: true,
    previewColors: ["#60a5fa", "#bfdbfe"],
    patch: {
      fire: {
        colorCurve: BLUE_CURVE,
        propColors: null,
      },
    },
  },
  {
    id: "fire-spirit",
    name: "Spirit",
    description: "Violet and magenta ghost flame.",
    effectType: "fire",
    builtIn: true,
    previewColors: ["#a855f7", "#e9d5ff"],
    patch: {
      fire: {
        colorCurve: SPIRIT_CURVE,
        propColors: null,
      },
    },
  },
];
