/**
 * Beta offset calculator
 *
 * When two props end at the same location (a "beta" position),
 * they need to be offset from each other so they don't overlap.
 */

import type { GridLocation, GridMode, Orientation, VectorDirection } from "../types.js";
import { isCardinal } from "../types.js";
import {
  DIAMOND_RADIAL_MAP,
  DIAMOND_NON_RADIAL_MAP,
  BOX_RADIAL_MAP,
  BOX_NON_RADIAL_MAP,
  SHIFT_RADIAL_MAP,
  SHIFT_NON_RADIAL_MAP,
  OPPOSITE_DIRECTIONS,
} from "../constants/direction-maps.js";

// ============================================================================
// CONSTANTS
// ============================================================================

// Default offset distance in pixels (for staff prop type in diamond mode)
const BETA_OFFSET_DISTANCE_DIAMOND = 21.11; // 950/45
const BETA_OFFSET_DISTANCE_BOX = 14.93; // (950/45) / sqrt(2)

// Hand-specific offset distance (same values)
const HAND_BETA_OFFSET_DISTANCE_DIAMOND = 950 / 45; // ~21.11px
const HAND_BETA_OFFSET_DISTANCE_BOX = 950 / 45 / Math.sqrt(2); // ~14.93px

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface BetaMotionInput {
  startLocation: string;
  endLocation: string;
  endOrientation?: string;
  motionType: string;
  color: "blue" | "red";
  propType?: string;
}

export interface BetaOffsetInput {
  blueMotion: BetaMotionInput;
  redMotion: BetaMotionInput;
  letter: string;
  gridMode: GridMode;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if orientation is radial (IN or OUT)
 * Interradial orientations (clockIn, clockOut, counterIn, counterOut) are NOT radial —
 * they use non-radial (clock/counter) offset maps as a close approximation.
 */
function isRadialOrientation(orientation: string | undefined): boolean {
  if (!orientation) return true; // Default to radial if not specified
  const ori = orientation.toLowerCase();
  return ori === "in" || ori === "out";
}

/**
 * Check if both orientations are radial
 */
function areBothRadial(blueOri: string | undefined, redOri: string | undefined): boolean {
  return isRadialOrientation(blueOri) && isRadialOrientation(redOri);
}

/**
 * Check if motion is a shift motion (PRO, ANTI, FLOAT)
 */
function isShiftMotion(motionType: string): boolean {
  const type = motionType.toLowerCase();
  return type === "pro" || type === "anti" || type === "float";
}

/**
 * Convert direction to pixel offset
 */
function directionToOffset(direction: VectorDirection, gridMode: GridMode): { x: number; y: number } {
  const distance = gridMode === "box" ? BETA_OFFSET_DISTANCE_BOX : BETA_OFFSET_DISTANCE_DIAMOND;

  switch (direction) {
    case "up":
      return { x: 0, y: -distance };
    case "down":
      return { x: 0, y: distance };
    case "left":
      return { x: -distance, y: 0 };
    case "right":
      return { x: distance, y: 0 };
    case "upright":
      return { x: distance, y: -distance };
    case "downright":
      return { x: distance, y: distance };
    case "upleft":
      return { x: -distance, y: -distance };
    case "downleft":
      return { x: -distance, y: distance };
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Get the opposite direction
 */
function getOppositeDirection(direction: VectorDirection): VectorDirection {
  return OPPOSITE_DIRECTIONS[direction];
}

// ============================================================================
// OFFSET CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate beta offset for static/dash motions
 */
function calculateStaticDashBetaOffset(
  location: string,
  color: "blue" | "red",
  isRadial: boolean,
  gridMode: GridMode
): { x: number; y: number } {
  const normalizedLocation = location.toLowerCase() as GridLocation;

  // Determine if this is a cardinal (diamond) or intercardinal (box) location
  const isDiamond = isCardinal(normalizedLocation);

  // Select the appropriate direction map
  let map: Record<GridLocation, Record<"blue" | "red", VectorDirection>>;
  if (isDiamond) {
    map = isRadial ? DIAMOND_RADIAL_MAP : DIAMOND_NON_RADIAL_MAP;
  } else {
    map = isRadial ? BOX_RADIAL_MAP : BOX_NON_RADIAL_MAP;
  }

  // Look up the direction for this location and color
  const locationMap = map[normalizedLocation];
  if (!locationMap) {
    // Location not found in map, no offset
    return { x: 0, y: 0 };
  }

  const direction = locationMap[color];
  if (!direction) {
    return { x: 0, y: 0 };
  }

  // Convert direction to pixel offset
  return directionToOffset(direction, gridMode);
}

/**
 * Calculate beta offset for shift motions (PRO/ANTI/FLOAT)
 */
function calculateShiftBetaOffset(
  motion: BetaMotionInput,
  isRadial: boolean,
  gridMode: GridMode
): { x: number; y: number } {
  const startLoc = motion.startLocation.toLowerCase() as GridLocation;
  const endLoc = motion.endLocation.toLowerCase() as GridLocation;

  // Select the appropriate shift map
  const map = isRadial ? SHIFT_RADIAL_MAP : SHIFT_NON_RADIAL_MAP;

  // Look up direction based on start->end transition
  const startMap = map[startLoc];
  if (!startMap) {
    // Fall back to static/dash calculation
    return calculateStaticDashBetaOffset(endLoc, motion.color, isRadial, gridMode);
  }

  const direction = startMap[endLoc];
  if (!direction) {
    // Fall back to static/dash calculation
    return calculateStaticDashBetaOffset(endLoc, motion.color, isRadial, gridMode);
  }

  return directionToOffset(direction, gridMode);
}

/**
 * Calculate beta offset for Y/Z letters.
 *
 * Y/Z letters combine a shift motion with a static/dash motion.
 * The shift motion gets its calculated direction, the non-shift motion
 * gets the OPPOSITE direction.
 */
function calculateYZBetaOffset(
  input: BetaOffsetInput,
  targetMotion: BetaMotionInput,
  isRadial: boolean,
  gridMode: GridMode
): { x: number; y: number } {
  const { blueMotion, redMotion } = input;

  // Identify which motion is shift (PRO/ANTI/FLOAT) vs non-shift (STATIC/DASH)
  const redIsShift = isShiftMotion(redMotion.motionType);
  const blueIsShift = isShiftMotion(blueMotion.motionType);

  const shiftMotion = redIsShift ? redMotion : blueIsShift ? blueMotion : null;

  if (!shiftMotion) {
    // Neither is a shift motion - fall back to static/dash calculation
    const location = targetMotion.endLocation.toLowerCase();
    return calculateStaticDashBetaOffset(location, targetMotion.color, isRadial, gridMode);
  }

  // Calculate direction from the SHIFT motion (not the target motion)
  const startLoc = shiftMotion.startLocation.toLowerCase() as GridLocation;
  const endLoc = shiftMotion.endLocation.toLowerCase() as GridLocation;
  const map = isRadial ? SHIFT_RADIAL_MAP : SHIFT_NON_RADIAL_MAP;

  const startMap = map[startLoc];
  if (!startMap) {
    // Fall back
    const location = targetMotion.endLocation.toLowerCase();
    return calculateStaticDashBetaOffset(location, targetMotion.color, isRadial, gridMode);
  }

  const shiftDirection = startMap[endLoc];
  if (!shiftDirection) {
    // Fall back
    const location = targetMotion.endLocation.toLowerCase();
    return calculateStaticDashBetaOffset(location, targetMotion.color, isRadial, gridMode);
  }

  // If target is the shift motion, use the calculated direction
  // If target is the non-shift motion, use the OPPOSITE direction
  const isTargetShiftMotion = targetMotion.color === shiftMotion.color;
  const direction = isTargetShiftMotion ? shiftDirection : getOppositeDirection(shiftDirection);

  return directionToOffset(direction, gridMode);
}

/**
 * Calculate beta offset for G/H letters.
 *
 * G/H letters have both motions as shifts with the same trajectory.
 * Red gets the base direction (from static/dash map using end location),
 * blue gets the opposite direction.
 * Matches the app's LetterGHHandler logic.
 */
function calculateGHBetaOffset(
  input: BetaOffsetInput,
  targetMotion: BetaMotionInput,
  isRadial: boolean,
  gridMode: GridMode
): { x: number; y: number } {
  const endLoc = targetMotion.endLocation.toLowerCase() as GridLocation;

  // Special case: South location always returns RIGHT as base direction
  if (endLoc === "s") {
    const baseDirection: VectorDirection = "right";
    const direction = targetMotion.color === "red"
      ? baseDirection
      : getOppositeDirection(baseDirection);
    return directionToOffset(direction, gridMode);
  }

  // Look up base direction from the static/dash map using red's perspective
  const isDiamond = isCardinal(endLoc);
  let map: Record<GridLocation, Record<"blue" | "red", VectorDirection>>;
  if (isDiamond) {
    map = isRadial ? DIAMOND_RADIAL_MAP : DIAMOND_NON_RADIAL_MAP;
  } else {
    map = isRadial ? BOX_RADIAL_MAP : BOX_NON_RADIAL_MAP;
  }

  const locationMap = map[endLoc];
  if (!locationMap) {
    return { x: 0, y: 0 };
  }

  // Red gets the base direction, blue gets the opposite
  const baseDirection = locationMap["red"];
  const direction = targetMotion.color === "red"
    ? baseDirection
    : getOppositeDirection(baseDirection);

  // DEBUG
  console.log(`[GH-BETA] endLoc=${endLoc} isDiamond=${isDiamond} isRadial=${isRadial} base=${baseDirection} final=${direction} color=${targetMotion.color} offset=${JSON.stringify(directionToOffset(direction, gridMode))}`);

  return directionToOffset(direction, gridMode);
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

/**
 * Calculate beta offset for a single motion
 * Returns { x, y } pixel offset to apply to prop position
 */
export function calculateBetaOffset(
  input: BetaOffsetInput,
  targetMotion: BetaMotionInput
): { x: number; y: number } {
  const { blueMotion, redMotion, letter, gridMode } = input;

  // Check if both props end at the same location (beta position)
  const blueEndLoc = blueMotion.endLocation.toLowerCase();
  const redEndLoc = redMotion.endLocation.toLowerCase();

  // DEBUG: trace beta offset calculation
  if (letter === "G" || letter === "H") {
    console.log(`[BETA-DEBUG] letter=${letter} target=${targetMotion.color} blueEnd=${blueEndLoc} redEnd=${redEndLoc} blueMT=${blueMotion.motionType} redMT=${redMotion.motionType} blueOri=${blueMotion.endOrientation} redOri=${redMotion.endOrientation}`);
  }

  if (blueEndLoc !== redEndLoc) {
    // Props don't overlap, no offset needed
    return { x: 0, y: 0 };
  }

  // SPECIAL CASE: Hand props always use "right hand on right, left hand on left"
  const bothAreHands = blueMotion.propType === "hand" && redMotion.propType === "hand";
  if (bothAreHands) {
    const distance =
      gridMode === "box" ? HAND_BETA_OFFSET_DISTANCE_BOX : HAND_BETA_OFFSET_DISTANCE_DIAMOND;

    // Blue hand goes LEFT (negative X), Red hand goes RIGHT (positive X)
    // This creates the "right hand on right, left hand on left" visual
    if (targetMotion.color === "blue") {
      return { x: -distance, y: 0 };
    } else {
      return { x: distance, y: 0 };
    }
  }

  // Determine if both orientations are radial
  const isRadial = areBothRadial(blueMotion.endOrientation, redMotion.endOrientation);

  // Get the target motion's end location
  const location = targetMotion.endLocation.toLowerCase();

  // Check for letter-specific handling (Y/Z have special logic)
  if (letter === "Y" || letter === "Z" || letter === "Y-" || letter === "Z-") {
    return calculateYZBetaOffset(input, targetMotion, isRadial, gridMode);
  }

  // Letter G/H: both motions are shifts with the same trajectory.
  // Red gets the base direction (from static/dash map), blue gets opposite.
  // This matches the app's LetterGHHandler logic.
  if (letter === "G" || letter === "H" || letter === "G-" || letter === "H-") {
    return calculateGHBetaOffset(input, targetMotion, isRadial, gridMode);
  }

  // Check if this is a shift motion (PRO/ANTI/FLOAT)
  if (isShiftMotion(targetMotion.motionType)) {
    return calculateShiftBetaOffset(targetMotion, isRadial, gridMode);
  }

  // Static or Dash motion - use location-based maps
  return calculateStaticDashBetaOffset(location, targetMotion.color, isRadial, gridMode);
}
