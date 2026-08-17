/**
 * LED effect presets.
 *
 * Each preset is a complete prop: a device, the strip pattern it runs, how
 * fast that pattern loops, and the look. They are meant to read as six
 * different props rather than six tints of one.
 */

import type { EffectPreset, EffectPresetGroup } from "./types";
import {
  CAPSULE_LED_COUNT,
  DEFAULT_LED_LOOK,
  PATTERN_MATERIALIZE_BRIGHTNESS,
  PROP_BLUE,
  PROP_RED,
  hexToRgb255,
  type LedLook,
} from "$lib/shared/animation-engine/domain/types/led-types";
import type { PatternParams } from "$lib/shared/poi/domain/strip-pattern";

function look(overrides: Partial<LedLook> = {}): LedLook {
  return { ...DEFAULT_LED_LOOK, ...overrides };
}

function params(primary: string, secondary?: string): PatternParams {
  return {
    primaryColor: hexToRgb255(primary),
    secondaryColor: secondary ? hexToRgb255(secondary) : undefined,
    speed: 1,
    brightness: PATTERN_MATERIALIZE_BRIGHTNESS,
  };
}

const CAPSULE = { kind: "capsule", ledCount: CAPSULE_LED_COUNT } as const;
const STAFF_72 = { kind: "pixel-staff", ledCount: 72 } as const;
const STAFF_200 = { kind: "pixel-staff", ledCount: 200 } as const;

export const LED_PRESETS: EffectPreset<"led">[] = [
  {
    id: "led-capsule-classic",
    name: "Capsule Classic",
    previewColor: PROP_BLUE,
    previewColor2: PROP_RED,
    patch: {
      device: { ...CAPSULE },
      pattern: {
        source: "generator",
        generatorId: "prop-colors",
        params: params(PROP_BLUE, PROP_RED),
      },
      cycleDuration: 3,
      look: look({ trailFadeRate: 0.88, glowRadius: 1.0 }),
    },
  },
  {
    id: "led-capsule-pulse",
    name: "Capsule Pulse",
    previewColor: "#00ff88",
    patch: {
      device: { ...CAPSULE },
      pattern: {
        source: "generator",
        generatorId: "pulse",
        params: params("#00ff88"),
      },
      cycleDuration: 1.6,
      look: look({ glowRadius: 1.4, trailFadeRate: 0.9 }),
    },
  },
  {
    id: "led-rainbow-pov",
    name: "Rainbow POV",
    previewColor: "rainbow",
    patch: {
      device: { ...STAFF_200 },
      pattern: {
        source: "generator",
        generatorId: "rainbow-sweep",
        params: params("#ffffff"),
      },
      cycleDuration: 6,
      // The hero look: long persistence so the whole arc paints in the air.
      look: look({ trailFadeRate: 0.97, bloomIntensity: 0.07, brightness: 4 }),
    },
  },
  {
    id: "led-comet",
    name: "Comet",
    previewColor: "#3b82f6",
    patch: {
      device: { ...STAFF_72 },
      pattern: {
        source: "generator",
        generatorId: "comet",
        params: params("#3b82f6"),
      },
      cycleDuration: 1.2,
      look: look({ trailFadeRate: 0.94, glowRadius: 1.2 }),
    },
  },
  {
    id: "led-gradient-blade",
    name: "Gradient Blade",
    previewColor: "#00ff88",
    previewColor2: "#3b82f6",
    patch: {
      device: { ...STAFF_200 },
      pattern: {
        source: "generator",
        generatorId: "gradient",
        params: params("#00ff88", "#3b82f6"),
      },
      cycleDuration: 4,
      look: look({ trailFadeRate: 0.94 }),
    },
  },
  {
    id: "led-image-showcase",
    name: "Image Showcase",
    previewColor: "#ff6600",
    previewColor2: "#7c3aed",
    patch: {
      device: { ...STAFF_200 },
      // Phase 4: image source — swap this for the curated built-in pattern
      // image once it ships. A gradient stands in so the preset is honest
      // about being a wide two-color sweep rather than pretending to load.
      pattern: {
        source: "generator",
        generatorId: "gradient",
        params: params("#ff6600", "#7c3aed"),
      },
      cycleDuration: 5,
      look: look({ trailFadeRate: 0.96, bloomIntensity: 0.06 }),
    },
  },
];

const DEVICE_LABELS: Record<string, string> = {
  capsule: "Capsule",
  "pixel-staff": "Pixel staff",
};

export const LED_PRESET_GROUP: EffectPresetGroup = {
  effectType: "led",
  presets: LED_PRESETS,
  getSummary: (state): string => {
    const { device, pattern, cycleDuration } = state.led;
    const deviceLabel =
      device.kind === "capsule"
        ? DEVICE_LABELS.capsule
        : `${DEVICE_LABELS["pixel-staff"]} ${device.ledCount}`;
    const patternLabel =
      pattern.source === "generator"
        ? pattern.generatorId
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")
        : "Image";
    return `${deviceLabel} · ${patternLabel} · ${cycleDuration}s loop`;
  },
};
