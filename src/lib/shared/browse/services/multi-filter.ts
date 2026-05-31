/**
 * Multi-Filter
 *
 * Composes the existing BrowseFilter to apply multiple filters
 * with AND logic. Each filter type narrows the result set.
 *
 * Stateless — plain module functions. BrowseFilter has no instance state, so a
 * single module-level instance replaces the former ctor injection (the getter
 * created exactly one `new BrowseFilter()` per app).
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";
import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/filtering-types";
import type { ActiveFilter } from "$lib/shared/browse/domain/multi-filter-models";
import { BrowseFilter } from "./browse-filter";

const browseFilter = new BrowseFilter();

export function applyFilters(
  sequences: SequenceData[],
  filters: Map<string, ActiveFilter>
): SequenceData[] {
  let result = sequences;

  for (const filter of filters.values()) {
    result = browseFilter.applyFilter(result, filter.type, filter.value);
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
    filtered = browseFilter.applyFilter(filtered, filter.type, filter.value);
  }

  // Then apply the candidate filter
  filtered = browseFilter.applyFilter(filtered, candidateType, candidateValue);

  return filtered.length;
}
