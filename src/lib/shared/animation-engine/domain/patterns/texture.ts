import { hslToRgb } from "../types/led-patterns";
import type { LedColor } from "../types/led-patterns";
import type { TipEvaluationContext } from "./context";
import { simplex2d } from "./noise";

/**
 * Sparkle pattern: random-looking spiky flashes of light using noise.
 * Most of the time a tip is dark or near-black; occasionally it fires
 * a sharp burst. The effect reads like glitter or starfield.
 *
 * The threshold cuts out most of the noise range so only the top ~20%
 * of values become visible, producing the spiky isolated-flash character.
 */
export function evaluateSparkle(ctx: TipEvaluationContext): LedColor {
  const { time, speed, ledIndex, primaryColor } = ctx;
  const raw = simplex2d(ledIndex * 10, time * speed * 5);
  const brightness = Math.max(0, raw - 0.6) * 2.5;
  return {
    r: primaryColor.r * brightness,
    g: primaryColor.g * brightness,
    b: primaryColor.b * brightness,
  };
}

/**
 * Flicker pattern: gentle organic variation in brightness - like a candle.
 * The tip is always partially lit (brightness ≥ 0.2), so it never goes dark.
 * The noise input is sampled slowly to keep the wavering slow and organic.
 */
export function evaluateFlicker(ctx: TipEvaluationContext): LedColor {
  const { time, speed, ledIndex, primaryColor } = ctx;
  const brightness = 0.6 + 0.4 * simplex2d(ledIndex * 3, time * speed);
  return {
    r: primaryColor.r * brightness,
    g: primaryColor.g * brightness,
    b: primaryColor.b * brightness,
  };
}

/**
 * Aurora pattern: multi-octave noise drives both hue and brightness,
 * producing shifting curtains of color that move slowly and unpredictably.
 * Uses independent noise coordinates for hue and brightness so they
 * vary semi-independently, creating the characteristic aurora shimmer.
 */
export function evaluateAurora(ctx: TipEvaluationContext): LedColor {
  const { time, ledIndex } = ctx;
  const hue = 0.45 + 0.15 * simplex2d(time * 0.1, ledIndex);
  const brightnessRaw = 0.5 + 0.5 * simplex2d(time * 0.15 + 100, ledIndex * 2);
  return hslToRgb(hue % 1.0, 0.9, brightnessRaw * 0.5);
}
