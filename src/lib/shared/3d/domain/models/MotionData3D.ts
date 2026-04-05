/**
 * MotionData3D - Extended motion data with plane context
 *
 * Adds plane information to the existing MotionData model.
 */

import type { Plane } from "../enums/Plane";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  RotationDirection,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/**
 * Simplified motion configuration for testing
 * (Full MotionData has many more fields we don't need for the sandbox)
 */
export interface MotionConfig3D {
  /** Which plane this motion occurs on */
  plane: Plane;
  /** Starting grid location */
  startLocation: GridLocation;
  /** Ending grid location */
  endLocation: GridLocation;
  /** Type of motion (PRO, ANTI, STATIC, DASH, FLOAT) */
  motionType: MotionType;
  /** Rotation direction (CW, CCW, NO_ROTATION) */
  rotationDirection: RotationDirection;
  /** Number of turns (or "fl" for float) */
  turns: number;
  /** Starting orientation */
  startOrientation: Orientation;
  /** Ending orientation */
  endOrientation: Orientation;
  /**
   * X-axis offset for this hand's plane center, in avatar-local space.
   * Used in dual-wheel mode to separate each hand's wheel plane laterally.
   * Default: 0 (no offset, planes centered on body).
   */
  lateralOffset?: number;
  /**
   * Which plane to use for prop ROTATION quaternion calculation.
   * Defaults to `plane` when not specified.
   */
  rotationPlane?: Plane;
  /**
   * When true, position and rotation are already in world space — the
   * facing angle transform is skipped for both. Used in dual-wheel mode
   * where WHEEL positions (YZ plane) should stay in YZ world space,
   * not get rotated by the facing angle back into XY (wall).
   */
  skipFacingTransform?: boolean;
}

/**
 * Create a default motion config for testing
 */
export function createDefaultMotionConfig(plane: Plane): MotionConfig3D {
  return {
    plane,
    startLocation: "n" as GridLocation,
    endLocation: "s" as GridLocation,
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    turns: 1,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.OUT,
  };
}

/**
 * Motion presets for quick testing
 */
export const MOTION_PRESETS: Record<string, Partial<MotionConfig3D>> = {
  "PRO N→S CW": {
    startLocation: "n" as GridLocation,
    endLocation: "s" as GridLocation,
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    turns: 1,
  },
  "ANTI S→N CCW": {
    startLocation: "s" as GridLocation,
    endLocation: "n" as GridLocation,
    motionType: MotionType.ANTI,
    rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
    turns: 1,
  },
  "STATIC E→W": {
    startLocation: "e" as GridLocation,
    endLocation: "w" as GridLocation,
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    turns: 0,
  },
  "DASH NE→SW": {
    startLocation: "ne" as GridLocation,
    endLocation: "sw" as GridLocation,
    motionType: MotionType.DASH,
    rotationDirection: RotationDirection.NO_ROTATION,
    turns: 0,
  },
  "FLOAT W→E": {
    startLocation: "w" as GridLocation,
    endLocation: "e" as GridLocation,
    motionType: MotionType.FLOAT,
    rotationDirection: RotationDirection.NO_ROTATION,
    turns: 0,
  },
};
