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
      // Short persistence and a tight beam: two clean endpoint dots, the way
      // a capsule actually reads.
      look: look({ shutter: { mode: "eye", timeConstantSeconds: 0.08 }, glare: 0.55 }),
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
      // Shortest persistence of the six: each pulse reads as a distinct beat
      // rather than smearing into the next.
      look: look({ shutter: { mode: "eye", timeConstantSeconds: 0.05 }, glare: 0.52 }),
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
      // The hero look: a camera shutter held open so the whole arc paints in
      // the air, plus the broadest glare veil of the six.
      look: look({
        shutter: { mode: "camera", exposureSeconds: 2.5 },
        glare: 0.9,
        brightness: 4,
      }),
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
      // Short-to-medium persistence: enough to lengthen the comet's own tail
      // without smearing it into a full loop.
      look: look({ shutter: { mode: "eye", timeConstantSeconds: 0.18 }, glare: 0.65 }),
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
      look: look({ shutter: { mode: "eye", timeConstantSeconds: 0.25 }, glare: 0.75 }),
    },
  },
  {
    id: "led-sunset-sweep",
    name: "Sunset Sweep",
    previewColor: "#ff6600",
    previewColor2: "#7c3aed",
    patch: {
      device: { ...STAFF_200 },
      // Image-source presets wait on a bundled-pattern seam (the materializer
      // resolves image sources from the user's library only), so the sixth
      // prop is an honest warm-to-violet gradient wash rather than a preset
      // named for a pipeline that doesn't exist yet.
      pattern: {
        source: "generator",
        generatorId: "gradient",
        params: params("#ff6600", "#7c3aed"),
      },
      cycleDuration: 5,
      look: look({ shutter: { mode: "eye", timeConstantSeconds: 0.3 }, glare: 0.8 }),
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
