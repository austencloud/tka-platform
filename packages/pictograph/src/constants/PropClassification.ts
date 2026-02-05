/**
 * Prop Classification System
 *
 * This determines whether beta offset should be applied based on orientation.
 *
 * From desktop: legacy/enums/prop_type.py
 */

export const BIG_UNILATERAL_PROPS = ["bighoop", "bigfan", "bigtriad"] as const;

export const SMALL_UNILATERAL_PROPS = [
  "fan",
  "club",
  "minihoop",
  "triad",
  "ukulele",
  "triquetra",
  "triquetra2",
  "chicken",
] as const;

export const BIG_BILATERAL_PROPS = [
  "bigstaff",
  "bigbuugeng",
  "bigdoublestar",
  "bigeightrings",
  "bigclub",
  "bigchicken",
  "guitar",
  "sword",
] as const;

export const SMALL_BILATERAL_PROPS = [
  "staff",
  "simple_staff",
  "staff_v2",
  "buugeng",
  "doublestar",
  "quiad",
  "fractalgeng",
  "eightrings",
] as const;

export type BigUnilateralProp = (typeof BIG_UNILATERAL_PROPS)[number];
export type SmallUnilateralProp = (typeof SMALL_UNILATERAL_PROPS)[number];
export type BigBilateralProp = (typeof BIG_BILATERAL_PROPS)[number];
export type SmallBilateralProp = (typeof SMALL_BILATERAL_PROPS)[number];

export type UnilateralProp = BigUnilateralProp | SmallUnilateralProp;
export type BilateralProp = BigBilateralProp | SmallBilateralProp;

export function isUnilateralProp(propType: string): boolean {
  const normalizedType = propType.toLowerCase();
  if (normalizedType === "hand") return false;
  return (
    (BIG_UNILATERAL_PROPS as readonly string[]).includes(normalizedType) ||
    (SMALL_UNILATERAL_PROPS as readonly string[]).includes(normalizedType)
  );
}

export function isBilateralProp(propType: string): boolean {
  const normalizedType = propType.toLowerCase();
  if (normalizedType === "hand") return false;
  return (
    (BIG_BILATERAL_PROPS as readonly string[]).includes(normalizedType) ||
    (SMALL_BILATERAL_PROPS as readonly string[]).includes(normalizedType)
  );
}

export const BUUGENG_FAMILY_PROPS = [
  "buugeng",
  "bigbuugeng",
  "fractalgeng",
] as const;

export function isBuugengFamilyProp(propType: string): boolean {
  const normalizedType = propType.toLowerCase();
  return (BUUGENG_FAMILY_PROPS as readonly string[]).includes(normalizedType);
}

export function isBigProp(propType: string): boolean {
  const normalizedType = propType.toLowerCase();
  return (
    (BIG_UNILATERAL_PROPS as readonly string[]).includes(normalizedType) ||
    (BIG_BILATERAL_PROPS as readonly string[]).includes(normalizedType)
  );
}

export function isSmallProp(propType: string): boolean {
  const normalizedType = propType.toLowerCase();
  return (
    (SMALL_UNILATERAL_PROPS as readonly string[]).includes(normalizedType) ||
    (SMALL_BILATERAL_PROPS as readonly string[]).includes(normalizedType)
  );
}

const STAFF_FAMILY_PROPS = [
  "staff",
  "simple_staff",
  "staff_v2",
  "bigstaff",
] as const;

export function getBilateralEndLabels(propType: string): [string, string] {
  const normalizedType = propType.toLowerCase();

  if ((STAFF_FAMILY_PROPS as readonly string[]).includes(normalizedType)) {
    return ["Pinky End", "Thumb End"];
  }

  if (normalizedType === "guitar") {
    return ["Body End", "Neck End"];
  }

  if (normalizedType === "sword") {
    return ["Tip End", "Hilt End"];
  }

  return ["End 1", "End 2"];
}

export function getBetaOffsetSize(
  propType: string,
  gridMode?: "diamond" | "box" | "skewed" | "centric"
): number {
  const normalizedType = propType.toLowerCase();

  let baseOffset: number;

  if (normalizedType === "club" || normalizedType === "eightrings") {
    baseOffset = 950 / 60;
  } else if (normalizedType === "doublestar") {
    baseOffset = 950 / 50;
  } else {
    baseOffset = 950 / 45;
  }

  if (gridMode === "box") {
    return baseOffset / Math.sqrt(2);
  }

  return baseOffset;
}
