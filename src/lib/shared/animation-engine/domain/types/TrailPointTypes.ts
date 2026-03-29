// src/lib/shared/animation-engine/domain/types/TrailPointTypes.ts

/**
 * Trail Point Assignment Types
 *
 * Each prop type can have up to 2 trail endpoints (left, right), each
 * sourced from an existing tip point, a custom position, or disabled.
 * This lets users fix wrong trail positions on asymmetrical props
 * (e.g. Big Hoop) by pointing trails at specific tip points.
 */

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
