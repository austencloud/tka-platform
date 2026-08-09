import { MediaQuery } from "svelte/reactivity";

/**
 * Shared reduced-motion source for the 3D environment primitives.
 *
 * Every animated scene layer used to decide for itself whether to keep moving,
 * and in practice only the autumn wind ever asked. One lazily-created
 * MediaQuery keeps particles, stars, wisps and water on the same answer without
 * each of them re-implementing the media listener.
 */
let query: MediaQuery | null = null;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  query ??= new MediaQuery("(prefers-reduced-motion: reduce)");
  return query.current;
}

/**
 * Per-frame time multiplier an animated layer should apply to its delta.
 *
 * An explicit override always wins so a caller can force motion on or off for
 * its own reasons; otherwise the operating-system preference decides. Negative
 * and non-finite overrides are treated as programming mistakes rather than a
 * request to run time backwards.
 */
export function resolveMotionScale(
  reduced: boolean,
  override?: number
): number {
  if (override !== undefined) {
    return Number.isFinite(override) ? Math.max(0, override) : 1;
  }
  return reduced ? 0 : 1;
}
