---
status: active
value: 3
effort: M
remaining: "Body status: Active"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Sectioned Virtual Gallery — Design

**Date:** 2026-07-03
**Status:** Active
**Author:** Claude (Opus 4.8) + Austen

## Problem

Tapping a value in the gallery drill (e.g. "Level 1") freezes for a long, feedback-less
beat before the grid appears. Measured on localhost (dev build, fast desktop CPU):

| Filter | Rendered cards | Sections | Longest main-thread task | Click → painted |
|---|---|---|---|---|
| Level 1 | 158 | 98 | 220 ms | 362 ms |
| Level 2 | 244 | 112 | 341 ms | 584 ms |

On a phone (4–6× slower CPU) that is roughly a 1–3.5 s frozen tap.

### Root cause (verified in code)

`BrowseGrid.svelte:44` — `useVirtualization` is **false whenever sections are enabled and
present**:

```ts
const useVirtualization = $derived(
  !disableVirtualization &&
    !(engine.sectionsEnabled && engine.sections.length > 0) &&
    engine.sequences.length > 50
);
```

The gallery always runs with `sections: true`, so it **never virtualizes**. The sectioned
branch renders a real `ChoreoCardThumbnail` for every word across every section. That mount
is synchronous and happens in the same flush that swaps the drill out
(`BrowseModule.svelte:547` calls `engine.addFilter(...)` then `galleryView = "browse-all"`),
and the swap is a bare `{#if}` with no transition. BrowsePanel's skeleton is gated on
`engine.isLoading` (async data load only), so nothing covers a filter recompute. Result:
the drill stays painted and frozen while the main thread mounts N cards, then hard-cuts to
the grid.

## Goals

1. Tapping a drill value paints the grid effectively instantly, regardless of bucket size.
2. Constant DOM/work independent of result count (true virtualization, not progressive
   chunking that still fills the DOM).
3. Preserve every existing gallery behavior: desktop section sidebar (jump + active-section
   highlight), scroll-position restore on return from the viewer, toolbar hide-on-scroll,
   pinch-zoom column count, variation pills, difficulty badges, level banners, letter
   subsections.

## Non-goals

- The drill count vs. rendered-card-count mismatch (drill shows variation-record counts,
  e.g. "Level 2: 1138", grid renders 244 word-cards). Real but separate; not touched here.
- The flat `VirtualizedSequenceGrid` (used by non-sectioned hosts — pickers, collections).
  Left as-is.

## Architecture

### New component: `SectionedVirtualGrid.svelte`

`src/lib/shared/browse/components/SectionedVirtualGrid.svelte`

Windows a **flattened, typed item stream** with `@tanstack/svelte-virtual` (already a
dependency, used by the flat grid).

**Flatten** `engine.sections` (already sorted/organized by the engine) into:

```ts
type Item =
  | { type: 'banner'; key: string; level: number; levelTotal: number }
  | { type: 'header'; key: string; title: string; count: number; isLevel: boolean; hideSteps: boolean }
  | { type: 'row'; key: string; sequences: SequenceData[]; isLevel: boolean };
```

Per section: if it starts a new level → emit a `banner`; emit a `header`; `dedupeByWord`
its sequences and chunk into rows of `engine.columnCount` → emit `row` items. This mirrors
the current `sectionRows`/`dedupeByWord` logic in `BrowseGrid.svelte` exactly — moved, not
reinvented.

**Height estimation** (`estimateSize` by item type):
- `banner`: fixed constant (measured ~54 px).
- `header`: fixed constant (measured ~40 px).
- `row`: `cardWidth / calculateGalleryAspectRatio(tallestStepsInRow, layout)` — the same
  math the flat grid's `estimateRowHeight` uses.

`measureElement` corrects each rendered item's real height after paint (TanStack variable
size + measurement, identical to the flat grid).

**External scroll element (the key integration decision):** the virtualizer uses
`getScrollElement: () => scrollElement` where `scrollElement` is **BrowsePanel's
`.panel-content`**, passed down as a prop — NOT a scroller the grid owns. This keeps ONE
scroll container, which is required because:
- the section sidebar is `position: sticky` inside `.panel-content` (a self-scrolling grid
  would break sticky),
- scroll-restore, toolbar hide-on-scroll, and the skeleton overlay are all already wired to
  `.panel-content` and keep working unchanged.

TanStack `scrollMargin` is set to the virtual list container's offset within the scroll
element (`container.top − scrollElement.top + scrollElement.scrollTop`) so absolute item
offsets line up with real scroll position even though the list starts below the toolbar/
filter bar.

**Columns:** driven by `engine.columnCount` (already clamped, pinch-zoom aware) so behavior
matches the current sectioned grid's `grid-template-columns: repeat(columnCount, 1fr)`.

**Section navigation (desktop ≥768px only — sidebar is `display:none` below that):**
- Build `Map<sectionTitle, headerItemIndex>`.
- Expose an imperative API via `onGridReady({ scrollToSectionTitle })` →
  `virtualizer.scrollToIndex(headerIndex, { align: 'start' })`.
- Report active section up via `onActiveSectionChange(title)` derived from the topmost
  visible item's owning section (replaces BrowsePanel's DOM-offset `updateActiveSection`,
  which virtualization breaks since off-screen headers leave the DOM).

**Reused, not rebuilt:** `ChoreoCardThumbnail`, `SectionHeader`, `DifficultyBadge`,
`variation-grouper` (`buildVariationMap`/`variationGroupKey`/word dedupe),
`calculateGalleryAspectRatio`, `cellPreWarmer` (pre-warm visible rows on scroll-idle),
and every card prop (`handPathMode`, `showBlueMotion`, `showRedMotion`, `addWord`,
`addDifficultyLevel`, `lightMode`, prop settings, `selectedIds`). Only the windowing
wrapper is new.

### Wiring changes

`BrowseGrid.svelte`:
- Sectioned branch (`{:else if engine.sectionsEnabled && engine.sections.length > 0}`)
  renders `<SectionedVirtualGrid {engine} {scrollElement} onGridReady onActiveSectionChange … />`
  instead of the inline `{#each sectionRows}`.
- New props threaded through: `scrollElement`, `onActiveSectionChange`.
- `sectionRows`/`dedupeByWord` move into `SectionedVirtualGrid`.

`BrowsePanel.svelte`:
- Pass `contentEl` (`.panel-content`) down to `BrowseGrid` as `scrollElement`.
- Receive the grid's `onGridReady` API; wire `onScrollToSection` (to the sidebar) →
  `api.scrollToSectionTitle`.
- Receive `onActiveSectionChange` → set `activeSection`.
- Keep `handleScroll` on `.panel-content` for `browseScrollState` (toolbar hide + scroll
  restore). The DOM-offset `updateActiveSection` is no longer the source for the sectioned
  case — the grid reports it.

### Part 2 — perceived feel (evidence-driven)

Re-measure the tap after virtualization. Expected: card mounts drop from 158/244 to the
visible window (~12–24), main-thread task to a few tens of ms — effectively instant. Then:
- Add an `:active` pressed state to the drill value tiles (`.level-tile`, `.length-row`,
  etc.) for instant touch feedback (no `:hover` on touch).
- Add a crossfade on the drill→grid swap **only if** the re-measured numbers still warrant
  it. If virtualization alone makes the tap instant, a crossfade is polish, not a fix.

## Risks & mitigations

- **scrollMargin drift** when toolbar/filter-bar height changes (chips wrap): recompute
  scrollMargin on ResizeObserver of the scroll element (already observed for width).
- **Estimate vs. measured height jump** on first paint: seed estimates from the real
  aspect-ratio math (not a flat guess), so pre-measure layout is close; `measureElement`
  settles it within a frame. Same approach the flat grid already ships.
- **Active-section accuracy** while scrolling fast: derive from `virtualItems[0]`'s owning
  section each range change — cheap, no DOM queries.
- **Small buckets** (e.g. Level 3 ≈ 51 cards): virtualization still correct; overscan 3
  keeps it smooth. One code path for all sizes.

## Verification (self, via Chrome DevTools MCP — user is remote/blind)

1. Re-run the instrumented Level 1 + Level 2 tap: assert rendered-card count is the visible
   window (not 158/244) and longest task drops to tens of ms. Report before/after table.
2. Scroll the virtualized grid: assert cards recycle (DOM node count stays bounded), no
   overlap, no blank rows.
3. Desktop (≥768px): sidebar letter/level jump scrolls to the right section; active marker
   highlights correctly while scrolling.
4. Return-from-viewer scroll restore still lands at the saved position.
5. Variation pill still cycles a card's variations; difficulty badges + level banners render.
6. `npm run check` clean for the touched files; screenshots at mobile + desktop widths.
