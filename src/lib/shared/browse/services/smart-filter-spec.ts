/**
 * Smart Collection filter-spec serialization.
 *
 * Bridges the headless BrowseEngine and the Firestore-safe SmartFilterSpec.
 * The engine holds filters as an in-memory Map<string, ActiveFilter>; a
 * SmartFilterSpec stores them as an array of plain objects (Firestore forbids
 * arrays-of-arrays, so the engine's [key, ActiveFilter] tuple form can't be
 * persisted directly).
 */

import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";
import type { BrowseSortMethod } from "$lib/shared/browse/domain/enums/browse-enums";
import { applyFilters } from "$lib/shared/browse/services/multi-filter";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { BrowseEngine, ActiveFilter } from "$lib/shared/browse/engine/types";
import type {
  SmartFilterSpec,
  StoredSmartFilter,
} from "$lib/shared/library/domain/models/collection";

/**
 * Serialize the engine's current NON-locked filters, source, and sort into a
 * Firestore-safe SmartFilterSpec.
 */
export function buildFilterSpecFromEngine(engine: BrowseEngine): SmartFilterSpec {
  const filters: StoredSmartFilter[] = [];
  for (const [key, f] of engine.activeFilters) {
    if (f.locked) continue;
    filters.push({
      key,
      type: String(f.type),
      value: f.value,
      label: f.label,
      chipColor: f.chipColor,
    });
  }
  return {
    source: engine.source,
    filters,
    sortMethod: String(engine.sortMethod),
    sortDirection: engine.sortDirection,
  };
}

/**
 * Replay a saved spec onto a fresh engine. Uses addFilter so composite loop /
 * TnD keys (which STACK) are reconstructed exactly, then applies the sort.
 * Call after creating the engine; the derived pipeline applies the filters
 * once the pool loads via initialize().
 */
export function applySpecToEngine(engine: BrowseEngine, spec: SmartFilterSpec): void {
  for (const f of spec.filters) {
    engine.addFilter(f.type as BrowseFilterType, f.value, f.label, f.chipColor);
  }
  engine.setSort(spec.sortMethod as BrowseSortMethod, spec.sortDirection);
}

/**
 * Pure derivation for tests and non-engine callers: filter a pool by a spec.
 * (The live detail view uses an engine; this mirrors its filter result.)
 */
export function deriveSpecMembers(
  pool: SequenceData[],
  spec: SmartFilterSpec
): SequenceData[] {
  const map = new Map<string, ActiveFilter>();
  for (const f of spec.filters) {
    map.set(f.key, {
      type: f.type as BrowseFilterType,
      value: f.value,
      label: f.label,
      chipColor: f.chipColor,
      locked: false,
    });
  }
  return applyFilters(pool, map);
}
