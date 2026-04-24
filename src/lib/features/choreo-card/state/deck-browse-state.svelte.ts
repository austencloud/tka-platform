// src/lib/features/choreo-card/state/deck-browse-state.svelte.ts

import type { Deck } from '../domain/models/Deck';
import type { FilterState, AvailableFilters, SavedDeckBrowseState } from './deck-browse-types';
import { EMPTY_FILTERS, VTG_FAMILY_KEYS } from './deck-browse-types';

const STORAGE_KEY = 'deckBrowser.state';
const DEBOUNCE_MS = 300;

function loadFromStorage(): SavedDeckBrowseState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedDeckBrowseState;
  } catch {
    return null;
  }
}

function saveToStorage(state: SavedDeckBrowseState): void {
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

export function applyFilters(decks: Deck[], filters: FilterState, collection: 'LOOPs' | 'VTG'): Deck[] {
  let result = decks;

  if (collection === 'LOOPs' && filters.loopTypes.length > 0) {
    result = result.filter(d => filters.loopTypes.includes(d.loopType));
  }

  if (collection === 'VTG' && filters.vtgFamilies.length > 0) {
    result = result.filter(d =>
      filters.vtgFamilies.some(family =>
        d.families.some(f => f.id.toLowerCase().includes(family))
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

  return result;
}

export function computeAvailableFilters(decks: Deck[], collection: 'LOOPs' | 'VTG'): AvailableFilters {
  return {
    loopTypes: collection === 'LOOPs' ? unique(decks.map(d => d.loopType)).sort() : [],
    vtgFamilies: collection === 'VTG'
      ? VTG_FAMILY_KEYS.filter(key => decks.some(d => d.families.some(f => f.id.toLowerCase().includes(key))))
      : [],
    sliceTypes: unique(decks.map(d => d.sliceType)).sort(),
    gridModes: unique(decks.map(d => d.gridMode)).sort(),
    stepCounts: unique(decks.map(d => d.stepCount)).sort((a, b) => a - b),
    turnPatterns: unique(decks.map(d => d.turnPattern)).sort(),
  };
}

export function inferVtgFamily(deck: Deck): string {
  for (const key of VTG_FAMILY_KEYS) {
    if (deck.families.some(f => f.id.toLowerCase().includes(key))) return key;
  }
  return deck.loopType || 'unknown';
}

export function groupDecks(decks: Deck[], collection: 'LOOPs' | 'VTG'): Map<string, Deck[]> {
  const groups = new Map<string, Deck[]>();
  for (const deck of decks) {
    const key = collection === 'LOOPs' ? deck.loopType : inferVtgFamily(deck);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(deck);
  }
  return groups;
}

export function createDeckBrowseState(allDecksOrGetter: Deck[] | (() => Deck[])) {
  const getAllDecks = typeof allDecksOrGetter === 'function' ? allDecksOrGetter : () => allDecksOrGetter;

  const saved = typeof window !== 'undefined' ? loadFromStorage() : null;

  let collection = $state<'LOOPs' | 'VTG'>(saved?.collection ?? 'LOOPs');
  let filters = $state<FilterState>(saved?.filters ? { ...saved.filters } : { ...EMPTY_FILTERS });
  let scrollY = $state(saved?.scrollY ?? 0);

  const collectionDecks = $derived(getAllDecks().filter(d => d.collection === collection));
  const filteredDecks = $derived(applyFilters(collectionDecks, filters, collection));
  const groupedDecks = $derived(groupDecks(filteredDecks, collection));
  const availableFilters = $derived(computeAvailableFilters(collectionDecks, collection));
  const totalCount = $derived(filteredDecks.length);
  const totalSequences = $derived(filteredDecks.reduce((sum, d) => sum + d.totalSequences, 0));

  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const snapshot: SavedDeckBrowseState = { collection, filters, scrollY };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveToStorage(snapshot), DEBOUNCE_MS);
    return () => clearTimeout(saveTimer);
  });

  return {
    get collection() { return collection; },
    get filters() { return filters; },
    get filteredDecks() { return filteredDecks; },
    get groupedDecks() { return groupedDecks; },
    get availableFilters() { return availableFilters; },
    get totalCount() { return totalCount; },
    get totalSequences() { return totalSequences; },
    get scrollY() { return scrollY; },

    setCollection(c: 'LOOPs' | 'VTG') {
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

export type DeckBrowseState = ReturnType<typeof createDeckBrowseState>;
