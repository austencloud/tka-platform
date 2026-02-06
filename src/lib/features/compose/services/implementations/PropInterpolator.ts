/**
 * Prop Interpolation Service
 *
 * Focused service for angle interpolation and motion calculations.
 * Single responsibility: Motion interpolation between keyframes.
 */

import type { StepData } from "../../../create/shared/domain/models/StepData";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { MotionEndpoints } from "$lib/shared/pictograph/shared/domain/models/MotionEndpoints";
import type { IPropInterpolator } from "../contracts/IPropInterpolator";
import type { InterpolationResult } from "../contracts/IAnimationStateManager";
import type { IAngleCalculator } from "../contracts/IAngleCalculator";
import type { IEndpointCalculator } from "../contracts/IEndpointCalculator";

export class PropInterpolator implements IPropInterpolator {
  constructor(
    private angleCalculator: IAngleCalculator,
    private endpointCalculator: IEndpointCalculator
  ) {}

  /**
   * Calculate interpolated prop angles for current beat progress
   * Uses Cartesian interpolation for DASH motions (straight through center)
   * Uses angular interpolation for all other motions
   */
  interpolatePropAngles(
    currentStepData: StepData,
    stepProgress: number
  ): InterpolationResult {
    // Get motion data directly from domain beat (PURE DOMAIN!)
    const blueMotion = currentStepData.motions?.blue;
    const redMotion = currentStepData.motions?.red;

    if (!blueMotion || !redMotion) {
      console.warn("PropInterpolator: Missing motion data", {
        stepNumber: currentStepData?.stepNumber,
        hasBlue: !!blueMotion,
        hasRed: !!redMotion,
      });
      return {
        blueAngles: { centerPathAngle: 0, staffRotationAngle: 0 },
        redAngles: { centerPathAngle: 0, staffRotationAngle: 0 },
        isValid: false,
      };
    }

    // Calculate endpoints using native MotionData
    const blueEndpoints =
      this.endpointCalculator.calculateMotionEndpoints(blueMotion);
    const redEndpoints =
      this.endpointCalculator.calculateMotionEndpoints(redMotion);

    // Check if motions are dashes - use Cartesian interpolation for straight-through-center movement
    const blueDash = blueMotion.motionType === MotionType.DASH;
    const redDash = redMotion.motionType === MotionType.DASH;

    // Interpolate blue prop
    const blueAngles = blueDash
      ? this.interpolateDashMotion(blueEndpoints, stepProgress)
      : {
          // Grid location: ALWAYS shortest path (W → N always goes W → NW → N)
          centerPathAngle: this.angleCalculator.lerpAngle(
            blueEndpoints.startCenterAngle,
            blueEndpoints.targetCenterAngle,
            stepProgress
          ),
          // Staff rotation: Use total rotation delta to respect turns
          staffRotationAngle: this.angleCalculator.normalizeAnglePositive(
            blueEndpoints.startStaffAngle +
              blueEndpoints.staffRotationDelta * stepProgress
          ),
          // Don't set x,y for non-dash motions - let CanvasRenderer calculate from angle
        };

    // Interpolate red prop
    const redAngles = redDash
      ? this.interpolateDashMotion(redEndpoints, stepProgress)
      : {
          // Grid location: ALWAYS shortest path
          centerPathAngle: this.angleCalculator.lerpAngle(
            redEndpoints.startCenterAngle,
            redEndpoints.targetCenterAngle,
            stepProgress
          ),
          // Staff rotation: Use total rotation delta to respect turns
          staffRotationAngle: this.angleCalculator.normalizeAnglePositive(
            redEndpoints.startStaffAngle +
              redEndpoints.staffRotationDelta * stepProgress
          ),
          // Don't set x,y for non-dash motions - let CanvasRenderer calculate from angle
        };

    return {
      blueAngles,
      redAngles,
      isValid: true,
    };
  }

  /**
   * Interpolate dash motion using Cartesian coordinates
   * Dashes move in a straight line through the center, not around the circle
   * Returns angle for compatibility, but the angle will be recalculated from x,y in the renderer
   */
  private interpolateDashMotion(
    endpoints: MotionEndpoints,
    progress: number
  ): {
    centerPathAngle: number;
    staffRotationAngle: number;
    x?: number;
    y?: number;
  } {
    // Convert start and end angles to Cartesian coordinates (unit circle)
    const startX = Math.cos(endpoints.startCenterAngle);
    const startY = Math.sin(endpoints.startCenterAngle);
    const endX = Math.cos(endpoints.targetCenterAngle);
    const endY = Math.sin(endpoints.targetCenterAngle);

    // Linear interpolation in Cartesian space (straight line through center)
    const currentX = startX + (endX - startX) * progress;
    const currentY = startY + (endY - startY) * progress;

    // Convert back to angle for compatibility
    const centerPathAngle = Math.atan2(currentY, currentX);

    // Staff rotation: Use total rotation delta to respect turns (NOT shortest path!)
    // This ensures 1.5 turns rotates +270°, not -90° via shortest path
    const staffRotationAngle = this.angleCalculator.normalizeAnglePositive(
      endpoints.startStaffAngle + endpoints.staffRotationDelta * progress
    );

    // Return x,y coordinates so renderer can use them directly
    return { centerPathAngle, staffRotationAngle, x: currentX, y: currentY };
  }

  /**
   * Calculate initial prop angles from first beat
   */
  calculateInitialAngles(firstStep: StepData): InterpolationResult {
    // Get motion data directly from domain beat (PURE DOMAIN!)
    const blueStartMotion = firstStep.motions?.blue;
    const redStartMotion = firstStep.motions?.red;

    if (!blueStartMotion || !redStartMotion) {
      console.warn("PropInterpolator: Missing motion data on first beat", {
        stepNumber: firstStep?.stepNumber,
        hasBlue: !!blueStartMotion,
        hasRed: !!redStartMotion,
      });
      return {
        blueAngles: { centerPathAngle: 0, staffRotationAngle: 0 },
        redAngles: { centerPathAngle: 0, staffRotationAngle: 0 },
        isValid: false,
      };
    }

    const blueStartEndpoints =
      this.endpointCalculator.calculateMotionEndpoints(blueStartMotion);
    const redStartEndpoints =
      this.endpointCalculator.calculateMotionEndpoints(redStartMotion);

    return {
      blueAngles: {
        centerPathAngle: blueStartEndpoints.startCenterAngle,
        staffRotationAngle: blueStartEndpoints.startStaffAngle,
      },
      redAngles: {
        centerPathAngle: redStartEndpoints.startCenterAngle,
        staffRotationAngle: redStartEndpoints.startStaffAngle,
      },
      isValid: true,
    };
  }

  /**
   * Get motion data for debugging
   */
  getMotionData(stepData: StepData): { blue: MotionData; red: MotionData } {
    const blueMotion = stepData.motions.blue;
    const redMotion = stepData.motions.red;

    if (!blueMotion) {
      throw new Error("Blue motion data is missing for current beat.");
    }

    if (!redMotion) {
      throw new Error("Red motion data is missing for current beat.");
    }

    return {
      blue: blueMotion,
      red: redMotion,
    };
  }

  /**
   * Calculate endpoints for debugging
   */
  getEndpoints(stepData: StepData): {
    blue: MotionEndpoints;
    red: MotionEndpoints;
  } {
    const motionData = this.getMotionData(stepData);
    return {
      blue: this.endpointCalculator.calculateMotionEndpoints(motionData.blue),
      red: this.endpointCalculator.calculateMotionEndpoints(motionData.red),
    };
  }
}
