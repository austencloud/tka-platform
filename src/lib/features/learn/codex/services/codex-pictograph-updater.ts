/**
 * Codex Pictograph Updater
 *
 * Transforms pictographs for the codex view:
 * - Rotate: 45° clockwise rotation, toggles grid mode
 * - Mirror: Vertical flip, reverses rotation directions
 * - Hand Swap: Swaps left and right motion data
 *
 * Uses the same transformation maps as SequenceTransformer
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  HandSide,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { LOCATION_MAP_EIGHTH_CW } from "../../../create/generate/circular/domain/constants/circular-position-maps";
import {
  VERTICAL_MIRROR_POSITION_MAP,
  VERTICAL_MIRROR_LOCATION_MAP,
  SWAPPED_POSITION_MAP,
} from "../../../create/generate/circular/domain/constants/strict-loop-position-maps";
import type { CodexTransformationOperation } from "../domain/types/codex-types";

/**
 * Rotate all pictographs 45° clockwise
 * - Rotates all locations by 45°
 * - Toggles grid mode (DIAMOND ↔ BOX)
 */
export function rotateAllPictographs(
  pictographs: PictographData[]
): PictographData[] {
  return pictographs.map((p) => rotatePictograph(p));
}

/**
 * Mirror all pictographs vertically
 * - Mirrors all positions and locations
 * - Reverses rotation directions
 */
export function mirrorAllPictographs(
  pictographs: PictographData[]
): PictographData[] {
  return pictographs.map((p) => mirrorPictograph(p));
}

/**
 * Swap hands for all pictographs
 * - Swaps left and right motion data
 * - Updates positions based on swapped locations
 */
export function handSwapAllPictographs(
  pictographs: PictographData[]
): PictographData[] {
  return pictographs.map((p) => handSwapPictograph(p));
}

/**
 * Apply a named operation to all pictographs
 */
export function applyOperation(
  pictographs: PictographData[],
  operation: CodexTransformationOperation
): PictographData[] {
  switch (operation) {
    case "rotate":
      return rotateAllPictographs(pictographs);
    case "mirror":
      return mirrorAllPictographs(pictographs);
    case "handSwap":
      return handSwapAllPictographs(pictographs);
    default:
      console.warn(`Unknown operation: ${operation}`);
      return [...pictographs];
  }
}

/**
 * Rotate a single pictograph 45° clockwise
 */
function rotatePictograph(pictograph: PictographData): PictographData {
  const leftMotion = pictograph.motions[HandSide.LEFT];
  const rightMotion = pictograph.motions[HandSide.RIGHT];

  // Determine new grid mode (toggle DIAMOND ↔ BOX)
  const currentGridMode = leftMotion?.gridMode ?? GridMode.DIAMOND;
  const newGridMode =
    currentGridMode === GridMode.DIAMOND ? GridMode.BOX : GridMode.DIAMOND;

  const rotatedMotions: Partial<Record<HandSide, MotionData | undefined>> = {};

  // Rotate left motion
  if (leftMotion) {
    const {
      arrowPlacementData: _arrowPlacementData,
      propPlacementData: _propPlacementData,
      ...motionWithoutPlacement
    } = leftMotion;
    rotatedMotions[HandSide.LEFT] = createMotionData({
      ...motionWithoutPlacement,
      startLocation: LOCATION_MAP_EIGHTH_CW[leftMotion.startLocation],
      endLocation: LOCATION_MAP_EIGHTH_CW[leftMotion.endLocation],
      arrowLocation: LOCATION_MAP_EIGHTH_CW[leftMotion.arrowLocation],
      gridMode: newGridMode,
    });
  }

  // Rotate right motion
  if (rightMotion) {
    const {
      arrowPlacementData: _arrowPlacementData,
      propPlacementData: _propPlacementData,
      ...motionWithoutPlacement
    } = rightMotion;
    rotatedMotions[HandSide.RIGHT] = createMotionData({
      ...motionWithoutPlacement,
      startLocation: LOCATION_MAP_EIGHTH_CW[rightMotion.startLocation],
      endLocation: LOCATION_MAP_EIGHTH_CW[rightMotion.endLocation],
      arrowLocation: LOCATION_MAP_EIGHTH_CW[rightMotion.arrowLocation],
      gridMode: newGridMode,
    });
  }

  // Positions are derived from location pairs (left + right), so we keep them as-is
  // The pictograph renderer will use the rotated motion locations to position elements correctly
  // Positions like alpha1, beta3, gamma11 describe the combined state, not individual locations

  return {
    ...pictograph,
    motions: rotatedMotions,
    // Keep original positions - they describe the letter's start/end configuration
    startPosition: pictograph.startPosition,
    endPosition: pictograph.endPosition,
  };
}

/**
 * Mirror a single pictograph vertically
 */
function mirrorPictograph(pictograph: PictographData): PictographData {
  const leftMotion = pictograph.motions[HandSide.LEFT];
  const rightMotion = pictograph.motions[HandSide.RIGHT];

  const mirroredMotions: Partial<Record<HandSide, MotionData | undefined>> = {};

  // Mirror left motion
  if (leftMotion) {
    mirroredMotions[HandSide.LEFT] = {
      ...leftMotion,
      startLocation: VERTICAL_MIRROR_LOCATION_MAP[leftMotion.startLocation],
      endLocation: VERTICAL_MIRROR_LOCATION_MAP[leftMotion.endLocation],
      arrowLocation: VERTICAL_MIRROR_LOCATION_MAP[leftMotion.arrowLocation],
      rotationDirection: reverseRotationDirection(leftMotion.rotationDirection),
    };
  }

  // Mirror right motion
  if (rightMotion) {
    mirroredMotions[HandSide.RIGHT] = {
      ...rightMotion,
      startLocation: VERTICAL_MIRROR_LOCATION_MAP[rightMotion.startLocation],
      endLocation: VERTICAL_MIRROR_LOCATION_MAP[rightMotion.endLocation],
      arrowLocation: VERTICAL_MIRROR_LOCATION_MAP[rightMotion.arrowLocation],
      rotationDirection: reverseRotationDirection(
        rightMotion.rotationDirection
      ),
    };
  }

  // Mirror positions
  const mirroredStartPosition = pictograph.startPosition
    ? VERTICAL_MIRROR_POSITION_MAP[pictograph.startPosition]
    : pictograph.startPosition;
  const mirroredEndPosition = pictograph.endPosition
    ? VERTICAL_MIRROR_POSITION_MAP[pictograph.endPosition]
    : pictograph.endPosition;

  return {
    ...pictograph,
    motions: mirroredMotions,
    startPosition: mirroredStartPosition,
    endPosition: mirroredEndPosition,
  };
}

/**
 * Swap hands for a single pictograph
 */
function handSwapPictograph(pictograph: PictographData): PictographData {
  const leftMotion = pictograph.motions[HandSide.LEFT];
  const rightMotion = pictograph.motions[HandSide.RIGHT];

  // Swap the motions
  const swappedMotions: Partial<Record<HandSide, MotionData | undefined>> = {};

  if (rightMotion) {
    swappedMotions[HandSide.LEFT] = {
      ...rightMotion,
      hand: HandSide.LEFT,
    };
  }

  if (leftMotion) {
    swappedMotions[HandSide.RIGHT] = {
      ...leftMotion,
      hand: HandSide.RIGHT,
    };
  }

  // Swap positions using swap position map
  const swappedStartPosition = pictograph.startPosition
    ? SWAPPED_POSITION_MAP[pictograph.startPosition]
    : pictograph.startPosition;
  const swappedEndPosition = pictograph.endPosition
    ? SWAPPED_POSITION_MAP[pictograph.endPosition]
    : pictograph.endPosition;

  return {
    ...pictograph,
    motions: swappedMotions,
    startPosition: swappedStartPosition,
    endPosition: swappedEndPosition,
  };
}

/**
 * Reverse rotation direction (cw ↔ ccw)
 */
function reverseRotationDirection(
  direction: RotationDirection
): RotationDirection {
  if (direction === RotationDirection.CLOCKWISE) {
    return RotationDirection.COUNTER_CLOCKWISE;
  } else if (direction === RotationDirection.COUNTER_CLOCKWISE) {
    return RotationDirection.CLOCKWISE;
  }
  return direction; // NO_ROTATION stays the same
}
