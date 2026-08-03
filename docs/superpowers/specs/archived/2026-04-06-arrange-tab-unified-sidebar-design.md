---
status: backlog
value: 3
effort: M
remaining: "ArrangeSidebar was built then deleted in e45885d24 cleanup (2026-04-30). Needs full rebuild: collapsible sections, auto-collapse on cell select, playback pinned bottom."
depends_on: ""
plan_path: plans/backlog/2026-04-06-arrange-tab-unified-sidebar.md
tags: []
last_triaged: 2026-05-04
---
# Arrange Tab: Unified Sections Sidebar

**Date:** 2026-04-06
**Feedback:** nH7SHBnMpVvGnQEwMQXF
**Module:** compose / arrange
**Status:** Design approved

---

## Problem

The arrange tab has two disconnected control surfaces: a permanent right sidebar (grid config + playback) and a slide-in drawer (cell editor). Clicking a cell triggers a drawer animation that overlays the grid, creating a jarring mode switch. Deselecting closes the drawer with another animation. Users constantly switch between "adjust this cell" and "see how it looks in the grid," and the drawer transition is friction on every switch.

The grid config picker is a "set once at the start" control that wastes sidebar space during the 95% of time spent editing cells.

## Solution: Unified Sections Sidebar

Replace the drawer and the current two-panel layout with a single persistent sidebar containing collapsible sections. No drawer, no animation, no mode switch.

### Layout

```
┌──────────────────────────────────────┬──────────────────┐
│                                      │ ▼ Grid: 4×3      │  ← collapsed
│                                      │                  │
│           Grid Canvas                │ ┌──────────────┐ │
│        (cells render here)           │ │  Cell 5       │ │  ← expanded
│                                      │ │  Layers       │ │
│                                      │ │  Chips        │ │
│                                      │ │  Copy / Clear │ │
│                                      │ └──────────────┘ │
│                                      │                  │
│                                      │ ─── playback ─── │  ← pinned
│                                      │   ◀◀ ◀ ▶ ▶ ▶▶   │
│                                      │   3/16 · 120 BPM │
└──────────────────────────────────────┴──────────────────┘
```

**Desktop layout:** `grid-template-columns: 1fr clamp(280px, 20vw, 340px)`

### Two States

**No cell selected (default):**
- Grid Layout section: **expanded** — shows 8×8 dimension picker, dimension count, layout presets
- Cell Editor section: **absent** — placeholder text "Click a cell to edit"
- Playback: **pinned to bottom** — transport controls, beat counter, BPM chips

**Cell selected:**
- Grid Layout section: **auto-collapses** to one-line summary showing current dimensions (e.g., "Grid 4×3")
- Cell Editor section: **appears** — full cell editor content (header, layers, chips, footer) with a subtle accent border
- Playback: **stays pinned to bottom** — unchanged position

### Interaction Rules

1. **Click a cell → cell editor appears, grid config collapses.** No animation. Content swaps instantly.
2. **Click away / press Escape → cell editor disappears, grid config re-expands.** Instant.
3. **Click grid config header while cell is selected → grid config expands.** Both sections can be open simultaneously. User can adjust grid without losing cell context.
4. **Playback never moves.** Always pinned to the bottom of the sidebar regardless of state.
5. **Sidebar width is constant.** `clamp(280px, 20vw, 340px)`. No layout shift when cell is selected/deselected.
6. **Cell editor area scrolls independently** if content overflows (e.g., expanded effects matrix + multiple layers).

### Sidebar Width

The current control panel is `clamp(220px, 16vw, 300px)` — too narrow for cell editor chips. The drawer was `clamp(280px, 22vw, 360px)`. The unified sidebar uses `clamp(280px, 20vw, 340px)` — wide enough for cell controls, narrower than the drawer was.

The grid canvas gets slightly less width than today, but the grid already calculates cell sizes dynamically based on available space (ResizeObserver + `Math.min(maxFromWidth, maxFromHeight)`), so cells auto-adjust.

---

## Component Changes

### Modified: `ArrangeTab.svelte`

The biggest change. Currently renders:
- `CompositionGrid` in a `.canvas-area`
- `GridLayoutControls` + `PlaybackBar` in a `.control-panel`
- `Drawer` containing `CellEditorPanel`

Changes to:
- `CompositionGrid` in a `.canvas-area` (unchanged)
- New unified `ArrangeSidebar.svelte` replacing both `.control-panel` and `Drawer`

Specific removals:
- Remove `Drawer` component import and usage
- Remove drawer CSS overrides (`.cell-editor-drawer`, `.cell-editor-backdrop`)
- Remove `handleDrawerClose` function
- Update `grid-template-columns` to `1fr clamp(280px, 20vw, 340px)`

### New: `ArrangeSidebar.svelte`

The unified sidebar component. Contains three sections:

1. **Grid Layout Section** — wraps existing `GridLayoutControls` in a collapsible section
   - Collapsed state: one-line header showing "Grid {cols}×{rows}"
   - Expanded state: full grid picker + presets (existing component)
   - Auto-collapses when `selectedCell` becomes non-null
   - Auto-expands when `selectedCell` becomes null
   - Manually expandable/collapsible at any time

2. **Cell Editor Section** — wraps existing `CellEditorPanel` content
   - Only renders when `selectedCell !== null`
   - Subtle accent border: `1px solid rgba(139,92,246,0.08)`
   - Scrollable independently (`overflow-y: auto`, `flex: 1`)
   - No close button needed — clicking away from the cell deselects it

3. **Playback Section** — wraps existing `PlaybackBar`
   - Pinned to bottom: `margin-top: auto` or `flex-shrink: 0`
   - Always visible regardless of cell selection state
   - Separated by a thin border-top

### Modified: `CellEditorPanel.svelte`

Minor changes:
- Remove the close button from the header (deselection happens by clicking away from the cell in the grid)
- Remove `onClose` prop
- Remove `border-left` style (sidebar provides the border)
- Remove `background` (sidebar provides the background)
- Remove `height: 100%` (flexbox handles sizing now)

### Removed: Drawer usage

The `Drawer` component is no longer used by the arrange tab. It may still be used elsewhere in the app — do not delete the component itself. Just remove the import and usage in `ArrangeTab.svelte`.

---

## Files Touched

| File | Change |
|------|--------|
| `compose/tabs/arrange/ArrangeSidebar.svelte` | **New** — unified sidebar with collapsible sections |
| `compose/tabs/arrange/ArrangeTab.svelte` | Remove Drawer, replace control-panel with ArrangeSidebar |
| `cell-editor/CellEditorPanel.svelte` | Remove close button, onClose prop, standalone styling |

---

## What's NOT Changing

- `CompositionGrid.svelte` — grid rendering, cell sizing, drag/resize all stay the same
- `GridLayoutControls.svelte` — grid picker UI stays the same, just wrapped in a collapsible section
- `PlaybackBar.svelte` — transport controls stay the same, just repositioned in the sidebar
- `CellEditorPanel` internals — layers, chips, expanded sections, unified effects/effort all stay the same
- Cell selection logic — `gridState.selectCell()` / `gridState.deselectCell()` unchanged
- Mobile — currently shows a "desktop only" placeholder; this doesn't change that

---

## Responsive Behavior

| Breakpoint | Sidebar Width | Notes |
|-----------|---------------|-------|
| 1200px+ | `clamp(300px, 20vw, 340px)` | Comfortable for cell editor |
| 768px–1200px | `clamp(280px, 18vw, 320px)` | Chips may wrap more, still functional |
| Below 768px | Mobile placeholder (unchanged) | Future work |

---

## Verification

- Grid cells resize correctly when sidebar takes more width (ResizeObserver handles this)
- Cell editor content scrolls within its section when overflowing
- Grid config can be manually expanded while cell is selected (both open)
- Deselecting cell (click empty grid area or Escape) restores grid config expanded state
- Playback controls remain functional and in the same position across both states
- All existing cell editor functionality works: layers, chips, expanded sections, effects/effort matrix, transform, speed, colors, offset, display
- No drawer animation artifacts or z-index issues
