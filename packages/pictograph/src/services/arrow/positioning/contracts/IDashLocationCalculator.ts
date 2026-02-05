import type { GridLocation, GridMode, MotionData, PictographData } from "@tka/types";
import type { LetterType } from "@tka/types";

export interface IDashLocationCalculator {
  calculateDashLocationFromPictographData(
    pictographData: PictographData,
    isBlueArrow: boolean
  ): GridLocation;
  calculateDashLocation(
    motion: MotionData,
    otherMotion?: MotionData,
    letterType?: LetterType,
    gridMode?: GridMode,
    shiftLocation?: GridLocation,
    isPhiDash?: boolean,
    isPsiDash?: boolean,
    isLambda?: boolean,
    isLambdaDash?: boolean
  ): GridLocation;
}
