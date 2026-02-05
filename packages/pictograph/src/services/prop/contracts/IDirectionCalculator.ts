import type { MotionData, VectorDirection } from "@tka/types";

export interface IDirectionCalculator {
  calculate(motionData: MotionData): VectorDirection | null;
}
