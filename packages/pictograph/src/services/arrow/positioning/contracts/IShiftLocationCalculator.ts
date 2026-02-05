import type { GridLocation, MotionData } from "@tka/types";

export interface IShiftLocationCalculator {
  calculateLocation(motion: MotionData): GridLocation;
}
