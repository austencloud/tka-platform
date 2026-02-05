import type { ArrowPlacementData, MotionData } from "@tka/types";

export interface IArrowPathResolver {
  getArrowPath(
    arrowData: ArrowPlacementData,
    motionData: MotionData
  ): string | null;
  getArrowSvgPath(motionData: MotionData | undefined): string;
}
