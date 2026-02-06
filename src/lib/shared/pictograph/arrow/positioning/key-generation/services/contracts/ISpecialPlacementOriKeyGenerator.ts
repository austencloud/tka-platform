/**
 * Special Placement Orientation Key Generator Contract
 */

import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";

export interface ISpecialPlacementOriKeyGenerator {
  generateOrientationKey(
    motionData: MotionData,
    pictographData: PictographData
  ): string;
}
