import type { MotionData, MotionEndpoints } from "@tka/types";

export interface IEndpointCalculator {
  calculateMotionEndpoints(motionData: MotionData): MotionEndpoints;
  calculateEndpointStaffAngle(motionData: MotionData): number;
}
