/**
 * Arrow Location Calculator Interface
 *
 * Calculates arrow locations based on motion data and pictograph context.
 */

import type { GridLocation } from "../../../../../grid/domain/enums/grid-enums";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { MotionType } from "../../../../../shared/domain/enums/pictograph-enums";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";

export interface IArrowLocationCalculator {
  /**
   * Calculate the arrow location based on motion type and data.
   */
  calculateLocation(
    motion: MotionData,
    pictographData?: PictographData
  ): GridLocation;

  getSupportedMotionTypes(): MotionType[];

  validateMotionData(motion: MotionData): boolean;

  isBlueArrowMotion(
    motion: MotionData,
    pictographData: PictographData
  ): boolean;
}
