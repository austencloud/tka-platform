import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type {
  MotionColor,
  Orientation,
} from "../../../shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../../shared/domain/models/MotionData";

export interface IOrientationCalculator {
  calculateEndOrientation(motion: MotionData, color: MotionColor): Orientation;
  updateStartOrientations(
    nextStep: StepData,
    lastStep: StepData | StartPositionData
  ): StepData;
  updateEndOrientations(beat: StepData): StepData;
}
