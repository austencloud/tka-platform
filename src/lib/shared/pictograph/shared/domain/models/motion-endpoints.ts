/**
 * Motion Endpoints Model (INTERNAL USE ONLY)
 *
 * ⚠️ This is an internal implementation detail of the animation system.
 * ⚠️ Angles are hidden from public APIs and debugging logs.
 * ⚠️ Use MotionData (with GridLocation and Orientation) for all public interfaces.
 *
 * Represents the calculated start and end angles for a motion.
 * Used internally by animation services to interpolate prop positions and rotations.
 *
 * These angles are calculated from domain concepts:
 * - startCenterAngle: Calculated from MotionData.startLocation
 * - targetCenterAngle: Calculated from MotionData.endLocation
 * - startStaffAngle: Calculated from MotionData.startLocation + startOrientation
 * - targetStaffAngle: Calculated from MotionData.endLocation + endOrientation + motionType + turns
 */

import type { RotationDirection } from "../enums/pictograph-enums";

export interface MotionEndpoints {
  /** Starting center path angle (radians) - calculated from startLocation */
  startCenterAngle: number;

  /** Starting staff rotation angle (radians) - calculated from startLocation + startOrientation */
  startStaffAngle: number;

  /** Target center path angle (radians) - calculated from endLocation */
  targetCenterAngle: number;

  /** Target staff rotation angle (radians) - calculated from endLocation + endOrientation + motionType + turns */
  targetStaffAngle: number;

  /** Total staff rotation delta (radians, un-normalized) - includes turns and can be > 2π */
  staffRotationDelta: number;

  /** Explicit rotation direction from sequence data - determines path direction */
  rotationDirection: RotationDirection;
}
