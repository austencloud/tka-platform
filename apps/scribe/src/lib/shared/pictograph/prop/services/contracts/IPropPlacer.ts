/**
 * Prop Placement Service Interface
 *
 * Calculates prop placement data for pictograph rendering.
 */

import type { PictographData } from "../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../shared/domain/models/MotionData";
import type { PropPlacementData } from "../../domain/models/PropPlacementData";

export interface IPropPlacer {
  calculatePlacement(
    pictographData: PictographData,
    motionData: MotionData
  ): Promise<PropPlacementData>;
}
