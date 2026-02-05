/**
 * Arrow Placement Key Generator Contract
 *
 * Generates placement keys for arrow positioning lookups.
 * Simplified version of the desktop PlacementKeyGenerator logic.
 */

import type { MotionType } from "../../../../../shared/domain/enums/pictograph-enums";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";

export interface IArrowPlacementKeyGenerator {
  generatePlacementKey(
    motionData: MotionData,
    pictographData: PictographData,
    availableKeys: string[]
  ): string;

  generateBasicKey(motionType: MotionType): string;
}
