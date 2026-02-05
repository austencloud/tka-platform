import type { GridLocation, PictographData, MotionData } from "@tka/types";
import type { Point } from "../../../../domain/Point";

export interface IArrowAdjustmentCalculator {
  calculateAdjustment(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    location: GridLocation,
    arrowColor?: string
  ): Promise<Point>;

  getBaseAdjustmentPublic(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    arrowColor?: string
  ): Promise<Point>;
}
