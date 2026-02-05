import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";

export interface IStepConverter {
  /**
   * Convert PictographData to StepData - creates proper domain object for steps
   */
  convertToStep(
    pictograph: PictographData,
    stepNumber: number,
    gridMode: GridMode
  ): StepData;

  /**
   * Convert PictographData to StartPositionData - creates proper domain object for start positions
   */
  convertToStartPosition(
    pictograph: PictographData,
    gridMode: GridMode
  ): StartPositionData;
}
