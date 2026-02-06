/**
 * Screen Space Adjustment Transformer Contract
 *
 * Transforms screen-space adjustments (from WASD input) to reference values
 * that produce correct screen-space positions after directional tuple processing.
 *
 * The key insight is that all directional tuple transformation matrices are self-inverse
 * (reflections and 90° rotations). By applying the same transformation before storage,
 * the render-time transformation will cancel it out, resulting in the intended
 * screen-space movement.
 */

import type { Point } from "fabric";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { GridLocation } from "../../../../../grid/domain/enums/grid-enums";

export interface IScreenSpaceAdjustmentTransformer {
  /**
   * Transform screen-space adjustment to reference value.
   *
   * Flow:
   * 1. User presses WASD → screen-space adjustment (e.g., W = (0, -5) = up)
   * 2. This method applies the inverse transform (same matrix since self-inverse)
   * 3. Result is stored in global repo as reference value
   * 4. On render, DirectionalTupleProcessor applies forward transform
   * 5. Arrow moves in correct screen-space direction
   *
   * @param screenSpaceAdjustment - The adjustment in screen coordinates (from WASD input)
   * @param motionData - Motion data for determining transformation matrix
   * @param location - Arrow's grid location for quadrant selection
   * @returns Reference value to store that will produce correct screen-space position after rendering
   */
  transformToReference(
    screenSpaceAdjustment: Point,
    motionData: MotionData,
    location: GridLocation
  ): Point;
}
