import type { Mark, EasingType } from '../domain/stage-types';

export function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'linear': return t;
    case 'easeIn': return t * t;
    case 'easeOut': return 1 - (1 - t) * (1 - t);
    case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}

export function computeMarkDistance(from: Mark, to: Mark): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function computeMarkSpeed(from: Mark, to: Mark, bpm: number): number {
  if (to.beats <= 0) return 0;
  const distance = computeMarkDistance(from, to);
  const durationSeconds = (to.beats * 60) / bpm;
  return distance / durationSeconds;
}
