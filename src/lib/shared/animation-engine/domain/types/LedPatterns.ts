/**
 * LED Pattern Engine
 *
 * Defines the built-in LED color patterns and the backward-compatible
 * `evaluatePattern()` wrapper that delegates to the new registry-based
 * evaluator introduced in the pattern expansion.
 *
 * All RGB values are in [0, 1]. Time is in seconds. The function is
 * intentionally free of side effects so it can be called from both the
 * main thread and (eventually) a WebWorker without serialization overhead.
 */

import { evaluatePattern as newEvaluatePattern } from "../patterns/evaluator";
import { createReusableContext } from "../patterns/context";

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
  type: "solid" | "rainbow";
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

// ─── Pattern Evaluator (Backward-Compat Wrapper) ─────────────────────────────

/** Reusable context for the backward-compatible evaluatePattern() wrapper */
const _compatCtx = createReusableContext();

/**
 * Compute the LED color for a single point at a given moment in time.
 *
 * This is a backward-compatible wrapper that delegates to the new
 * registry-based evaluator. New code should use the evaluator directly
 * via `evaluatePattern` from `../patterns/evaluator` with a full
 * TipEvaluationContext for access to velocity, position, and TKA-aware data.
 *
 * @param pattern      - The pattern descriptor (uses `id` to look up the evaluator).
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
  _compatCtx.time = time;
  _compatCtx.ledIndex = ledIndex;
  _compatCtx.totalLeds = totalLeds;
  _compatCtx.speed = speed;
  _compatCtx.primaryColor = primaryColor;
  return newEvaluatePattern(pattern.id, _compatCtx);
}

// ─── Built-in Pattern Registry ────────────────────────────────────────────────

/**
 * The built-in LED patterns shipped with the overlay.
 * Order here matches the display order in the settings UI.
 */
export const LED_PATTERNS: LedPattern[] = [
  {
    id: "solid",
    name: "Solid",
    type: "solid",
  },
  {
    id: "rainbow",
    name: "Rainbow",
    type: "rainbow",
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
