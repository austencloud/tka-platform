import type { LedColor } from "../types/led-patterns";
import type { TipEvaluationContext } from "./context";

const TWO_PI = Math.PI * 2;

/**
 * Breathe pattern: smooth sinusoidal brightness oscillation.
 * All tips pulse together in a slow, lung-like rhythm.
 */
export function evaluateBreathe(ctx: TipEvaluationContext): LedColor {
  const t = ctx.time * ctx.speed;
  const brightness = 0.5 + 0.5 * Math.sin(t * TWO_PI);
  return {
    r: ctx.primaryColor.r * brightness,
    g: ctx.primaryColor.g * brightness,
    b: ctx.primaryColor.b * brightness,
  };
}

/**
 * Pulse pattern: sharp flash followed by exponential decay.
 * Like a strobe with a long tail - bright at the top of each cycle,
 * then fades quickly to black. More energetic than Breathe.
 */
export function evaluatePulse(ctx: TipEvaluationContext): LedColor {
  const t = ctx.time * ctx.speed;
  const frac = ((t % 1) + 1) % 1; // Normalized position within the current cycle [0, 1)
  const brightness = Math.pow(Math.max(0, 1 - frac * 3), 3);
  return {
    r: ctx.primaryColor.r * brightness,
    g: ctx.primaryColor.g * brightness,
    b: ctx.primaryColor.b * brightness,
  };
}

/**
 * Heartbeat pattern: two distinct peaks per cycle, mimicking a cardiac waveform.
 * First beat is slightly stronger (no offset), second beat follows ~0.2s later.
 * Both peaks are sharp Gaussian bumps so the double-beat reads clearly at distance.
 */
export function evaluateHeartbeat(ctx: TipEvaluationContext): LedColor {
  const t = ctx.time * ctx.speed;
  const frac = ((t % 1) + 1) % 1;

  const peak1 = Math.pow(Math.max(0, 1 - Math.abs(frac - 0.0) * 10), 2);
  const peak2 = Math.pow(Math.max(0, 1 - Math.abs(frac - 0.2) * 10), 2);
  const brightness = Math.min(1, peak1 + peak2);

  return {
    r: ctx.primaryColor.r * brightness,
    g: ctx.primaryColor.g * brightness,
    b: ctx.primaryColor.b * brightness,
  };
}

/**
 * Color Morph pattern: smooth oscillation between primary and secondary colors.
 * The tip color sweeps the full blend range once per cycle, so you see
 * both colors and the gradient between them.
 */
export function evaluateColorMorph(ctx: TipEvaluationContext): LedColor {
  const t = ctx.time * ctx.speed;
  const blend = 0.5 + 0.5 * Math.sin(t * TWO_PI);
  const inv = 1 - blend;
  return {
    r: ctx.primaryColor.r * inv + ctx.secondaryColor.r * blend,
    g: ctx.primaryColor.g * inv + ctx.secondaryColor.g * blend,
    b: ctx.primaryColor.b * inv + ctx.secondaryColor.b * blend,
  };
}
