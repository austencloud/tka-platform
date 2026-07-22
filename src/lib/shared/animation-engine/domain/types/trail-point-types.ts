// src/lib/shared/animation-engine/domain/types/TrailPointTypes.ts

/**
 * Trail Point Assignment Types
 *
 * Each prop type can have up to 2 trail endpoints (left, right), each
 * sourced from an existing tip point, a custom position, or disabled.
 * This lets users fix wrong trail positions on asymmetrical props
 * (e.g. Big Hoop) by pointing trails at specific tip points.
 */

import {
  getTipPoints,
  type TipPoint,
} from "$lib/shared/animation-engine/domain/types/prop-tip-points";
import { propTipEnds } from "$lib/shared/pictograph/prop/domain/prop-tip-ends";
import { TrackingMode } from "$lib/shared/animation-engine/domain/types/trail-types";

/**
 * The prop center in prop-local coordinates. A custom source at (0,0) resolves
 * to the prop center, which is the hand path — the point the sprite is drawn
 * around. Shared by the HAND tracking mode so trails follow the grip instead of
 * a tip.
 */
const HAND_TRAIL_CONFIG: TrailPointConfig = {
  left: { type: "none" },
  right: { type: "custom", dx: 0, dy: 0 },
};

/**
 * Where a single trail endpoint gets its position from.
 * - "none": no trail from this end
 * - "tip": use the tip point at `index` from the unified getTipPoints() registry
 * - "custom": manual dx/dy offset from prop center (same coordinate space as tip points)
 */
export type TrailPointSource =
  | { type: "none" }
  | { type: "tip"; index: number }
  | { type: "custom"; dx: number; dy: number };

/**
 * Trail endpoint configuration for a prop type.
 * Left = tipIndex 0 in PropPositionCalculator.
 * Right = tipIndex 1 (tip end).
 */
export interface TrailPointConfig {
  left: TrailPointSource;
  right: TrailPointSource;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Override Provider (callback pattern avoids circular dependency with feature layer)
// ═══════════════════════════════════════════════════════════════════════════════

type TrailPointOverrideFn = (propType: string) => TrailPointConfig | null;
let trailPointOverrideProvider: TrailPointOverrideFn | null = null;

/**
 * Register a callback that can supply custom trail point assignments for a prop type.
 * Called by the effects-lab DI container at startup.
 * Pass null to remove the override provider.
 */
export function setTrailPointOverrideProvider(
  provider: TrailPointOverrideFn | null
): void {
  trailPointOverrideProvider = provider;
}

/**
 * Look up trail point assignment for a prop type.
 * Returns null if no assignment exists (caller should use geometric fallback).
 */
export function getTrailPointConfig(
  propType: string | null | undefined
): TrailPointConfig | null {
  if (!propType) return null;
  const key = propType.toLowerCase();
  return trailPointOverrideProvider?.(key) ?? null;
}

/**
 * Choose the primary outward tip for a single-ended prop. Tip arrays contain
 * every valid effect attachment point, but a trail needs one stable spine.
 * The primary axis is +dx, so this picks the furthest point on that axis and
 * uses the point nearest the axis as the tie-breaker. That resolves a fan to
 * its center rib instead of whichever rib happens to be first in the array.
 */
function primaryTrailTipIndex(points: readonly TipPoint[]): number {
  let bestIndex = 0;

  for (let index = 1; index < points.length; index++) {
    const candidate = points[index]!;
    const best = points[bestIndex]!;
    const fartherOut = candidate.dx > best.dx;
    const sameReachButCloserToAxis =
      candidate.dx === best.dx && Math.abs(candidate.dy) < Math.abs(best.dy);

    if (fartherOut || sameReachButCloserToAxis) {
      bestIndex = index;
    }
  }

  return bestIndex;
}

/**
 * Canonical automatic trail assignment for a prop.
 *
 * Two-ended props preserve the registry's end ordering. Single-ended props
 * expose the same primary point through both logical ends so LEFT, RIGHT, and
 * BOTH tracking modes all follow the same physical tip without duplicating
 * geometry in callers that de-duplicate matching sources.
 */
export function getDefaultTrailPointConfig(
  propType: string | null | undefined
): TrailPointConfig {
  const points = getTipPoints(propType).points;
  if (points.length === 0) {
    return { left: { type: "none" }, right: { type: "none" } };
  }

  if (propTipEnds(propType ?? undefined) === 2 && points.length > 1) {
    return {
      left: { type: "tip", index: 0 },
      right: { type: "tip", index: 1 },
    };
  }

  const index = primaryTrailTipIndex(points);
  return {
    left: { type: "tip", index },
    right: { type: "tip", index },
  };
}

/**
 * Resolve the effective trail assignment from one authority: HAND tracking mode
 * (a single prop-center source, prop-agnostic) wins outright; otherwise an
 * explicit lab override when present, otherwise the canonical prop-aware
 * default.
 *
 * `trackingMode` is optional so the legacy tip-based callers (path cache,
 * endpoint helpers) keep their tip behavior unchanged — only the live trail
 * overlays pass it, and only HAND changes the result.
 */
export function resolveTrailPointConfig(
  propType: string | null | undefined,
  trackingMode?: TrackingMode
): TrailPointConfig {
  if (trackingMode === TrackingMode.HAND) return HAND_TRAIL_CONFIG;
  return getTrailPointConfig(propType) ?? getDefaultTrailPointConfig(propType);
}
