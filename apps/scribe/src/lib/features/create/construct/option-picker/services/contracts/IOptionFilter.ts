/**
 * Filter Service Contract
 *
 * Handles filtering of pictograph options by type, end position, and reversals.
 * Extracted from OptionPickerService for better separation of concerns.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type {
  EndPositionFilter,
  ReversalFilter,
  TypeFilter,
} from "../../domain/option-picker-types";

export interface IOptionFilter {
  /**
   * Apply type filtering to options
   */
  applyTypeFiltering(
    options: PictographData[],
    typeFilter: TypeFilter
  ): PictographData[];

  /**
   * Apply end position filtering to options
   */
  applyEndPositionFiltering(
    options: PictographData[],
    endPositionFilter: EndPositionFilter
  ): PictographData[];

  /**
   * Apply reversal filtering to options
   * @param options - Options to filter
   * @param reversalFilter - Reversal filter criteria
   * @param sequence - Current sequence for context-based reversal detection
   */
  applyReversalFiltering(
    options: PictographData[],
    reversalFilter: ReversalFilter,
    sequence: PictographData[]
  ): PictographData[];

  /**
   * Filter pictographs by letter type
   */
  filterPictographsByType(
    pictographs: PictographData[],
    letterType: string
  ): PictographData[];
}
