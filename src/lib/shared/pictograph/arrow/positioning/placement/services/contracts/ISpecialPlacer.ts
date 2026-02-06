/**
 * Special Placer Contract
 */

import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { Point } from "fabric";

export interface ISpecialPlacer {
  getSpecialAdjustment(
    motionData: MotionData,
    pictographData: PictographData,
    arrowColor?: string,
    attributeKey?: string
  ): Promise<Point | null>;

  hasRotationAngleOverride(
    motionData: MotionData,
    pictographData: PictographData,
    rotationOverrideKey: string
  ): Promise<boolean>;
}
