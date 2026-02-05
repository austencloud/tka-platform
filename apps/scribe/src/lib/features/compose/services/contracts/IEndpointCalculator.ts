/**
 * Endpoint Calculator Service Contract
 *
 * Handles calculation of motion endpoints and staff angles
 * for different motion types.
 */

import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { MotionEndpoints } from "$lib/shared/pictograph/shared/domain/models/MotionEndpoints";

export interface IEndpointCalculator {
  /**
   * Calculate motion endpoints directly from MotionData
   */
  calculateMotionEndpoints(motionData: MotionData): MotionEndpoints;

  /**
   * Calculate endpoint staff angle for a motion
   */
  calculateEndpointStaffAngle(motionData: MotionData): number;
}
