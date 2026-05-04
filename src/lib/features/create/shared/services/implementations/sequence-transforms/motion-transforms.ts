/**
 * Motion Transforms
 *
 * Pure functions that transform a single MotionData object.
 * Each function returns a new MotionData without mutating the input.
 */

import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  VERTICAL_MIRROR_LOCATION_MAP,
  HORIZONTAL_MIRROR_LOCATION_MAP,
} from "../../../../generate/circular/domain/constants/strict-loop-position-maps";
import {
  reverseRotationDirection,
  invertMotionType,
  rotateLocation,
  getToggledGridMode,
} from "$lib/shared/create/services/rotation-helpers";

/**
 * Mirror a motion across the vertical axis (E ↔ W).
 * Reverses rotation direction.
 */
export function mirrorMotion(motion: MotionData): MotionData {
  return createMotionData({
    ...motion,
    startLocation: VERTICAL_MIRROR_LOCATION_MAP[motion.startLocation],
    endLocation: VERTICAL_MIRROR_LOCATION_MAP[motion.endLocation],
    arrowLocation: VERTICAL_MIRROR_LOCATION_MAP[motion.arrowLocation],
    rotationDirection: reverseRotationDirection(motion.rotationDirection),
  });
}

/**
 * Flip a motion across the horizontal axis (N ↔ S).
 * Reverses rotation direction.
 */
export function flipMotion(motion: MotionData): MotionData {
  return createMotionData({
    ...motion,
    startLocation: HORIZONTAL_MIRROR_LOCATION_MAP[motion.startLocation],
    endLocation: HORIZONTAL_MIRROR_LOCATION_MAP[motion.endLocation],
    arrowLocation: HORIZONTAL_MIRROR_LOCATION_MAP[motion.arrowLocation],
    rotationDirection: reverseRotationDirection(motion.rotationDirection),
  });
}

/**
 * Rotate a motion's locations by 45° steps.
 * Updates grid mode and clears placement data for recalculation.
 */
export function rotateMotion(
  motion: MotionData,
  rotationAmount: number
): MotionData {
  const currentGridMode = motion.gridMode ?? GridMode.DIAMOND;
  const newGridMode = getToggledGridMode(currentGridMode, rotationAmount);

  // Destructure to exclude old placement data - force regeneration
  const {
    arrowPlacementData: _,
    propPlacementData: __,
    ...motionWithoutPlacement
  } = motion;

  return createMotionData({
    ...motionWithoutPlacement,
    startLocation: rotateLocation(
      motion.startLocation,
      rotationAmount
    ) as GridLocation,
    endLocation: rotateLocation(
      motion.endLocation,
      rotationAmount
    ) as GridLocation,
    arrowLocation: rotateLocation(
      motion.arrowLocation,
      rotationAmount
    ) as GridLocation,
    gridMode: newGridMode,
  });
}

/**
 * Swap motion color to the target color.
 */
export function swapMotionColor(
  motion: MotionData,
  targetColor: MotionColor
): MotionData {
  return createMotionData({
    ...motion,
    color: targetColor,
  });
}

/**
 * Invert motion type (PRO ↔ ANTI) and rotation direction (CW ↔ CCW).
 */
export function invertMotion(motion: MotionData): MotionData {
  return createMotionData({
    ...motion,
    motionType: invertMotionType(motion.motionType),
    rotationDirection: reverseRotationDirection(motion.rotationDirection),
  });
}

/**
 * Rewind a motion (swap start/end, flip rotation direction).
 * Used when playing sequence backwards.
 */
export function rewindMotion(motion: MotionData): MotionData {
  return createMotionData({
    ...motion,
    startLocation: motion.endLocation,
    endLocation: motion.startLocation,
    startOrientation: motion.endOrientation,
    endOrientation: motion.startOrientation,
    rotationDirection: reverseRotationDirection(motion.rotationDirection),
  });
}
