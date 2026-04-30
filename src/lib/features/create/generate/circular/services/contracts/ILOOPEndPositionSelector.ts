import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { LOOPType, Period } from "../../domain/models/circular-models";

/**
 * Service for determining required end positions for LOOP sequences
 *
 * Each LOOP type has specific requirements for where a partial sequence must end
 * in order to successfully complete the circular pattern.
 */
export interface ILOOPEndPositionSelector {
  /**
   * Determine the required end position for a LOOP sequence
   *
   * @param loopType - The type of LOOP being executed
   * @param startPosition - The starting grid position
   * @param period - The slice size (only used for rotated LOOP)
   * @returns The grid position where the partial sequence must end, or null if unconstrained
   */
  determineEndPosition(
    loopType: LOOPType,
    startPosition: GridPosition,
    period: Period
  ): GridPosition | null;
}
