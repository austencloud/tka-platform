/**
 * OrientationCalculator — thin wrapper delegating to orientation-calculator module functions.
 * Kept for backward-compatible DI injection across existing consumers.
 */

import type { MotionColor, Orientation } from "../../../shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../../shared/domain/models/MotionData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import {
  calculateEndOrientation as _calculateEndOrientation,
  updateStartOrientations as _updateStartOrientations,
  updateEndOrientations as _updateEndOrientations,
} from "../orientation-calculator";

export class OrientationCalculator {
  calculateEndOrientation(motion: MotionData, color: MotionColor): Orientation {
    return _calculateEndOrientation(motion, color);
  }

  updateStartOrientations(
    nextStep: StepData,
    lastStep: StepData | StartPositionData
  ): StepData {
    return _updateStartOrientations(nextStep, lastStep);
  }

  updateEndOrientations(beat: StepData): StepData {
    return _updateEndOrientations(beat);
  }
}

export const orientationCalculator = new OrientationCalculator();
