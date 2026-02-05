/**
 * Rotation Helpers
 *
 * Pure helper functions for rotation, direction, and grid mode transformations.
 * Used by motion, beat, and sequence transform functions.
 */

import type {
  GridPosition,
  GridLocation,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  RotationDirection,
  MotionType,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { LOCATION_MAP_EIGHTH_CW } from "../../../../generate/circular/domain/constants/circular-position-maps";

/**
 * Normalize rotation steps to a positive count within a single revolution (0-7).
 */
export function normalizeRotationSteps(rotationAmount: number): number {
  return ((rotationAmount % 8) + 8) % 8;
}

/**
 * Reverse rotation direction (CW ↔ CCW, NO_ROTATION stays same).
 */
export function reverseRotationDirection(
  direction: RotationDirection
): RotationDirection {
  if (direction === RotationDirection.CLOCKWISE) {
    return RotationDirection.COUNTER_CLOCKWISE;
  }
  if (direction === RotationDirection.COUNTER_CLOCKWISE) {
    return RotationDirection.CLOCKWISE;
  }
  return direction;
}

/**
 * Invert motion type (PRO ↔ ANTI, others stay same).
 */
export function invertMotionType(motionType: MotionType): MotionType {
  if (motionType === MotionType.PRO) {
    return MotionType.ANTI;
  }
  if (motionType === MotionType.ANTI) {
    return MotionType.PRO;
  }
  return motionType;
}

/**
 * Toggle grid mode based on rotation steps.
 * Grid mode toggles on every 45° step; even step counts stay in the same mode.
 */
export function getToggledGridMode(
  current: GridMode,
  rotationAmount: number
): GridMode {
  const steps = normalizeRotationSteps(rotationAmount);
  if (steps % 2 === 0) return current;
  return current === GridMode.DIAMOND ? GridMode.BOX : GridMode.DIAMOND;
}

/**
 * Rotate a location by 45° steps.
 * Positive = clockwise, negative = counter-clockwise.
 */
export function rotateLocation(
  location: GridPosition | GridLocation,
  rotationAmount: number
): GridPosition | GridLocation {
  const steps = normalizeRotationSteps(rotationAmount);
  let rotated = location;
  for (let i = 0; i < steps; i++) {
    rotated =
      LOCATION_MAP_EIGHTH_CW[rotated as keyof typeof LOCATION_MAP_EIGHTH_CW] ??
      rotated;
  }
  return rotated;
}
