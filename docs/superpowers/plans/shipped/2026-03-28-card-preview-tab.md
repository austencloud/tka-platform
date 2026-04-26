# Card Preview Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Library and Print-Prep tabs with a unified Card Preview tab that renders deck sequences as physical cards on simulated pages with integrated export.

**Architecture:** Progressive disclosure navigation (source → deck → card view) with a state factory managing level transitions, subset filtering, and card rendering. Reuses existing `PrintCardRenderer`, `LoopCollectionView`, and `DeckLoader` — adds tarot card size support and a page layout system.

**Tech Stack:** Svelte 5 (runes), TypeScript, ITI DI, existing canvas rendering pipeline, pdf-lib for PDF export.

**Spec:** `docs/superpowers/specs/2026-03-28-card-preview-tab-design.md`

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `src/lib/features/choreo-card/domain/card-sizes.ts` | Card size constants (poker/tarot), page layout calculator |
| `src/lib/features/choreo-card/state/card-preview-state.svelte.ts` | State factory: navigation, filters, card config, render options |
| `src/lib/features/choreo-card/context/card-preview-context.ts` | Context setters/getters for Card Preview state |
| `src/lib/features/choreo-card/components/card-preview/CardPreviewTab.svelte` | Top-level orchestrator for 3-level progressive disclosure |
| `src/lib/features/choreo-card/components/card-preview/SourcePicker.svelte` | Level 0: LOOP Decks / VTG Decks source cards |
| `src/lib/features/choreo-card/components/card-preview/CardSizeToggle.svelte` | Segmented control: poker / tarot |
| `src/lib/features/choreo-card/components/card-preview/BreadcrumbBar.svelte` | Clickable breadcrumb navigation |
| `src/lib/features/choreo-card/components/card-preview/SubsetFilterBar.svelte` | Family chips + start position filter |
| `src/lib/features/choreo-card/components/card-preview/CardPageLayout.svelte` | Renders cards on simulated letter pages |
| `src/lib/features/choreo-card/components/card-preview/CardPreviewSettings.svelte` | Collapsible settings: theme, visibility, export |
| `tests/unit/card-sizes.test.ts` | Tests for page layout calculator |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/features/choreo-card/services/contracts/IPrintPDFExporter.ts` | Add `cardSize` parameter to both methods |
| `src/lib/features/choreo-card/services/implementations/PrintPDFExporter.ts` | Replace hardcoded poker constants with dynamic layout from `getPageLayout()` |
| `src/lib/features/choreo-card/components/ChoreoCardTab.svelte` | Remove library/print-prep modes, add card-preview mode, update `ChoreoCardMode` type |
| `src/lib/shared/navigation/config/tab-definitions.ts:540-573` | Replace library + print-prep tabs with card-preview tab |
| `src/lib/features/choreo-card/components/PrintPrepView.svelte` | Pass `cardSize` to PDF exporter calls (keeps working for Decks tab internal use if needed) |

---

## Task 1: Card Size Constants and Page Layout Calculator

**Files:**
- Create: `src/lib/features/choreo-card/domain/card-sizes.ts`
- Create: `tests/unit/card-sizes.test.ts`

This is a pure data + math module with no UI dependencies. Foundation for everything else.

- [ ] **Step 1: Write failing tests for page layout calculation**

```typescript
// tests/unit/card-sizes.test.ts
import { describe, it, expect } from 'vitest';
import { CARD_SIZES, getPageLayout } from '$lib/features/choreo-card/domain/card-sizes';

describe('CARD_SIZES', () => {
  it('poker dimensions match existing MPC constants', () => {
    expect(CARD_SIZES.poker.canvasWidth).toBe(822);
    expect(CARD_SIZES.poker.canvasHeight).toBe(1122);
    expect(CARD_SIZES.poker.bleedPx).toBe(36);
    expect(CARD_SIZES.poker.contentWidth).toBe(750);
    expect(CARD_SIZES.poker.contentHeight).toBe(1050);
  });

  it('tarot dimensions are correct at 300 DPI', () => {
    expect(CARD_SIZES.tarot.canvasWidth).toBe(897);
    expect(CARD_SIZES.tarot.canvasHeight).toBe(1497);
    expect(CARD_SIZES.tarot.bleedPx).toBe(36);
    expect(CARD_SIZES.tarot.contentWidth).toBe(825);
    expect(CARD_SIZES.tarot.contentHeight).toBe(1425);
  });
});

describe('getPageLayout', () => {
  it('poker layout matches existing PrintPDFExporter (3x3=9)', () => {
    const layout = getPageLayout('poker');
    expect(layout.cols).toBe(3);
    expect(layout.rows).toBe(3);
    expect(layout.cardsPerPage).toBe(9);
    expect(layout.cardWidthPt).toBe(180);  // 2.5 * 72
    expect(layout.cardHeightPt).toBe(252); // 3.5 * 72
  });

  it('tarot layout fits 2x2=4 on letter', () => {
    const layout = getPageLayout('tarot');
    expect(layout.cols).toBe(2);
    expect(layout.rows).toBe(2);
    expect(layout.cardsPerPage).toBe(4);
    expect(layout.cardWidthPt).toBe(198);  // 2.75 * 72
    expect(layout.cardHeightPt).toBe(342); // 4.75 * 72
  });

  it('margins are centered on letter page', () => {
    const poker = getPageLayout('poker');
    // Letter = 612 x 792 pt. Grid = 540 x 756.
    expect(poker.marginXPt).toBe(36);  // (612 - 540) / 2
    expect(poker.marginYPt).toBe(18);  // (792 - 756) / 2

    const tarot = getPageLayout('tarot');
    // Grid = 396 x 684.
    expect(tarot.marginXPt).toBe(108); // (612 - 396) / 2
    expect(tarot.marginYPt).toBe(54);  // (792 - 684) / 2
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/card-sizes.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement card-sizes.ts**

```typescript
// src/lib/features/choreo-card/domain/card-sizes.ts

export const CARD_SIZES = {
  poker: {
    label: 'Poker 2.5"×3.5"',
    widthInches: 2.5,
    heightInches: 3.5,
    contentWidth: 750,
    contentHeight: 1050,
    canvasWidth: 822,
    canvasHeight: 1122,
    bleedPx: 36,
  },
  tarot: {
    label: 'Tarot 2.75"×4.75"',
    widthInches: 2.75,
    heightInches: 4.75,
    contentWidth: 825,
    contentHeight: 1425,
    canvasWidth: 897,
    canvasHeight: 1497,
    bleedPx: 36,
  },
} as const;

export type CardSizeId = keyof typeof CARD_SIZES;

// US Letter in points
const LETTER_W_PT = 612; // 8.5 * 72
const LETTER_H_PT = 792; // 11 * 72

export interface PageLayout {
  cols: number;
  rows: number;
  cardsPerPage: number;
  cardWidthPt: number;
  cardHeightPt: number;
  marginXPt: number;
  marginYPt: number;
}

const PAGE_LAYOUTS: Record<CardSizeId, PageLayout> = {
  poker: buildLayout(CARD_SIZES.poker, 3, 3),
  tarot: buildLayout(CARD_SIZES.tarot, 2, 2),
};

function buildLayout(
  size: (typeof CARD_SIZES)[CardSizeId],
  cols: number,
  rows: number
): PageLayout {
  const cardWidthPt = Math.round(size.widthInches * 72);
  const cardHeightPt = Math.round(size.heightInches * 72);
  const gridW = cols * cardWidthPt;
  const gridH = rows * cardHeightPt;
  return {
    cols,
    rows,
    cardsPerPage: cols * rows,
    cardWidthPt,
    cardHeightPt,
    marginXPt: (LETTER_W_PT - gridW) / 2,
    marginYPt: (LETTER_H_PT - gridH) / 2,
  };
}

export function getPageLayout(cardSize: CardSizeId): PageLayout {
  return PAGE_LAYOUTS[cardSize];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/card-sizes.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/domain/card-sizes.ts tests/unit/card-sizes.test.ts
git commit -m "feat(choreo-card): add card size constants and page layout calculator"
```

---

## Task 2: Update PrintPDFExporter for Dynamic Card Sizes

**Files:**
- Modify: `src/lib/features/choreo-card/services/contracts/IPrintPDFExporter.ts`
- Modify: `src/lib/features/choreo-card/services/implementations/PrintPDFExporter.ts`
- Modify: `src/lib/features/choreo-card/components/PrintPrepView.svelte` (update call sites)

- [ ] **Step 1: Update the interface**

In `src/lib/features/choreo-card/services/contracts/IPrintPDFExporter.ts`, add `CardSizeId` import and parameter:

```typescript
import type { CardSizeId } from "../../domain/card-sizes";

export interface CardPair {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  label: string;
}

export interface IPrintPDFExporter {
  exportDeckPDF(
    pairs: CardPair[],
    deckName: string,
    cardSize: CardSizeId,
    onProgress?: (current: number, total: number) => void
  ): Promise<Blob>;

  exportHomePrintPDF(
    pairs: CardPair[],
    deckName: string,
    cardSize: CardSizeId,
    onProgress?: (current: number, total: number) => void
  ): Promise<Blob>;
}
```

- [ ] **Step 2: Update the implementation**

In `src/lib/features/choreo-card/services/implementations/PrintPDFExporter.ts`:

1. Remove hardcoded card constants (`CARD_W`, `CARD_H`, `COLS`, `ROWS`, `CARDS_PER_SHEET`, `GRID_W`, `GRID_H`, `MARGIN_X`, `MARGIN_Y`)
2. Import `getPageLayout`, `CARD_SIZES`, and `CardSizeId` from `../../domain/card-sizes`
3. Compute page dimensions dynamically in both methods:

Replace the module-level constants (lines 4-25) with:

```typescript
import { getPageLayout, CARD_SIZES, type CardSizeId } from '../../domain/card-sizes';

const LETTER_W = 612;
const LETTER_H = 792;
```

Update `exportDeckPDF` signature to accept `cardSize: CardSizeId` and compute MPC page dimensions:

```typescript
async exportDeckPDF(
  pairs: CardPair[],
  _deckName: string,
  cardSize: CardSizeId = 'poker',
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const size = CARD_SIZES[cardSize];
  const pageWidthPt = (size.canvasWidth / 300) * 72;
  const pageHeightPt = (size.canvasHeight / 300) * 72;
  // ... rest uses pageWidthPt/pageHeightPt instead of PAGE_WIDTH_PT/PAGE_HEIGHT_PT
```

Update `exportHomePrintPDF` similarly, using `getPageLayout(cardSize)` for grid computation:

```typescript
async exportHomePrintPDF(
  pairs: CardPair[],
  _deckName: string,
  cardSize: CardSizeId = 'poker',
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const layout = getPageLayout(cardSize);
  const { cols, rows, cardsPerPage, cardWidthPt, cardHeightPt, marginXPt, marginYPt } = layout;
  // ... rest uses these instead of COLS/ROWS/CARD_W/CARD_H/MARGIN_X/MARGIN_Y
```

- [ ] **Step 3: Update PrintPrepView call sites**

In `src/lib/features/choreo-card/components/PrintPrepView.svelte`, find the two export calls and add `'poker'` as the card size argument (preserves existing behavior):

```typescript
// In the export handler:
await exporter.exportDeckPDF(pairs, deckName, 'poker', onProgress);
// and:
await exporter.exportHomePrintPDF(pairs, deckName, 'poker', onProgress);
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/services/contracts/IPrintPDFExporter.ts \
        src/lib/features/choreo-card/services/implementations/PrintPDFExporter.ts \
        src/lib/features/choreo-card/components/PrintPrepView.svelte
git commit -m "feat(choreo-card): make PrintPDFExporter card-size-aware"
```

---

## Task 3: Card Preview State Factory and Context

**Files:**
- Create: `src/lib/features/choreo-card/state/card-preview-state.svelte.ts`
- Create: `src/lib/features/choreo-card/context/card-preview-context.ts`

- [ ] **Step 1: Create the state factory**

Create `src/lib/features/choreo-card/state/card-preview-state.svelte.ts`:

```typescript
import type { Deck } from "../domain/models/Deck";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IDeckLoader } from "../services/contracts/IDeckLoader";
import type { PrintRenderOptions } from "../services/contracts/IPrintCardRenderer";
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
  deckLoader: IDeckLoader,
  allDecks: Deck[]
) {
  // Navigation
  let level = $state<0 | 1 | 2>(0);
  let selectedSource = $state<CardPreviewSource | null>(
    (getStored(STORAGE_SOURCE) as CardPreviewSource) ?? null
  );
  let selectedDeck = $state<Deck | null>(null);

  // Card config
  let cardSize = $state<CardSizeId>(
    (getStored(STORAGE_CARD_SIZE) as CardSizeId) ?? 'poker'
  );

  // Subset filters
  let selectedFamilyIds = $state<string[]>([]);
  let startPositionFilter = $state<string | null>(null);

  // Sequences
  let sequences = $state<SequenceData[]>([]);
  let isLoading = $state(false);
  let renderProgress = $state(0);
  let renderTotal = $state(0);

  // Derived
  let isLargeDeck = $derived(
    (selectedDeck?.totalSequences ?? 0) >= LARGE_DECK_THRESHOLD
  );

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
      result = result.filter(s =>
        s.startingPositionGroup === startPositionFilter
      );
    }
    return result;
  });

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

  // Actions
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

  async function loadFamilySequences(deck: Deck, familyIds: string[]) {
    isLoading = true;
    try {
      const seqIds = deck.families
        .filter(f => familyIds.includes(f.id))
        .flatMap(f => [...f.sequenceIds]);
      const loaded = await deckLoader.loadSequencesByIds(deck.id, seqIds);
      // Merge with existing (don't replace — user may have multiple families selected)
      const existingIds = new Set(sequences.map(s => s.id));
      const newSeqs = loaded.filter(s => !existingIds.has(s.id));
      sequences = [...sequences, ...newSeqs];
    } finally {
      isLoading = false;
    }
  }

  return {
    // Navigation
    get level() { return level; },
    get selectedSource() { return selectedSource; },
    get selectedDeck() { return selectedDeck; },
    get breadcrumbs() { return breadcrumbs; },

    // Card config
    get cardSize() { return cardSize; },
    set cardSize(v: CardSizeId) {
      cardSize = v;
      persist(STORAGE_CARD_SIZE, v);
    },

    // Filters
    get selectedFamilyIds() { return selectedFamilyIds; },
    get startPositionFilter() { return startPositionFilter; },
    get filteredSequences() { return filteredSequences; },
    get isLoading() { return isLoading; },
    get isLargeDeck() { return isLargeDeck; },
    get renderProgress() { return renderProgress; },
    get renderTotal() { return renderTotal; },
    set renderProgress(v: number) { renderProgress = v; },
    set renderTotal(v: number) { renderTotal = v; },

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

      if (!isLargeDeck) {
        await loadDeckSequences(deck);
      }
      // Large decks wait for family selection
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
      if (isLargeDeck && selectedDeck && ids.length > 0) {
        await loadFamilySequences(selectedDeck, ids);
      }
    },

    setStartPositionFilter(pos: string | null) {
      startPositionFilter = pos;
    },

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
```

- [ ] **Step 2: Create the context**

Create `src/lib/features/choreo-card/context/card-preview-context.ts`:

```typescript
import { getContext, setContext } from 'svelte';
import type { CardPreviewState } from '../state/card-preview-state.svelte';

const KEY = Symbol('card-preview');

interface CardPreviewContext {
  state: CardPreviewState;
}

export function setCardPreviewContext(ctx: CardPreviewContext) {
  setContext(KEY, ctx);
}

export function getCardPreviewContext(): CardPreviewContext {
  return getContext<CardPreviewContext>(KEY);
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/state/card-preview-state.svelte.ts \
        src/lib/features/choreo-card/context/card-preview-context.ts
git commit -m "feat(choreo-card): add Card Preview state factory and context"
```

---

## Task 4: Small UI Components (CardSizeToggle, BreadcrumbBar, SourcePicker)

**Files:**
- Create: `src/lib/features/choreo-card/components/card-preview/CardSizeToggle.svelte`
- Create: `src/lib/features/choreo-card/components/card-preview/BreadcrumbBar.svelte`
- Create: `src/lib/features/choreo-card/components/card-preview/SourcePicker.svelte`

These are simple, presentational components. No tests needed (visual, not algorithmic).

- [ ] **Step 1: Create CardSizeToggle**

```svelte
<!-- src/lib/features/choreo-card/components/card-preview/CardSizeToggle.svelte -->
<script lang="ts">
  import { CARD_SIZES, type CardSizeId } from "../../domain/card-sizes";

  interface Props {
    selected: CardSizeId;
    onchange: (size: CardSizeId) => void;
  }

  let { selected, onchange }: Props = $props();

  const sizes = Object.entries(CARD_SIZES) as [CardSizeId, (typeof CARD_SIZES)[CardSizeId]][];
</script>

<div class="size-toggle" role="radiogroup" aria-label="Card size">
  {#each sizes as [id, size]}
    <button
      class="size-option"
      class:active={selected === id}
      role="radio"
      aria-checked={selected === id}
      onclick={() => onchange(id)}
    >
      {size.label}
    </button>
  {/each}
</div>

<style>
  .size-toggle {
    display: flex;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    overflow: hidden;
  }

  .size-option {
    padding: 6px 14px;
    font-size: var(--font-size-compact, 12px);
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    border: none;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .size-option:not(:last-child) {
    border-right: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .size-option.active {
    background: var(--theme-accent, #4a9eff);
    color: #fff;
  }

  .size-option:hover:not(.active) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }
</style>
```

- [ ] **Step 2: Create BreadcrumbBar**

```svelte
<!-- src/lib/features/choreo-card/components/card-preview/BreadcrumbBar.svelte -->
<script lang="ts">
  interface BreadcrumbSegment {
    label: string;
    level: 0 | 1 | 2;
  }

  interface Props {
    segments: BreadcrumbSegment[];
    onNavigate: (level: 0 | 1 | 2) => void;
  }

  let { segments, onNavigate }: Props = $props();
</script>

<nav class="breadcrumbs" aria-label="Card preview navigation">
  {#each segments as segment, i}
    {#if i > 0}
      <span class="separator" aria-hidden="true">/</span>
    {/if}
    {#if i < segments.length - 1}
      <button class="crumb clickable" onclick={() => onNavigate(segment.level)}>
        {segment.label}
      </button>
    {:else}
      <span class="crumb current" aria-current="page">{segment.label}</span>
    {/if}
  {/each}
</nav>

<style>
  .breadcrumbs {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-min, 14px);
    min-height: 32px;
  }

  .separator {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .crumb.clickable {
    background: none;
    border: none;
    color: var(--theme-accent, #4a9eff);
    cursor: pointer;
    padding: 4px 2px;
    font-size: inherit;
  }

  .crumb.clickable:hover {
    text-decoration: underline;
  }

  .crumb.current {
    color: var(--theme-text, #ffffff);
  }
</style>
```

- [ ] **Step 3: Create SourcePicker**

```svelte
<!-- src/lib/features/choreo-card/components/card-preview/SourcePicker.svelte -->
<script lang="ts">
  import type { Deck } from "../../domain/models/Deck";
  import type { CardPreviewSource } from "../../state/card-preview-state.svelte";

  interface Props {
    decks: Deck[];
    onSelect: (source: CardPreviewSource) => void;
  }

  let { decks, onSelect }: Props = $props();

  let loopDecks = $derived(decks.filter(d => d.collection === 'LOOPs'));
  let vtgDecks = $derived(decks.filter(d => d.collection === 'VTG'));

  let sources = $derived([
    {
      id: 'loops' as CardPreviewSource,
      label: 'LOOP Decks',
      description: 'Algorithmic loop pattern decks',
      deckCount: loopDecks.length,
      sequenceCount: loopDecks.reduce((sum, d) => sum + d.totalSequences, 0),
    },
    {
      id: 'vtg' as CardPreviewSource,
      label: 'VTG Decks',
      description: 'Per-hand learning decks',
      deckCount: vtgDecks.length,
      sequenceCount: vtgDecks.reduce((sum, d) => sum + d.totalSequences, 0),
    },
  ]);
</script>

<div class="source-grid">
  {#each sources as source}
    <button class="source-card" onclick={() => onSelect(source.id)}>
      <h3 class="source-label">{source.label}</h3>
      <p class="source-desc">{source.description}</p>
      <div class="source-stats">
        <span>{source.deckCount} decks</span>
        <span>{source.sequenceCount.toLocaleString()} sequences</span>
      </div>
    </button>
  {/each}
</div>

<style>
  .source-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
    padding: 24px;
    max-width: 600px;
    margin: 0 auto;
  }

  .source-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 24px;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, transform 0.15s;
    color: var(--theme-text, #ffffff);
  }

  .source-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    transform: translateY(-2px);
  }

  .source-label {
    margin: 0 0 8px;
    font-size: var(--font-size-lg, 18px);
  }

  .source-desc {
    margin: 0 0 16px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
  }

  .source-stats {
    display: flex;
    gap: 16px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }
</style>
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/card-preview/
git commit -m "feat(choreo-card): add CardSizeToggle, BreadcrumbBar, SourcePicker components"
```

---

## Task 5: SubsetFilterBar Component

**Files:**
- Create: `src/lib/features/choreo-card/components/card-preview/SubsetFilterBar.svelte`

Reuses the family chip + start position filter pattern from `DeckInteriorFilterPanel.svelte` but in a horizontal bar layout.

- [ ] **Step 1: Create SubsetFilterBar**

```svelte
<!-- src/lib/features/choreo-card/components/card-preview/SubsetFilterBar.svelte -->
<script lang="ts">
  import type { DeckFamily } from "../../domain/models/Deck";

  interface Props {
    families: readonly DeckFamily[];
    selectedFamilyIds: string[];
    activePosition: string | null;
    totalFiltered: number;
    totalSequences: number;
    isLargeDeck: boolean;
    onFamilyChange: (familyIds: string[]) => void;
    onPositionChange: (position: string | null) => void;
  }

  let {
    families,
    selectedFamilyIds,
    activePosition,
    totalFiltered,
    totalSequences,
    isLargeDeck,
    onFamilyChange,
    onPositionChange,
  }: Props = $props();

  const positions = ['alpha', 'beta', 'gamma'] as const;

  function toggleFamily(id: string) {
    const current = new Set(selectedFamilyIds);
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    onFamilyChange([...current]);
  }

  function togglePosition(pos: string) {
    onPositionChange(activePosition === pos ? null : pos);
  }
</script>

<div class="filter-bar">
  <div class="filter-section">
    <span class="filter-label">Family</span>
    <div class="chip-row">
      {#each families as family}
        <button
          class="chip"
          class:active={selectedFamilyIds.includes(family.id)}
          onclick={() => toggleFamily(family.id)}
        >
          {family.label}
          <span class="chip-count">{family.sequenceIds.length}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="filter-section">
    <span class="filter-label">Start</span>
    <div class="chip-row">
      {#each positions as pos}
        <button
          class="chip"
          class:active={activePosition === pos}
          onclick={() => togglePosition(pos)}
        >
          {pos}
        </button>
      {/each}
    </div>
  </div>

  <div class="count-badge">
    {totalFiltered} of {totalSequences.toLocaleString()} cards
  </div>

  {#if isLargeDeck && selectedFamilyIds.length === 0}
    <div class="large-deck-hint">
      Select a family to view cards ({totalSequences.toLocaleString()} total)
    </div>
  {/if}
</div>

<style>
  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
  }

  .filter-section {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .filter-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .chip {
    padding: 4px 10px;
    border-radius: 14px;
    font-size: var(--font-size-compact, 12px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .chip.active {
    background: var(--theme-accent, #4a9eff);
    color: #fff;
    border-color: var(--theme-accent, #4a9eff);
  }

  .chip:hover:not(.active) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .chip-count {
    opacity: 0.7;
    margin-left: 4px;
  }

  .count-badge {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .large-deck-hint {
    width: 100%;
    text-align: center;
    padding: 12px;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-style: italic;
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/card-preview/SubsetFilterBar.svelte
git commit -m "feat(choreo-card): add SubsetFilterBar with family chips and position filter"
```

---

## Task 6: CardPageLayout Component

**Files:**
- Create: `src/lib/features/choreo-card/components/card-preview/CardPageLayout.svelte`

The core rendering component. Shows card-sized items on simulated letter pages.

- [ ] **Step 1: Create CardPageLayout**

This component takes filtered sequences, card size, and render options. It groups sequences into pages, renders them via `PrintCardRenderer`, and displays on simulated paper.

```svelte
<!-- src/lib/features/choreo-card/components/card-preview/CardPageLayout.svelte -->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IPrintCardRenderer, PrintRenderOptions } from "../../services/contracts/IPrintCardRenderer";
  import type { DeckFamily } from "../../domain/models/Deck";
  import { getPageLayout, type CardSizeId } from "../../domain/card-sizes";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  interface Props {
    sequences: SequenceData[];
    families: readonly DeckFamily[];
    selectedFamilyIds: string[];
    cardSize: CardSizeId;
    renderOptions: PrintRenderOptions;
    isLoading: boolean;
    isLargeDeck: boolean;
    onCardClick: (index: number) => void;
    onRenderProgress: (current: number, total: number) => void;
  }

  let {
    sequences,
    families,
    selectedFamilyIds,
    cardSize,
    renderOptions,
    isLoading,
    isLargeDeck,
    onCardClick,
    onRenderProgress,
  }: Props = $props();

  const renderer = container.items.printCardRenderer as IPrintCardRenderer;

  let layout = $derived(getPageLayout(cardSize));
  let aspectRatio = $derived(8.5 / 11);

  // Rendered card images (data URLs for memory efficiency)
  let cardImages = $state<Map<string, string>>(new Map());
  let isRendering = $state(false);

  // Abort controller to cancel in-flight renders when sequences/options change
  let renderGeneration = 0;

  // Group sequences into pages
  let pages = $derived.by(() => {
    const result: SequenceData[][] = [];
    for (let i = 0; i < sequences.length; i += layout.cardsPerPage) {
      result.push(sequences.slice(i, i + layout.cardsPerPage));
    }
    return result;
  });

  // Render cards when sequences or options change
  $effect(() => {
    if (sequences.length === 0) {
      cardImages = new Map();
      return;
    }
    // Capture current generation to detect stale renders
    const gen = ++renderGeneration;
    renderCards(gen);
  });

  async function renderCards(generation: number) {
    isRendering = true;
    const newImages = new Map<string, string>();
    const total = sequences.length;

    for (let i = 0; i < sequences.length; i++) {
      // Abort if a newer render was triggered
      if (generation !== renderGeneration) return;

      const seq = sequences[i]!;
      try {
        const canvas = await renderer.renderFront(seq, renderOptions);
        newImages.set(seq.id, canvas.toDataURL('image/png'));
      } catch {
        // Skip failed renders
      }
      onRenderProgress(i + 1, total);

      // Update progressively every 10 cards so the UI shows partial results
      if (i % 10 === 9 || i === sequences.length - 1) {
        if (generation !== renderGeneration) return;
        cardImages = new Map(newImages);
      }
    }

    if (generation === renderGeneration) {
      cardImages = newImages;
      isRendering = false;
    }
  }
</script>

<div class="page-layout-container">
  {#if isLoading}
    <div class="loading-state">Loading sequences...</div>
  {:else if isLargeDeck && selectedFamilyIds.length === 0}
    <div class="empty-state">Select a family to preview cards</div>
  {:else if sequences.length === 0}
    <div class="empty-state">No sequences match current filters</div>
  {:else}
    {#if isRendering}
      <div class="render-progress">
        Rendering cards... {Math.round((cardImages.size / sequences.length) * 100)}%
      </div>
    {/if}

    <div class="pages-scroll">
      {#each pages as page, pageIndex}
        <div
          class="page"
          style:aspect-ratio={aspectRatio}
        >
          <div
            class="page-grid"
            style:grid-template-columns="repeat({layout.cols}, 1fr)"
            style:grid-template-rows="repeat({layout.rows}, 1fr)"
            style:padding="{(layout.marginYPt / 792) * 100}% {(layout.marginXPt / 612) * 100}%"
          >
            {#each page as seq, cardIndex}
              {@const globalIndex = pageIndex * layout.cardsPerPage + cardIndex}
              <button
                class="card-slot"
                onclick={() => onCardClick(globalIndex)}
                aria-label="View {seq.word ?? 'sequence'} card"
              >
                {#if cardImages.has(seq.id)}
                  <img
                    src={cardImages.get(seq.id)}
                    alt={seq.word ?? 'Sequence card'}
                    class="card-image"
                    loading="lazy"
                  />
                {:else}
                  <div class="card-placeholder">
                    <span>{seq.word ?? '...'}</span>
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page-layout-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .pages-scroll {
    display: flex;
    flex-direction: column;
    gap: 24px;
    align-items: center;
  }

  .page {
    background: #ffffff;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    width: 100%;
    max-width: 680px;
    container-type: inline-size;
  }

  .page-grid {
    display: grid;
    gap: 2px;
    width: 100%;
    height: 100%;
  }

  .card-slot {
    background: none;
    border: 1px dashed rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    cursor: pointer;
    padding: 0;
    overflow: hidden;
    transition: box-shadow 0.15s;
    aspect-ratio: auto;
  }

  .card-slot:hover {
    box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.5);
  }

  .card-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .card-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.05);
    color: rgba(0, 0, 0, 0.3);
    font-size: 12px;
  }

  .loading-state,
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 300px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }

  .render-progress {
    text-align: center;
    padding: 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/card-preview/CardPageLayout.svelte
git commit -m "feat(choreo-card): add CardPageLayout with simulated page rendering"
```

---

## Task 7: CardPreviewSettings Component

**Files:**
- Create: `src/lib/features/choreo-card/components/card-preview/CardPreviewSettings.svelte`

Collapsible settings panel. Reuses the same theme options and visibility toggles from `PrintPrepSidebar`.

- [ ] **Step 1: Create CardPreviewSettings**

This handles theme picker, visibility toggles (grid, TKA, word, start position, hand points), and export controls (format picker, export button).

The component accepts individual setting values and callbacks rather than managing its own state — the parent orchestrator owns the state.

```svelte
<!-- src/lib/features/choreo-card/components/card-preview/CardPreviewSettings.svelte -->
<script lang="ts">
  import type { CardSizeId } from "../../domain/card-sizes";

  interface ThemeOption {
    id: string;
    label: string;
    color: string;
  }

  interface Props {
    isOpen: boolean;
    // Visibility
    showGrid: boolean;
    showTKA: boolean;
    showWord: boolean;
    includeStartPosition: boolean;
    handPointsVisible: boolean;
    // Theme
    selectedTheme: string;
    themeOptions: readonly ThemeOption[];
    // Export
    exportFormat: "pdf" | "zip";
    cardSize: CardSizeId;
    totalCards: number;
    isExporting: boolean;
    hasRenderedCards: boolean;
    // Callbacks
    onToggle: () => void;
    onVisibilityChange: (key: string, value: boolean) => void;
    onThemeChange: (themeId: string) => void;
    onExportFormatChange: (format: "pdf" | "zip") => void;
    onExport: () => void;
  }

  let {
    isOpen,
    showGrid,
    showTKA,
    showWord,
    includeStartPosition,
    handPointsVisible,
    selectedTheme,
    themeOptions,
    exportFormat,
    cardSize,
    totalCards,
    isExporting,
    hasRenderedCards,
    onToggle,
    onVisibilityChange,
    onThemeChange,
    onExportFormatChange,
    onExport,
  }: Props = $props();
</script>

{#if isOpen}
  <aside class="settings-panel">
    <div class="settings-header">
      <h3>Settings</h3>
      <button class="close-btn" onclick={onToggle} aria-label="Close settings">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    <section class="settings-section">
      <h4>Visibility</h4>
      <button class="toggle-row" onclick={() => onVisibilityChange('showGrid', !showGrid)}>
        <span class="toggle-indicator" class:on={showGrid}></span>
        Grid
      </button>
      <button class="toggle-row" onclick={() => onVisibilityChange('showTKA', !showTKA)}>
        <span class="toggle-indicator" class:on={showTKA}></span>
        TKA Notation
      </button>
      <button class="toggle-row" onclick={() => onVisibilityChange('showWord', !showWord)}>
        <span class="toggle-indicator" class:on={showWord}></span>
        Word
      </button>
      <button class="toggle-row" onclick={() => onVisibilityChange('includeStartPosition', !includeStartPosition)}>
        <span class="toggle-indicator" class:on={includeStartPosition}></span>
        Start Position
      </button>
      <button class="toggle-row" onclick={() => onVisibilityChange('handPointsVisible', !handPointsVisible)}>
        <span class="toggle-indicator" class:on={handPointsVisible}></span>
        Hand Points
      </button>
    </section>

    <section class="settings-section">
      <h4>Card Back Theme</h4>
      <div class="theme-grid">
        {#each themeOptions as theme}
          <button
            class="theme-swatch"
            class:active={selectedTheme === theme.id}
            style:background={theme.color}
            title={theme.label}
            onclick={() => onThemeChange(theme.id)}
            aria-label="Theme: {theme.label}"
          ></button>
        {/each}
      </div>
    </section>

    <section class="settings-section">
      <h4>Export</h4>
      <div class="export-format">
        <button
          class="format-btn"
          class:active={exportFormat === 'pdf'}
          onclick={() => onExportFormatChange('pdf')}
        >PDF</button>
        <button
          class="format-btn"
          class:active={exportFormat === 'zip'}
          onclick={() => onExportFormatChange('zip')}
        >ZIP</button>
      </div>
      <button
        class="export-btn"
        disabled={!hasRenderedCards || isExporting || totalCards === 0}
        onclick={onExport}
      >
        {#if isExporting}
          Exporting...
        {:else}
          Export {totalCards} cards ({cardSize})
        {/if}
      </button>
    </section>
  </aside>
{/if}

<style>
  .settings-panel {
    width: 260px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding: 16px;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .settings-header h3 {
    margin: 0;
    font-size: var(--font-size-min, 14px);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    padding: 4px;
  }

  .settings-section {
    margin-bottom: 20px;
  }

  .settings-section h4 {
    margin: 0 0 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    color: var(--theme-text, #ffffff);
    background: none;
    border: none;
    width: 100%;
    text-align: left;
  }

  .toggle-indicator {
    width: 32px;
    height: 18px;
    border-radius: 9px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    position: relative;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .toggle-indicator::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.15s;
  }

  .toggle-indicator.on {
    background: var(--theme-accent, #4a9eff);
  }

  .toggle-indicator.on::after {
    transform: translateX(14px);
  }

  .theme-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .theme-swatch {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .theme-swatch.active {
    border-color: #fff;
  }

  .export-format {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }

  .format-btn {
    flex: 1;
    padding: 6px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
  }

  .format-btn.active {
    background: var(--theme-accent, #4a9eff);
    color: #fff;
    border-color: var(--theme-accent, #4a9eff);
  }

  .export-btn {
    width: 100%;
    padding: 10px;
    border-radius: 8px;
    border: none;
    background: var(--theme-accent, #4a9eff);
    color: #fff;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
  }

  .export-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/card-preview/CardPreviewSettings.svelte
git commit -m "feat(choreo-card): add CardPreviewSettings with theme, visibility, export"
```

---

## Task 8: CardPreviewTab Orchestrator

**Files:**
- Create: `src/lib/features/choreo-card/components/card-preview/CardPreviewTab.svelte`

The top-level component that wires together all the pieces: state factory, progressive disclosure, breadcrumbs, and all child components.

- [ ] **Step 1: Create CardPreviewTab**

This is the main orchestrator. It:
1. Creates the card preview state factory
2. Sets the context
3. Renders the appropriate level (0, 1, or 2)
4. Manages visibility state and settings panel
5. Handles detail modal for card clicks

```svelte
<!-- src/lib/features/choreo-card/components/card-preview/CardPreviewTab.svelte -->
<script lang="ts">
  import type { Deck } from "../../domain/models/Deck";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IDeckLoader } from "../../services/contracts/IDeckLoader";
  import type { IPrintCardRenderer } from "../../services/contracts/IPrintCardRenderer";
  import type { IPrintPDFExporter, CardPair } from "../../services/contracts/IPrintPDFExporter";
  import type { IPrintZipExporter } from "../../services/contracts/IPrintZipExporter";
  import { container } from "$lib/shared/di";
  import { createCardPreviewState, type VisibilitySettings } from "../../state/card-preview-state.svelte";
  import { setCardPreviewContext } from "../../context/card-preview-context";
  import BreadcrumbBar from "./BreadcrumbBar.svelte";
  import CardSizeToggle from "./CardSizeToggle.svelte";
  import SourcePicker from "./SourcePicker.svelte";
  import SubsetFilterBar from "./SubsetFilterBar.svelte";
  import CardPageLayout from "./CardPageLayout.svelte";
  import CardPreviewSettings from "./CardPreviewSettings.svelte";
  import LoopCollectionView from "../LoopCollectionView.svelte";
  import VtgCollectionView from "../VtgCollectionView.svelte";
  import PrintPrepDetailModal from "../print-prep/PrintPrepDetailModal.svelte";

  interface Props {
    decks: Deck[];
  }

  let { decks }: Props = $props();

  // Services
  const deckLoader = container.items.deckLoader as IDeckLoader;

  // State
  const state = createCardPreviewState(deckLoader, decks);
  setCardPreviewContext({ state });

  // Visibility settings (persisted via localStorage)
  function getStoredBool(key: string, def: boolean): boolean {
    if (typeof window === 'undefined') return def;
    const v = localStorage.getItem(key);
    return v === null ? def : v === 'true';
  }

  let showGrid = $state(getStoredBool('choreoCard.showGrid', true));
  let showTKA = $state(getStoredBool('choreoCard.showTKA', true));
  let showWord = $state(getStoredBool('choreoCard.showWord', true));
  let includeStartPosition = $state(getStoredBool('choreoCard.includeStartPosition', true));
  let handPointsVisible = $state(getStoredBool('choreoCard.handPointsVisible', true));
  let selectedTheme = $state(localStorage.getItem('cardPreview.theme') ?? 'nightSky');
  let exportFormat = $state<'pdf' | 'zip'>(
    (localStorage.getItem('cardPreview.exportFormat') as 'pdf' | 'zip') ?? 'zip'
  );
  let settingsOpen = $state(false);

  // Detail modal
  let detailIndex = $state<number | null>(null);

  let visibility = $derived<VisibilitySettings>({
    showGrid,
    showTKA,
    showWord,
    includeStartPosition,
    handPointsVisible,
    theme: selectedTheme,
  });

  let renderOptions = $derived(state.buildRenderOptions(visibility));

  // Theme options (same as PrintPrepSidebar)
  const themeOptions = [
    { id: 'nightSky', label: 'Night Sky', color: '#1a1a2e' },
    { id: 'deepOcean', label: 'Deep Ocean', color: '#0a1628' },
    { id: 'snowfall', label: 'Snowfall', color: '#e8eaf0' },
    { id: 'emberGlow', label: 'Ember Glow', color: '#2d1b1b' },
    { id: 'sakuraDrift', label: 'Sakura Drift', color: '#2d1b28' },
    { id: 'fireflyForest', label: 'Firefly Forest', color: '#1b2d1b' },
    { id: 'autumnDrift', label: 'Autumn Drift', color: '#2d251b' },
    { id: 'pride', label: 'Pride', color: 'linear-gradient(135deg, #e40303, #ff8c00, #ffed00, #008026, #004dff, #750787)' },
  ] as const;

  // Collection filtering for Level 1
  let loopDecks = $derived(decks.filter(d => d.collection === 'LOOPs'));
  let vtgDecks = $derived(decks.filter(d => d.collection === 'VTG'));
  let collectionDecks = $derived(
    state.selectedSource === 'loops' ? loopDecks : vtgDecks
  );

  function handleVisibilityChange(key: string, value: boolean) {
    const map: Record<string, () => void> = {
      showGrid: () => { showGrid = value; },
      showTKA: () => { showTKA = value; },
      showWord: () => { showWord = value; },
      includeStartPosition: () => { includeStartPosition = value; },
      handPointsVisible: () => { handPointsVisible = value; },
    };
    map[key]?.();
    localStorage.setItem(`choreoCard.${key}`, String(value));
  }

  function handleThemeChange(id: string) {
    selectedTheme = id;
    localStorage.setItem('cardPreview.theme', id);
  }

  function handleExportFormatChange(format: 'pdf' | 'zip') {
    exportFormat = format;
    localStorage.setItem('cardPreview.exportFormat', format);
  }

  let isExporting = $state(false);

  async function handleExport() {
    if (state.filteredSequences.length === 0) return;
    isExporting = true;
    try {
      const printRenderer = container.items.printCardRenderer as IPrintCardRenderer;
      const opts = state.buildRenderOptions(visibility);

      // Render all card pairs
      const pairs: CardPair[] = [];
      for (const seq of state.filteredSequences) {
        const front = await printRenderer.renderFront(seq, opts);
        const back = await printRenderer.renderBack(seq, opts);
        pairs.push({ front, back, label: seq.word ?? seq.id });
      }

      const deckName = state.selectedDeck?.name ?? 'cards';
      if (exportFormat === 'pdf') {
        const pdfExporter = container.items.printPDFExporter as IPrintPDFExporter;
        const blob = await pdfExporter.exportHomePrintPDF(pairs, deckName, state.cardSize);
        downloadBlob(blob, `${deckName}-${state.cardSize}.pdf`);
      } else {
        const zipExporter = container.items.printZipExporter as IPrintZipExporter;
        const blob = await zipExporter.exportDeckZip(pairs, deckName);
        downloadBlob(blob, `${deckName}-${state.cardSize}.zip`);
      }
    } finally {
      isExporting = false;
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="card-preview-tab">
  <!-- Top bar -->
  <div class="top-bar">
    <div class="top-bar-left">
      <BreadcrumbBar
        segments={state.breadcrumbs}
        onNavigate={(level) => state.navigateTo(level)}
      />
    </div>
    <div class="top-bar-right">
      {#if state.level === 2}
        <CardSizeToggle
          selected={state.cardSize}
          onchange={(size) => { state.cardSize = size; }}
        />
      {/if}
      <button
        class="settings-toggle"
        onclick={() => { settingsOpen = !settingsOpen; }}
        aria-label="Toggle settings"
      >
        <i class="fas fa-cog" aria-hidden="true"></i>
      </button>
    </div>
  </div>

  <!-- Subset filters (Level 2 only) -->
  {#if state.level === 2 && state.selectedDeck}
    <SubsetFilterBar
      families={state.selectedDeck.families}
      selectedFamilyIds={state.selectedFamilyIds}
      activePosition={state.startPositionFilter}
      totalFiltered={state.filteredSequences.length}
      totalSequences={state.selectedDeck.totalSequences}
      isLargeDeck={state.isLargeDeck}
      onFamilyChange={(ids) => state.setFamilyFilter(ids)}
      onPositionChange={(pos) => state.setStartPositionFilter(pos)}
    />
  {/if}

  <!-- Main content area -->
  <div class="content-area">
    <div class="content-main">
      {#if state.level === 0}
        <SourcePicker {decks} onSelect={(source) => state.selectSource(source)} />

      {:else if state.level === 1 && state.selectedSource === 'loops'}
        <LoopCollectionView
          decks={collectionDecks}
          onSelectDeck={(deck) => state.selectDeck(deck)}
        />

      {:else if state.level === 1 && state.selectedSource === 'vtg'}
        <VtgCollectionView
          decks={collectionDecks}
          onSelectDeck={(deckId) => {
            const deck = collectionDecks.find(d => d.id === deckId);
            if (deck) state.selectDeck(deck);
          }}
          onSelectFamily={() => {/* VTG family drill-down — future enhancement */}}
        />

      {:else if state.level === 2 && state.selectedDeck}
        <CardPageLayout
          sequences={state.filteredSequences}
          families={state.selectedDeck.families}
          selectedFamilyIds={state.selectedFamilyIds}
          cardSize={state.cardSize}
          {renderOptions}
          isLoading={state.isLoading}
          isLargeDeck={state.isLargeDeck}
          onCardClick={(index) => { detailIndex = index; }}
          onRenderProgress={(current, total) => {
            state.renderProgress = current;
            state.renderTotal = total;
          }}
        />
      {/if}
    </div>

    <CardPreviewSettings
      isOpen={settingsOpen}
      {showGrid}
      {showTKA}
      {showWord}
      {includeStartPosition}
      {handPointsVisible}
      {selectedTheme}
      {themeOptions}
      {exportFormat}
      cardSize={state.cardSize}
      totalCards={state.filteredSequences.length}
      {isExporting}
      hasRenderedCards={state.filteredSequences.length > 0 && !state.isLoading}
      onToggle={() => { settingsOpen = false; }}
      onVisibilityChange={handleVisibilityChange}
      onThemeChange={handleThemeChange}
      onExportFormatChange={handleExportFormatChange}
      onExport={handleExport}
    />
  </div>

  <!-- Detail modal -->
  {#if detailIndex !== null}
    <!-- Detail modal wiring will use PrintPrepDetailModal with rendered card data -->
  {/if}
</div>

<style>
  .card-preview-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .top-bar-left {
    flex: 1;
    min-width: 0;
  }

  .top-bar-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .settings-toggle {
    background: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    padding: 6px 10px;
    cursor: pointer;
  }

  .settings-toggle:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .content-area {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .content-main {
    flex: 1;
    overflow-y: auto;
    min-width: 0;
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No type errors (some warnings about unused export function are OK at this stage)

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/card-preview/CardPreviewTab.svelte
git commit -m "feat(choreo-card): add CardPreviewTab orchestrator component"
```

---

## Task 9: Wire CardPreviewTab into ChoreoCardTab and Update Navigation

**Files:**
- Modify: `src/lib/features/choreo-card/components/ChoreoCardTab.svelte`
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts:540-573`

This is the integration task that makes Card Preview live and removes Library + Print-Prep tabs.

- [ ] **Step 1: Update tab definitions**

In `src/lib/shared/navigation/config/tab-definitions.ts`, find the `CHOREO_CARD_TABS` array (around line 540). Replace the `library` and `print-prep` entries with a single `card-preview` entry:

Replace the library tab entry (lines ~541-548) with:
```typescript
{
  id: "card-preview",
  label: "Card Preview",
  icon: '<i class="fas fa-id-card" style="color: #e0c068;" aria-hidden="true"></i>',
  description: "Preview and print physical card decks",
},
```

Remove the print-prep tab entry (lines ~565-572 after the library removal shift).

The final tabs should be: `card-preview`, `decks`, `designer`.

- [ ] **Step 2: Update ChoreoCardTab.svelte**

In `src/lib/features/choreo-card/components/ChoreoCardTab.svelte`:

1. Update the `ChoreoCardMode` type (line 162):
```typescript
type ChoreoCardMode = "card-preview" | "decks" | "designer";
```

2. Update the `$effect` that syncs with navigation state (line 166-177):
```typescript
$effect(() => {
  const navTab = navigationState.activeTab;
  if (navTab === "card-preview" || navTab === "decks" || navTab === "designer") {
    const newMode = navTab as ChoreoCardMode;
    if (newMode !== mode) {
      mode = newMode;
      if (newMode !== "designer" && decks.length === 0) {
        loadDecks();
      }
    }
  }
});
```

3. Set default mode to `"card-preview"` (line 163):
```typescript
let mode = $state<ChoreoCardMode>("card-preview");
```

4. Add the import for `CardPreviewTab`:
```typescript
import CardPreviewTab from "./card-preview/CardPreviewTab.svelte";
```

5. In the template rendering section (lines ~585-688), replace the library rendering block and print-prep rendering block with:
```svelte
{#if mode === "card-preview"}
  <CardPreviewTab {decks} />
{:else if mode === "decks"}
  <!-- existing DeckBrowser code stays -->
{:else if mode === "designer"}
  <!-- existing CardDesigner code stays -->
{/if}
```

Remove the library-mode rendering (PageDisplay, ChoreoCardFilters, ChoreoCardExport, Navigation, status bar) and the print-prep rendering (PrintPrepView).

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No type errors. There may be unused import warnings for removed components — clean those up.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/ChoreoCardTab.svelte \
        src/lib/shared/navigation/config/tab-definitions.ts
git commit -m "feat(choreo-card): wire Card Preview tab, remove Library and Print-Prep tabs"
```

---

## Task 10: Browser History Integration

**Files:**
- Modify: `src/lib/features/choreo-card/state/card-preview-state.svelte.ts`
- Modify: `src/lib/features/choreo-card/components/card-preview/CardPreviewTab.svelte`

Add hash-based browser history so back/forward navigation works and deck views are linkable.

- [ ] **Step 1: Add hash encoding/decoding to state factory**

In `card-preview-state.svelte.ts`, add hash helpers:

```typescript
const HASH_PREFIX = 'card-preview:';

function encodeHash(source: CardPreviewSource | null, deckId: string | null): string {
  if (!source) return '';
  const params = new URLSearchParams();
  params.set('src', source);
  if (deckId) params.set('deck', deckId);
  return `${HASH_PREFIX}${params.toString()}`;
}

function decodeHash(hash: string): { source: CardPreviewSource | null; deckId: string | null } | null {
  if (!hash.startsWith(`#${HASH_PREFIX}`)) return null;
  try {
    const params = new URLSearchParams(hash.slice(`#${HASH_PREFIX}`.length));
    const src = params.get('src') as CardPreviewSource | null;
    const deck = params.get('deck');
    return { source: src, deckId: deck };
  } catch {
    return null;
  }
}
```

Add `pushNavState()` calls inside `selectSource`, `selectDeck`, and `navigateTo` actions. Add an `initFromHash(hash: string, allDecks: Deck[])` method that restores state from a hash on mount.

- [ ] **Step 2: Wire popstate listener in CardPreviewTab**

In `CardPreviewTab.svelte`, add a `$effect` that listens for `popstate` events and calls `state.initFromHash()`:

```typescript
$effect(() => {
  function handlePopState(event: PopStateEvent) {
    const hash = window.location.hash;
    // Only handle card-preview hashes
    if (hash.startsWith(`#card-preview:`)) {
      state.initFromHash(hash, decks);
    }
  }
  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
});
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/state/card-preview-state.svelte.ts \
        src/lib/features/choreo-card/components/card-preview/CardPreviewTab.svelte
git commit -m "feat(choreo-card): add browser history for Card Preview navigation"
```

---

## Task 11: Verify End-to-End

- [ ] **Step 1: Run full typecheck**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All tests pass (including the new card-sizes tests)

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual verification checklist**

Open the app and navigate to Choreo Cards module:
1. Tabs show: Card Preview, Decks, Designer (no Library, no Print-Prep)
2. Card Preview opens to source picker (Level 0) with LOOP Decks and VTG Decks cards
3. Clicking a source shows collection view (Level 1) with deck filtering
4. Selecting a deck shows card page layout (Level 2) with breadcrumbs
5. Card size toggle switches between poker and tarot
6. Family chips filter the displayed cards
7. Settings gear opens the settings panel
8. Cards render on simulated white pages
9. Decks tab still works independently
10. Designer tab still works

- [ ] **Step 5: Test browser back/forward**

Navigate source → deck → back → forward. Verify state restores correctly.

- [ ] **Step 6: Test export**

Export a small deck (VTG zero-turn, 19 sequences) as both PDF and ZIP. Verify files download correctly.

- [ ] **Step 7: Final commit if any fixes needed**

```bash
git commit -m "fix(choreo-card): address Card Preview integration issues"
```
