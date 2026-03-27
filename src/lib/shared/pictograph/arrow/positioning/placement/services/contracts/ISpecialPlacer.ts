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

  /**
   * Get the special adjustment from static JSON only (no global overrides).
   * Used by diagnostics to show what the JSON file contains independently.
   * Returns the raw value plus the file path and turns tuple key for display.
   */
  getSpecialJsonAdjustmentOnly(
    motionData: MotionData,
    pictographData: PictographData,
    arrowColor?: string,
    attributeKey?: string
  ): Promise<{ adjustment: Point; filePath: string; turnsTupleKey: string } | null>;
}
