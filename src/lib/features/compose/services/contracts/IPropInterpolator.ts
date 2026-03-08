/**
 * Prop Interpolation Service Interface
 *
 * Interface for prop interpolation and smooth transitions.
 * Handles angle calculations and motion data extraction.
 */

import type { StepData } from "../../../create/shared/domain/models/StepData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { MotionEndpoints } from "$lib/shared/pictograph/shared/domain/models/MotionEndpoints";
import type { InterpolationResult } from "./IAnimationStateManager";

export interface IPropInterpolator {
  interpolatePropAngles(
    currentStepData: StepData,
    stepProgress: number
  ): InterpolationResult;
  calculateInitialAngles(firstStep: StepData): InterpolationResult;
  getMotionData(stepData: StepData): {
    blue: MotionData | null;
    red: MotionData | null;
  };
  getEndpoints(stepData: StepData): {
    blue: MotionEndpoints | null;
    red: MotionEndpoints | null;
  };
}
