/**
 * Beta offset calculator
 *
 * When two props end at the same location (a "beta" position),
 * they need to be offset from each other so they don't overlap.
 *
 * This implements the EXACT gate sequence from PropPlacer.calculateBetaOffset()
 * (lines 130-376) and BetaPropDirectionCalculator for direction routing.
 */

import type { GridLocation, GridMode, VectorDirection } from "../types.js";
import { isCardinal } from "../types.js";
import {
  DIAMOND_RADIAL_MAP,
  DIAMOND_NON_RADIAL_MAP,
  BOX_RADIAL_MAP,
  BOX_NON_RADIAL_MAP,
  SHIFT_RADIAL_MAP,
  SHIFT_NON_RADIAL_MAP,
  LETTER_I_RADIAL_MAP,
  LETTER_I_NON_RADIAL_MAP,
  OPPOSITE_DIRECTIONS,
} from "../constants/direction-maps.js";
import {
  getBetaOffsetSize,
  isUnilateralProp,
  isBuugengFamilyProp,
} from "../constants/prop-classification.js";

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
  /** Prop type override from user settings (e.g. user renders "staff" data as "buugeng") */
  bluePropType?: string;
  /** Prop type override from user settings */
  redPropType?: string;
  /** Whether the blue buugeng prop is flipped (chirality) */
  blueBuugengFlipped?: boolean;
  /** Whether the red buugeng prop is flipped (chirality) */
  redBuugengFlipped?: boolean;
}

// ============================================================================
// ORIENTATION HELPERS
// ============================================================================

const RADIAL_ORIENTATIONS = ["in", "out"];
const NON_RADIAL_ORIENTATIONS = ["clock", "counter"];

function isRadialOrientation(ori: string | undefined): boolean {
  if (!ori) return false;
  return RADIAL_ORIENTATIONS.includes(ori.toLowerCase());
}

function isNonRadialOrientation(ori: string | undefined): boolean {
  if (!ori) return false;
  return NON_RADIAL_ORIENTATIONS.includes(ori.toLowerCase());
}

/**
 * Replicate the app's OrientationChecker.isRadial() for direction map selection.
 *
 * TODO: Known parity requirement — this logic is ASYMMETRIC in the app.
 * The app checks: (red is IN|OUT AND blue is IN) OR (blue is OUT regardless of red).
 * The symmetric version would be: both are IN|OUT. We replicate the asymmetric
 * version here for exact parity with the app's rendering.
 */
function isRadialForMapSelection(
  blueEndOri: string | undefined,
  redEndOri: string | undefined
): boolean {
  const redNorm = redEndOri?.toLowerCase();
  const blueNorm = blueEndOri?.toLowerCase();

  const redIsInOrOut = redNorm === "in" || redNorm === "out";
  const blueIsIn = blueNorm === "in";
  const blueIsOut = blueNorm === "out";

  return (redIsInOrOut && blueIsIn) || blueIsOut;
}

// ============================================================================
// MOTION TYPE HELPERS
// ============================================================================

function isShiftMotion(motionType: string): boolean {
  const type = motionType.toLowerCase();
  return type === "pro" || type === "anti" || type === "float";
}

// ============================================================================
// DIRECTION RESOLUTION HELPERS
// ============================================================================

function directionToOffset(
  direction: VectorDirection,
  distance: number
): { x: number; y: number } {
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

function getOppositeDirection(direction: VectorDirection): VectorDirection {
  return OPPOSITE_DIRECTIONS[direction];
}

// ============================================================================
// DIRECTION CALCULATION (mirrors BetaPropDirectionCalculator)
// ============================================================================

/**
 * Static/Dash handler: look up direction from DIAMOND/BOX × RADIAL/NON_RADIAL maps
 * by location and color. Uses isCardinal(location) to choose diamond vs box map.
 */
function getStaticDashDirection(
  endLocation: string,
  color: "blue" | "red",
  isRadial: boolean
): VectorDirection | null {
  const loc = endLocation.toLowerCase() as GridLocation;
  const isDiamond = isCardinal(loc);

  let map: Record<GridLocation, Record<"blue" | "red", VectorDirection>>;
  if (isDiamond) {
    map = isRadial ? DIAMOND_RADIAL_MAP : DIAMOND_NON_RADIAL_MAP;
  } else {
    map = isRadial ? BOX_RADIAL_MAP : BOX_NON_RADIAL_MAP;
  }

  const locationMap = map[loc];
  if (!locationMap) return null;
  return locationMap[color] ?? null;
}

/**
 * Shift handler: look up from SHIFT_RADIAL/NON_RADIAL maps by [startLocation][endLocation].
 * Falls back to static/dash if lookup fails.
 */
function getShiftDirection(
  startLocation: string,
  endLocation: string,
  color: "blue" | "red",
  isRadial: boolean
): VectorDirection | null {
  const startLoc = startLocation.toLowerCase() as GridLocation;
  const endLoc = endLocation.toLowerCase() as GridLocation;

  const map = isRadial ? SHIFT_RADIAL_MAP : SHIFT_NON_RADIAL_MAP;
  const startMap = map[startLoc];
  if (!startMap) {
    return getStaticDashDirection(endLoc, color, isRadial);
  }

  const direction = startMap[endLoc];
  if (!direction) {
    return getStaticDashDirection(endLoc, color, isRadial);
  }

  return direction;
}

/**
 * Letter I handler: look up from LETTER_I_RADIAL/NON_RADIAL maps by location and color.
 */
function getLetterIDirection(
  endLocation: string,
  color: "blue" | "red",
  isRadial: boolean
): VectorDirection | null {
  const loc = endLocation.toLowerCase() as GridLocation;
  const map = isRadial ? LETTER_I_RADIAL_MAP : LETTER_I_NON_RADIAL_MAP;
  const locationMap = map[loc];
  if (!locationMap) return null;
  return locationMap[color] ?? null;
}

/**
 * G/H handler: look up from static/dash maps (DIAMOND/BOX) using endLocation.
 * Red gets the base direction. Blue gets the OPPOSITE direction.
 * SPECIAL: At south location, always use RIGHT as red's base direction.
 */
function getLetterGHDirection(
  endLocation: string,
  color: "blue" | "red",
  isRadial: boolean
): VectorDirection | null {
  const loc = endLocation.toLowerCase();

  // Special case: south always returns RIGHT as base
  if (loc === "s") {
    const baseDirection: VectorDirection = "right";
    return color === "red" ? baseDirection : getOppositeDirection(baseDirection);
  }

  // Determine map based on cardinal vs intercardinal
  const isBox = !isCardinal(loc);

  let map: Record<GridLocation, Record<"blue" | "red", VectorDirection>>;
  if (isBox) {
    map = isRadial ? BOX_RADIAL_MAP : BOX_NON_RADIAL_MAP;
  } else {
    map = isRadial ? DIAMOND_RADIAL_MAP : DIAMOND_NON_RADIAL_MAP;
  }

  const locationMap = map[loc as GridLocation];
  if (!locationMap) return null;

  // Red gets the base direction from the map
  const baseDirection = locationMap["red"];
  if (!baseDirection) return null;

  // Red gets base, blue gets opposite
  return color === "red" ? baseDirection : getOppositeDirection(baseDirection);
}

/**
 * Y/Z handler: identify which motion is shift vs non-shift.
 * Calculate direction from the SHIFT motion using shift maps.
 * If target IS the shift motion → use that direction.
 * If target is NOT the shift motion → use OPPOSITE direction.
 */
function getLetterYZDirection(
  blueMotion: BetaMotionInput,
  redMotion: BetaMotionInput,
  targetMotion: BetaMotionInput,
  isRadial: boolean
): VectorDirection | null {
  // Identify shift vs non-shift
  const redIsShift = isShiftMotion(redMotion.motionType);
  const blueIsShift = isShiftMotion(blueMotion.motionType);

  const shiftMotion = redIsShift ? redMotion : blueIsShift ? blueMotion : null;
  if (!shiftMotion) return null;

  // Identify non-shift motion (static first, then dash)
  const findNonShift = (): BetaMotionInput | null => {
    const redType = redMotion.motionType.toLowerCase();
    const blueType = blueMotion.motionType.toLowerCase();
    if (redType === "static") return redMotion;
    if (blueType === "static") return blueMotion;
    if (redType === "dash") return redMotion;
    if (blueType === "dash") return blueMotion;
    return null;
  };

  const nonShiftMotion = findNonShift();
  if (!nonShiftMotion) return null;

  // Calculate direction from the shift motion
  const shiftDirection = getShiftDirection(
    shiftMotion.startLocation,
    shiftMotion.endLocation,
    shiftMotion.color,
    isRadial
  );
  if (!shiftDirection) return null;

  // Target is the shift motion → use direction; otherwise → opposite
  const isTargetShift = targetMotion.color === shiftMotion.color;
  return isTargetShift ? shiftDirection : getOppositeDirection(shiftDirection);
}

/**
 * Route to the correct direction handler based on letter and motion type.
 * Exact routing order from BetaPropDirectionCalculator.getDirectionForMotionData().
 */
function calculateDirection(
  input: BetaOffsetInput,
  targetMotion: BetaMotionInput,
  isRadial: boolean
): VectorDirection | null {
  const { blueMotion, redMotion, letter } = input;

  // 1. Is letter Y, Z, Y-, or Z-?
  if (letter === "Y" || letter === "Z" || letter === "Y-" || letter === "Z-") {
    return getLetterYZDirection(blueMotion, redMotion, targetMotion, isRadial);
  }

  // 2. Is target motion a shift (pro/anti/float)?
  if (isShiftMotion(targetMotion.motionType)) {
    // 2a. Is letter G or H (NOT G- or H-)?
    if (letter === "G" || letter === "H") {
      return getLetterGHDirection(targetMotion.endLocation, targetMotion.color, isRadial);
    }
    // 2b. Is letter I (NOT I-)?
    if (letter === "I") {
      return getLetterIDirection(targetMotion.endLocation, targetMotion.color, isRadial);
    }
    // 2c. Both-shift pairing: when BOTH motions are shift (e.g. letter J),
    // the shift maps give independent perpendicular directions that may not oppose.
    // Fix: compute blue's direction from its shift path, red gets the opposite.
    const otherMotion = targetMotion.color === "blue" ? redMotion : blueMotion;
    if (isShiftMotion(otherMotion.motionType)) {
      const blueDirection = getShiftDirection(
        blueMotion.startLocation,
        blueMotion.endLocation,
        "blue",
        isRadial
      );
      if (!blueDirection) return null;
      return targetMotion.color === "blue"
        ? blueDirection
        : getOppositeDirection(blueDirection);
    }
    // 2d. Generic shift handler (only one motion is shift)
    return getShiftDirection(
      targetMotion.startLocation,
      targetMotion.endLocation,
      targetMotion.color,
      isRadial
    );
  }

  // 3. Static or dash → static/dash handler
  return getStaticDashDirection(targetMotion.endLocation, targetMotion.color, isRadial);
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

/**
 * Calculate beta offset for a single motion.
 * Returns { x, y } pixel offset to apply to prop position.
 *
 * Implements the exact gate sequence from PropPlacer.calculateBetaOffset()
 * (lines 130-376 of the app's PropPlacer.ts).
 */
export function calculateBetaOffset(
  input: BetaOffsetInput,
  targetMotion: BetaMotionInput
): { x: number; y: number } {
  const { blueMotion, redMotion, gridMode } = input;

  // ========================================================================
  // Gate 1: Same location check
  // If blue and red don't end at same location → return {0,0}
  // ========================================================================
  const blueEndLoc = blueMotion.endLocation.toLowerCase();
  const redEndLoc = redMotion.endLocation.toLowerCase();

  if (blueEndLoc !== redEndLoc) {
    return { x: 0, y: 0 };
  }

  // ========================================================================
  // Resolve actual prop types (settings override stored motionData.propType)
  // A user may have "staff" stored in data but render as "buugeng" via settings.
  // Hand prop type is never overridden — if stored as hand, it stays hand.
  // ========================================================================
  const blueIsHand = blueMotion.propType === "hand";
  const redIsHand = redMotion.propType === "hand";
  const actualBluePropType = blueIsHand
    ? "hand"
    : (input.bluePropType ?? blueMotion.propType ?? "staff");
  const actualRedPropType = redIsHand
    ? "hand"
    : (input.redPropType ?? redMotion.propType ?? "staff");

  // ========================================================================
  // Gate 2: Hand prop special case (PropPlacer lines 154-222)
  // When both props are hands, use direction-aware positioning.
  // ========================================================================
  const bothAreHands = actualBluePropType === "hand" && actualRedPropType === "hand";

  if (bothAreHands) {
    const distance = getBetaOffsetSize("hand", gridMode);

    const eastPositions = ["e", "ne", "se"];
    const westPositions = ["w", "nw", "sw"];

    const blueStartLoc = blueMotion.startLocation.toLowerCase();
    const redStartLoc = redMotion.startLocation.toLowerCase();

    const blueFromEast = eastPositions.includes(blueStartLoc);
    const blueFromWest = westPositions.includes(blueStartLoc);
    const redFromEast = eastPositions.includes(redStartLoc);
    const redFromWest = westPositions.includes(redStartLoc);

    if (blueFromEast && redFromWest) {
      // Blue approaching from east → RIGHT, red from west → LEFT
      return targetMotion.color === "blue"
        ? { x: distance, y: 0 }
        : { x: -distance, y: 0 };
    } else if (blueFromWest && redFromEast) {
      // Blue approaching from west → LEFT, red from east → RIGHT
      return targetMotion.color === "blue"
        ? { x: -distance, y: 0 }
        : { x: distance, y: 0 };
    } else {
      // Default: blue LEFT, red RIGHT
      return targetMotion.color === "blue"
        ? { x: -distance, y: 0 }
        : { x: distance, y: 0 };
    }
  }

  // ========================================================================
  // Gate 3: Hybrid orientation skip (PropPlacer lines 231-250)
  // Check each prop's end orientation independently.
  // If one is radial and one is nonRadial → return {0,0}.
  // This check is SYMMETRIC (unlike OrientationChecker used later for maps).
  // ========================================================================
  const blueEndOri = blueMotion.endOrientation;
  const redEndOri = redMotion.endOrientation;

  const blueIsRadial = isRadialOrientation(blueEndOri);
  const redIsRadial = isRadialOrientation(redEndOri);
  const blueIsNonRadial = isNonRadialOrientation(blueEndOri);
  const redIsNonRadial = isNonRadialOrientation(redEndOri);

  const hybridOrientation =
    (redIsRadial && blueIsNonRadial) || (redIsNonRadial && blueIsRadial);

  if (hybridOrientation) {
    return { x: 0, y: 0 };
  }

  // Pre-compute orientation relationships for gates 4-6
  const bothRadial = redIsRadial && blueIsRadial;
  const bothNonRadial = redIsNonRadial && blueIsNonRadial;
  const sameTypeButDifferentOrientation =
    (bothRadial && redEndOri?.toLowerCase() !== blueEndOri?.toLowerCase()) ||
    (bothNonRadial && redEndOri?.toLowerCase() !== blueEndOri?.toLowerCase());

  // ========================================================================
  // Gate 4: Buugeng family nesting (PropPlacer lines 274-290)
  // If both props are buugeng family AND have opposite chirality → return {0,0}
  // ========================================================================
  const bothAreBuugengFamily =
    isBuugengFamilyProp(actualBluePropType) &&
    isBuugengFamilyProp(actualRedPropType);

  if (bothAreBuugengFamily) {
    const blueChirality = input.blueBuugengFlipped ?? false;
    const redChirality = input.redBuugengFlipped ?? false;
    const oppositeChirality = blueChirality !== redChirality; // XOR

    if (oppositeChirality) {
      return { x: 0, y: 0 };
    }
  }

  // ========================================================================
  // Gate 5: Unilateral prop skip (PropPlacer lines 292-303)
  // Same orientation TYPE but different specific orientations AND unilateral
  // → return {0,0}
  // ========================================================================
  const actualPropType =
    targetMotion.color === "blue" ? actualBluePropType : actualRedPropType;

  if (sameTypeButDifferentOrientation && isUnilateralProp(actualPropType)) {
    return { x: 0, y: 0 };
  }

  // ========================================================================
  // Gate 6: Trigeng skip (PropPlacer lines 308-310)
  // Same type different orientation AND prop type is "trigeng" → return {0,0}
  // ========================================================================
  if (sameTypeButDifferentOrientation && actualPropType === "trigeng") {
    return { x: 0, y: 0 };
  }

  // ========================================================================
  // Direction Calculation (BetaPropDirectionCalculator)
  // Uses the ASYMMETRIC OrientationChecker for map selection (known parity bug).
  // ========================================================================
  const isRadial = isRadialForMapSelection(blueEndOri, redEndOri);
  const direction = calculateDirection(input, targetMotion, isRadial);

  if (!direction) {
    return { x: 0, y: 0 };
  }

  // ========================================================================
  // Final Step: Convert direction to offset using prop-type-specific distance
  // ========================================================================
  const distance = getBetaOffsetSize(actualPropType, gridMode);
  return directionToOffset(direction, distance);
}
