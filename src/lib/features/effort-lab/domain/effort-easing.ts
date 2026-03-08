/**
 * Effort Easing Functions
 *
 * Seven easing functions that transform animation progress (0-1) into
 * distinct movement qualities. Each function maps to a Laban effort
 * quality and produces a characteristic motion feel when applied to
 * prop interpolation.
 *
 * All functions accept optional params for tunable behavior.
 */

import type { EffortQuality } from "./effort-qualities";

export type EffortParams = Record<string, number>;

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function linear(t: number): number {
  return clamp01(t);
}

function sustained(t: number, params?: EffortParams): number {
  t = clamp01(t);
  const intensity = params?.intensity ?? 1.0;

  // Adjust the cubic curve steepness based on intensity
  // intensity=1.0 gives the original cubic S-curve
  // Higher intensity = more pronounced S (steeper midpoint)
  if (t < 0.5) {
    return Math.pow(2 * t, 1 + intensity * 2) / 2;
  }
  const p = 2 * (1 - t);
  return 1 - Math.pow(p, 1 + intensity * 2) / 2;
}

function sudden(t: number, params?: EffortParams): number {
  t = clamp01(t);
  const sharpness = params?.sharpness ?? 5;
  return Math.pow(t, sharpness);
}

function heavy(t: number, params?: EffortParams): number {
  t = clamp01(t);
  const weight = params?.weight ?? 0.7;

  // First phase: slow cubic buildup (pressing against resistance)
  // Last phase: ease-out deceleration (momentum release)
  if (t < weight) {
    const normalized = t / weight;
    // Cubic ease-in, scaled to reach (1 - weight) fraction at the boundary
    return (1 - weight) * normalized * normalized * normalized;
  }
  const boundary = 1 - weight;
  const normalized = (t - weight) / (1 - weight);
  // Quadratic ease-out from boundary to 1.0
  return boundary + (1 - boundary) * (1 - (1 - normalized) * (1 - normalized));
}

function light(t: number, params?: EffortParams): number {
  t = clamp01(t);
  const softness = params?.softness ?? 4;
  const inv = 1 - t;
  return 1 - Math.pow(inv, softness);
}

function bound(t: number, params?: EffortParams): number {
  t = clamp01(t);
  if (t >= 1) return 1;

  const steps = params?.steps ?? 4;
  const smoothness = params?.smoothness ?? 0.5;

  const segment = t * steps;
  const segmentIndex = Math.floor(segment);
  const segmentProgress = segment - segmentIndex;

  const startValue = segmentIndex / steps;
  const endValue = (segmentIndex + 1) / steps;

  // Smoothness controls how much ease-out is applied
  // 0 = linear within segment, 1 = strong ease-out (decisive arrival)
  const power = 1 + smoothness * 3; // 1 (linear) to 4 (strong ease-out)
  const easedSegment = 1 - Math.pow(1 - segmentProgress, power);

  return startValue + (endValue - startValue) * easedSegment;
}

function free(t: number, params?: EffortParams): number {
  t = clamp01(t);
  if (t === 0) return 0;
  if (t === 1) return 1;

  const momentum = params?.momentum ?? 0.5;

  // Base progress with ease-in-out
  const base = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  // Add sine-wave momentum (organic fluctuation)
  // momentum controls amplitude of the wave
  const wave = Math.sin(t * Math.PI * 2) * momentum * 0.08;

  // Blend: mostly base progress, with subtle wave overlay
  // The wave naturally goes to 0 at t=0 and t=1 (sin(0) = sin(2pi) = 0)
  return base + wave;
}

type EasingFn = (t: number, params?: EffortParams) => number;

const EASING_FUNCTIONS: Record<EffortQuality, EasingFn> = {
  linear,
  sustained,
  sudden,
  heavy,
  light,
  bound,
  free,
};

export function applyEffortEasing(
  quality: EffortQuality,
  t: number,
  params?: EffortParams,
): number {
  return EASING_FUNCTIONS[quality](t, params);
}

export interface EasingSample {
  readonly t: number;
  readonly value: number;
}

export function sampleEasingCurve(
  quality: EffortQuality,
  samples: number = 64,
  params?: EffortParams,
): EasingSample[] {
  const easingFn = EASING_FUNCTIONS[quality];
  const result: EasingSample[] = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    result.push({ t, value: easingFn(t, params) });
  }

  return result;
}
