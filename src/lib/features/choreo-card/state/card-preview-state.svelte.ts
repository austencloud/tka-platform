import type { Deck } from "../domain/models/Deck";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { DeckLoader } from "../services/implementations/DeckLoader";
import type { PrintRenderOptions } from "../services/contracts/types";
import { CARD_SIZES, type CardSizeId } from "../domain/card-sizes";

export type CardPreviewSource = 'loops' | 'vtg';

export interface VisibilitySettings {
  showGrid: boolean;
  showTKA: boolean;
  showWord: boolean;
  includeStartPosition: boolean;
  handPointsVisible: boolean;
  theme: string;
}

interface BreadcrumbSegment {
  label: string;
  level: 0 | 1 | 2;
}

const STORAGE_CARD_SIZE = 'cardPreview.cardSize';
const STORAGE_SOURCE = 'cardPreview.source';
const STORAGE_DECK_ID = 'cardPreview.deckId';

// Decks with this many sequences or more use lazy-loading per family subset
// rather than loading everything upfront on deck selection.
const LARGE_DECK_THRESHOLD = 500;

function getStored(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

function persist(key: string, value: string | null) {
  if (typeof window === 'undefined') return;
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

export function createCardPreviewState(
  deckLoader: DeckLoader,
  allDecks: Deck[]
) {
  // ── Navigation ──────────────────────────────────────────────────────────────
  let level = $state<0 | 1 | 2>(0);
  let selectedSource = $state<CardPreviewSource | null>(
    (getStored(STORAGE_SOURCE) as CardPreviewSource) ?? null
  );
  let selectedDeck = $state<Deck | null>(null);

  // ── Card configuration ───────────────────────────────────────────────────────
  let cardSize = $state<CardSizeId>(
    (getStored(STORAGE_CARD_SIZE) as CardSizeId) ?? 'poker'
  );

  // ── Subset filters ───────────────────────────────────────────────────────────
  let selectedFamilyIds = $state<string[]>([]);
  let startPositionFilter = $state<string | null>(null);

  // ── Sequences ────────────────────────────────────────────────────────────────
  let sequences = $state<SequenceData[]>([]);
  let isLoading = $state(false);
  let renderProgress = $state(0);
  let renderTotal = $state(0);

  // ── Derived ──────────────────────────────────────────────────────────────────

  // True when the selected deck is large enough to warrant on-demand family loading.
  let isLargeDeck = $derived(
    (selectedDeck?.totalSequences ?? 0) >= LARGE_DECK_THRESHOLD
  );

  // Applies active family and start-position filters to the loaded sequence set.
  let filteredSequences = $derived.by(() => {
    let result = sequences;

    if (selectedFamilyIds.length > 0) {
      const idSet = new Set(selectedFamilyIds);
      const seqIds = new Set(
        selectedDeck?.families
          .filter(f => idSet.has(f.id))
          .flatMap(f => [...f.sequenceIds]) ?? []
      );
      result = result.filter(s => seqIds.has(s.id));
    }

    if (startPositionFilter) {
      result = result.filter(
        s => s.startingPositionGroup === startPositionFilter
      );
    }

    return result;
  });

  // Trail of labels the user can click to jump back up the hierarchy.
  let breadcrumbs = $derived.by<BreadcrumbSegment[]>(() => {
    const crumbs: BreadcrumbSegment[] = [{ label: 'Card Preview', level: 0 }];
    if (selectedSource) {
      crumbs.push({
        label: selectedSource === 'loops' ? 'LOOP Decks' : 'VTG Decks',
        level: 1,
      });
    }
    if (selectedDeck) {
      crumbs.push({ label: selectedDeck.name, level: 2 });
    }
    return crumbs;
  });

  // ── Private helpers ──────────────────────────────────────────────────────────

  async function loadDeckSequences(deck: Deck) {
    isLoading = true;
    sequences = [];
    try {
      const loaded = await deckLoader.loadDeckSequences(deck.id);
      sequences = loaded;
    } finally {
      isLoading = false;
    }
  }

  // Merges newly-fetched family sequences into the existing list without duplicates.
  async function loadFamilySequences(deck: Deck, familyIds: string[]) {
    isLoading = true;
    try {
      const seqIds = deck.families
        .filter(f => familyIds.includes(f.id))
        .flatMap(f => [...f.sequenceIds]);
      const loaded = await deckLoader.loadSequencesByIds(deck.id, seqIds);
      const existingIds = new Set(sequences.map(s => s.id));
      const newSeqs = loaded.filter(s => !existingIds.has(s.id));
      sequences = [...sequences, ...newSeqs];
    } finally {
      isLoading = false;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  return {
    // Getters
    get level() { return level; },
    get selectedSource() { return selectedSource; },
    get selectedDeck() { return selectedDeck; },
    get breadcrumbs() { return breadcrumbs; },
    get cardSize() { return cardSize; },
    get selectedFamilyIds() { return selectedFamilyIds; },
    get startPositionFilter() { return startPositionFilter; },
    get filteredSequences() { return filteredSequences; },
    get isLoading() { return isLoading; },
    get isLargeDeck() { return isLargeDeck; },
    get renderProgress() { return renderProgress; },
    get renderTotal() { return renderTotal; },

    // Setters (external mutations allowed for render pipeline progress tracking)
    set cardSize(v: CardSizeId) {
      cardSize = v;
      persist(STORAGE_CARD_SIZE, v);
    },
    set renderProgress(v: number) { renderProgress = v; },
    set renderTotal(v: number) { renderTotal = v; },

    // Actions

    selectSource(source: CardPreviewSource) {
      selectedSource = source;
      level = 1;
      persist(STORAGE_SOURCE, source);
    },

    async selectDeck(deck: Deck) {
      selectedDeck = deck;
      level = 2;
      selectedFamilyIds = [];
      startPositionFilter = null;
      persist(STORAGE_DECK_ID, deck.id);

      // Small decks load eagerly; large decks wait until the user picks a family.
      if ((deck.totalSequences ?? 0) < LARGE_DECK_THRESHOLD) {
        await loadDeckSequences(deck);
      }
    },

    navigateTo(targetLevel: 0 | 1 | 2) {
      if (targetLevel <= 1) {
        selectedDeck = null;
        sequences = [];
        selectedFamilyIds = [];
        startPositionFilter = null;
      }
      if (targetLevel === 0) {
        selectedSource = null;
        persist(STORAGE_SOURCE, null);
      }
      level = targetLevel;
    },

    async setFamilyFilter(ids: string[]) {
      selectedFamilyIds = ids;

      // For large decks, fetch the families that haven't been loaded yet.
      if (
        (selectedDeck?.totalSequences ?? 0) >= LARGE_DECK_THRESHOLD &&
        selectedDeck &&
        ids.length > 0
      ) {
        await loadFamilySequences(selectedDeck, ids);
      }
    },

    setStartPositionFilter(pos: string | null) {
      startPositionFilter = pos;
    },

    // Converts current card size + caller-supplied visibility into render options
    // that the print pipeline can consume directly.
    buildRenderOptions(visibility: VisibilitySettings): PrintRenderOptions {
      const size = CARD_SIZES[cardSize];
      return {
        canvasWidth: size.canvasWidth,
        canvasHeight: size.canvasHeight,
        bleedPx: size.bleedPx,
        showGrid: visibility.showGrid,
        showTKA: visibility.showTKA,
        showWord: visibility.showWord,
        includeStartPosition: visibility.includeStartPosition,
        handPointsVisible: visibility.handPointsVisible,
        theme: visibility.theme,
      };
    },
  };
}

export type CardPreviewState = ReturnType<typeof createCardPreviewState>;
