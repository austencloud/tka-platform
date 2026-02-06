/**
 * Arrow Rotation Calculator Interface
 *
 * Calculates arrow rotation angles based on motion type and location.
 */

import type { GridLocation } from "../../../../../grid/domain/enums/grid-enums";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { MotionType } from "../../../../../shared/domain/enums/pictograph-enums";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";

export interface IArrowRotationCalculator {
  /**
   * Calculate the arrow rotation angle based on motion type and location.
   */
  calculateRotation(
    motion: MotionData,
    location: GridLocation,
    pictographData?: PictographData
  ): Promise<number>;

  getSupportedMotionTypes(): MotionType[];

  validateMotionData(motion: MotionData): boolean;
}
