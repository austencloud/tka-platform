import type { GridLocation, MotionData, MotionType, PictographData } from "@tka/types";

export interface IArrowRotationCalculator {
  calculateRotation(
    motion: MotionData,
    location: GridLocation,
    pictographData?: PictographData
  ): Promise<number>;

  getSupportedMotionTypes(): MotionType[];

  validateMotionData(motion: MotionData): boolean;
}
