---
status: archived
---
# Card Preview Tab Design

**Date:** 2026-03-28
**Status:** Draft
**Replaces:** Library tab + Print-Prep tab in Choreo Cards module

## Problem

The Choreo Cards module has four tabs (Library, Decks, Designer, Print-Prep) that fragment a single workflow: "see my cards as they'll look printed, then print them." The Library tab shows saved sequences in a page layout but not as actual card shapes. The Print-Prep tab renders real cards but lives in a separate tab with no browsing. Users must bounce between tabs to go from "find a deck" to "see the cards" to "export for printing."

## Solution

Replace the Library and Print-Prep tabs with a single **Card Preview** tab. This tab uses progressive disclosure to walk the user from source selection through deck choice to subset filtering, rendering every sequence as a physical card on simulated pages. Export/print is an action on whatever you're viewing, not a separate destination.

**Tab structure after this change:**
- **Card Preview** (new, replaces Library + Print-Prep)
- **Decks** (stays for now — provides a lightweight browse-only experience without card rendering overhead. Candidate for future removal once Card Preview is proven.)
- **Designer** (stays)

## Navigation: Progressive Disclosure with Breadcrumbs

Three levels, each replacing the previous content area. A breadcrumb bar at the top enables jumping back to any level.

### Level 0: Source Selection

Two source cards (more added later):
- **LOOP Decks** - algorithmic loop pattern decks
- **VTG Decks** - per-hand learning decks

Future sources (not in this implementation): My Library, Custom Set.

Each card shows: collection name, deck count, total sequence count.

### Level 1: Deck Selection

Reuses existing collection views:
- For LOOP Decks: `LoopCollectionView` with its pill bar (LOOP type), axis toggle (beats/turns/reversal), and filter dropdowns (slice type, grid mode)
- For VTG Decks: existing VTG collection filtering (family/ratio/reversal views)

Selecting a deck advances to Level 2.

Breadcrumb: `Card Preview > LOOP Decks`

### Level 2: Card Preview (the main view)

This is where cards render on pages. Components:

**Top bar:**
- Breadcrumb: `Card Preview > LOOP Decks > L1 3-Beat Rotated Halved`
- Card size toggle (segmented control): `[ Poker 2.5"x3.5" | Tarot 2.75"x4.75" ]`

**Subset filters (below breadcrumb):**
- Family chips (multi-select, from deck families)
- Start position filter (alpha/beta/gamma)
- Sequence count badge showing how many cards match current filters

**Main content area:**
- Simulated white pages (letter-size, portrait)
- Cards arranged on pages in a grid determined by card size:
  - Poker (2.5"x3.5"): 3 columns x 3 rows = 9 cards per page (matches existing `PrintPDFExporter` layout)
  - Tarot (2.75"x4.75"): 2 columns x 2 rows = 4 cards per page
- Page preview must match PDF export layout exactly — what you see is what you print
- Family section headers appear between page groups
- Cards show front face by default
- Click a card to open detail modal (front + back, navigation arrows)

**Collapsible settings panel (gear icon or slide-out):**
- Card back theme picker (8 existing themes)
- Visibility toggles: grid, TKA notation, word, start position, hand points
- Export format: ZIP (PNGs) or PDF
- Export button: "Export [N] cards" — exports current filtered subset
- Home print option: PDF laid out for letter/A4 double-sided printing

## Card Sizes

### Poker (existing)
- Physical: 2.5" x 3.5"
- At 300 DPI: 750 x 1050 px (content area)
- With bleed (36px): 822 x 1122 px
- Aspect ratio: ~0.732

### Tarot (new)
- Physical: 2.75" x 4.75"
- At 300 DPI: 825 x 1425 px (content area)
- With bleed (36px): 897 x 1497 px
- Aspect ratio: ~0.579

The `PrintRenderOptions` interface already supports `canvasWidth`, `canvasHeight`, and `bleedPx` overrides. No changes needed to the rendering contract — just pass the right dimensions.

### Card Size Constants

```typescript
export const CARD_SIZES = {
  poker: {
    label: 'Poker 2.5"x3.5"',
    widthInches: 2.5,
    heightInches: 3.5,
    contentWidth: 750,    // at 300 DPI
    contentHeight: 1050,
    canvasWidth: 822,     // with 36px bleed
    canvasHeight: 1122,
    bleedPx: 36,
  },
  tarot: {
    label: 'Tarot 2.75"x4.75"',
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
```

## Page Layout Calculation

Pages simulate letter-size paper (8.5" x 11" = 612 x 792 pt). Card arrangement must match the existing `PrintPDFExporter` output so the preview is WYSIWYG.

### Poker (2.5" x 3.5" = 180 x 252 pt)

The existing `PrintPDFExporter` uses 3x3 = 9 cards per sheet:
- Grid: 540 x 756 pt
- Margins: 36 pt horizontal (0.5"), 18 pt vertical (0.25")
- This is tight but correct — the code already ships this layout.

### Tarot (2.75" x 4.75" = 198 x 342 pt)

New layout calculation:
- Columns: floor(612 / 198) = 3, but grid width = 594 leaves only 18pt margin. Use 2 columns for comfortable margins.
- Rows: floor(792 / 342) = 2
- Grid: 396 x 684 pt
- Margins: 108 pt horizontal (1.5"), 54 pt vertical (0.75")
- Cards per page: 4

### Layout Constant Structure

```typescript
export interface PageLayout {
  cols: number;
  rows: number;
  cardsPerPage: number;
  cardWidthPt: number;
  cardHeightPt: number;
  marginXPt: number;
  marginYPt: number;
}

export function getPageLayout(cardSize: CardSizeId): PageLayout { ... }
```

The `PrintPDFExporter` interface must change to accept card size so it can compute the correct grid. See "Service Changes" section below.

## Component Architecture

### New Components

| Component | Purpose |
|-----------|---------|
| `CardPreviewTab.svelte` | Top-level orchestrator. Manages progressive disclosure levels, breadcrumb state, source/deck/subset selection. |
| `SourcePicker.svelte` | Level 0. Two cards for LOOP and VTG sources (extensible for future sources). |
| `CardPageLayout.svelte` | Level 2 main content. Renders card-sized items on simulated pages. Takes sequences + card size, computes pages. |
| `CardSizeToggle.svelte` | Segmented control for poker/tarot selection. |
| `CardPreviewSettings.svelte` | Collapsible panel with theme, visibility, export controls. Reuses logic from PrintPrepSidebar. |
| `SubsetFilterBar.svelte` | Family chips + start position filter for Level 2. Reuses logic from DeckInteriorFilterPanel. |

### Reused Components (no changes)

| Component | Used For |
|-----------|----------|
| `LoopCollectionView` | Level 1 LOOP deck selection |
| `PrintPrepDetailModal` | Card detail view on click |
| `DeckCard` | Deck cards in Level 1 collection views |

### Service Changes

| Service | Change |
|---------|--------|
| `PrintCardRenderer` | None — already supports size overrides via `PrintRenderOptions` |
| `CardBackCanvasRenderer` | None — scales to canvas size |
| `DeckLoader` | None — loads deck sequences by family |
| `PrintPDFExporter` | **Interface change required.** Both `exportDeckPDF` and `exportHomePrintPDF` must accept a `CardSizeId` parameter. Implementation must replace hardcoded poker constants (`CARD_W=180`, `CARD_H=252`, `COLS=3`, `ROWS=3`) with dynamic computation from `getPageLayout(cardSize)`. The MPC single-page export also needs per-card page dimensions updated for tarot. |
| `IPrintPDFExporter` | Add `cardSize: CardSizeId` to both method signatures |
| `PrintZipExporter` | None — exports whatever canvases it receives |

## State Management

Follows the project's factory + context pattern:

```typescript
// state/card-preview-state.svelte.ts
export function createCardPreviewState(deckLoader: IDeckLoader) {
  // Navigation
  let level = $state<0 | 1 | 2>(0);
  let selectedSource = $state<'loops' | 'vtg' | null>(null);
  let selectedDeck = $state<Deck | null>(null);

  // Card config
  let cardSize = $state<CardSizeId>('poker');

  // Subset filters
  // Array (not Set) to match DeckInteriorFilterPanel's string[] interface
  let selectedFamilyIds = $state<string[]>([]);
  // Matches position prefix strings: "alpha", "beta", "gamma"
  let startPositionFilter = $state<string | null>(null);

  // Sequences & rendering
  let sequences = $state<SequenceData[]>([]);
  let isLoading = $state(false);

  // Rendered card canvases — virtualized per page to manage memory
  let renderedPages = $state<Map<number, CardPair[]>>(new Map());

  // Derived
  let filteredSequences = $derived.by(() => {
    let result = sequences;
    if (selectedFamilyIds.length > 0) {
      const idSet = new Set(selectedFamilyIds);
      const seqIds = new Set(
        selectedDeck?.families
          .filter(f => idSet.has(f.id))
          .flatMap(f => f.sequenceIds) ?? []
      );
      result = result.filter(s => seqIds.has(s.id));
    }
    if (startPositionFilter) {
      // SequenceData.startPosition is a string like "alpha1", "beta3", "gamma2"
      // Filter by prefix: "alpha" matches "alpha1", "alpha2", etc.
      result = result.filter(s => {
        const posId = s.startPosition ?? '';
        return typeof posId === 'string' && posId.startsWith(startPositionFilter!);
      });
    }
    return result;
  });

  // Breadcrumb segments
  let breadcrumbs = $derived.by(() => {
    const crumbs = [{ label: 'Card Preview', level: 0 as const }];
    if (selectedSource) {
      crumbs.push({
        label: selectedSource === 'loops' ? 'LOOP Decks' : 'VTG Decks',
        level: 1 as const,
      });
    }
    if (selectedDeck) {
      crumbs.push({ label: selectedDeck.name, level: 2 as const });
    }
    return crumbs;
  });

  return {
    // Navigation
    get level() { return level; },
    get selectedSource() { return selectedSource; },
    get selectedDeck() { return selectedDeck; },
    get breadcrumbs() { return breadcrumbs; },

    // Card config
    get cardSize() { return cardSize; },
    set cardSize(v) { cardSize = v; },

    // Filters
    get selectedFamilyIds() { return selectedFamilyIds; },
    get startPositionFilter() { return startPositionFilter; },
    get filteredSequences() { return filteredSequences; },
    get isLoading() { return isLoading; },

    // Actions
    selectSource(source: 'loops' | 'vtg') {
      selectedSource = source;
      level = 1;
    },
    selectDeck(deck: Deck) {
      selectedDeck = deck;
      level = 2;
      // Load sequences, reset filters
      selectedFamilyIds = [];
      startPositionFilter = null;
      renderedPages = new Map();
      // Trigger sequence loading...
    },
    navigateTo(targetLevel: 0 | 1 | 2) {
      // Reset all state below the target level
      if (targetLevel <= 1) {
        selectedDeck = null;
        sequences = [];
        selectedFamilyIds = [];
        startPositionFilter = null;
        renderedPages = new Map();
      }
      if (targetLevel === 0) {
        selectedSource = null;
      }
      level = targetLevel;
    },
    setFamilyFilter(ids: string[]) { selectedFamilyIds = ids; },
    setStartPositionFilter(pos: string | null) { startPositionFilter = pos; },

    // Build render options from current card size
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
```

Persisted to localStorage:
- `cardPreview.cardSize` (poker/tarot)
- `cardPreview.source` (loops/vtg)
- `cardPreview.deckId` (last viewed deck)
- `cardPreview.theme` (card back theme)
- Visibility toggles (reuse existing `choreoCard.*` keys)

## Rendering Strategy

### Small decks (< 100 sequences)
Render all cards eagerly when deck loads. Show progress bar during rendering.

### Medium decks (100-500 sequences)
Render in batches of 20. Show pages as they complete. Lazy-render pages below the fold.

### Large decks (500+ sequences)
Force family selection first (no "show all" option). Each family is typically 20-60 sequences, which renders quickly. The subset filter bar shows a warning: "Select a family to view cards (2,592 total sequences)."

This mirrors the existing `isLargeDeck` threshold in DeckBrowser (500+).

### Canvas Memory Management

Each card pair (front + back at poker size) is ~7.4MB of canvas memory. At 100 cards = ~740MB. To prevent memory pressure:

- **Virtualize by page.** Only keep rendered canvases for visible pages + 1 page above/below.
- **Convert to data URLs for off-screen pages.** Data URLs are strings (smaller footprint than canvas pixel buffers) and can be used directly as `<img>` src.
- **Release canvases** for pages scrolled out of the buffer window.
- **Re-render on scroll** when a page re-enters the viewport (using IntersectionObserver).

The `renderedPages` map in state holds `CardPair[]` per page index. The `CardPageLayout` component manages the viewport window.

## Browser History

The existing `#deck-nav:` hash scheme maps to the new 3-level navigation:

```
Level 0 (source picker):  #card-preview:
Level 1 (deck selection):  #card-preview:src=loops
Level 2 (card view):       #card-preview:src=loops&deck=strict_rotated_halved_L1_3beat
```

Optional filter state is NOT encoded in the hash (too volatile). Only source and deck are permalink-able. Filter state resets when navigating via breadcrumbs or browser back.

Existing `#deck-nav:` hashes from the Decks tab are unaffected — they use a different prefix.

## What Gets Removed

- **Library tab** — replaced entirely by Card Preview. The Library tab's sequence loading from saved library will return when the "My Library" source is added.
- **Print-Prep tab** — absorbed into Card Preview. Export is an action within Card Preview, not a separate view.
- Tab count goes from 4 to 3: Card Preview, Decks, Designer.

## What Gets Preserved

- All print-prep rendering infrastructure (PrintCardRenderer, exporters, themes)
- All deck browsing infrastructure (LoopCollectionView, DeckLoader, family filtering)
- Browser history support (hash-based navigation state)
- Context menu on cards (rerender, settings)
- Card back themes and visibility toggles
- Detail modal with prev/next navigation

## Migration

- `ChoreoCardTab.svelte` mode type changes from `"library" | "decks" | "designer" | "print-prep"` to `"card-preview" | "decks" | "designer"`
- Navigation tab definitions in `module-definitions.ts` updated
- localStorage keys: existing `choreoCard.*` keys remain valid. New `cardPreview.*` keys added for Card Preview-specific state.
- Old `printPrep.*` localStorage keys still read for backward compat (theme, bleed, info cards), but new writes use `cardPreview.*` prefix.
- Library-only keys (`choreoCard.selectedLength`, `choreoCard.columnCount`, `choreoCard.difficulty`, `choreoCard.favorites`, `choreoCard.gridMode`, `choreoCard.author`, `choreoCard.showQRCodes`) become dead keys. Leave them in place — no cleanup needed since they don't collide. They'll be relevant again when the "My Library" source is added.
- Shared visibility keys (`choreoCard.showGrid`, `choreoCard.showTKA`, `choreoCard.showWord`, `choreoCard.includeStartPosition`, `choreoCard.handPointsVisible`) are reused by Card Preview as-is.

## Not In Scope (Future)

- **My Library source** — load saved sequences into Card Preview
- **Custom Set source** — cherry-pick sequences from any source into a printable set
- **A4 paper size** — currently letter only
- **Landscape orientation** — portrait only
- **Card back customization** — beyond theme color selection
- **Batch print across multiple decks** — one deck at a time
