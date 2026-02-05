import type { GridLocation, MotionData } from "@tka/types";

export interface IStaticLocationCalculator {
  calculateLocation(motion: MotionData): GridLocation;
}
