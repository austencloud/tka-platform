# Decks Tab Redesign — Design Spec

**Date:** 2026-04-23
**Status:** Draft
**Scope:** Choreo Cards → Decks tab browse experience

## Problem

The current Decks tab has three UX failures:

1. **Dead-end first load** — "Too many decks to browse" with an empty content area. Zero content visible until you click through filters.
2. **Sequential drill-down** — 5 filter steps (collection → shape → stepcount → turn → reversal) must be completed before seeing any decks. Not a power-user experience.
3. **Sidebar filter panel** — takes horizontal space, feels clinical, separates filter controls from results.

## Design

### Layout: Full-Width Filter Bar + Grouped Grid

Replace the sidebar + drill-down with a single full-width page:

```
┌──────────────────────────────────────────────────┐
│ Decks   [LOOPs] [VTG]              128 decks     │
├──────────────────────────────────────────────────┤
│ TYPE  [Rotated] [Mirrored] [Flipped] [Swapped]  │
│ SLICE [Halved] [Quartered] · GRID [Diamond] [Box]│
│       · STEPS [4] [6] [8] · TURNS [Uniform]     │
├──────────────────────────────────────────────────┤
│ ── Rotated ──────────────────────── 42 decks ──  │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│
│ │ card    │ │ card    │ │ card    │ │ card    ││
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘│
│ ── Mirrored ─────────────────────── 38 decks ──  │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│
│ │ card    │ │ card    │ │ card    │ │ card    ││
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘│
└──────────────────────────────────────────────────┘
```

**Container:** `max-width: 1200px`, centered. Prevents content from swimming on 4K displays.

**Grid:** `grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))`. Adapts from 2 columns on narrow to 4–5 on wide.

### Filter Chips

- **Collection toggle** (LOOPs / VTG): Only required choice. Defaults to LOOPs. Shown as pill toggle in header row.
- **All other filters** (Type, Slice, Grid, Steps, Turns): Optional multi-select chips. Compact rows below header.
- **Behavior:** Chips narrow results, never gate them. Unselected = show all. Selected = show only matching. Multiple selections within a row = OR logic. Across rows = AND logic.
- **Type row:** Shows only loop types that exist in current deck set: Rotated, Mirrored, Flipped, Swapped, Inverted, Rot/Inv, Mir/Swap, Rewound (and compound combos as they get generated).
- **Second row:** Slice + Grid + Steps + Turns combined, separated by dot dividers. These have fewer options so they fit on one line.

### Deck Card

Horizontal layout filling the full card width:

```
┌──────────────────────────────────────┐
│ [picto] Name            ●●●● rev    │
│         42 seq · 8 steps             │
└──────────────────────────────────────┘
```

- **Left:** 36×36px pictograph thumbnail of beat 1 from the deck's first sequence. Uses PictographRenderer at small size (not custom SVG).
- **Center:** Deck name (reversal pattern label: Continuous, Alternating, Book, etc.) + sequence count + step count.
- **Right:** Reversal dot strip — colored squares (blue=P, red=R) showing the reversal pattern. Existing `getReversalPattern()` logic stays.
- **Context-determined tags:** Only show properties that differ across visible results in the current group. If all decks in "Rotated" group are Diamond grid, don't show a "Diamond" tag. Reuse the existing "varying axes" logic from `DeckResultsPanel`.
- **Hover:** `border-color` transition to cyan accent. No `translateY` lift (wastes vertical space in a dense grid).

### Grouping

Decks grouped by **loop type** within each collection:

- LOOPs: sections for Rotated, Mirrored, Flipped, Swapped, Inverted, and compound types
- VTG: sections by VTG family (vtgFamily field on Deck)

Each group has a header row: `GroupName ──────── N decks`

Groups with zero decks after filtering are hidden. If filters reduce to a single group, the group header still shows for orientation.

### Persistence

Full browsing state persisted to `localStorage` key `deckBrowser.state`:

```typescript
interface SavedDeckBrowseState {
  collection: 'LOOPs' | 'VTG';
  filters: {
    loopTypes: string[];
    sliceTypes: ('halved' | 'quartered')[];
    gridModes: string[];
    stepCounts: number[];
    turnPatterns: string[];
  };
  scrollY: number;
  selectedDeckId: string | null;
}
```

On mount: restore from localStorage. On any filter/scroll change: debounce-write to localStorage (300ms). User returns to Decks tab → sees exactly what they left.

### State Management

New `createDeckBrowseState(decks: Deck[])` factory replaces `createDrillDownState()`.

```typescript
interface DeckBrowseState {
  // Reactive state
  collection: 'LOOPs' | 'VTG';
  filters: FilterState;

  // Derived
  readonly filteredDecks: Deck[];
  readonly groupedDecks: Map<string, Deck[]>;
  readonly availableFilters: AvailableFilters; // what chips to show (based on actual deck data)
  readonly totalCount: number;
  readonly totalSequences: number;

  // Actions
  setCollection(c: 'LOOPs' | 'VTG'): void;
  toggleFilter(dimension: string, value: string): void;
  clearFilters(): void;
  restore(saved: SavedState): void;
}
```

Filter logic:
- Within a dimension (e.g. loopTypes): **OR** — deck matches if its loopType is in the selected set
- Across dimensions: **AND** — deck must match all active filter dimensions
- Empty dimension = no constraint (show all)

### What Gets Deleted

These components are fully replaced:

```
components/drilldown/
  DeckDrillDown.svelte
  DeckFilterSidebar.svelte → replaced by inline filter chips
  DeckResultsPanel.svelte → replaced by grouped grid
  CollectionStep.svelte
  ShapeStep.svelte
  StepCountStep.svelte
  TurnPatternStep.svelte
  ReversalPatternStep.svelte
  UniformSubStep.svelte
  DrillBreadcrumb.svelte
  DrillPill.svelte → chip design extracted, drilldown logic removed
  ShapeStep helpers (GridModeCard, TurnBarChart, TurnPatternCard, ElementalFamilyCard)
  sidebar/ (entire directory)

state/
  deck-drilldown-state.svelte.ts → replaced by deck-browse-state.svelte.ts
  deck-drilldown-types.ts → replaced by deck-browse-types.ts

context/
  deck-drilldown-context.ts → replaced by deck-browse-context.ts
```

### What Stays

- `Deck.ts` model — unchanged
- `DeckLoader.ts` service — unchanged
- `reversal-patterns.ts` — unchanged, still drives dot visualization
- `DeckBrowser.svelte` — rewritten but keeps its role as the deck interior view (family/position filtering, print preview)
- `ChoreoCard.svelte`, `CardInspectModal.svelte` — unchanged
- `DeckCard.svelte` — rewritten with new horizontal layout
- `ChoreoCardTab.svelte` — updated to route through new browse state instead of drill-down

### Mobile

Mobile layout (< 768px):
- Collection toggle and filter chips stack vertically
- Grid drops to `minmax(160px, 1fr)` — 2 columns
- Group headers stay
- Card layout stays horizontal but pictograph shrinks to 28px
- Filter area collapsible (chevron toggle) to maximize scroll real estate

### Pictograph Thumbnails

Each deck card shows beat 1 of its first sequence as a mini pictograph. Loading strategy:
- On mount, load first sequence ID from each visible deck's first family
- Use PictographRenderer at 36px size
- Cache rendered thumbnails in a `Map<string, SVGElement>` keyed by sequence ID
- Lazy-load: only render thumbnails for cards in viewport (IntersectionObserver)
- Fallback: show placeholder grid dots (4 cardinal points) while loading

### VTG Collection

When VTG is selected:
- Filter row changes: Type row replaced by **Category** row (VTG family names from deck data)
- Slice/Grid/Steps/Turns rows remain
- Groups organized by VTG family instead of loop type
- Card layout identical
- Purple accent color (`#b763cd`) instead of cyan (`#63b7cd`)

### Transitions

- Collection toggle: instant swap, no animation
- Filter chip toggle: grid re-renders with CSS `layout` animation (if browser supports it), otherwise instant
- Group collapse/expand: not needed — all groups visible, scroll to find
- Card click → deck interior: existing transition in ChoreoCardTab stays
