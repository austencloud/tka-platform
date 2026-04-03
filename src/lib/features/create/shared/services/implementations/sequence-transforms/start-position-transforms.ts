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

import type { StartPositionData } from "../../../domain/models/StartPositionData";
import { createStartPositionData } from "../../../domain/factories/createStartPositionData";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";
import {
  VERTICAL_MIRROR_POSITION_MAP,
  HORIZONTAL_MIRROR_POSITION_MAP,
  SWAPPED_POSITION_MAP,
} from "../../../../generate/circular/domain/constants/strict-loop-position-maps";
import {
  mirrorMotion,
  flipMotion,
  rotateMotion,
  swapMotionColor,
} from "./motion-transforms";
import { invertMotionType, reverseRotationDirection } from "./rotation-helpers";
import type { TargetHand } from "../../../state/panel-coordination-state.svelte";
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
  startPos: StartPositionData,
  positionDeriver: IGridPositionDeriver
): GridPosition | null {
  const blueMotion = startPos.motions[MotionColor.BLUE];
  const redMotion = startPos.motions[MotionColor.RED];

  if (blueMotion && redMotion) {
    return positionDeriver.getGridPositionFromLocations(
      blueMotion.startLocation,
      redMotion.startLocation
    );
  }
  return startPos.gridPosition ?? null;
}

/**
 * Mirror a start position across the vertical axis (E ↔ W).
 * @param targetHand - Which hand(s) to transform. Defaults to "both".
 * @param positionDeriver - Required for single-hand transforms to derive new grid position.
 */
export function mirrorStartPosition(
  startPos: StartPositionData,
  targetHand: TargetHand = "both",
  positionDeriver?: IGridPositionDeriver
): StartPositionData {
  const mirroredMotions = { ...startPos.motions };

  // Transform specified hand(s)
  if ((targetHand === "blue" || targetHand === "both") && startPos.motions[MotionColor.BLUE]) {
    mirroredMotions[MotionColor.BLUE] = mirrorMotion(
      startPos.motions[MotionColor.BLUE]
    );
  }
  if ((targetHand === "red" || targetHand === "both") && startPos.motions[MotionColor.RED]) {
    mirroredMotions[MotionColor.RED] = mirrorMotion(
      startPos.motions[MotionColor.RED]
    );
  }

  // For single-hand transforms, derive new grid position from motion locations
  // For "both", use the lookup table
  let newGridPosition: GridPosition | null;
  if (targetHand === "both") {
    newGridPosition = startPos.gridPosition
      ? VERTICAL_MIRROR_POSITION_MAP[startPos.gridPosition]
      : null;
  } else if (positionDeriver) {
    const tempStartPos = createStartPositionData({ ...startPos, motions: mirroredMotions });
    newGridPosition = deriveGridPositionFromMotions(tempStartPos, positionDeriver);
  } else {
    newGridPosition = startPos.gridPosition ?? null;
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
 * @param positionDeriver - Required for single-hand transforms to derive new grid position.
 */
export function flipStartPosition(
  startPos: StartPositionData,
  targetHand: TargetHand = "both",
  positionDeriver?: IGridPositionDeriver
): StartPositionData {
  const flippedMotions = { ...startPos.motions };

  // Transform specified hand(s)
  if ((targetHand === "blue" || targetHand === "both") && startPos.motions[MotionColor.BLUE]) {
    flippedMotions[MotionColor.BLUE] = flipMotion(
      startPos.motions[MotionColor.BLUE]
    );
  }
  if ((targetHand === "red" || targetHand === "both") && startPos.motions[MotionColor.RED]) {
    flippedMotions[MotionColor.RED] = flipMotion(
      startPos.motions[MotionColor.RED]
    );
  }

  // For single-hand transforms, derive new grid position from motion locations
  // For "both", use the lookup table
  let newGridPosition: GridPosition | null;
  if (targetHand === "both") {
    newGridPosition = startPos.gridPosition
      ? HORIZONTAL_MIRROR_POSITION_MAP[startPos.gridPosition]
      : null;
  } else if (positionDeriver) {
    const tempStartPos = createStartPositionData({ ...startPos, motions: flippedMotions });
    newGridPosition = deriveGridPositionFromMotions(tempStartPos, positionDeriver);
  } else {
    newGridPosition = startPos.gridPosition ?? null;
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
  positionDeriver: IGridPositionDeriver,
  targetHand: TargetHand = "both"
): StartPositionData {
  const rotatedMotions = { ...startPos.motions };

  // Transform specified hand(s)
  if ((targetHand === "blue" || targetHand === "both") && startPos.motions[MotionColor.BLUE]) {
    rotatedMotions[MotionColor.BLUE] = rotateMotion(
      startPos.motions[MotionColor.BLUE],
      rotationAmount
    );
  }
  if ((targetHand === "red" || targetHand === "both") && startPos.motions[MotionColor.RED]) {
    rotatedMotions[MotionColor.RED] = rotateMotion(
      startPos.motions[MotionColor.RED],
      rotationAmount
    );
  }

  // Derive new gridPosition from rotated motion locations
  // This correctly handles the DIAMOND ↔ BOX mode transitions
  let rotatedGridPosition: GridPosition | null = startPos.gridPosition ?? null;
  const blueMotion = rotatedMotions[MotionColor.BLUE];
  const redMotion = rotatedMotions[MotionColor.RED];

  if (blueMotion && redMotion) {
    rotatedGridPosition = positionDeriver.getGridPositionFromLocations(
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
  const swappedMotions = {
    [MotionColor.BLUE]: startPos.motions[MotionColor.RED]
      ? swapMotionColor(startPos.motions[MotionColor.RED], MotionColor.BLUE)
      : undefined,
    [MotionColor.RED]: startPos.motions[MotionColor.BLUE]
      ? swapMotionColor(startPos.motions[MotionColor.BLUE], MotionColor.RED)
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
 * @param positionDeriver - Required for single-hand transforms to derive new grid position.
 */
export function invertStartPosition(
  startPos: StartPositionData,
  orientationCalculator: IOrientationCalculator,
  targetHand: TargetHand = "both",
  positionDeriver?: IGridPositionDeriver
): StartPositionData {
  const invertedMotions = { ...startPos.motions };

  // Transform specified hand(s)
  if ((targetHand === "blue" || targetHand === "both") && startPos.motions[MotionColor.BLUE]) {
    const blueMotion = startPos.motions[MotionColor.BLUE];
    const invertedBlueMotion = createMotionData({
      ...blueMotion,
      motionType: invertMotionType(blueMotion.motionType),
      rotationDirection: reverseRotationDirection(blueMotion.rotationDirection),
    });
    const newEndOrientation = orientationCalculator.calculateEndOrientation(
      invertedBlueMotion,
      MotionColor.BLUE
    );
    invertedMotions[MotionColor.BLUE] = {
      ...invertedBlueMotion,
      endOrientation: newEndOrientation,
    };
  }

  if ((targetHand === "red" || targetHand === "both") && startPos.motions[MotionColor.RED]) {
    const redMotion = startPos.motions[MotionColor.RED];
    const invertedRedMotion = createMotionData({
      ...redMotion,
      motionType: invertMotionType(redMotion.motionType),
      rotationDirection: reverseRotationDirection(redMotion.rotationDirection),
    });
    const newEndOrientation = orientationCalculator.calculateEndOrientation(
      invertedRedMotion,
      MotionColor.RED
    );
    invertedMotions[MotionColor.RED] = {
      ...invertedRedMotion,
      endOrientation: newEndOrientation,
    };
  }

  // For single-hand transforms, derive new grid position from motion locations
  let newGridPosition: GridPosition | null = startPos.gridPosition ?? null;
  if (targetHand !== "both" && positionDeriver) {
    const tempStartPos = createStartPositionData({ ...startPos, motions: invertedMotions });
    newGridPosition = deriveGridPositionFromMotions(tempStartPos, positionDeriver);
  }

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
