/**
 * Service for filtering gallery sequences
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ExploreFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
import type { ExploreFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";

export interface IDiscoverFilter {
  /**
   * Apply a filter to a list of sequences
   */
  applyFilter(
    sequences: SequenceData[],
    filterType: ExploreFilterType,
    filterValue: ExploreFilterValue
  ): SequenceData[];

  /**
   * Get available filter options for a given filter type
   */
  getFilterOptions(
    filterType: ExploreFilterType,
    sequences: SequenceData[]
  ): string[];
}
