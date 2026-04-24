// tests/unit/deck-browse/deck-browse-filters.test.ts

import { describe, it, expect } from 'vitest';
import {
  applyFilters,
  computeAvailableFilters,
  groupDecks,
  toggleInArray,
  inferVtgFamily,
} from '$lib/features/choreo-card/state/deck-browse-state.svelte';
import { EMPTY_FILTERS } from '$lib/features/choreo-card/state/deck-browse-types';
import type { Deck } from '$lib/features/choreo-card/domain/models/Deck';

function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: overrides.id ?? 'deck-1',
    name: 'Test',
    canonicalName: 'test',
    description: '',
    families: overrides.families ?? [{ id: 'fam-1', label: 'Fam', typeCombo: 'pro-iso', sequenceIds: ['s1'] }],
    totalSequences: overrides.totalSequences ?? 10,
    gridMode: overrides.gridMode ?? 'diamond',
    level: 1,
    collection: overrides.collection ?? 'LOOPs',
    loopType: overrides.loopType ?? 'rotated',
    sliceType: overrides.sliceType ?? 'halved',
    stepCount: overrides.stepCount ?? 4,
    turnPattern: overrides.turnPattern ?? 'uniform-0t',
    reversalPattern: overrides.reversalPattern ?? 'continuous',
  } as Deck;
}

describe('toggleInArray', () => {
  it('adds value when not present', () => {
    expect(toggleInArray(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
  });

  it('removes value when present', () => {
    expect(toggleInArray(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('works with numbers', () => {
    expect(toggleInArray([4, 6], 8)).toEqual([4, 6, 8]);
    expect(toggleInArray([4, 6, 8], 6)).toEqual([4, 8]);
  });
});

describe('applyFilters', () => {
  const decks = [
    makeDeck({ id: '1', loopType: 'rotated', stepCount: 4, sliceType: 'halved', gridMode: 'diamond' }),
    makeDeck({ id: '2', loopType: 'mirrored', stepCount: 4, sliceType: 'halved', gridMode: 'diamond' }),
    makeDeck({ id: '3', loopType: 'rotated', stepCount: 8, sliceType: 'quartered', gridMode: 'box' }),
    makeDeck({ id: '4', loopType: 'flipped', stepCount: 6, sliceType: 'halved', gridMode: 'diamond' }),
  ];

  it('returns all decks with empty filters', () => {
    const result = applyFilters(decks, EMPTY_FILTERS, 'LOOPs');
    expect(result).toHaveLength(4);
  });

  it('filters by loopType (OR within dimension)', () => {
    const filters = { ...EMPTY_FILTERS, loopTypes: ['rotated', 'flipped'] };
    const result = applyFilters(decks, filters, 'LOOPs');
    expect(result.map(d => d.id)).toEqual(['1', '3', '4']);
  });

  it('filters by stepCount', () => {
    const filters = { ...EMPTY_FILTERS, stepCounts: [4] };
    const result = applyFilters(decks, filters, 'LOOPs');
    expect(result.map(d => d.id)).toEqual(['1', '2']);
  });

  it('AND across dimensions', () => {
    const filters = { ...EMPTY_FILTERS, loopTypes: ['rotated'], stepCounts: [8] };
    const result = applyFilters(decks, filters, 'LOOPs');
    expect(result.map(d => d.id)).toEqual(['3']);
  });

  it('returns empty when no match', () => {
    const filters = { ...EMPTY_FILTERS, loopTypes: ['rotated'], stepCounts: [6] };
    const result = applyFilters(decks, filters, 'LOOPs');
    expect(result).toHaveLength(0);
  });
});

describe('applyFilters VTG', () => {
  const decks = [
    makeDeck({
      id: 'v1', collection: 'VTG',
      families: [{ id: 'split-same-pro-iso', label: 'SS', typeCombo: 'pro-iso', sequenceIds: ['s1'] }],
    }),
    makeDeck({
      id: 'v2', collection: 'VTG',
      families: [{ id: 'tog-opp-anti-iso', label: 'TO', typeCombo: 'anti-iso', sequenceIds: ['s2'] }],
    }),
  ];

  it('filters VTG by vtgFamilies', () => {
    const filters = { ...EMPTY_FILTERS, vtgFamilies: ['split-same'] };
    const result = applyFilters(decks, filters, 'VTG');
    expect(result.map(d => d.id)).toEqual(['v1']);
  });
});

describe('groupDecks', () => {
  const decks = [
    makeDeck({ id: '1', loopType: 'rotated' }),
    makeDeck({ id: '2', loopType: 'mirrored' }),
    makeDeck({ id: '3', loopType: 'rotated' }),
  ];

  it('groups LOOPs by loopType', () => {
    const groups = groupDecks(decks, 'LOOPs');
    expect(groups.size).toBe(2);
    expect(groups.get('rotated')?.map(d => d.id)).toEqual(['1', '3']);
    expect(groups.get('mirrored')?.map(d => d.id)).toEqual(['2']);
  });
});

describe('inferVtgFamily', () => {
  it('infers from family id', () => {
    const deck = makeDeck({
      families: [{ id: 'quarter-opp-anti-iso', label: 'QO', typeCombo: 'anti-iso', sequenceIds: ['s1'] }],
    });
    expect(inferVtgFamily(deck)).toBe('quarter-opp');
  });

  it('falls back to loopType when no family matches', () => {
    const deck = makeDeck({ loopType: 'rotated', families: [{ id: 'custom', label: 'C', typeCombo: 'c', sequenceIds: [] }] });
    expect(inferVtgFamily(deck)).toBe('rotated');
  });
});

describe('computeAvailableFilters', () => {
  const decks = [
    makeDeck({ loopType: 'rotated', stepCount: 4, sliceType: 'halved', gridMode: 'diamond', turnPattern: 'uniform-0t' }),
    makeDeck({ loopType: 'mirrored', stepCount: 8, sliceType: 'quartered', gridMode: 'box', turnPattern: 'uniform-1t' }),
  ];

  it('extracts unique values for LOOPs', () => {
    const av = computeAvailableFilters(decks, 'LOOPs');
    expect(av.loopTypes).toEqual(['mirrored', 'rotated']);
    expect(av.stepCounts).toEqual([4, 8]);
    expect(av.sliceTypes).toEqual(['halved', 'quartered']);
    expect(av.gridModes).toEqual(['box', 'diamond']);
    expect(av.turnPatterns).toEqual(['uniform-0t', 'uniform-1t']);
    expect(av.vtgFamilies).toEqual([]);
  });
});
