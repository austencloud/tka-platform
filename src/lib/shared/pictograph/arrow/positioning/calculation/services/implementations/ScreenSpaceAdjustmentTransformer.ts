/**
 * Screen Space Adjustment Transformer
 *
 * Transforms screen-space adjustments (from WASD input) to reference values
 * that produce correct screen-space positions after directional tuple processing.
 *
 * Key insight: All directional tuple transformation matrices are self-inverse
 * (reflections and 90° rotations). Applying the same transformation twice
 * returns the original value. So:
 *
 * 1. User wants screen-space (0, -5) = move up
 * 2. We apply the forward transform → get reference value
 * 3. Store reference value
 * 4. On render, DirectionalTupleProcessor applies same transform
 * 5. Result: back to screen-space (0, -5) = arrow moves up ✓
 */

import { Point } from "fabric";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { GridLocation } from "../../../../../grid/domain/enums/grid-enums";
import type { IScreenSpaceAdjustmentTransformer } from "../contracts/IScreenSpaceAdjustmentTransformer";
import type { IDirectionalTupleCalculator } from "../contracts/IDirectionalTupleGenerator";
import type { IArrowQuadrantCalculator } from "../../../../orchestration/services/contracts/IArrowQuadrantCalculator";

export class ScreenSpaceAdjustmentTransformer
  implements IScreenSpaceAdjustmentTransformer
{
  constructor(
    private tupleCalculator: IDirectionalTupleCalculator,
    private quadrantCalculator: IArrowQuadrantCalculator
  ) {}

  /**
   * Transform screen-space adjustment to reference value.
   *
   * Since all transformation matrices are self-inverse, we apply the
   * same transformation that will be applied during rendering.
   * This ensures the final rendered position matches the user's intent.
   */
  transformToReference(
    screenSpaceAdjustment: Point,
    motionData: MotionData,
    location: GridLocation
  ): Point {
    try {
      // Generate the transformation tuples (same logic as DirectionalTupleProcessor)
      const tuples = this.tupleCalculator.generateDirectionalTuples(
        motionData,
        screenSpaceAdjustment.x,
        screenSpaceAdjustment.y
      );

      // Get quadrant index (same logic as DirectionalTupleProcessor)
      const quadrantIndex = this.quadrantCalculator.calculateQuadrantIndex(
        motionData,
        location
      );

      // Apply transformation (which is its own inverse)
      const selectedTuple = tuples[quadrantIndex] || [0, 0];

      return new Point(selectedTuple[0], selectedTuple[1]);
    } catch (error) {
      console.warn(
        "[ScreenSpaceAdjustmentTransformer] Transform failed, using original:",
        error
      );
      return screenSpaceAdjustment;
    }
  }
}
