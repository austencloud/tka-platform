import type { RotationDirection } from "./pictograph-enums";

export interface MotionEndpoints {
  startCenterAngle: number;
  startStaffAngle: number;
  targetCenterAngle: number;
  targetStaffAngle: number;
  staffRotationDelta: number;
  rotationDirection: RotationDirection;
}
