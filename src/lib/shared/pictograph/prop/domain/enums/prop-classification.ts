/**
 * Prop Classification System
 *
 * This determines whether beta offset should be applied based on orientation.
 *
 * From desktop: legacy/enums/prop_type.py
 */

/**
 * Big Unilateral Props
 * - Large size
 * - SKIP beta offset when ending in radial (IN/OUT) or non-radial (CLOCK/COUNTER)
 */
export const BIG_UNILATERAL_PROPS = ["bighoop", "bigfan", "bigtriad", "bigtorch", "bigcontactball"] as const;

/**
 * Small Unilateral Props
 * - Small/medium size
 * - SKIP beta offset when ending in radial (IN/OUT) or non-radial (CLOCK/COUNTER)
 */
export const SMALL_UNILATERAL_PROPS = [
  "fan",
  "club",
  "minihoop",
  "triad", // ← TRIAD IS UNILATERAL!
  "ukulele",
  "triquetra",
  "triquetra2",
  "chicken",
  "torch",
  "contactball",
] as const;

/**
 * Big Bilateral Props
 * - Large size
 * - ALWAYS apply beta offset
 */
export const BIG_BILATERAL_PROPS = [
  "bigstaff",
  "bigbuugeng",
  "bigdoublestar",
  "bigeightrings",
  "bigclub",
  "bigchicken",
  "guitar",
  "sword",
  "bigdoublecontactball",
] as const;

/**
 * Small Bilateral Props
 * - Held with two hands
 * - Small/medium size
 * - ALWAYS apply beta offset
 */
export const SMALL_BILATERAL_PROPS = [
  "staff",
  "simple_staff",
  "staff_v2",
  "buugeng",
  "trigeng",
  "doublestar",
  "quiad",
  "fractalgeng",
  "eightrings",
  "doublecontactball",
] as const;

// Union types for type checking
export type BigUnilateralProp = (typeof BIG_UNILATERAL_PROPS)[number];
export type SmallUnilateralProp = (typeof SMALL_UNILATERAL_PROPS)[number];
export type BigBilateralProp = (typeof BIG_BILATERAL_PROPS)[number];
export type SmallBilateralProp = (typeof SMALL_BILATERAL_PROPS)[number];

export type UnilateralProp = BigUnilateralProp | SmallUnilateralProp;
export type BilateralProp = BigBilateralProp | SmallBilateralProp;

/**
 * Check if a prop is unilateral (one-handed)
 */
export function isUnilateralProp(propType: string): boolean {
  const normalizedType = propType.toLowerCase();
  if (normalizedType === "hand") return false;
  return (
    (BIG_UNILATERAL_PROPS as readonly string[]).includes(normalizedType) ||
    (SMALL_UNILATERAL_PROPS as readonly string[]).includes(normalizedType)
  );
}

/**
 * Check if a prop is bilateral (two-handed)
 */
export function isBilateralProp(propType: string): boolean {
  const normalizedType = propType.toLowerCase();
  if (normalizedType === "hand") return false;
  return (
    (BIG_BILATERAL_PROPS as readonly string[]).includes(normalizedType) ||
    (SMALL_BILATERAL_PROPS as readonly string[]).includes(normalizedType)
  );
}

/**
 * Buugeng Family Props - asymmetric bilateral props that can nest together
 * when orientations are opposite. Used for special beta offset handling.
 */
export const BUUGENG_FAMILY_PROPS = [
  "buugeng",
  "bigbuugeng",
  "fractalgeng",
  "trigeng",
] as const;

/**
 * Check if a prop is in the Buugeng family (asymmetric bilateral props)
 */
export function isBuugengFamilyProp(propType: string): boolean {
  const normalizedType = propType.toLowerCase();
  return (BUUGENG_FAMILY_PROPS as readonly string[]).includes(normalizedType);
}

/**
 * Strict Placed Props
 * These props are physically larger and need to be positioned at strict handpoints
 * (further from center) to avoid visual overlap with the grid.
 *
 * From desktop: legacy/enums/prop_type.py strict_placed_props
 *
 * IMPORTANT: The legacy check (`has_strict_placed_props`) requires ALL props in the
 * pictograph to be of a strict type. If one hand is bighoop and the other is staff,
 * normal handpoints are used. Use `pictographRequiresStrictHandpoints()` for this check.
 */
export const STRICT_PLACED_PROPS = [
  "bighoop",
  "doublestar",
  "bigbuugeng",
  "bigdoublestar",
  "triquetra",
] as const;

/**
 * Check if a single prop type requires strict handpoints
 */
export function isStrictPlacedProp(propType: string): boolean {
  return (STRICT_PLACED_PROPS as readonly string[]).includes(
    propType.toLowerCase()
  );
}

/**
 * Check if a pictograph should use strict handpoints.
 * Returns true only when BOTH props are strict-placed types (matching legacy behavior).
 * If either prop is non-strict, normal handpoints are used for both.
 */
export function pictographRequiresStrictHandpoints(
  bluePropType: string,
  redPropType: string
): boolean {
  return (
    isStrictPlacedProp(bluePropType) && isStrictPlacedProp(redPropType)
  );
}

/**
 * Check if a prop is big (requires larger spacing)
 */
export function isBigProp(propType: string): boolean {
  const normalizedType = propType.toLowerCase();
  return (
    (BIG_UNILATERAL_PROPS as readonly string[]).includes(normalizedType) ||
    (BIG_BILATERAL_PROPS as readonly string[]).includes(normalizedType)
  );
}

/**
 * Check if a prop is small (normal spacing)
 */
export function isSmallProp(propType: string): boolean {
  const normalizedType = propType.toLowerCase();
  return (
    (SMALL_UNILATERAL_PROPS as readonly string[]).includes(normalizedType) ||
    (SMALL_BILATERAL_PROPS as readonly string[]).includes(normalizedType)
  );
}

/**
 * Staff family props - use Thumb/Pinky terminology
 */
const STAFF_FAMILY_PROPS = [
  "staff",
  "simple_staff",
  "staff_v2",
  "bigstaff",
] as const;

/**
 * Get human-readable labels for bilateral prop ends
 * Returns [leftEndLabel, rightEndLabel] matching TrackingMode.LEFT_END and RIGHT_END
 *
 * Note: LEFT_END tracks what visually appears as the "pinky" side of a staff,
 * RIGHT_END tracks the "thumb" side. Labels are swapped accordingly.
 */
export function getBilateralEndLabels(propType: string): [string, string] {
  const normalizedType = propType.toLowerCase();

  // Staff family: Pinky End / Thumb End (LEFT_END=pinky side, RIGHT_END=thumb side)
  if ((STAFF_FAMILY_PROPS as readonly string[]).includes(normalizedType)) {
    return ["Pinky End", "Thumb End"];
  }

  // Guitar: Body End / Neck End
  if (normalizedType === "guitar") {
    return ["Body End", "Neck End"];
  }

  // Sword: Tip End / Hilt End
  if (normalizedType === "sword") {
    return ["Tip End", "Hilt End"];
  }

  // Generic fallback for other bilateral props
  return ["End 1", "End 2"];
}

/**
 * Get the beta offset size for a prop type
 *
 * Based on desktop calculations:
 * - Large props: 950/60 = 15.83px
 * - Medium props (doublestar): 950/50 = 19px
 * - Default/small props: 950/45 = 21.11px
 *
 * Box mode applies diagonal compensation (÷√2) since diagonal vectors travel 1.414x farther
 * than cardinal vectors, resulting in equal visual spacing between diamond and box modes.
 */
export function getBetaOffsetSize(
  propType: string,
  gridMode?: "diamond" | "box" | "skewed" | "centric" | "trigrid" | "8point"
): number {
  const normalizedType = propType.toLowerCase();

  let baseOffset: number;

  // Large props
  if (normalizedType === "club" || normalizedType === "eightrings") {
    baseOffset = 950 / 60; // 15.83px
  }
  // Medium props
  else if (normalizedType === "doublestar") {
    baseOffset = 950 / 50; // 19px
  }
  // Default/small props
  else {
    baseOffset = 950 / 45; // 21.11px
  }

  // Compensate for diagonal vector magnitude in box mode
  // Diagonal vectors have magnitude √2 ≈ 1.414, so we divide by √2 to achieve equal visual spacing
  if (gridMode === "box") {
    return baseOffset / Math.sqrt(2); // ÷ 1.414
  }

  return baseOffset;
}
