/**
 * Prop Geometry Adjustment Domain Model
 *
 * Letter-free, prop-aware arrow adjustments. When a prop's physical shape
 * (triad arms, fan spread, buugeng curves) extends into the arrow's default
 * position, these adjustments push the arrow clear of the prop body.
 *
 * This tier sits between Default and Special in the cascade:
 *   Default → Prop Geometry → Special → Global → Manual (WASD)
 *
 * Each higher tier overrides the one below it. A special placement for
 * letter "L" overrides the prop geometry default. A global adjustment
 * overrides the special. Manual WASD adds on top of everything.
 *
 * Key structure encodes the physical scenario without any letter:
 *   gridMode|propType|otherPropType|positionType|endOri|otherEndOri|motionType|turns|arrowColor
 *
 * Values are BASE adjustments - they go through directional tuple rotation
 * in the pipeline, so one entry covers all four quadrants automatically.
 */

import type { Timestamp } from "firebase/firestore";

/**
 * A single prop geometry adjustment entry
 */
export interface PropGeometryAdjustment {
  readonly gridMode: string;
  readonly propType: string;
  readonly otherPropType: string;
  readonly positionType: string;
  readonly endOrientation: string;
  readonly otherEndOrientation: string;
  readonly motionType: string;
  readonly turns: string;
  readonly arrowColor: string;
  readonly adjustmentX: number;
  readonly adjustmentY: number;
  readonly updatedAt: Timestamp;
  readonly updatedBy: string;
}

/**
 * Input for creating or updating a prop geometry adjustment
 */
export interface PropGeometryAdjustmentInput {
  readonly gridMode: string;
  readonly propType: string;
  readonly otherPropType: string;
  readonly positionType: string;
  readonly endOrientation: string;
  readonly otherEndOrientation: string;
  readonly motionType: string;
  readonly turns: string;
  readonly arrowColor: string;
  readonly adjustmentX: number;
  readonly adjustmentY: number;
}

/**
 * Composite key for looking up prop geometry adjustments.
 */
export interface PropGeometryKey {
  readonly gridMode: string;
  readonly propType: string;
  readonly otherPropType: string;
  readonly positionType: string;
  readonly endOrientation: string;
  readonly otherEndOrientation: string;
  readonly motionType: string;
  readonly turns: string;
  readonly arrowColor: string;
}

/**
 * Generate the full key string from key components.
 */
export function generatePropGeometryKeyString(key: PropGeometryKey): string {
  return [
    key.gridMode,
    key.propType,
    key.otherPropType,
    key.positionType,
    key.endOrientation,
    key.otherEndOrientation,
    key.motionType,
    key.turns,
    key.arrowColor,
  ].join("|");
}

/**
 * Parse a key string back into components.
 * Returns null if the string doesn't have exactly 9 parts.
 */
export function parsePropGeometryKeyString(
  keyString: string
): PropGeometryKey | null {
  const parts = keyString.split("|");
  if (parts.length !== 9) return null;

  const [
    gridMode,
    propType,
    otherPropType,
    positionType,
    endOrientation,
    otherEndOrientation,
    motionType,
    turns,
    arrowColor,
  ] = parts;

  if (
    !gridMode ||
    !propType ||
    !otherPropType ||
    !positionType ||
    !endOrientation ||
    !otherEndOrientation ||
    !motionType ||
    !turns ||
    !arrowColor
  ) {
    return null;
  }

  return {
    gridMode,
    propType,
    otherPropType,
    positionType,
    endOrientation,
    otherEndOrientation,
    motionType,
    turns,
    arrowColor,
  };
}

/**
 * Generate cascading fallback keys for lookup.
 *
 * Returns keys from most specific to least specific:
 * 1. Full key (all 9 dimensions)
 * 2. Drop arrowColor - same adjustment for both blue and red
 * 3. Drop otherPropType - same adjustment regardless of partner prop
 * 4. Drop both arrowColor and otherPropType - broadest match
 *
 * Each uses "*" as the wildcard value for the dropped dimension.
 */
export function generateCascadingKeys(key: PropGeometryKey): string[] {
  const keys: string[] = [];

  // Level 1: Full key
  keys.push(generatePropGeometryKeyString(key));

  // Level 2: Wildcard arrowColor
  keys.push(
    generatePropGeometryKeyString({ ...key, arrowColor: "*" })
  );

  // Level 3: Wildcard otherPropType
  keys.push(
    generatePropGeometryKeyString({ ...key, otherPropType: "*" })
  );

  // Level 4: Wildcard both
  keys.push(
    generatePropGeometryKeyString({
      ...key,
      otherPropType: "*",
      arrowColor: "*",
    })
  );

  return keys;
}
