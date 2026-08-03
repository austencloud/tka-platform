/**
 * Multi-Filter
 *
 * Composes the browse-filter module functions to apply multiple filters.
 * Categories compose with AND logic against each other; WITHIN a category the
 * semantics depend on the attribute:
 *
 * - Single-valued attributes (a sequence has exactly ONE start position,
 *   level, length, starting letter, grid mode, creator) stack as
 *   ALTERNATIVES: several selected values mean "matches ANY of these".
 *   AND-ing them would always produce zero results.
 * - Property-contains attributes (LOOP components, TnD families — a sequence
 *   can be mirrored AND swapped, can touch several families) stack as
 *   REQUIREMENTS: each selected value narrows further.
 *
 * Stateless — plain module functions delegating to browse-filter's applyFilter.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";
import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/filtering-types";
import type { ActiveFilter } from "$lib/shared/browse/domain/multi-filter-models";
import { applyFilter } from "./browse-filter";

/** Single-valued categories whose stacked values are alternatives (OR). */
export const OR_STACKING_TYPES: ReadonlySet<BrowseFilterType> = new Set([
  BrowseFilterType.DIFFICULTY,
  BrowseFilterType.LENGTH,
  BrowseFilterType.STARTING_LETTER,
  BrowseFilterType.STARTING_POSITION,
  BrowseFilterType.GRID_MODE,
  BrowseFilterType.OWNER,
]);

// Accept any structural subtype of ActiveFilter (e.g. the engine's variant that
// adds a `locked` flag). All functions only read `.type` and `.value`, so a
// generic over `T extends ActiveFilter` lets callers pass their richer map
// without an invariance-defeating cast at the call site.
export function applyFilters<T extends ActiveFilter>(
  sequences: SequenceData[],
  filters: Map<string, T>
): SequenceData[] {
  let result = sequences;
  const orGroups = new Map<BrowseFilterType, BrowseFilterValue[]>();

  for (const filter of filters.values()) {
    if (OR_STACKING_TYPES.has(filter.type)) {
      const group = orGroups.get(filter.type) ?? [];
      group.push(filter.value);
      orGroups.set(filter.type, group);
    } else {
      result = applyFilter(result, filter.type, filter.value);
    }
  }

  for (const [type, values] of orGroups) {
    if (values.length === 1) {
      result = applyFilter(result, type, values[0]!);
      continue;
    }
    const keep = new Set<string>();
    for (const value of values) {
      for (const seq of applyFilter(result, type, value)) keep.add(seq.id);
    }
    result = result.filter((seq) => keep.has(seq.id));
  }

  return result;
}

export function getFilteredCount<T extends ActiveFilter>(
  sequences: SequenceData[],
  candidateType: BrowseFilterType,
  candidateValue: BrowseFilterValue,
  otherFilters: Map<string, T>
): number {
  // Facet-count convention: a candidate value's count reflects the pool under
  // every OTHER category. For OR-stacking categories the candidate's own
  // category is excluded entirely — selecting a sibling value must not zero
  // its alternatives (they are alternatives, not requirements). For
  // requirement-stacking categories (LOOPs/TnD) same-type selections stay in,
  // so counts stay contextual ("mirrored AND swapped").
  const rest = new Map<string, T>();
  for (const [key, filter] of otherFilters) {
    if (key === candidateType) continue;
    if (OR_STACKING_TYPES.has(candidateType) && filter.type === candidateType) {
      continue;
    }
    rest.set(key, filter);
  }

  return applyFilter(
    applyFilters(sequences, rest),
    candidateType,
    candidateValue
  ).length;
}
