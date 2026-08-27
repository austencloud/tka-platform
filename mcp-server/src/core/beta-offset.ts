/**
 * Beta Offset Calculator for Standalone Renderer
 *
 * When two props end at the same location (a "beta" position),
 * they need to be offset from each other so they don't overlap.
 * The direction of offset depends on:
 * - The location (N/S/E/W vs NE/SE/SW/NW)
 * - The orientation type (radial IN/OUT vs non-radial CLOCK/COUNTER)
 * - The motion color (red vs blue)
 * - For shift motions, the start->end transition
 *
 * Ported from src/lib/shared/pictograph/prop/domain/direction/DirectionMaps.ts
 */

import { GridLocation, GridMode, Orientation } from "./enums.js";

// Vector directions for offset calculation
export enum VectorDirection {
  UP = "up",
  DOWN = "down",
  LEFT = "left",
  RIGHT = "right",
  UPRIGHT = "upright",
  DOWNRIGHT = "downright",
  UPLEFT = "upleft",
  DOWNLEFT = "downleft",
}

// Motion input for beta calculation
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

// Default offset distance in pixels (for staff prop type in diamond mode)
const BETA_OFFSET_DISTANCE_DIAMOND = 21.11;
const BETA_OFFSET_DISTANCE_BOX = 14.93;

// Hand-specific offset distance
// Matches getBetaOffsetSize() from PropClassification.ts: 950/45 = 21.11px
const HAND_BETA_OFFSET_DISTANCE_DIAMOND = 950 / 45;  // ~21.11px
const HAND_BETA_OFFSET_DISTANCE_BOX = (950 / 45) / Math.sqrt(2);  // ~14.93px


type ColorMap = Record<"blue" | "red", VectorDirection>;

/**
 * Diamond grid (N/S/E/W) - radial orientation (IN/OUT)
 * Props at cardinal locations with radial orientations
 */
const DIAMOND_RADIAL_MAP: Record<string, ColorMap> = {
  [GridLocation.NORTH]: { red: VectorDirection.RIGHT, blue: VectorDirection.LEFT },
  [GridLocation.EAST]: { red: VectorDirection.DOWN, blue: VectorDirection.UP },
  [GridLocation.SOUTH]: { red: VectorDirection.LEFT, blue: VectorDirection.RIGHT },
  [GridLocation.WEST]: { red: VectorDirection.UP, blue: VectorDirection.DOWN },
};

/**
 * Diamond grid (N/S/E/W) - non-radial orientation (CLOCK/COUNTER)
 */
const DIAMOND_NON_RADIAL_MAP: Record<string, ColorMap> = {
  [GridLocation.NORTH]: { red: VectorDirection.UP, blue: VectorDirection.DOWN },
  [GridLocation.EAST]: { red: VectorDirection.RIGHT, blue: VectorDirection.LEFT },
  [GridLocation.SOUTH]: { red: VectorDirection.DOWN, blue: VectorDirection.UP },
  [GridLocation.WEST]: { red: VectorDirection.LEFT, blue: VectorDirection.RIGHT },
};

/**
 * Box grid (NE/SE/SW/NW) - radial orientation
 */
const BOX_RADIAL_MAP: Record<string, ColorMap> = {
  [GridLocation.NORTHEAST]: { red: VectorDirection.DOWNRIGHT, blue: VectorDirection.UPLEFT },
  [GridLocation.SOUTHEAST]: { red: VectorDirection.UPRIGHT, blue: VectorDirection.DOWNLEFT },
  [GridLocation.SOUTHWEST]: { red: VectorDirection.DOWNRIGHT, blue: VectorDirection.UPLEFT },
  [GridLocation.NORTHWEST]: { red: VectorDirection.UPRIGHT, blue: VectorDirection.DOWNLEFT },
};

/**
 * Box grid (NE/SE/SW/NW) - non-radial orientation
 */
// CCW 90° rotation of BOX_RADIAL_MAP — non-radial staff lies perpendicular to
// the radial axis, so props nest along the radial axis.
const BOX_NON_RADIAL_MAP: Record<string, ColorMap> = {
  [GridLocation.NORTHEAST]: { red: VectorDirection.UPRIGHT, blue: VectorDirection.DOWNLEFT },
  [GridLocation.SOUTHEAST]: { red: VectorDirection.UPLEFT, blue: VectorDirection.DOWNRIGHT },
  [GridLocation.SOUTHWEST]: { red: VectorDirection.UPRIGHT, blue: VectorDirection.DOWNLEFT },
  [GridLocation.NORTHWEST]: { red: VectorDirection.UPLEFT, blue: VectorDirection.DOWNRIGHT },
};

/**
 * Shift motion transitions - radial orientation
 * Maps [startLocation][endLocation] -> direction
 */
const SHIFT_RADIAL_MAP: Record<string, Record<string, VectorDirection>> = {
  [GridLocation.EAST]: {
    [GridLocation.NORTH]: VectorDirection.RIGHT,
    [GridLocation.SOUTH]: VectorDirection.RIGHT,
  },
  [GridLocation.WEST]: {
    [GridLocation.NORTH]: VectorDirection.LEFT,
    [GridLocation.SOUTH]: VectorDirection.LEFT,
  },
  [GridLocation.NORTH]: {
    [GridLocation.EAST]: VectorDirection.UP,
    [GridLocation.WEST]: VectorDirection.UP,
  },
  [GridLocation.SOUTH]: {
    [GridLocation.EAST]: VectorDirection.DOWN,
    [GridLocation.WEST]: VectorDirection.DOWN,
  },
  [GridLocation.NORTHEAST]: {
    [GridLocation.NORTHWEST]: VectorDirection.UPRIGHT,
    [GridLocation.SOUTHEAST]: VectorDirection.UPRIGHT,
  },
  [GridLocation.SOUTHEAST]: {
    [GridLocation.NORTHEAST]: VectorDirection.DOWNRIGHT,
    [GridLocation.SOUTHWEST]: VectorDirection.DOWNRIGHT,
  },
  [GridLocation.SOUTHWEST]: {
    [GridLocation.NORTHWEST]: VectorDirection.DOWNLEFT,
    [GridLocation.SOUTHEAST]: VectorDirection.DOWNLEFT,
  },
  [GridLocation.NORTHWEST]: {
    [GridLocation.NORTHEAST]: VectorDirection.UPLEFT,
    [GridLocation.SOUTHWEST]: VectorDirection.UPLEFT,
  },
};

/**
 * Shift motion transitions - non-radial orientation
 */
const SHIFT_NON_RADIAL_MAP: Record<string, Record<string, VectorDirection>> = {
  [GridLocation.EAST]: {
    [GridLocation.NORTH]: VectorDirection.UP,
    [GridLocation.SOUTH]: VectorDirection.UP,
  },
  [GridLocation.WEST]: {
    [GridLocation.NORTH]: VectorDirection.DOWN,
    [GridLocation.SOUTH]: VectorDirection.DOWN,
  },
  [GridLocation.NORTH]: {
    [GridLocation.EAST]: VectorDirection.RIGHT,
    [GridLocation.WEST]: VectorDirection.RIGHT,
  },
  [GridLocation.SOUTH]: {
    [GridLocation.EAST]: VectorDirection.LEFT,
    [GridLocation.WEST]: VectorDirection.LEFT,
  },
  [GridLocation.NORTHEAST]: {
    [GridLocation.SOUTHEAST]: VectorDirection.UPLEFT,
    [GridLocation.NORTHWEST]: VectorDirection.DOWNRIGHT,
  },
  [GridLocation.SOUTHEAST]: {
    [GridLocation.NORTHEAST]: VectorDirection.DOWNLEFT,
    [GridLocation.SOUTHWEST]: VectorDirection.UPRIGHT,
  },
  [GridLocation.SOUTHWEST]: {
    [GridLocation.NORTHWEST]: VectorDirection.UPRIGHT,
    [GridLocation.SOUTHEAST]: VectorDirection.DOWNLEFT,
  },
  [GridLocation.NORTHWEST]: {
    [GridLocation.NORTHEAST]: VectorDirection.DOWNRIGHT,
    [GridLocation.SOUTHWEST]: VectorDirection.UPLEFT,
  },
};


/**
 * Opposite direction lookup table
 */
const OPPOSITE_DIRECTIONS: Record<VectorDirection, VectorDirection> = {
  [VectorDirection.UP]: VectorDirection.DOWN,
  [VectorDirection.DOWN]: VectorDirection.UP,
  [VectorDirection.LEFT]: VectorDirection.RIGHT,
  [VectorDirection.RIGHT]: VectorDirection.LEFT,
  [VectorDirection.UPRIGHT]: VectorDirection.DOWNLEFT,
  [VectorDirection.DOWNLEFT]: VectorDirection.UPRIGHT,
  [VectorDirection.UPLEFT]: VectorDirection.DOWNRIGHT,
  [VectorDirection.DOWNRIGHT]: VectorDirection.UPLEFT,
};

function getOppositeDirection(direction: VectorDirection): VectorDirection {
  return OPPOSITE_DIRECTIONS[direction];
}

/**
 * Check if orientation is radial (IN or OUT)
 */
function isRadialOrientation(orientation: string | undefined): boolean {
  if (!orientation) return true; // Default to radial if not specified
  const ori = orientation.toLowerCase();
  return ori === Orientation.IN || ori === Orientation.OUT ||
         ori === "in" || ori === "out";
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
 * Check if location is a cardinal (diamond) location
 */
function isCardinalLocation(location: string): boolean {
  const loc = location.toLowerCase();
  return loc === "n" || loc === "e" || loc === "s" || loc === "w";
}

/**
 * Convert direction to pixel offset
 */
function directionToOffset(direction: VectorDirection, gridMode: GridMode): { x: number; y: number } {
  const distance = gridMode === GridMode.BOX ? BETA_OFFSET_DISTANCE_BOX : BETA_OFFSET_DISTANCE_DIAMOND;

  switch (direction) {
    case VectorDirection.UP:
      return { x: 0, y: -distance };
    case VectorDirection.DOWN:
      return { x: 0, y: distance };
    case VectorDirection.LEFT:
      return { x: -distance, y: 0 };
    case VectorDirection.RIGHT:
      return { x: distance, y: 0 };
    case VectorDirection.UPRIGHT:
      return { x: distance, y: -distance };
    case VectorDirection.DOWNRIGHT:
      return { x: distance, y: distance };
    case VectorDirection.UPLEFT:
      return { x: -distance, y: -distance };
    case VectorDirection.DOWNLEFT:
      return { x: -distance, y: distance };
    default:
      return { x: 0, y: 0 };
  }
}

/**
 * Normalize location to lowercase enum value
 */
function normalizeLocation(loc: string): string {
  return loc.toLowerCase();
}


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
  const blueEndLoc = normalizeLocation(blueMotion.endLocation);
  const redEndLoc = normalizeLocation(redMotion.endLocation);

  if (blueEndLoc !== redEndLoc) {
    // Props don't overlap, no offset needed
    return { x: 0, y: 0 };
  }

  // SPECIAL CASE: Hand props always use "right hand on right, left hand on left"
  // This matches the behavior in PropPlacer.ts (lines 129-197)
  const bothAreHands = blueMotion.propType === "hand" && redMotion.propType === "hand";
  if (bothAreHands) {
    const distance = gridMode === GridMode.BOX
      ? HAND_BETA_OFFSET_DISTANCE_BOX
      : HAND_BETA_OFFSET_DISTANCE_DIAMOND;

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
  const location = normalizeLocation(targetMotion.endLocation);
  const color = targetMotion.color;

  // Check for letter-specific handling (Y/Z have special logic)
  if (letter === "Y" || letter === "Z" || letter === "Y-" || letter === "Z-") {
    // Y/Z letters: shift motion gets calculated direction, non-shift gets OPPOSITE
    return calculateYZBetaOffset(input, targetMotion, isRadial, gridMode);
  }

  // Check if this is a shift motion (PRO/ANTI/FLOAT)
  if (isShiftMotion(targetMotion.motionType)) {
    // Letter G/H have special handling
    if (letter === "G" || letter === "H") {
      return calculateShiftBetaOffset(targetMotion, isRadial, gridMode);
    }
    // Letter I has its own maps but we'll use shift maps
    if (letter === "I") {
      return calculateShiftBetaOffset(targetMotion, isRadial, gridMode);
    }
    return calculateShiftBetaOffset(targetMotion, isRadial, gridMode);
  }

  // Static or Dash motion - use location-based maps
  return calculateStaticDashBetaOffset(location, color, isRadial, gridMode);
}

/**
 * Calculate beta offset for static/dash motions
 */
function calculateStaticDashBetaOffset(
  location: string,
  color: "blue" | "red",
  isRadial: boolean,
  gridMode: GridMode
): { x: number; y: number } {
  // Determine if this is a cardinal (diamond) or intercardinal (box) location
  const isDiamond = isCardinalLocation(location);

  // Select the appropriate direction map
  let map: Record<string, ColorMap>;
  if (isDiamond) {
    map = isRadial ? DIAMOND_RADIAL_MAP : DIAMOND_NON_RADIAL_MAP;
  } else {
    map = isRadial ? BOX_RADIAL_MAP : BOX_NON_RADIAL_MAP;
  }

  // Look up the direction for this location and color
  const locationMap = map[location];
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
  const startLoc = normalizeLocation(motion.startLocation);
  const endLoc = normalizeLocation(motion.endLocation);

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
    const location = normalizeLocation(targetMotion.endLocation);
    return calculateStaticDashBetaOffset(location, targetMotion.color, isRadial, gridMode);
  }

  // Calculate direction from the SHIFT motion (not the target motion)
  const startLoc = normalizeLocation(shiftMotion.startLocation);
  const endLoc = normalizeLocation(shiftMotion.endLocation);
  const map = isRadial ? SHIFT_RADIAL_MAP : SHIFT_NON_RADIAL_MAP;

  const startMap = map[startLoc];
  if (!startMap) {
    // Fall back
    const location = normalizeLocation(targetMotion.endLocation);
    return calculateStaticDashBetaOffset(location, targetMotion.color, isRadial, gridMode);
  }

  const shiftDirection = startMap[endLoc];
  if (!shiftDirection) {
    // Fall back
    const location = normalizeLocation(targetMotion.endLocation);
    return calculateStaticDashBetaOffset(location, targetMotion.color, isRadial, gridMode);
  }

  // If target is the shift motion, use the calculated direction
  // If target is the non-shift motion, use the OPPOSITE direction
  const isTargetShiftMotion = targetMotion.color === shiftMotion.color;
  const direction = isTargetShiftMotion
    ? shiftDirection
    : getOppositeDirection(shiftDirection);

  return directionToOffset(direction, gridMode);
}
