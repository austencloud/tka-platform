import type { Orientation, RotationDirection } from "@tka/types";

export interface IMotionCalculator {
  calculateProIsolationStaffAngle(
    centerPathAngle: number,
    propRotDir: RotationDirection
  ): number;
  calculateProTargetAngle(
    startCenterAngle: number,
    targetCenterAngle: number,
    startStaffAngle: number,
    turns: number,
    rotationDirection: RotationDirection
  ): number;
  calculateAntispinTargetAngle(
    startCenterAngle: number,
    targetCenterAngle: number,
    startStaffAngle: number,
    turns: number,
    rotationDirection: RotationDirection
  ): number;
  calculateStaticStaffAngle(
    startStaffAngle: number,
    endOrientation: Orientation,
    targetCenterAngle: number
  ): number;
  calculateDashTargetAngle(
    startStaffAngle: number,
    endOrientation: Orientation,
    targetCenterAngle: number,
    turns: number,
    rotationDirection: RotationDirection
  ): number;
  calculateFloatStaffAngle(startStaffAngle: number): number;
}
