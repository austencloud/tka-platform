/**
 * LED Pattern Engine
 *
 * Defines the six built-in LED color patterns and the pure `evaluatePattern()`
 * function that maps (time, LED index, config) → a normalized RGB color.
 *
 * All RGB values are in [0, 1]. Time is in seconds. The function is
 * intentionally free of side effects so it can be called from both the
 * main thread and (eventually) a WebWorker without serialization overhead.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Describes a built-in LED color pattern available to the overlay config.
 */
export interface LedPattern {
  /** Unique key used in LedOverlayConfig.patternId */
  id: string;
  /** Human-readable display name shown in the settings UI */
  name: string;
  /** Animation family this pattern belongs to */
  type: "solid" | "pulse" | "rainbow" | "chase" | "strobe" | "breathe";
}

/**
 * Normalized RGB output from the pattern engine.
 * All channels are in [0, 1]; values are clamped by the caller before
 * passing to the shader.
 */
export interface LedColor {
  r: number;
  g: number;
  b: number;
}

// ─── HSL Helper ───────────────────────────────────────────────────────────────

/**
 * Convert HSL to RGB. All parameters and return values are normalized to [0, 1].
 *
 * Implements the standard IEC 61966-2-1 sRGB piecewise formula so that hue
 * 0 = red, 1/3 = green, 2/3 = blue (wraps at 1).
 */
export function hslToRgb(h: number, s: number, l: number): LedColor {
  // Achromatic fast path
  if (s === 0) {
    return { r: l, g: l, b: l };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: hueToChannel(p, q, h + 1 / 3),
    g: hueToChannel(p, q, h),
    b: hueToChannel(p, q, h - 1 / 3),
  };
}

/** Internal helper: converts a hue sector to a single RGB channel value. */
function hueToChannel(p: number, q: number, t: number): number {
  // Normalize t into [0, 1]
  if (t < 0) t += 1;
  if (t > 1) t -= 1;

  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

// ─── Pattern Evaluator ────────────────────────────────────────────────────────

/**
 * Compute the LED color for a single point at a given moment in time.
 *
 * @param pattern      - The pattern descriptor (only `type` is consumed here).
 * @param time         - Elapsed time in seconds (monotonically increasing).
 * @param ledIndex     - Zero-based index of this LED within the prop's LED array.
 * @param totalLeds    - Total number of LEDs on this prop (used for relative offset).
 * @param speed        - Animation speed multiplier from LedOverlayConfig.patternSpeed.
 * @param primaryColor - Base color from LedOverlayConfig (already parsed to [0,1] RGB).
 * @returns            - Normalized RGB in [0, 1]. Caller clamps before shader upload.
 */
export function evaluatePattern(
  pattern: LedPattern,
  time: number,
  ledIndex: number,
  totalLeds: number,
  speed: number,
  primaryColor: LedColor
): LedColor {
  // Scaled time drives all temporal oscillations.
  const t = time * speed;

  switch (pattern.type) {
    case "solid": {
      // All LEDs emit the primary color at full intensity.
      return { r: primaryColor.r, g: primaryColor.g, b: primaryColor.b };
    }

    case "pulse": {
      // Uniform brightness oscillation at ~2 Hz (at speed 1).
      // sin maps [-1,1] → intensity maps [0,1].
      const intensity = 0.5 + 0.5 * Math.sin(t * 2.0);
      return {
        r: primaryColor.r * intensity,
        g: primaryColor.g * intensity,
        b: primaryColor.b * intensity,
      };
    }

    case "rainbow": {
      // Each LED is offset around the hue wheel proportionally to its
      // position in the array, and the whole spectrum rotates over time.
      const hue = (t * 0.15 + ledIndex / Math.max(totalLeds, 1)) % 1.0;
      return hslToRgb(hue, 1.0, 0.5);
    }

    case "chase": {
      // A bright "comet" travels along the prop; LEDs behind the head fade
      // in a tail whose length is 30% of the total LED count (minimum 1).
      const tailLength = Math.max(totalLeds * 0.3, 1);
      // Head position cycles through the full LED range at ~2 LEDs/second.
      const headPos = (t * 2.0) % Math.max(totalLeds, 1);
      // Angular distance in LED-space, wrapped to [0, totalLeds).
      const raw = ledIndex - headPos;
      const dist = ((raw % totalLeds) + totalLeds) % totalLeds;
      // Exponential falloff behind the head; LEDs ahead of the head are dark.
      const intensity = dist < tailLength ? Math.exp(-dist / (tailLength * 0.4)) : 0.0;
      return {
        r: primaryColor.r * intensity,
        g: primaryColor.g * intensity,
        b: primaryColor.b * intensity,
      };
    }

    case "strobe": {
      // Hard on/off flash at ~8 Hz (at speed 1). All LEDs flash together.
      const intensity = Math.sin(t * 8.0) > 0 ? 1.0 : 0.0;
      return {
        r: primaryColor.r * intensity,
        g: primaryColor.g * intensity,
        b: primaryColor.b * intensity,
      };
    }

    case "breathe": {
      // Slower, smoother sine breath at ~1.2 Hz (at speed 1).
      // Minimum brightness is 0.3 so LEDs are always faintly visible.
      const intensity = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 1.2));
      return {
        r: primaryColor.r * intensity,
        g: primaryColor.g * intensity,
        b: primaryColor.b * intensity,
      };
    }

    default: {
      // Defensive fallback — return primary color unchanged.
      return { r: primaryColor.r, g: primaryColor.g, b: primaryColor.b };
    }
  }
}

// ─── Built-in Pattern Registry ────────────────────────────────────────────────

/**
 * The six built-in LED patterns shipped with the overlay.
 * Order here matches the display order in the settings UI.
 */
export const LED_PATTERNS: LedPattern[] = [
  {
    id: "solid",
    name: "Solid",
    type: "solid",
  },
  {
    id: "pulse",
    name: "Pulse",
    type: "pulse",
  },
  {
    id: "rainbow",
    name: "Rainbow",
    type: "rainbow",
  },
  {
    id: "chase",
    name: "Chase",
    type: "chase",
  },
  {
    id: "strobe",
    name: "Strobe",
    type: "strobe",
  },
  {
    id: "breathe",
    name: "Breathe",
    type: "breathe",
  },
];

/** Fallback used when an unknown patternId is requested. */
const SOLID_PATTERN: LedPattern = { id: "solid", name: "Solid", type: "solid" };

/**
 * Look up a built-in pattern by its ID string.
 * Returns the solid pattern if the ID is not recognized.
 */
export function getLedPattern(patternId: string): LedPattern {
  return LED_PATTERNS.find((p) => p.id === patternId) ?? SOLID_PATTERN;
}
