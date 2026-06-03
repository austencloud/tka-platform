/**
 * Multi-Filter
 *
 * Composes the browse-filter module functions to apply multiple filters
 * with AND logic. Each filter type narrows the result set.
 *
 * Stateless — plain module functions delegating to browse-filter's applyFilter.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";
import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/filtering-types";
import type { ActiveFilter } from "$lib/shared/browse/domain/multi-filter-models";
import { applyFilter } from "./browse-filter";

export function applyFilters(
  sequences: SequenceData[],
  filters: Map<string, ActiveFilter>
): SequenceData[] {
  let result = sequences;

  for (const filter of filters.values()) {
    result = applyFilter(result, filter.type, filter.value);
  }

  return result;
}

export function getFilteredCount(
  sequences: SequenceData[],
  candidateType: BrowseFilterType,
  candidateValue: BrowseFilterValue,
  otherFilters: Map<string, ActiveFilter>
): number {
  // First apply all other filters (excluding the candidate type)
  let filtered = sequences;

  for (const [key, filter] of otherFilters) {
    if (key === candidateType) continue;
    filtered = applyFilter(filtered, filter.type, filter.value);
  }

  // Then apply the candidate filter
  filtered = applyFilter(filtered, candidateType, candidateValue);

  return filtered.length;
}
