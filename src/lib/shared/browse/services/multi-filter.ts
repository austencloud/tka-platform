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

// Accept any structural subtype of ActiveFilter (e.g. the engine's variant that
// adds a `locked` flag). Both functions only read `.type` and `.value`, so a
// generic over `T extends ActiveFilter` lets callers pass their richer map
// without an invariance-defeating cast at the call site.
export function applyFilters<T extends ActiveFilter>(
  sequences: SequenceData[],
  filters: Map<string, T>
): SequenceData[] {
  let result = sequences;

  for (const filter of filters.values()) {
    result = applyFilter(result, filter.type, filter.value);
  }

  return result;
}

export function getFilteredCount<T extends ActiveFilter>(
  sequences: SequenceData[],
  candidateType: BrowseFilterType,
  candidateValue: BrowseFilterValue,
  otherFilters: Map<string, T>
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
