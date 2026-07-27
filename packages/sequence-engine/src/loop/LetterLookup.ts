/**
 * Letter Lookup for LOOP Execution
 *
 * Given motion parameters (type, rotation direction, start/end locations),
 * finds the corresponding TKA letter by searching the pictograph data.
 *
 * This is needed for LOOP execution because when you reverse motions,
 * the resulting letter may be different from the original. For example,
 * reversing E's motions produces K (they are inverses of each other).
 */

interface MotionData {
  color?: string;
  startLocation: string;
  endLocation: string;
  motionType: string;
  rotationDirection: string;
  startOrientation?: string;
  endOrientation?: string;
  prefloatMotionType?: string;
  prefloatRotationDirection?: string;
}

interface PictographData {
  letter: string;
  startPosition: string;
  endPosition: string;
  timing: string;
  direction: string;
  blueMotion: MotionData;
  redMotion: MotionData;
}

/**
 * Find the TKA letter that matches the given blue and red motion parameters.
 * @param blueMotion - Blue motion data (type, locations, rotation)
 * @param redMotion - Red motion data (type, locations, rotation)
 * @param allPictographs - All available pictograph data to search
 * @returns The matching letter, or null if no match found
 */
export function findLetterByMotions(
  blueMotion: MotionData,
  redMotion: MotionData,
  allPictographs: PictographData[]
): string | null {
  // Normalize inputs to lowercase for matching
  const blueType = (
    blueMotion.motionType === "float"
      ? (blueMotion.prefloatMotionType ?? blueMotion.motionType)
      : blueMotion.motionType
  ).toLowerCase();
  const blueStart = blueMotion.startLocation.toLowerCase();
  const blueEnd = blueMotion.endLocation.toLowerCase();
  const blueRot = (
    blueMotion.motionType === "float"
      ? (blueMotion.prefloatRotationDirection ?? blueMotion.rotationDirection)
      : blueMotion.rotationDirection
  ).toLowerCase();

  const redType = (
    redMotion.motionType === "float"
      ? (redMotion.prefloatMotionType ?? redMotion.motionType)
      : redMotion.motionType
  ).toLowerCase();
  const redStart = redMotion.startLocation.toLowerCase();
  const redEnd = redMotion.endLocation.toLowerCase();
  const redRot = (
    redMotion.motionType === "float"
      ? (redMotion.prefloatRotationDirection ?? redMotion.rotationDirection)
      : redMotion.rotationDirection
  ).toLowerCase();

  // For static and dash motions, rotation direction doesn't matter
  // because the generator applies turns which changes rotation
  const blueIgnoreRotation = blueType === "static" || blueType === "dash";
  const redIgnoreRotation = redType === "static" || redType === "dash";

  for (const pictograph of allPictographs) {
    const pBlue = pictograph.blueMotion;
    const pRed = pictograph.redMotion;

    // Check blue motion matches
    const blueTypeMatches = pBlue.motionType.toLowerCase() === blueType;
    const blueStartMatches = pBlue.startLocation.toLowerCase() === blueStart;
    const blueEndMatches = pBlue.endLocation.toLowerCase() === blueEnd;
    const blueRotMatches =
      blueIgnoreRotation || pBlue.rotationDirection.toLowerCase() === blueRot;

    // Check red motion matches
    const redTypeMatches = pRed.motionType.toLowerCase() === redType;
    const redStartMatches = pRed.startLocation.toLowerCase() === redStart;
    const redEndMatches = pRed.endLocation.toLowerCase() === redEnd;
    const redRotMatches =
      redIgnoreRotation || pRed.rotationDirection.toLowerCase() === redRot;

    if (
      blueTypeMatches &&
      blueStartMatches &&
      blueEndMatches &&
      blueRotMatches &&
      redTypeMatches &&
      redStartMatches &&
      redEndMatches &&
      redRotMatches
    ) {
      return pictograph.letter;
    }
  }

  // No exact match found - try with relaxed rotation matching
  // This handles cases where turns have been applied
  for (const pictograph of allPictographs) {
    const pBlue = pictograph.blueMotion;
    const pRed = pictograph.redMotion;

    const blueTypeMatches = pBlue.motionType.toLowerCase() === blueType;
    const blueStartMatches = pBlue.startLocation.toLowerCase() === blueStart;
    const blueEndMatches = pBlue.endLocation.toLowerCase() === blueEnd;

    const redTypeMatches = pRed.motionType.toLowerCase() === redType;
    const redStartMatches = pRed.startLocation.toLowerCase() === redStart;
    const redEndMatches = pRed.endLocation.toLowerCase() === redEnd;

    if (
      blueTypeMatches &&
      blueStartMatches &&
      blueEndMatches &&
      redTypeMatches &&
      redStartMatches &&
      redEndMatches
    ) {
      return pictograph.letter;
    }
  }

  return null;
}

/**
 * CW becomes CCW, CCW becomes CW.
 * Static/dash/noRotation stay unchanged.
 */
export function getInverseRotation(rotation: string): string {
  const normalized = rotation.toLowerCase();
  if (normalized === "cw") return "ccw";
  if (normalized === "ccw") return "cw";
  return rotation;
}
