import type { StepData, MotionData, MotionEndpoints } from "@tka/types";
import type { InterpolationResult } from "./IAnimationStateManager";

export interface IPropInterpolator {
  interpolatePropAngles(
    currentStepData: StepData,
    stepProgress: number
  ): InterpolationResult;
  calculateInitialAngles(firstStep: StepData): InterpolationResult;
  getMotionData(stepData: StepData): { blue: MotionData; red: MotionData };
  getEndpoints(stepData: StepData): {
    blue: MotionEndpoints;
    red: MotionEndpoints;
  };
}
