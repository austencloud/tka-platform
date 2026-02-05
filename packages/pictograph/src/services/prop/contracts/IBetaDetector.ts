import type { GridPosition, PictographData } from "@tka/types";

export interface IBetaDetector {
  isBetaPosition(position: GridPosition): boolean;
  startsWithBeta(pictographData: PictographData): boolean;
  endsWithBeta(pictographData: PictographData): boolean;
}
