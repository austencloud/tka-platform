# VTG Turn Matrix Browser

**Date:** 2026-05-25
**Status:** Draft
**Scope:** Replace the flat VTG catalog card grid + overflowing turn-pattern chips with a structured dual-view browser.

---

## Problem

The VTG catalog browser displays 49+ decks per family as identical-looking cards ("Continuous, 19 seq, 4-step") in a flat grid. Turn combinations are shown as an overflowing horizontal chip row with cryptic notation like "0.5|1.5". No visual structure communicates the relationship between blue and red hand turns.

## Solution

Two orthogonal view modes for VTG catalogs, toggled at the top:

| Mode | Gate | Content | Click action |
|------|------|---------|-------------|
| **By Turns** | None — matrix is the landing view | 7×7 grid: blue turns (rows) × red turns (cols) | Cell → catalog interior (all 19 sequences) |
| **By Family** | 6 TnD family buttons with element icons | Flat sequence card grid across all turn combos | Card → sequence viewer |

The LOOPs/VTG collection toggle remains unchanged. When VTG is selected, the family filter chips and turn-pattern filter chips are removed — the matrix and family picker replace them entirely.

---

## By Turns View (7×7 Matrix)

### Layout

A CSS grid with 8 columns (header + 7 turn values) and 8 rows (header + 7 turn values).

- **Column headers:** Red hand turns (0, 0.5, 1, 1.5, 2, 2.5, 3), colored `#ED1C24`
- **Row headers:** Blue hand turns (0, 0.5, 1, 1.5, 2, 2.5, 3), colored `#3575E2`
- **Turn values:** `[0, 0.5, 1, 1.5, 2, 2.5, 3]` — the 7 discrete turn levels

### Cell States

| State | Condition | Appearance |
|-------|-----------|------------|
| **Symmetric** | Row == Column (diagonal) | Highlighted fill, stronger border, diamond marker |
| **Asymmetric** | Row != Column (off-diagonal) | Standard fill |
| **Empty** | No catalog exists for this turn pair | Dim/disabled, no click handler |

Each populated cell displays:
- Sequence count (e.g. "19")
- Hover: brighten + subtle scale
- Click: navigates to existing catalog interior view

### Turn Pattern Resolution

Catalogs store turn patterns in two formats:
- Symmetric: `"uniform-Nt"` where N is the turn count (e.g., `"uniform-2t"`)
- Asymmetric: `"blue|red"` pipe-separated turn counts (e.g., `"0.5|1"`)

The matrix maps each catalog to its [row, col] position by parsing these patterns. The `parseTurnPattern()` utility returns `{ blue: number, red: number }`.

### Sizing

The matrix should fit comfortably on screen without scrolling. Target cell size: ~80px square on desktop, ~48px on mobile. The entire matrix is ~640px wide on desktop.

---

## By Family View

### Family Picker

Six large buttons, each showing:
- Element icon (water, earth, sun, fire, air, moon)
- Family name (Split-Same, Tog-Same, Split-Opp, Tog-Opp, Quarter-Same, Quarter-Opp)
- Total sequence count across all turn combos

### Sequence Grid

After selecting a family, a flat card grid shows ALL sequences of that family across all 49 turn combinations. Each sequence card displays:
- Sequence thumbnail/pictograph
- Sequence word/ID
- Turn label (e.g., "0|0.5") showing which turn combo it came from

No sub-grouping — flat grid, sorted by turn combo then alphabetically.

---

## Component Structure

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `VtgTurnMatrix.svelte` | `src/lib/features/choreo-card/components/` | The 7×7 grid with headers, cells, click handling |
| `VtgFamilyBrowser.svelte` | `src/lib/features/choreo-card/components/` | Family picker + flat sequence grid |

### Modified Components

| Component | Change |
|-----------|--------|
| `CatalogBrowseFilterBar.svelte` | Add VTG view mode toggle (By Turns / By Family) when VTG selected. Remove family chips and turn-pattern chips for VTG. |
| `CatalogBrowseGrid.svelte` | When VTG + "By Turns" mode, render `VtgTurnMatrix` instead of card grid. When VTG + "By Family" mode, render `VtgFamilyBrowser`. LOOPs unchanged. |
| `catalog-browse-state.svelte.ts` | Add `vtgViewMode: 'turns' | 'family'` to state. Persist to localStorage. |
| `catalog-browse-types.ts` | Add `VtgViewMode` type. |

### Unchanged

- `CatalogBrowser.svelte` — the two-level nav (browse → interior) is unchanged. Matrix cell click feeds into the same `onSelectCatalog` callback.
- `CatalogCard.svelte` — still used for LOOPs and for sequence cards in family view.
- All catalog interior components — drill-down view unchanged.

---

## State Changes

```typescript
// catalog-browse-types.ts
export type VtgViewMode = 'turns' | 'family';

// catalog-browse-state.svelte.ts additions
let vtgViewMode = $state<VtgViewMode>(saved?.vtgViewMode ?? 'turns');

// New getter/setter
get vtgViewMode() { return vtgViewMode; },
setVtgViewMode(mode: VtgViewMode) { vtgViewMode = mode; },
```

The `vtgViewMode` persists to localStorage alongside existing state.

---

## Data Flow

### By Turns

```
allCatalogs (collection === 'VTG')
  → group by parseTurnPattern() → { blue, red }
  → populate 7×7 matrix cells
  → cell click → onSelectCatalog(catalog)
  → existing catalog interior
```

### By Family

```
allCatalogs (collection === 'VTG')
  → for each catalog, extract sequences matching selected familyId
  → flatten into single sequence list
  → render as flat card grid with turn labels
  → card click → sequence viewer
```

---

## Visual Design

- Matrix background: `var(--theme-card-bg)` with `var(--theme-stroke)` borders
- Symmetric diagonal: `rgba(183, 99, 205, 0.2)` fill (VTG purple accent)
- Asymmetric cells: `rgba(183, 99, 205, 0.06)` fill
- Hover: `rgba(183, 99, 205, 0.15)` with 1.02 scale
- Blue axis label color: `#3575E2`
- Red axis label color: `#ED1C24`
- Family buttons use existing element icon paths from `VTG_ELEMENT_MAP`

---

## Mobile

- Matrix cells shrink to ~48px
- Turn value labels use abbreviated format (no decimal for whole numbers)
- Family view: 2-column grid for family buttons, full-width sequence cards

---

## Out of Scope

- LOOPs collection changes — existing filter/grid system unchanged
- Generating new decks from empty matrix cells (future)
- Reordering or customizing matrix axes
- Any changes to the catalog interior view
