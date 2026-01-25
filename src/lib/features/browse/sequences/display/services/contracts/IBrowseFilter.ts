/**
 * Service for filtering gallery sequences
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BrowseFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";

export interface IBrowseFilter {
  /**
   * Apply a filter to a list of sequences
   */
  applyFilter(
    sequences: SequenceData[],
    filterType: BrowseFilterType,
    filterValue: BrowseFilterValue
  ): SequenceData[];

  /**
   * Get available filter options for a given filter type
   */
  getFilterOptions(
    filterType: BrowseFilterType,
    sequences: SequenceData[]
  ): string[];
}
