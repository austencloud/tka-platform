/**
 * Start Position Transforms
 *
 * Pure functions that transform StartPositionData objects.
 * Similar to beat transforms but without beat-specific fields.
 *
 * Supports targetHand parameter to transform only specific hand(s):
 * - "left": Only transform left motion
 * - "right": Only transform right motion
 * - "both": Transform both motions (default, original behavior)
 */

import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import { createStartPositionData } from "$lib/shared/create/factories/create-start-position-data";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { HandSide } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
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
  reassignMotionHand,
} from "$lib/shared/create/services/motion-transforms";
import {
  invertMotionType,
  reverseRotationDirection,
} from "$lib/shared/create/services/rotation-helpers";
import type { TargetHand } from "$lib/shared/create/state/panel-coordination-state.svelte";
import { Letter } from "$lib/shared/foundation/domain/models/letter";

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
  const leftMotion = startPos.motions[HandSide.LEFT];
  const rightMotion = startPos.motions[HandSide.RIGHT];

  // Invisible placeholder = hand not really there (both-required Step shape).
  if (isVisibleMotion(leftMotion) && isVisibleMotion(rightMotion)) {
    return getGridPositionFromLocations(
      leftMotion.startLocation,
      rightMotion.startLocation
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
  const leftMotion = startPos.motions[HandSide.LEFT];
  const rightMotion = startPos.motions[HandSide.RIGHT];

  // Transform specified hand(s)
  if ((targetHand === "left" || targetHand === "both") && leftMotion) {
    mirroredMotions[HandSide.LEFT] = mirrorMotion(leftMotion);
  }
  if ((targetHand === "right" || targetHand === "both") && rightMotion) {
    mirroredMotions[HandSide.RIGHT] = mirrorMotion(rightMotion);
  }

  // For single-hand transforms, derive new grid position from motion locations
  // For "both", use the lookup table
  let newGridPosition: GridPosition | null;
  if (targetHand === "both") {
    newGridPosition = startPos.gridPosition
      ? VERTICAL_MIRROR_POSITION_MAP[startPos.gridPosition]
      : null;
  } else {
    const tempStartPos = createStartPositionData({
      ...startPos,
      motions: mirroredMotions,
    });
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
  const leftMotion = startPos.motions[HandSide.LEFT];
  const rightMotion = startPos.motions[HandSide.RIGHT];

  // Transform specified hand(s)
  if ((targetHand === "left" || targetHand === "both") && leftMotion) {
    flippedMotions[HandSide.LEFT] = flipMotion(leftMotion);
  }
  if ((targetHand === "right" || targetHand === "both") && rightMotion) {
    flippedMotions[HandSide.RIGHT] = flipMotion(rightMotion);
  }

  // For single-hand transforms, derive new grid position from motion locations
  // For "both", use the lookup table
  let newGridPosition: GridPosition | null;
  if (targetHand === "both") {
    newGridPosition = startPos.gridPosition
      ? HORIZONTAL_MIRROR_POSITION_MAP[startPos.gridPosition]
      : null;
  } else {
    const tempStartPos = createStartPositionData({
      ...startPos,
      motions: flippedMotions,
    });
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
  const origLeftMotion = startPos.motions[HandSide.LEFT];
  const origRightMotion = startPos.motions[HandSide.RIGHT];

  // Transform specified hand(s)
  if ((targetHand === "left" || targetHand === "both") && origLeftMotion) {
    rotatedMotions[HandSide.LEFT] = rotateMotion(
      origLeftMotion,
      rotationAmount
    );
  }
  if ((targetHand === "right" || targetHand === "both") && origRightMotion) {
    rotatedMotions[HandSide.RIGHT] = rotateMotion(
      origRightMotion,
      rotationAmount
    );
  }

  // Derive new gridPosition from rotated motion locations
  // This correctly handles the DIAMOND ↔ BOX mode transitions
  let rotatedGridPosition: GridPosition | null = startPos.gridPosition ?? null;
  const leftMotion = rotatedMotions[HandSide.LEFT];
  const rightMotion = rotatedMotions[HandSide.RIGHT];

  if (isVisibleMotion(leftMotion) && isVisibleMotion(rightMotion)) {
    rotatedGridPosition = getGridPositionFromLocations(
      leftMotion.startLocation,
      rightMotion.startLocation
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
 * Swap hand roles in a start position (left ↔ right).
 */
export function handSwapStartPosition(
  startPos: StartPositionData
): StartPositionData {
  const origLeft = startPos.motions[HandSide.LEFT];
  const origRight = startPos.motions[HandSide.RIGHT];
  const swappedMotions = {
    [HandSide.LEFT]: origRight
      ? reassignMotionHand(origRight, HandSide.LEFT)
      : undefined,
    [HandSide.RIGHT]: origLeft
      ? reassignMotionHand(origLeft, HandSide.RIGHT)
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
  const startLeftMotion = startPos.motions[HandSide.LEFT];
  const startRightMotion = startPos.motions[HandSide.RIGHT];

  // Transform specified hand(s)
  if ((targetHand === "left" || targetHand === "both") && startLeftMotion) {
    const leftMotion = startLeftMotion;
    const invertedLeftMotion = createMotionData({
      ...leftMotion,
      motionType: invertMotionType(leftMotion.motionType),
      rotationDirection: reverseRotationDirection(leftMotion.rotationDirection),
    });
    const newEndOrientation = calculateEndOrientation(
      invertedLeftMotion,
      HandSide.LEFT
    );
    invertedMotions[HandSide.LEFT] = {
      ...invertedLeftMotion,
      endOrientation: newEndOrientation,
    };
  }

  if ((targetHand === "right" || targetHand === "both") && startRightMotion) {
    const rightMotion = startRightMotion;
    const invertedRightMotion = createMotionData({
      ...rightMotion,
      motionType: invertMotionType(rightMotion.motionType),
      rotationDirection: reverseRotationDirection(
        rightMotion.rotationDirection
      ),
    });
    const newEndOrientation = calculateEndOrientation(
      invertedRightMotion,
      HandSide.RIGHT
    );
    invertedMotions[HandSide.RIGHT] = {
      ...invertedRightMotion,
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
