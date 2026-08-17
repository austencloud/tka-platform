import type { StripPattern, PatternParams, RGBColor } from "./strip-pattern";
import { setPixel } from "./strip-pattern";
import { createEmptyPattern } from "./strip-pattern";

export type PresetCategory = "basic";

export interface IPatternPreset {
  id: string;
  name: string;
  category: PresetCategory;
  /** CSS color string for UI thumbnails */
  previewColor: string;
  generate(
    ledCount: number,
    frameCount: number,
    params: PatternParams
  ): StripPattern;
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/** HSL → RGB (h: 0–360, s: 0–1, l: 0–1) → 0–255 */
function hslToRgb(h: number, s: number, l: number): RGBColor {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: clamp255((r + m) * 255),
    g: clamp255((g + m) * 255),
    b: clamp255((b + m) * 255),
  };
}

function lerpColor(a: RGBColor, b: RGBColor, t: number): RGBColor {
  return {
    r: clamp255(a.r + (b.r - a.r) * t),
    g: clamp255(a.g + (b.g - a.g) * t),
    b: clamp255(a.b + (b.b - a.b) * t),
  };
}

const solidPreset: IPatternPreset = {
  id: "solid",
  name: "Solid",
  category: "basic",
  previewColor: "#ffffff",
  generate(ledCount, frameCount, params) {
    const pattern = createEmptyPattern(ledCount, frameCount, "Solid");
    pattern.metadata.presetId = "solid";
    const c: RGBColor = {
      r: clamp255(params.primaryColor.r * params.brightness),
      g: clamp255(params.primaryColor.g * params.brightness),
      b: clamp255(params.primaryColor.b * params.brightness),
    };
    for (let f = 0; f < frameCount; f++) {
      for (let led = 0; led < ledCount; led++) {
        setPixel(pattern, f, led, c);
      }
    }
    return pattern;
  },
};

const gradientPreset: IPatternPreset = {
  id: "gradient",
  name: "Gradient",
  category: "basic",
  previewColor: "linear-gradient(#00ff88, #3b82f6)",
  generate(ledCount, frameCount, params) {
    const pattern = createEmptyPattern(ledCount, frameCount, "Gradient");
    pattern.metadata.presetId = "gradient";
    const secondary = params.secondaryColor ?? { r: 0, g: 0, b: 0 };
    for (let f = 0; f < frameCount; f++) {
      for (let led = 0; led < ledCount; led++) {
        const t = ledCount > 1 ? led / (ledCount - 1) : 0;
        const c = lerpColor(params.primaryColor, secondary, t);
        setPixel(pattern, f, led, {
          r: clamp255(c.r * params.brightness),
          g: clamp255(c.g * params.brightness),
          b: clamp255(c.b * params.brightness),
        });
      }
    }
    return pattern;
  },
};

const rainbowSweepPreset: IPatternPreset = {
  id: "rainbow-sweep",
  name: "Rainbow Sweep",
  category: "basic",
  previewColor: "rainbow",
  generate(ledCount, frameCount, params) {
    const pattern = createEmptyPattern(ledCount, frameCount, "Rainbow Sweep");
    pattern.metadata.presetId = "rainbow-sweep";
    for (let f = 0; f < frameCount; f++) {
      for (let led = 0; led < ledCount; led++) {
        // Hue: spatial along strip + temporal advance per frame
        const spatialHue = (led / ledCount) * 360;
        const temporalOffset = (f / frameCount) * 360 * params.speed;
        const hue = (spatialHue + temporalOffset) % 360;
        const c = hslToRgb(hue, 1.0, 0.5);
        setPixel(pattern, f, led, {
          r: clamp255(c.r * params.brightness),
          g: clamp255(c.g * params.brightness),
          b: clamp255(c.b * params.brightness),
        });
      }
    }
    return pattern;
  },
};

const pulsePreset: IPatternPreset = {
  id: "pulse",
  name: "Pulse",
  category: "basic",
  previewColor: "#ff6600",
  generate(ledCount, frameCount, params) {
    const pattern = createEmptyPattern(ledCount, frameCount, "Pulse");
    pattern.metadata.presetId = "pulse";
    for (let f = 0; f < frameCount; f++) {
      for (let led = 0; led < ledCount; led++) {
        // Sine wave pulse traveling along strip
        const phase =
          (led / ledCount + (f / frameCount) * params.speed) * Math.PI * 2;
        const intensity = (Math.sin(phase) + 1) / 2; // 0–1
        setPixel(pattern, f, led, {
          r: clamp255(params.primaryColor.r * intensity * params.brightness),
          g: clamp255(params.primaryColor.g * intensity * params.brightness),
          b: clamp255(params.primaryColor.b * intensity * params.brightness),
        });
      }
    }
    return pattern;
  },
};

const propColorsPreset: IPatternPreset = {
  id: "prop-colors",
  name: "Prop Colors",
  category: "basic",
  previewColor: "#3b82f6",
  generate(ledCount, frameCount, params) {
    const pattern = createEmptyPattern(ledCount, frameCount, "Prop Colors");
    pattern.metadata.presetId = "prop-colors";
    // Half the strip in primary color, half in secondary (or red if no secondary)
    const secondary = params.secondaryColor ?? { r: 239, g: 68, b: 68 };
    const midpoint = Math.floor(ledCount / 2);
    for (let f = 0; f < frameCount; f++) {
      for (let led = 0; led < ledCount; led++) {
        const c = led < midpoint ? params.primaryColor : secondary;
        setPixel(pattern, f, led, {
          r: clamp255(c.r * params.brightness),
          g: clamp255(c.g * params.brightness),
          b: clamp255(c.b * params.brightness),
        });
      }
    }
    return pattern;
  },
};

/**
 * Number of full sweeps the LED-position generators (chase, comet) make
 * across the strip over one pattern loop. Rounding `params.speed` to the
 * nearest integer keeps the sweep phase-continuous: at frame `frameCount`
 * the head position formula lands on exactly the same LED as frame 0, so
 * the loop has no visible seam.
 */
function sweepCycles(speed: number): number {
  return Math.max(1, Math.round(speed));
}

/**
 * Integer head-position index for a sweeping pattern at frame `f` of
 * `frameCount`, moving `cycles` full laps around the strip. Exactly
 * periodic in `frameCount` by construction: headIndex(frameCount) always
 * reduces to headIndex(0).
 */
function sweepHeadIndex(
  f: number,
  frameCount: number,
  cycles: number,
  ledCount: number
): number {
  return Math.floor((f * cycles * ledCount) / frameCount) % ledCount;
}

const chasePreset: IPatternPreset = {
  id: "chase",
  name: "Chase",
  category: "basic",
  previewColor: "#00ff88",
  generate(ledCount, frameCount, params) {
    const pattern = createEmptyPattern(ledCount, frameCount, "Chase");
    pattern.metadata.presetId = "chase";
    const blockWidth = Math.max(1, Math.round(ledCount * 0.15));
    const cycles = sweepCycles(params.speed);
    const c: RGBColor = {
      r: clamp255(params.primaryColor.r * params.brightness),
      g: clamp255(params.primaryColor.g * params.brightness),
      b: clamp255(params.primaryColor.b * params.brightness),
    };
    for (let f = 0; f < frameCount; f++) {
      const headIndex = sweepHeadIndex(f, frameCount, cycles, ledCount);
      for (let led = 0; led < ledCount; led++) {
        const dist = ((led - headIndex) % ledCount + ledCount) % ledCount;
        setPixel(pattern, f, led, dist < blockWidth ? c : { r: 0, g: 0, b: 0 });
      }
    }
    return pattern;
  },
};

/**
 * Comet geometry, as fractions of the strip.
 *
 * A comet is a bright head with a tail streaming out BEHIND it, along the
 * direction it travels. On a prop that tail is not the strip's job. The strip
 * runs down the shaft, and the shaft is spinning, so anything the strip fades
 * out trails sideways across the path rather than along it — a long strip tail
 * spun up is a soft glowing disc with a ring in it, which is what the first two
 * versions of this preset produced and why neither read as a comet. The tail
 * that reads is the one visual persistence draws, behind the head, down the
 * path it actually took.
 *
 * So the strip's job is only to make a compact, unmistakable head: a plateau
 * wide enough to survive downscaling, and just enough falloff behind it to keep
 * the head from looking stamped on. The look's persistence supplies the streak.
 */
const COMET_HEAD_FRACTION = 0.03;
const COMET_TAIL_FRACTION = 0.14;
/** e-foldings across the tail. exp(-4) leaves under 2% at the tail's end. */
const COMET_TAIL_DECAY = 4;

const cometPreset: IPatternPreset = {
  id: "comet",
  name: "Comet",
  category: "basic",
  previewColor: "#3b82f6",
  generate(ledCount, frameCount, params) {
    const pattern = createEmptyPattern(ledCount, frameCount, "Comet");
    pattern.metadata.presetId = "comet";
    const headWidth = Math.max(1, Math.round(ledCount * COMET_HEAD_FRACTION));
    const tailLength = Math.max(
      headWidth + 1,
      Math.round(ledCount * COMET_TAIL_FRACTION)
    );
    // Counted from the first LED past the head, so the tail starts already
    // attenuated instead of repeating the head's own value.
    const tailSpan = tailLength - headWidth + 1;
    const cycles = sweepCycles(params.speed);
    for (let f = 0; f < frameCount; f++) {
      const headIndex = sweepHeadIndex(f, frameCount, cycles, ledCount);
      for (let led = 0; led < ledCount; led++) {
        const dist = ((headIndex - led) % ledCount + ledCount) % ledCount;
        let intensity = 0;
        if (dist < headWidth) {
          intensity = 1;
        } else if (dist <= tailLength) {
          intensity = Math.exp(
            (-COMET_TAIL_DECAY * (dist - headWidth + 1)) / tailSpan
          );
        }
        setPixel(pattern, f, led, {
          r: clamp255(params.primaryColor.r * intensity * params.brightness),
          g: clamp255(params.primaryColor.g * intensity * params.brightness),
          b: clamp255(params.primaryColor.b * intensity * params.brightness),
        });
      }
    }
    return pattern;
  },
};

export const BUILT_IN_PRESETS: IPatternPreset[] = [
  solidPreset,
  gradientPreset,
  rainbowSweepPreset,
  pulsePreset,
  propColorsPreset,
  chasePreset,
  cometPreset,
];
