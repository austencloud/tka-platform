// deck-sort.ts - Sort methods and comparators for deck list.

import type { Deck } from "./models/Deck";

export enum DeckSortMethod {
  NAME = "name",
  LEVEL = "level",
  SEQUENCE_COUNT = "count",
}

export const DECK_SORT_LABELS: Record<DeckSortMethod, string> = {
  [DeckSortMethod.NAME]: "Name",
  [DeckSortMethod.LEVEL]: "Level",
  [DeckSortMethod.SEQUENCE_COUNT]: "Cards",
};

export const DECK_SORT_ICONS: Record<DeckSortMethod, string> = {
  [DeckSortMethod.NAME]: "fa-sort-alpha-down",
  [DeckSortMethod.LEVEL]: "fa-layer-group",
  [DeckSortMethod.SEQUENCE_COUNT]: "fa-sort-numeric-down",
};

const comparators: Record<DeckSortMethod, (a: Deck, b: Deck) => number> = {
  [DeckSortMethod.NAME]: (a, b) => a.name.localeCompare(b.name),
  [DeckSortMethod.LEVEL]: (a, b) => a.level - b.level || a.name.localeCompare(b.name),
  [DeckSortMethod.SEQUENCE_COUNT]: (a, b) => a.totalSequences - b.totalSequences || a.name.localeCompare(b.name),
};

export function sortDecks(decks: Deck[], method: DeckSortMethod): Deck[] {
  return [...decks].sort(comparators[method]);
}

/** Generate section labels for SectionIndexSidebar based on sort method. */
export function getDeckSectionKey(deck: Deck, method: DeckSortMethod): string {
  switch (method) {
    case DeckSortMethod.LEVEL:
      return `Level ${deck.level}`;
    case DeckSortMethod.SEQUENCE_COUNT: {
      if (deck.totalSequences < 100) return "< 100";
      if (deck.totalSequences < 1000) return "100-999";
      if (deck.totalSequences < 10000) return "1k-10k";
      return "10k+";
    }
    case DeckSortMethod.NAME:
    default:
      return deck.name.charAt(0).toUpperCase();
  }
}
