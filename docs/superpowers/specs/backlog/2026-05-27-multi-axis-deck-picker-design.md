# Multi-Axis Deck Picker Test Page

**Date:** 2026-05-27
**Status:** Draft
**Scope:** SvelteKit test route that renders a matrix grid of catalogs pivotable by any two classification axes.

---

## Route

`/test/deck-picker` — full-viewport, no sidebar. Top toolbar with axis selectors. Matrix grid fills remaining space. Detail panel slides from right on cell click.

## Data

Calls `loadCatalogs()` on mount. Derives axis values per catalog:

| Axis | Source |
|------|--------|
| TnD Family | `inferTnDFamily(catalog)` |
| Turn Pattern | `catalog.turnPattern` |
| Reversal Pattern | `catalog.reversalPattern` |
| Collection | `catalog.collection` |
| Grid Mode | `catalog.gridMode` |
| Step Count | `catalog.stepCount` |

Pivots catalogs, not sequences. Each cell = count of catalogs at that intersection.

## Matrix

Reuses `TnDTurnMatrix` visual style: CSS grid, monospace font, hover glow, heat-mapped cells. Empty cells dimmed.

## Axis Selectors

Two `<select>` dropdowns: Row Axis, Column Axis. Changing either re-renders the matrix.

## Cell Click

Detail panel lists catalogs in that cell with name and sequence count. Navigation to catalog interior deferred to v2.

## Existing Code to Reuse

| Need | Source |
|------|--------|
| Catalog loading | `catalog-loader.ts` — `loadCatalogs()` |
| Family inference | `catalog-browse-state.svelte.ts` — `inferTnDFamily()` |
| Turn parsing | `turn-pattern-parser.ts` — `parseTurnPattern()` |
| Visual style | `TnDTurnMatrix.svelte` — CSS patterns |

## Success Criteria

1. Page loads all catalogs from Firestore
2. Matrix renders with any two axes selected
3. Cell counts are correct
4. Click shows detail panel with catalog list
