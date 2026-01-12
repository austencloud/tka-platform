/**
 * Poi Sequence Validator Interface
 *
 * Validates entire sequences for poi legality by checking
 * all motions and transitions.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PoiValidationResult } from "../../domain/poi-models";

export interface IPoiSequenceValidator {
  /**
   * Validate an entire sequence for poi legality.
   *
   * Iterates through all pictographs, validating:
   * - Each poi motion against motion constraints
   * - Each transition between consecutive poi motions
   *
   * Only validates motions where propType is POI.
   * Mixed sequences (poi + static prop) are supported.
   */
  validateSequence(sequence: readonly PictographData[]): PoiValidationResult;

  /**
   * Validate a single pictograph in isolation.
   * Checks motion constraints only (no transitions).
   */
  validatePictograph(pictograph: PictographData): PoiValidationResult;
}
