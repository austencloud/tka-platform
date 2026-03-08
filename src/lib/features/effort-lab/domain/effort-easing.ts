/**
 * Effort Easing Functions
 *
 * Seven easing functions that transform animation progress (0-1) into
 * distinct movement qualities. Each function maps to a Laban effort
 * quality and produces a characteristic motion feel when applied to
 * prop interpolation.
 */

import type { EffortQuality } from "./effort-qualities";

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function linear(t: number): number {
  return clamp01(t);
}

function sustained(t: number): number {
  t = clamp01(t);
  if (t < 0.5) {
    return 4 * t * t * t;
  }
  const p = -2 * t + 2;
  return 1 - (p * p * p) / 2;
}

function sudden(t: number): number {
  t = clamp01(t);
  return t * t * t * t * t;
}

function heavy(t: number): number {
  t = clamp01(t);
  // First 70%: slow cubic buildup (pressing against resistance)
  // Last 30%: ease-out deceleration (momentum release)
  if (t < 0.7) {
    const normalized = t / 0.7;
    // Cubic ease-in, scaled to reach ~0.3 at the boundary
    return 0.3 * normalized * normalized * normalized;
  }
  const normalized = (t - 0.7) / 0.3;
  // Quadratic ease-out from 0.3 to 1.0
  return 0.3 + 0.7 * (1 - (1 - normalized) * (1 - normalized));
}

function light(t: number): number {
  t = clamp01(t);
  const inv = 1 - t;
  return 1 - inv * inv * inv * inv;
}

function bound(t: number): number {
  t = clamp01(t);
  const steps = 4;
  const stepIndex = Math.min(Math.floor(t * steps), steps - 1);
  const stepProgress = t * steps - stepIndex;

  const stepStart = stepIndex / steps;
  const stepEnd = (stepIndex + 1) / steps;

  // First 20% of each step: smoothstep transition
  // Remaining 80%: hold position
  const transitionThreshold = 0.2;

  if (stepProgress < transitionThreshold) {
    const transitionProgress = stepProgress / transitionThreshold;
    const eased = smoothstep(transitionProgress);
    return stepStart + (stepEnd - stepStart) * eased;
  }

  return stepEnd;
}

function free(t: number): number {
  t = clamp01(t);
  if (t === 0) return 0;
  if (t === 1) return 1;

  const damping = 4;
  const frequency = 3.5;
  return 1 - Math.exp(-damping * t) * Math.cos(frequency * Math.PI * t);
}

const EASING_FUNCTIONS: Record<EffortQuality, (t: number) => number> = {
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
): number {
  return EASING_FUNCTIONS[quality](t);
}

export interface EasingSample {
  readonly t: number;
  readonly value: number;
}

export function sampleEasingCurve(
  quality: EffortQuality,
  samples: number = 64,
): EasingSample[] {
  const easingFn = EASING_FUNCTIONS[quality];
  const result: EasingSample[] = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    result.push({ t, value: easingFn(t) });
  }

  return result;
}
