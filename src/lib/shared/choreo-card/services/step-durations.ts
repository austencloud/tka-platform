/**
 * Duration detection for card cell layout — a leaf module with no heavy
 * imports, so non-UI callers (canonical cell warming) can share the exact
 * rule ChoreoCard uses without dragging app state / Firebase into their
 * dependency graph.
 */

/** True when any step's duration differs from 1 (held beats → wide cells). */
export function detectMixedDurations(
  steps: readonly { duration?: number }[]
): boolean {
  for (const step of steps) {
    const d = step.duration ?? 1;
    if (Math.abs(d - 1.0) > 0.001) return true;
  }
  return false;
}
