/**
 * Codex Pictograph Updater
 *
 * Transforms pictographs for the codex view:
 * - Rotate: 45° clockwise rotation, toggles grid mode
 * - Mirror: Vertical flip, reverses rotation directions
 * - Color Swap: Swaps blue and red motion data
 *
 * Uses the same transformation maps as SequenceTransformer
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionColor,
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
export function rotateAllPictographs(pictographs: PictographData[]): PictographData[] {
  return pictographs.map((p) => rotatePictograph(p));
}

/**
 * Mirror all pictographs vertically
 * - Mirrors all positions and locations
 * - Reverses rotation directions
 */
export function mirrorAllPictographs(pictographs: PictographData[]): PictographData[] {
  return pictographs.map((p) => mirrorPictograph(p));
}

/**
 * Swap colors for all pictographs
 * - Swaps blue and red motion data
 * - Updates positions based on swapped locations
 */
export function colorSwapAllPictographs(pictographs: PictographData[]): PictographData[] {
  return pictographs.map((p) => colorSwapPictograph(p));
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
    case "colorSwap":
      return colorSwapAllPictographs(pictographs);
    default:
      console.warn(`Unknown operation: ${operation}`);
      return [...pictographs];
  }
}

/**
 * Rotate a single pictograph 45° clockwise
 */
function rotatePictograph(pictograph: PictographData): PictographData {
  const blueMotion = pictograph.motions[MotionColor.BLUE];
  const redMotion = pictograph.motions[MotionColor.RED];

  // Determine new grid mode (toggle DIAMOND ↔ BOX)
  const currentGridMode = blueMotion?.gridMode ?? GridMode.DIAMOND;
  const newGridMode =
    currentGridMode === GridMode.DIAMOND ? GridMode.BOX : GridMode.DIAMOND;

  const rotatedMotions: Partial<Record<MotionColor, MotionData | undefined>> = {};

  // Rotate blue motion
  if (blueMotion) {
    const {
      arrowPlacementData: _arrowPlacementData,
      propPlacementData: _propPlacementData,
      ...motionWithoutPlacement
    } = blueMotion;
    rotatedMotions[MotionColor.BLUE] = createMotionData({
      ...motionWithoutPlacement,
      startLocation: LOCATION_MAP_EIGHTH_CW[blueMotion.startLocation],
      endLocation: LOCATION_MAP_EIGHTH_CW[blueMotion.endLocation],
      arrowLocation: LOCATION_MAP_EIGHTH_CW[blueMotion.arrowLocation],
      gridMode: newGridMode,
    });
  }

  // Rotate red motion
  if (redMotion) {
    const {
      arrowPlacementData: _arrowPlacementData,
      propPlacementData: _propPlacementData,
      ...motionWithoutPlacement
    } = redMotion;
    rotatedMotions[MotionColor.RED] = createMotionData({
      ...motionWithoutPlacement,
      startLocation: LOCATION_MAP_EIGHTH_CW[redMotion.startLocation],
      endLocation: LOCATION_MAP_EIGHTH_CW[redMotion.endLocation],
      arrowLocation: LOCATION_MAP_EIGHTH_CW[redMotion.arrowLocation],
      gridMode: newGridMode,
    });
  }

  // Positions are derived from location pairs (blue + red), so we keep them as-is
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
  const blueMotion = pictograph.motions[MotionColor.BLUE];
  const redMotion = pictograph.motions[MotionColor.RED];

  const mirroredMotions: Partial<Record<MotionColor, MotionData | undefined>> = {};

  // Mirror blue motion
  if (blueMotion) {
    mirroredMotions[MotionColor.BLUE] = {
      ...blueMotion,
      startLocation: VERTICAL_MIRROR_LOCATION_MAP[blueMotion.startLocation],
      endLocation: VERTICAL_MIRROR_LOCATION_MAP[blueMotion.endLocation],
      arrowLocation: VERTICAL_MIRROR_LOCATION_MAP[blueMotion.arrowLocation],
      rotationDirection: reverseRotationDirection(blueMotion.rotationDirection),
    };
  }

  // Mirror red motion
  if (redMotion) {
    mirroredMotions[MotionColor.RED] = {
      ...redMotion,
      startLocation: VERTICAL_MIRROR_LOCATION_MAP[redMotion.startLocation],
      endLocation: VERTICAL_MIRROR_LOCATION_MAP[redMotion.endLocation],
      arrowLocation: VERTICAL_MIRROR_LOCATION_MAP[redMotion.arrowLocation],
      rotationDirection: reverseRotationDirection(redMotion.rotationDirection),
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
 * Swap colors for a single pictograph
 */
function colorSwapPictograph(pictograph: PictographData): PictographData {
  const blueMotion = pictograph.motions[MotionColor.BLUE];
  const redMotion = pictograph.motions[MotionColor.RED];

  // Swap the motions
  const swappedMotions: Partial<Record<MotionColor, MotionData | undefined>> = {};

  if (redMotion) {
    swappedMotions[MotionColor.BLUE] = {
      ...redMotion,
      color: MotionColor.BLUE,
    };
  }

  if (blueMotion) {
    swappedMotions[MotionColor.RED] = {
      ...blueMotion,
      color: MotionColor.RED,
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
function reverseRotationDirection(direction: RotationDirection): RotationDirection {
  if (direction === RotationDirection.CLOCKWISE) {
    return RotationDirection.COUNTER_CLOCKWISE;
  } else if (direction === RotationDirection.COUNTER_CLOCKWISE) {
    return RotationDirection.CLOCKWISE;
  }
  return direction; // NO_ROTATION stays the same
}
