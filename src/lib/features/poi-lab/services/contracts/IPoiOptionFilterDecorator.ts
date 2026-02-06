/**
 * Poi Option Filter Decorator Interface
 *
 * Filters pictograph options to only include poi-legal moves.
 * Used to constrain the option picker when poi is selected.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

export interface IPoiOptionFilterDecorator {
  /**
   * Filter options to only include poi-legal moves.
   *
   * For each option, validates:
   * - Motion constraints for any poi motions
   * - Transition constraints from previous pictograph (if provided)
   *
   * Non-poi motions pass through unfiltered.
   */
  filterPoiLegalOptions(
    options: readonly PictographData[],
    previousPictograph: PictographData | null
  ): PictographData[];
}
