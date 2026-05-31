import type { StripPattern, PatternParams, RGBColor } from "$lib/shared/poi/domain/strip-pattern";
import { setPixel } from "$lib/shared/poi/domain/strip-pattern";
import { createEmptyPattern } from "$lib/shared/poi/domain/strip-pattern";

export type PresetCategory = "basic" | "motion-driven";

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

export const BUILT_IN_PRESETS: IPatternPreset[] = [
  solidPreset,
  gradientPreset,
  rainbowSweepPreset,
  pulsePreset,
  propColorsPreset,
];
