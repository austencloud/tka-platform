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
import type { InterpolationResult } from "../contracts/IAnimationStateManager";
import type { AngleCalculator } from "./AngleCalculator";
import type { EndpointCalculator } from "./EndpointCalculator";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

/**
 * Returns true if this motion type should use Cartesian (straight-line) interpolation.
 * DASH always uses linear. PRO, ANTI, and FLOAT (arc/shift motions) use linear only when
 * the user has enabled "linear" pathShape in animation visibility settings.
 * STATIC is unaffected - it doesn't move at all.
 */
function shouldUseLinear(motionType: MotionType): boolean {
  if (motionType === MotionType.DASH) return true;
  // Arc motions (PRO, ANTI, FLOAT) can toggle between arc and linear.
  if (
    motionType === MotionType.PRO ||
    motionType === MotionType.ANTI ||
    motionType === MotionType.FLOAT
  ) {
    return getAnimationVisibilityManager().getPathShape() === "linear";
  }
  return false;
}

export class PropInterpolator {
  constructor(
    private angleCalculator: AngleCalculator,
    private endpointCalculator: EndpointCalculator
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

    // Both hands missing = truly invalid
    if (!blueMotion && !redMotion) {
      return {
        blueAngles: null,
        redAngles: null,
        isValid: false,
      };
    }

    // Interpolate blue prop (null if not present)
    let blueAngles: InterpolationResult["blueAngles"] = null;
    if (blueMotion) {
      const blueEndpoints =
        this.endpointCalculator.calculateMotionEndpoints(blueMotion);
      const blueDash = shouldUseLinear(blueMotion.motionType);
      blueAngles = blueDash
        ? this.interpolateLinearMotion(blueEndpoints, stepProgress)
        : {
            centerPathAngle: this.angleCalculator.lerpAngle(
              blueEndpoints.startCenterAngle,
              blueEndpoints.targetCenterAngle,
              stepProgress
            ),
            staffRotationAngle: this.angleCalculator.normalizeAnglePositive(
              blueEndpoints.startStaffAngle +
                blueEndpoints.staffRotationDelta * stepProgress
            ),
          };
    }

    // Interpolate red prop (null if not present)
    let redAngles: InterpolationResult["redAngles"] = null;
    if (redMotion) {
      const redEndpoints =
        this.endpointCalculator.calculateMotionEndpoints(redMotion);
      const redDash = shouldUseLinear(redMotion.motionType);
      redAngles = redDash
        ? this.interpolateLinearMotion(redEndpoints, stepProgress)
        : {
            centerPathAngle: this.angleCalculator.lerpAngle(
              redEndpoints.startCenterAngle,
              redEndpoints.targetCenterAngle,
              stepProgress
            ),
            staffRotationAngle: this.angleCalculator.normalizeAnglePositive(
              redEndpoints.startStaffAngle +
                redEndpoints.staffRotationDelta * stepProgress
            ),
          };
    }

    return {
      blueAngles,
      redAngles,
      isValid: true,
    };
  }

  /**
   * Interpolate motion using Cartesian coordinates (straight line path)
   * Used for DASH motions and shifts when pathShape is "linear"
   * Returns angle for compatibility, but the angle will be recalculated from x,y in the renderer
   */
  private interpolateLinearMotion(
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

    // Both hands missing = truly invalid
    if (!blueStartMotion && !redStartMotion) {
      return {
        blueAngles: null,
        redAngles: null,
        isValid: false,
      };
    }

    // Calculate angles for whichever hand is present (null for missing hand)
    let blueAngles: InterpolationResult["blueAngles"] = null;
    if (blueStartMotion) {
      const blueStartEndpoints =
        this.endpointCalculator.calculateMotionEndpoints(blueStartMotion);
      blueAngles = {
        centerPathAngle: blueStartEndpoints.startCenterAngle,
        staffRotationAngle: blueStartEndpoints.startStaffAngle,
      };
    }

    let redAngles: InterpolationResult["redAngles"] = null;
    if (redStartMotion) {
      const redStartEndpoints =
        this.endpointCalculator.calculateMotionEndpoints(redStartMotion);
      redAngles = {
        centerPathAngle: redStartEndpoints.startCenterAngle,
        staffRotationAngle: redStartEndpoints.startStaffAngle,
      };
    }

    return {
      blueAngles,
      redAngles,
      isValid: true,
    };
  }

  /**
   * Get motion data for debugging (supports single-hand beats)
   */
  getMotionData(stepData: StepData): {
    blue: MotionData | null;
    red: MotionData | null;
  } {
    return {
      blue: stepData.motions?.blue ?? null,
      red: stepData.motions?.red ?? null,
    };
  }

  /**
   * Calculate endpoints for debugging (supports single-hand beats)
   */
  getEndpoints(stepData: StepData): {
    blue: MotionEndpoints | null;
    red: MotionEndpoints | null;
  } {
    const motionData = this.getMotionData(stepData);
    return {
      blue: motionData.blue
        ? this.endpointCalculator.calculateMotionEndpoints(motionData.blue)
        : null,
      red: motionData.red
        ? this.endpointCalculator.calculateMotionEndpoints(motionData.red)
        : null,
    };
  }
}
