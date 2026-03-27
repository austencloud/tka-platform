/**
 * IMotionCalculator Contract
 *
 * Service for calculating target staff angles based on motion type.
 */

import type { MotionConfig3D } from "../../domain/models/MotionData3D";

export interface IMotionCalculator {
  /**
   * Calculate target staff angle based on motion type
   *
   * Handles PRO, ANTI, STATIC, DASH, FLOAT motions with proper
   * rotation direction and turn calculations.
   *
   * @param config - The motion configuration
   * @param startStaffAngle - Starting staff angle in radians
   * @param startCenterAngle - Starting center path angle in radians
   * @param endCenterAngle - Ending center path angle in radians
   * @returns Target staff angle in radians
   */
  calculateTargetStaffAngle(
    config: MotionConfig3D,
    startStaffAngle: number,
    startCenterAngle: number,
    endCenterAngle: number
  ): number;
}
