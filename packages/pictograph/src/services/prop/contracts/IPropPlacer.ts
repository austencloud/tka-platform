import type { PictographData, MotionData, PropPlacementData } from "@tka/types";

export interface IPropPlacer {
  calculatePlacement(
    pictographData: PictographData,
    motionData: MotionData
  ): Promise<PropPlacementData>;
}
