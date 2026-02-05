import type { StepData, MotionData, MotionEndpoints } from "@tka/types";
import { MotionType } from "@tka/types";
import type { IPropInterpolator } from "../contracts/IPropInterpolator";
import type { InterpolationResult } from "../contracts/IAnimationStateManager";
import type { IAngleCalculator } from "../contracts/IAngleCalculator";
import type { IEndpointCalculator } from "../contracts/IEndpointCalculator";

export class PropInterpolator implements IPropInterpolator {
  constructor(
    private angleCalculator: IAngleCalculator,
    private endpointCalculator: IEndpointCalculator
  ) {}

  interpolatePropAngles(
    currentStepData: StepData,
    stepProgress: number
  ): InterpolationResult {
    const blueMotion = currentStepData.motions?.blue;
    const redMotion = currentStepData.motions?.red;

    if (!blueMotion || !redMotion) {
      return {
        blueAngles: { centerPathAngle: 0, staffRotationAngle: 0 },
        redAngles: { centerPathAngle: 0, staffRotationAngle: 0 },
        isValid: false,
      };
    }

    const blueEndpoints =
      this.endpointCalculator.calculateMotionEndpoints(blueMotion);
    const redEndpoints =
      this.endpointCalculator.calculateMotionEndpoints(redMotion);

    const blueDash = blueMotion.motionType === MotionType.DASH;
    const redDash = redMotion.motionType === MotionType.DASH;

    const blueAngles = blueDash
      ? this.interpolateDashMotion(blueEndpoints, stepProgress)
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

    const redAngles = redDash
      ? this.interpolateDashMotion(redEndpoints, stepProgress)
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

    return {
      blueAngles,
      redAngles,
      isValid: true,
    };
  }

  private interpolateDashMotion(
    endpoints: MotionEndpoints,
    progress: number
  ): {
    centerPathAngle: number;
    staffRotationAngle: number;
    x?: number;
    y?: number;
  } {
    const startX = Math.cos(endpoints.startCenterAngle);
    const startY = Math.sin(endpoints.startCenterAngle);
    const endX = Math.cos(endpoints.targetCenterAngle);
    const endY = Math.sin(endpoints.targetCenterAngle);

    const currentX = startX + (endX - startX) * progress;
    const currentY = startY + (endY - startY) * progress;
    const centerPathAngle = Math.atan2(currentY, currentX);

    const staffRotationAngle = this.angleCalculator.normalizeAnglePositive(
      endpoints.startStaffAngle + endpoints.staffRotationDelta * progress
    );

    return { centerPathAngle, staffRotationAngle, x: currentX, y: currentY };
  }

  calculateInitialAngles(firstStep: StepData): InterpolationResult {
    const blueStartMotion = firstStep.motions?.blue;
    const redStartMotion = firstStep.motions?.red;

    if (!blueStartMotion || !redStartMotion) {
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

  getMotionData(stepData: StepData): { blue: MotionData; red: MotionData } {
    const blueMotion = stepData.motions.blue;
    const redMotion = stepData.motions.red;
    if (!blueMotion) throw new Error("Blue motion data is missing.");
    if (!redMotion) throw new Error("Red motion data is missing.");
    return { blue: blueMotion, red: redMotion };
  }

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
