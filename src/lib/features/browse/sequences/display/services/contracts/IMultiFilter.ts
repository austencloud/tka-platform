/**
 * Multi-Filter Contract
 *
 * Composes multiple filters with AND logic.
 * Delegates individual filter application to BrowseFilter.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ActiveFilter } from "../../../../shared/domain/models/multi-filter-models";
import type { BrowseFilterType } from "$lib/shared/persistence/domain/enums/FilteringEnums";
import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";

export interface IMultiFilter {
  /**
   * Apply all active filters sequentially (AND logic).
   * Each filter narrows the result set from the previous.
   */
  applyFilters(
    sequences: SequenceData[],
    filters: Map<string, ActiveFilter>
  ): SequenceData[];

  /**
   * Compute how many sequences would match if a candidate filter
   * were added to (or replaced within) the existing active filters.
   * Used for contextual count badges on filter options.
   */
  getFilteredCount(
    sequences: SequenceData[],
    candidateType: BrowseFilterType,
    candidateValue: BrowseFilterValue,
    otherFilters: Map<string, ActiveFilter>
  ): number;
}
