/**
 * Motion Calculator Service Contract
 *
 * Handles calculations for different motion types including
 * pro, anti, static, dash, and float motions.
 */

import type {
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface IMotionCalculator {
  /**
   * Calculate Pro Isolation staff angle using centralized enums
   */
  calculateProIsolationStaffAngle(
    centerPathAngle: number,
    propRotDir: RotationDirection
  ): number;

  /**
   * Calculate Pro motion target angle with turns support
   */
  calculateProTargetAngle(
    startCenterAngle: number,
    targetCenterAngle: number,
    startStaffAngle: number,
    turns: number,
    rotationDirection: RotationDirection
  ): number;

  /**
   * Calculate Antispin target angle using centralized enums
   */
  calculateAntispinTargetAngle(
    startCenterAngle: number,
    targetCenterAngle: number,
    startStaffAngle: number,
    turns: number,
    rotationDirection: RotationDirection
  ): number;

  /**
   * Calculate static motion staff angle
   */
  calculateStaticStaffAngle(
    startStaffAngle: number,
    endOrientation: Orientation,
    targetCenterAngle: number
  ): number;

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
  ): number;

  /**
   * Calculate float motion staff angle (no change)
   */
  calculateFloatStaffAngle(startStaffAngle: number): number;
}
