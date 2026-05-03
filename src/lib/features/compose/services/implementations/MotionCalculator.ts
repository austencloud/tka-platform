/**
 * Motion Calculation Service
 *
 * Handles calculations for different motion types including
 * pro, anti, static, dash, and float motions.
 */

import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PI } from "../../shared/domain/math-constants.js";
import {
  mapOrientationToAngle,
  normalizeAnglePositive,
  normalizeAngleSigned,
} from "./AngleCalculator";

// ============================================================================
// Standalone utility functions (exported for use by domain layer)
// ============================================================================

export function calculateProIsolationStaffAngle(
  centerPathAngle: number,
  _propRotDir: RotationDirection
): number {
  return normalizeAnglePositive(centerPathAngle + PI);
}

export function calculateProTargetAngle(
  startCenterAngle: number,
  targetCenterAngle: number,
  startStaffAngle: number,
  turns: number,
  rotationDirection: RotationDirection
): number {
  const centerMovement = normalizeAngleSigned(
    targetCenterAngle - startCenterAngle
  );
  const dir =
    rotationDirection === RotationDirection.COUNTER_CLOCKWISE ? -1 : 1;
  const propRotation = dir * turns * PI; // 1 turn = 180°, not 360°
  const staffMovement = centerMovement; // PRO: same direction as grid movement
  const targetStaffAngle = startStaffAngle + staffMovement + propRotation;
  return normalizeAnglePositive(targetStaffAngle);
}

export function calculateAntispinTargetAngle(
  startCenterAngle: number,
  targetCenterAngle: number,
  startStaffAngle: number,
  turns: number,
  rotationDirection: RotationDirection
): number {
  const centerMovement = normalizeAngleSigned(
    targetCenterAngle - startCenterAngle
  );
  const dir =
    rotationDirection === RotationDirection.COUNTER_CLOCKWISE ? -1 : 1;
  const propRotation = dir * turns * PI; // 1 turn = 180°, not 360°
  const staffMovement = -centerMovement; // ANTI: opposite direction to grid movement
  const targetStaffAngle = startStaffAngle + staffMovement + propRotation;
  return normalizeAnglePositive(targetStaffAngle);
}

export function calculateStaticStaffAngle(
  startStaffAngle: number,
  endOrientation: Orientation,
  targetCenterAngle: number
): number {
  const endOriAngle = mapOrientationToAngle(endOrientation, targetCenterAngle);
  const angleDiff = normalizeAngleSigned(endOriAngle - startStaffAngle);

  return Math.abs(angleDiff) > 0.1 ? endOriAngle : startStaffAngle;
}

export function calculateDashTargetAngle(
  startStaffAngle: number,
  endOrientation: Orientation,
  targetCenterAngle: number,
  turns: number,
  rotationDirection: RotationDirection
): number {
  // Calculate base orientation angle
  let baseAngle: number;
  if (endOrientation === Orientation.IN) {
    baseAngle = targetCenterAngle + PI;
  } else if (endOrientation === Orientation.OUT) {
    baseAngle = targetCenterAngle;
  } else {
    baseAngle = startStaffAngle;
  }

  // Add prop rotation: 1 turn = 180° (π) for all motion types
  const dir =
    rotationDirection === RotationDirection.COUNTER_CLOCKWISE ? -1 : 1;
  const propRotation = dir * turns * PI;
  const targetStaffAngle = baseAngle + propRotation;

  return normalizeAnglePositive(targetStaffAngle);
}

export function calculateFloatStaffAngle(startStaffAngle: number): number {
  return startStaffAngle;
}

// ============================================================================
// Service class (delegates to standalone functions)
// ============================================================================

export class MotionCalculator {
  constructor() {}

  /**
   * Calculate Pro Isolation staff angle using centralized enums
   */
  calculateProIsolationStaffAngle(
    centerPathAngle: number,
    propRotDir: RotationDirection
  ): number {
    return calculateProIsolationStaffAngle(centerPathAngle, propRotDir);
  }

  /**
   * Calculate Pro motion target angle with turns support
   */
  calculateProTargetAngle(
    startCenterAngle: number,
    targetCenterAngle: number,
    startStaffAngle: number,
    turns: number,
    rotationDirection: RotationDirection
  ): number {
    return calculateProTargetAngle(
      startCenterAngle,
      targetCenterAngle,
      startStaffAngle,
      turns,
      rotationDirection
    );
  }

  /**
   * Calculate Antispin target angle using centralized enums
   */
  calculateAntispinTargetAngle(
    startCenterAngle: number,
    targetCenterAngle: number,
    startStaffAngle: number,
    turns: number,
    rotationDirection: RotationDirection
  ): number {
    return calculateAntispinTargetAngle(
      startCenterAngle,
      targetCenterAngle,
      startStaffAngle,
      turns,
      rotationDirection
    );
  }

  /**
   * Calculate static motion staff angle
   */
  calculateStaticStaffAngle(
    startStaffAngle: number,
    endOrientation: Orientation,
    targetCenterAngle: number
  ): number {
    return calculateStaticStaffAngle(
      startStaffAngle,
      endOrientation,
      targetCenterAngle
    );
  }

  /**
   * Calculate dash target angle with turns support
   * Note: 1 turn = 180° (π) for all motion types
   */
  calculateDashTargetAngle(
    startStaffAngle: number,
    endOrientation: Orientation,
    targetCenterAngle: number,
    turns: number,
    rotationDirection: RotationDirection
  ): number {
    return calculateDashTargetAngle(
      startStaffAngle,
      endOrientation,
      targetCenterAngle,
      turns,
      rotationDirection
    );
  }

  /**
   * Calculate float motion staff angle (no change)
   */
  calculateFloatStaffAngle(startStaffAngle: number): number {
    return calculateFloatStaffAngle(startStaffAngle);
  }
}
