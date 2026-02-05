import type { GridLocation, MotionData, MotionType, PictographData } from "@tka/types";

export interface IArrowLocationCalculator {
  calculateLocation(
    motion: MotionData,
    pictographData: PictographData
  ): GridLocation;

  getSupportedMotionTypes(): MotionType[];

  validateMotionData(motion: MotionData): boolean;

  isBlueArrowMotion(
    motion: MotionData,
    pictographData: PictographData
  ): boolean;
}
