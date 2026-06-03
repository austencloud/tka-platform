import type { LedColor } from "../types/led-patterns";
import type { TipEvaluationContext } from "./context";

const TWO_PI = Math.PI * 2;

/**
 * Circular distance between two tip positions in the [0, totalLeds) ring.
 * Returns a value in [0, totalLeds / 2].
 */
function circularDist(a: number, b: number, total: number): number {
  const raw = Math.abs(a - b) % total;
  return raw > total / 2 ? total - raw : raw;
}

/**
 * Chase pattern: a single bright "head" sweeps around all tips continuously.
 * Each tip's brightness falls off as a Gaussian from the head position,
 * producing a smooth spotlight effect regardless of how many tips are lit.
 */
export function evaluateChase(ctx: TipEvaluationContext): LedColor {
  const { time, speed, ledIndex, totalLeds, primaryColor } = ctx;
  const t = time * speed;
  const total = Math.max(totalLeds, 1);
  const head = ((t * total) % total + total) % total;
  const dist = circularDist(ledIndex, head, total);
  const brightness = Math.exp(-dist * dist * 4);
  return {
    r: primaryColor.r * brightness,
    g: primaryColor.g * brightness,
    b: primaryColor.b * brightness,
  };
}

/**
 * Comet pattern: like Chase, but asymmetric - tips behind the head trail
 * brightly while tips ahead of it are cut off sharply.
 * Gives the impression of motion direction, like a comet with a trailing tail.
 */
export function evaluateComet(ctx: TipEvaluationContext): LedColor {
  const { time, speed, ledIndex, totalLeds, primaryColor } = ctx;
  const t = time * speed;
  const total = Math.max(totalLeds, 1);
  const head = ((t * total) % total + total) % total;

  // Forward distance: how far ahead of the head this tip is (wrapping).
  // A tip "behind" the head has positive forward distance when computed this way.
  let forwardDist = ((head - ledIndex) % total + total) % total;
  if (forwardDist > total / 2) forwardDist = total - forwardDist;

  // Bright in the "tail" (behind head), cuts off in front.
  const brightness = Math.max(0, 1 - forwardDist * 2) * Math.exp(-forwardDist * 0.5);
  return {
    r: primaryColor.r * brightness,
    g: primaryColor.g * brightness,
    b: primaryColor.b * brightness,
  };
}

/**
 * Wave pattern: sinusoidal brightness ripple that travels across all tips.
 * Each tip has a fixed phase offset proportional to its position, so at any
 * moment you see a smooth wave spanning the tip array.
 */
export function evaluateWave(ctx: TipEvaluationContext): LedColor {
  const { time, speed, ledIndex, totalLeds, primaryColor } = ctx;
  const t = time * speed;
  const total = Math.max(totalLeds, 1);
  const brightness = 0.5 + 0.5 * Math.sin(t * TWO_PI - (ledIndex / total) * TWO_PI);
  return {
    r: primaryColor.r * brightness,
    g: primaryColor.g * brightness,
    b: primaryColor.b * brightness,
  };
}

/**
 * Cascade pattern: staggered Breathe - each tip runs the same oscillation
 * but with a quarter-cycle delay per tip index. The effect is a sequential
 * pulse that flows from tip 0 to tip N like a waterfall.
 */
export function evaluateCascade(ctx: TipEvaluationContext): LedColor {
  const { time, speed, ledIndex, primaryColor } = ctx;
  const t = time * speed;
  const localT = t - ledIndex * 0.25;
  const brightness = 0.5 + 0.5 * Math.sin(localT * TWO_PI);
  return {
    r: primaryColor.r * brightness,
    g: primaryColor.g * brightness,
    b: primaryColor.b * brightness,
  };
}
