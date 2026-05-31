import { hslToRgb } from "../types/led-patterns";
import type { LedColor } from "../types/led-patterns";
import type { TipEvaluationContext } from "./context";

const TWO_PI = Math.PI * 2;

/**
 * Rainbow pattern: each tip is offset around the full hue wheel,
 * and the whole spectrum rotates over time.
 * Classic multi-color prop effect that reads from any distance.
 */
export function evaluateRainbow(ctx: TipEvaluationContext): LedColor {
  const { time, speed, ledIndex, totalLeds } = ctx;
  const t = time * speed;
  const total = Math.max(totalLeds, 1);
  const hue = (t * 0.15 + ledIndex / total) % 1.0;
  return hslToRgb(hue, 1.0, 0.5);
}

/**
 * Warm Shift pattern: hue cycles through warm tones (red to yellow).
 * Good for fire-like performances or warm atmospheric effects.
 * Spatial offset across tips so adjacent tips show neighboring warm shades.
 */
export function evaluateWarmShift(ctx: TipEvaluationContext): LedColor {
  const { time, speed, ledIndex, totalLeds } = ctx;
  const t = time * speed;
  const total = Math.max(totalLeds, 1);
  // Hue range: [0, 60/360] - reds through yellows
  const baseHue = (0.5 + 0.5 * Math.sin(t * TWO_PI)) * (60 / 360);
  const hue = baseHue + (ledIndex / total) * (30 / 360);
  return hslToRgb(hue % 1.0, 1.0, 0.5);
}

/**
 * Cool Shift pattern: hue cycles through cool tones (cyan to blue).
 * Good for water or ice-themed performances.
 * Same spatial offset logic as Warm Shift, applied to the cool range.
 */
export function evaluateCoolShift(ctx: TipEvaluationContext): LedColor {
  const { time, speed, ledIndex, totalLeds } = ctx;
  const t = time * speed;
  const total = Math.max(totalLeds, 1);
  // Hue range: [180/360, 240/360] - cyans through blues
  const range = 60 / 360;
  const baseHue = 180 / 360 + (0.5 + 0.5 * Math.sin(t * TWO_PI)) * range;
  const hue = baseHue + (ledIndex / total) * (30 / 360);
  return hslToRgb(hue % 1.0, 1.0, 0.5);
}

/**
 * Neon pattern: hue cycles through vivid purples and magentas (270–330°).
 * High-energy, club-aesthetic feel. Same spatial offset as other shift patterns.
 */
export function evaluateNeon(ctx: TipEvaluationContext): LedColor {
  const { time, speed, ledIndex, totalLeds } = ctx;
  const t = time * speed;
  const total = Math.max(totalLeds, 1);
  // Hue range: [270/360, 330/360] - purples through magentas
  const range = 60 / 360;
  const baseHue = 270 / 360 + (0.5 + 0.5 * Math.sin(t * TWO_PI)) * range;
  const hue = baseHue + (ledIndex / total) * (30 / 360);
  return hslToRgb(hue % 1.0, 1.0, 0.5);
}
