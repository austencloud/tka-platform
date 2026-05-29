/**
 * Start Position Transforms
 *
 * Pure functions that transform StartPositionData objects.
 * Similar to beat transforms but without beat-specific fields.
 *
 * Supports targetHand parameter to transform only specific hand(s):
 * - "blue": Only transform blue motion
 * - "red": Only transform red motion
 * - "both": Transform both motions (default, original behavior)
 */

import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import { createStartPositionData } from "$lib/shared/create/factories/createStartPositionData";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { calculateEndOrientation } from "$lib/shared/pictograph/prop/services/orientation-calculator";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import {
  VERTICAL_MIRROR_POSITION_MAP,
  HORIZONTAL_MIRROR_POSITION_MAP,
  SWAPPED_POSITION_MAP,
} from "$lib/shared/create/domain/strict-loop-position-maps";
import {
  mirrorMotion,
  flipMotion,
  rotateMotion,
  swapMotionColor,
} from "$lib/shared/create/services/motion-transforms";
import { invertMotionType, reverseRotationDirection } from "$lib/shared/create/services/rotation-helpers";
import type { TargetHand } from "$lib/shared/create/state/panel-coordination-state.svelte";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";

/**
 * Derive the static letter (α, β, γ) from a grid position.
 * Start positions always have static letters based on location.
 */
function deriveLetterFromGridPosition(
  position: GridPosition | null | undefined
): Letter {
  if (!position) return Letter.ALPHA;
  const positionStr = position.toString().toLowerCase();
  if (positionStr.startsWith("beta")) return Letter.BETA;
  if (positionStr.startsWith("gamma")) return Letter.GAMMA;
  return Letter.ALPHA;
}

/**
 * Derive grid position from motion locations.
 * Used after single-hand transforms to find the new combined position.
 */
function deriveGridPositionFromMotions(
  startPos: StartPositionData
): GridPosition | null {
  const blueMotion = startPos.motions[MotionColor.BLUE];
  const redMotion = startPos.motions[MotionColor.RED];

  if (blueMotion && redMotion) {
    return getGridPositionFromLocations(
      blueMotion.startLocation,
      redMotion.startLocation
    );
  }
  return startPos.gridPosition ?? null;
}

/**
 * Mirror a start position across the vertical axis (E ↔ W).
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export function mirrorStartPosition(
  startPos: StartPositionData,
  targetHand: TargetHand = "both"
): StartPositionData {
  const mirroredMotions = { ...startPos.motions };
  const blueMotion = startPos.motions[MotionColor.BLUE];
  const redMotion = startPos.motions[MotionColor.RED];

  // Transform specified hand(s)
  if ((targetHand === "blue" || targetHand === "both") && blueMotion) {
    mirroredMotions[MotionColor.BLUE] = mirrorMotion(blueMotion);
  }
  if ((targetHand === "red" || targetHand === "both") && redMotion) {
    mirroredMotions[MotionColor.RED] = mirrorMotion(redMotion);
  }

  // For single-hand transforms, derive new grid position from motion locations
  // For "both", use the lookup table
  let newGridPosition: GridPosition | null;
  if (targetHand === "both") {
    newGridPosition = startPos.gridPosition
      ? VERTICAL_MIRROR_POSITION_MAP[startPos.gridPosition]
      : null;
  } else {
    const tempStartPos = createStartPositionData({ ...startPos, motions: mirroredMotions });
    newGridPosition = deriveGridPositionFromMotions(tempStartPos);
  }

  // Derive letter from new grid position
  const newLetter = deriveLetterFromGridPosition(newGridPosition);

  return createStartPositionData({
    ...startPos,
    motions: mirroredMotions,
    gridPosition: newGridPosition,
    startPosition: newGridPosition,
    letter: newLetter,
  });
}

/**
 * Flip a start position across the horizontal axis (N ↔ S).
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export function flipStartPosition(
  startPos: StartPositionData,
  targetHand: TargetHand = "both"
): StartPositionData {
  const flippedMotions = { ...startPos.motions };
  const blueMotion = startPos.motions[MotionColor.BLUE];
  const redMotion = startPos.motions[MotionColor.RED];

  // Transform specified hand(s)
  if ((targetHand === "blue" || targetHand === "both") && blueMotion) {
    flippedMotions[MotionColor.BLUE] = flipMotion(blueMotion);
  }
  if ((targetHand === "red" || targetHand === "both") && redMotion) {
    flippedMotions[MotionColor.RED] = flipMotion(redMotion);
  }

  // For single-hand transforms, derive new grid position from motion locations
  // For "both", use the lookup table
  let newGridPosition: GridPosition | null;
  if (targetHand === "both") {
    newGridPosition = startPos.gridPosition
      ? HORIZONTAL_MIRROR_POSITION_MAP[startPos.gridPosition]
      : null;
  } else {
    const tempStartPos = createStartPositionData({ ...startPos, motions: flippedMotions });
    newGridPosition = deriveGridPositionFromMotions(tempStartPos);
  }

  // Derive letter from new grid position
  const newLetter = deriveLetterFromGridPosition(newGridPosition);

  return createStartPositionData({
    ...startPos,
    motions: flippedMotions,
    gridPosition: newGridPosition,
    startPosition: newGridPosition,
    letter: newLetter,
  });
}

/**
 * Rotate a start position by 45° steps.
 * Derives new gridPosition from rotated motion locations.
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export function rotateStartPosition(
  startPos: StartPositionData,
  rotationAmount: number,
  targetHand: TargetHand = "both"
): StartPositionData {
  const rotatedMotions = { ...startPos.motions };
  const origBlueMotion = startPos.motions[MotionColor.BLUE];
  const origRedMotion = startPos.motions[MotionColor.RED];

  // Transform specified hand(s)
  if ((targetHand === "blue" || targetHand === "both") && origBlueMotion) {
    rotatedMotions[MotionColor.BLUE] = rotateMotion(
      origBlueMotion,
      rotationAmount
    );
  }
  if ((targetHand === "red" || targetHand === "both") && origRedMotion) {
    rotatedMotions[MotionColor.RED] = rotateMotion(
      origRedMotion,
      rotationAmount
    );
  }

  // Derive new gridPosition from rotated motion locations
  // This correctly handles the DIAMOND ↔ BOX mode transitions
  let rotatedGridPosition: GridPosition | null = startPos.gridPosition ?? null;
  const blueMotion = rotatedMotions[MotionColor.BLUE];
  const redMotion = rotatedMotions[MotionColor.RED];

  if (blueMotion && redMotion) {
    rotatedGridPosition = getGridPositionFromLocations(
      blueMotion.startLocation,
      redMotion.startLocation
    );
  }

  // Derive letter from new grid position
  const newLetter = deriveLetterFromGridPosition(rotatedGridPosition);

  return createStartPositionData({
    ...startPos,
    motions: rotatedMotions,
    gridPosition: rotatedGridPosition,
    startPosition: rotatedGridPosition,
    letter: newLetter,
  });
}

/**
 * Swap colors in a start position (blue ↔ red).
 */
export function colorSwapStartPosition(
  startPos: StartPositionData
): StartPositionData {
  const origBlue = startPos.motions[MotionColor.BLUE];
  const origRed = startPos.motions[MotionColor.RED];
  const swappedMotions = {
    [MotionColor.BLUE]: origRed
      ? swapMotionColor(origRed, MotionColor.BLUE)
      : undefined,
    [MotionColor.RED]: origBlue
      ? swapMotionColor(origBlue, MotionColor.RED)
      : undefined,
  };

  const newGridPosition = startPos.gridPosition
      ? SWAPPED_POSITION_MAP[startPos.gridPosition]
      : null;

  return createStartPositionData({
    ...startPos,
    motions: swappedMotions,
    gridPosition: newGridPosition,
    startPosition: newGridPosition,
  });
}

/**
 * Invert a start position's motion types and rotation directions.
 * Recalculates endOrientation based on the new motion.
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 */
export function invertStartPosition(
  startPos: StartPositionData,
  targetHand: TargetHand = "both"
): StartPositionData {
  const invertedMotions = { ...startPos.motions };
  const startBlueMotion = startPos.motions[MotionColor.BLUE];
  const startRedMotion = startPos.motions[MotionColor.RED];

  // Transform specified hand(s)
  if ((targetHand === "blue" || targetHand === "both") && startBlueMotion) {
    const blueMotion = startBlueMotion;
    const invertedBlueMotion = createMotionData({
      ...blueMotion,
      motionType: invertMotionType(blueMotion.motionType),
      rotationDirection: reverseRotationDirection(blueMotion.rotationDirection),
    });
    const newEndOrientation = calculateEndOrientation(
      invertedBlueMotion,
      MotionColor.BLUE
    );
    invertedMotions[MotionColor.BLUE] = {
      ...invertedBlueMotion,
      endOrientation: newEndOrientation,
    };
  }

  if ((targetHand === "red" || targetHand === "both") && startRedMotion) {
    const redMotion = startRedMotion;
    const invertedRedMotion = createMotionData({
      ...redMotion,
      motionType: invertMotionType(redMotion.motionType),
      rotationDirection: reverseRotationDirection(redMotion.rotationDirection),
    });
    const newEndOrientation = calculateEndOrientation(
      invertedRedMotion,
      MotionColor.RED
    );
    invertedMotions[MotionColor.RED] = {
      ...invertedRedMotion,
      endOrientation: newEndOrientation,
    };
  }

  const newGridPosition: GridPosition | null = startPos.gridPosition ?? null;

  // Derive letter from grid position
  const newLetter = deriveLetterFromGridPosition(newGridPosition);

  return createStartPositionData({
    ...startPos,
    motions: invertedMotions,
    gridPosition: newGridPosition,
    startPosition: newGridPosition,
    letter: newLetter,
  });
}
