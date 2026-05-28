// src/lib/features/choreo-card/state/catalog-browse-state.svelte.ts

import type { Catalog } from '../domain/models/Catalog';
import type { FilterState, AvailableFilters, SavedCatalogBrowseState, TnDViewMode } from './catalog-browse-types';
import { EMPTY_FILTERS, TND_FAMILY_KEYS } from './catalog-browse-types';

const STORAGE_KEY = 'deckBrowser.state';
const DEBOUNCE_MS = 300;

function loadFromStorage(): SavedCatalogBrowseState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedCatalogBrowseState;
  } catch {
    return null;
  }
}

function saveToStorage(state: SavedCatalogBrowseState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded */ }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function toggleInArray<T>(arr: T[], value: T): T[] {
  const index = arr.indexOf(value);
  if (index >= 0) return [...arr.slice(0, index), ...arr.slice(index + 1)];
  return [...arr, value];
}

export function applyFilters(catalogs: Catalog[], filters: FilterState, collection: 'LOOPs' | 'TnD'): Catalog[] {
  let result = catalogs;

  if (collection === 'LOOPs' && filters.loopTypes.length > 0) {
    result = result.filter(d => filters.loopTypes.includes(d.loopType));
  }

  if (collection === 'TnD' && filters.tndFamilies.length > 0) {
    result = result.filter(d =>
      filters.tndFamilies.some(family =>
        (d.families ?? []).some(f => f.id.toLowerCase().includes(family))
      )
    );
  }

  if (filters.sliceTypes.length > 0) {
    result = result.filter(d => filters.sliceTypes.includes(d.sliceType));
  }
  if (filters.gridModes.length > 0) {
    result = result.filter(d => filters.gridModes.includes(d.gridMode));
  }
  if (filters.stepCounts.length > 0) {
    result = result.filter(d => filters.stepCounts.includes(d.stepCount));
  }
  if (filters.turnPatterns.length > 0) {
    result = result.filter(d => filters.turnPatterns.includes(d.turnPattern));
  }
  if (filters.reversalPatterns.length > 0) {
    result = result.filter(d => filters.reversalPatterns.includes(d.reversalPattern));
  }

  return result;
}

export function computeAvailableFilters(catalogs: Catalog[], collection: 'LOOPs' | 'TnD'): AvailableFilters {
  return {
    loopTypes: collection === 'LOOPs' ? unique(catalogs.map(d => d.loopType)).sort() : [],
    tndFamilies: collection === 'TnD'
      ? TND_FAMILY_KEYS.filter(key => catalogs.some(d => (d.families ?? []).some(f => f.id.toLowerCase().includes(key))))
      : [],
    sliceTypes: unique(catalogs.map(d => d.sliceType)).sort(),
    gridModes: unique(catalogs.map(d => d.gridMode)).sort(),
    stepCounts: unique(catalogs.map(d => d.stepCount)).sort((a, b) => a - b),
    turnPatterns: unique(catalogs.map(d => d.turnPattern)).sort(),
    reversalPatterns: unique(catalogs.map(d => d.reversalPattern)).filter(Boolean).sort(),
  };
}

export function inferTnDFamily(catalog: Catalog): string {
  for (const key of TND_FAMILY_KEYS) {
    if ((catalog.families ?? []).some(f => f.id.toLowerCase().includes(key))) return key;
  }
  return catalog.loopType || 'unknown';
}

export function groupCatalogs(catalogs: Catalog[], collection: 'LOOPs' | 'TnD'): Map<string, Catalog[]> {
  const groups = new Map<string, Catalog[]>();
  for (const catalog of catalogs) {
    const key = collection === 'LOOPs' ? catalog.loopType : inferTnDFamily(catalog);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(catalog);
  }
  return groups;
}

export function createCatalogBrowseState(allCatalogsOrGetter: Catalog[] | (() => Catalog[])) {
  const getAllCatalogs = typeof allCatalogsOrGetter === 'function' ? allCatalogsOrGetter : () => allCatalogsOrGetter;

  const saved = typeof window !== 'undefined' ? loadFromStorage() : null;

  let collection = $state<'LOOPs' | 'TnD'>(saved?.collection ?? 'LOOPs');
  let filters = $state<FilterState>(saved?.filters ? { ...saved.filters } : { ...EMPTY_FILTERS });
  let scrollY = $state(saved?.scrollY ?? 0);
  let tndViewMode = $state<TnDViewMode>(saved?.tndViewMode ?? 'turns');

  const collectionCatalogs = $derived(getAllCatalogs().filter(d => d.collection === collection));
  const filteredCatalogs = $derived(applyFilters(collectionCatalogs, filters, collection));
  const groupedCatalogs = $derived(groupCatalogs(filteredCatalogs, collection));
  const availableFilters = $derived(computeAvailableFilters(collectionCatalogs, collection));
  const totalCount = $derived(filteredCatalogs.length);
  const totalSequences = $derived(filteredCatalogs.reduce((sum, d) => sum + d.totalSequences, 0));

  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const snapshot: SavedCatalogBrowseState = { collection, filters, scrollY, tndViewMode };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveToStorage(snapshot), DEBOUNCE_MS);
    return () => clearTimeout(saveTimer);
  });

  return {
    get collection() { return collection; },
    get filters() { return filters; },
    get filteredCatalogs() { return filteredCatalogs; },
    get groupedCatalogs() { return groupedCatalogs; },
    get availableFilters() { return availableFilters; },
    get totalCount() { return totalCount; },
    get totalSequences() { return totalSequences; },
    get scrollY() { return scrollY; },
    get tndViewMode() { return tndViewMode; },

    setTnDViewMode(mode: TnDViewMode) { tndViewMode = mode; },

    setCollection(c: 'LOOPs' | 'TnD') {
      collection = c;
      filters = { ...EMPTY_FILTERS };
      scrollY = 0;
    },

    toggleFilter(dimension: keyof FilterState, value: string | number) {
      const current = filters[dimension] as (string | number)[];
      filters = { ...filters, [dimension]: toggleInArray(current, value) };
    },

    clearFilters() {
      filters = { ...EMPTY_FILTERS };
    },

    setScrollY(y: number) {
      scrollY = y;
    },
  };
}

export type CatalogBrowseState = ReturnType<typeof createCatalogBrowseState>;
