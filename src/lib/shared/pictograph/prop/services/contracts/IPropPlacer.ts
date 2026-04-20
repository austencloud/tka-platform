/**
 * Prop Placement Service Interface
 *
 * Calculates prop placement data for pictograph rendering.
 */

import type { PictographData } from "../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../shared/domain/models/MotionData";
import type { PropPlacementData } from "../../domain/models/PropPlacementData";

/** Motion visibility passed into placement so that a hidden partner suppresses
 *  this prop's beta offset (no collision → no offset needed). Omitted fields
 *  default to visible. */
export interface PropPlacementVisibility {
  showBlue?: boolean;
  showRed?: boolean;
}

export interface IPropPlacer {
  calculatePlacement(
    pictographData: PictographData,
    motionData: MotionData,
    visibility?: PropPlacementVisibility
  ): Promise<PropPlacementData>;
}
