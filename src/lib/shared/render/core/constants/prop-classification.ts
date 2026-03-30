/**
 * Prop Classification Helpers
 *
 * Ported from src/lib/shared/pictograph/prop/domain/enums/PropClassification.ts
 * Used by beta offset calculation to determine skip conditions and offset distances.
 */

import type { GridMode } from "../types.js";

const VIEWBOX_SIZE = 950;

// ============================================================================
// PROP TYPE ARRAYS (exact lists from app's PropClassification.ts)
// ============================================================================

const BIG_UNILATERAL_PROPS = [
  "bighoop", "bigfan", "bigtriad", "bigtorch", "bigcontactball",
] as const;

const SMALL_UNILATERAL_PROPS = [
  "fan", "club", "minihoop", "triad", "ukulele",
  "triquetra", "triquetra2", "chicken", "torch", "contactball",
] as const;

const BUUGENG_FAMILY = [
  "buugeng", "bigbuugeng", "fractalgeng", "trigeng",
] as const;

const STRICT_PLACED = [
  "bighoop", "doublestar", "bigbuugeng", "bigdoublestar", "triquetra",
] as const;

// ============================================================================
// CLASSIFICATION FUNCTIONS
// ============================================================================

export function isUnilateralProp(propType: string): boolean {
  const t = propType.toLowerCase();
  if (t === "hand") return false;
  return (BIG_UNILATERAL_PROPS as readonly string[]).includes(t)
      || (SMALL_UNILATERAL_PROPS as readonly string[]).includes(t);
}

export function isBuugengFamilyProp(propType: string): boolean {
  return (BUUGENG_FAMILY as readonly string[]).includes(propType.toLowerCase());
}

export function isStrictPlacedProp(propType: string): boolean {
  return (STRICT_PLACED as readonly string[]).includes(propType.toLowerCase());
}

export function pictographRequiresStrictHandpoints(
  bluePropType: string,
  redPropType: string
): boolean {
  return isStrictPlacedProp(bluePropType) && isStrictPlacedProp(redPropType);
}

/**
 * Get the beta offset size for a prop type.
 * Box mode applies diagonal compensation (÷√2).
 */
export function getBetaOffsetSize(propType: string, gridMode?: GridMode): number {
  const t = propType.toLowerCase();
  let base: number;

  if (t === "club" || t === "eightrings") {
    base = VIEWBOX_SIZE / 60;       // 15.83px
  } else if (t === "doublestar") {
    base = VIEWBOX_SIZE / 50;       // 19px
  } else {
    base = VIEWBOX_SIZE / 45;       // 21.11px
  }

  return gridMode === "box" ? base / Math.sqrt(2) : base;
}
