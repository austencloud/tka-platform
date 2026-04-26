---
status: backlog
value: 2
effort: M
remaining: Full build — split-screen card designer
depends_on: ""
plan_path: plans/backlog/2026-03-26-card-designer-split-screen.md
tags: []
last_triaged: 2026-04-26
---
# Card Designer Split-Screen Redesign

**Date:** 2026-03-26
**Status:** Approved

## Summary

Redesign the card designer page from a single-sequence prev/next navigator to a split-screen layout: thumbnail grid picker on the left, stacked front+back card preview on the right. Full state persistence across refreshes.

## Motivation

The current card designer requires clicking through sequences one at a time with no visual preview of what's coming. There's no persistence — refreshing loses your position. This makes it tedious to find and review specific sequences.

---

## Layout

### Split-Screen Structure

```
┌─────────────────────┬──────────────────────────┐
│  Sequence Picker     │  Card Preview             │
│  (scrollable grid)   │                           │
│                      │  ┌──────────────────┐  ⚙  │
│  [All] [4] [8] [16] │  │                  │     │
│                      │  │     FRONT        │     │
│  ┌──┐ ┌──┐ ┌──┐     │  │                  │     │
│  │▓▓│ │  │ │  │     │  └──────────────────┘     │
│  └──┘ └──┘ └──┘     │                           │
│  ┌──┐ ┌──┐ ┌──┐     │  ┌──────────────────┐     │
│  │  │ │  │ │  │     │  │                  │     │
│  └──┘ └──┘ └──┘     │  │     BACK         │     │
│  ┌──┐ ┌──┐ ┌──┐     │  │                  │     │
│  │  │ │  │ │  │     │  └──────────────────┘     │
│  └──┘ └──┘ └──┘     │                           │
└─────────────────────┴──────────────────────────┘
```

- Left panel: ~40% width. Scrollable thumbnail grid with filter chips at top.
- Right panel: ~60% width. Stacked front (top) + back (bottom) cards.
- Settings sidebar: collapsible on the right edge (gear icon toggle).

### Thumbnail Grid Picker (Left)

- Custom lightweight grid using `PropAwareThumbnail` directly (NOT `BrowseGrid`, which drags in variation grouping, action callbacks, and pinch-zoom that the picker doesn't need)
- Simple CSS grid with virtualization only if the filtered list exceeds ~100 items
- Filter chips at top: beat length (All, 2, 4, 6, 8, 10, 12, 16)
- Selected thumbnail highlighted with accent border
- Click to select → updates right side card preview
- Arrow keys (Left/Right) cycle sequentially through the filtered list
- Grid auto-scrolls to keep the selected thumbnail visible (use `element.scrollIntoView({ block: "nearest" })`)
- 3-column grid by default, adapts to panel width
- Empty state: filter icon + "No X-beat sequences" message when filter returns zero results

**Scroll-follows-selection:** Whenever the selected index changes (click, arrow key, or restore from localStorage), the grid scrolls to keep the selected thumbnail visible. On initial mount with a restored sequence ID, scroll happens after the grid renders (use `tick()` then `scrollIntoView`).

### Card Preview (Right)

**Stacked Layout:**
- Front card on top, back card below
- Default: equal 50/50 vertical split
- Gap between cards

**Toggleable Focus:**
- Click either card to make it the hero (~70% of vertical space)
- The other card shrinks to ~30%
- Click the hero again to equalize back to 50/50
- Smooth CSS transition between sizes (300ms ease)
- Focused state persisted to localStorage

**Card Rendering:**
- Front: existing `ChoreoCard` component
- Back: existing `CardBackV5` (with mandala for LOOP sequences)
- Both scale responsively via `transform: scale()` to fit their allocated space

**Layout solver note:** The current `CardDesigner` scales cards based on container width (side-by-side layout). The stacked layout constrains by height instead. `CardPreviewStack` must compute scale per card based on its allocated vertical slice (`containerHeight * 0.5` in equal mode, `* 0.7` / `* 0.3` in focus mode), re-derived on every resize and focus toggle. The back card renders at fixed 500x700 internally and scales down — that doesn't change.

### Settings Sidebar (Right Edge)

- Small gear icon at top-right of card preview area
- Clicking opens a slide-out panel from the right
- Contains all current CardDesigner controls:
  - Theme switcher (background type icons)
  - Visibility toggles (hand points, grid, TKA, word, start position)
  - QR code and birthday toggles
  - Export button (PNG)
  - Info card toggle
- Clicking gear again or pressing Escape closes it
- Panel overlays the card preview (doesn't push layout)

**Why not reuse `CardSettingsModal`?** The existing modal includes a live preview panel that takes half its real estate — redundant when the card preview is already visible alongside. The sidebar is a leaner interaction: controls only, no duplicate preview. Settings changes still flow through the existing global state managers (`visibilityManager`, `imageComposition`).

---

## Persistence

All state saved to localStorage under `choreoCard.designer*` keys:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `choreoCard.designerSequenceId` | string | null | Selected sequence ID — restores position on refresh |
| `choreoCard.designerLength` | number | 0 | Beat length filter (0 = All). Already exists. |
| `choreoCard.designerFocusedCard` | string | null | "front", "back", or null (equal split) |
| `choreoCard.designerShowInfoCard` | boolean | false | Already exists. |
| `choreoCard.designerSidebarOpen` | boolean | false | Settings sidebar state |

Existing visibility/theme keys already persist and will continue to work:
- `choreoCard.showQRCodes`, `choreoCard.handPointsVisible`, `choreoCard.showGrid`, `choreoCard.showTKA`, `choreoCard.showWord`, `choreoCard.includeStartPosition`

**Storage key ownership:** `CardDesigner.svelte` (the orchestrator) reads all persisted values on mount and passes them as props. Child components emit events to update values — the orchestrator writes to localStorage. No child component reads or writes localStorage directly.

**On refresh:** Restore sequence by ID. If the sequence is in the current filtered list, scroll the picker to it and highlight it. If the sequence is no longer in the filtered list, select the first sequence. If the restored ID doesn't exist in the library at all (deleted sequence), clear the persisted ID and select the first sequence from the unfiltered list.

---

## Keyboard Navigation

| Key | Action |
|-----|--------|
| ArrowLeft | Select previous sequence |
| ArrowRight | Select next sequence |
| Escape | Close settings sidebar if open |

Arrow keys work from anywhere on the page (global listener, same as current behavior). Every arrow key press also scrolls the picker grid to keep the selected thumbnail visible.

---

## File Structure

### Modified Files

| File | Change |
|------|--------|
| `CardDesigner.svelte` | Major rewrite — split-screen orchestrator. Owns localStorage reads/writes, observer registrations on `visibilityManager` and `imageComposition`, and passes derived state as props to children. |

### New Files

| File | Responsibility |
|------|----------------|
| `SequencePickerGrid.svelte` | Left-panel thumbnail grid with filters and selection state |
| `CardPreviewStack.svelte` | Right-panel stacked front+back with focus toggle |
| `DesignerSettingsSidebar.svelte` | Slide-out settings panel (extracted from current CardDesigner controls) |

### Reused Components

- `PropAwareThumbnail` — for picker grid thumbnails (direct usage, not via BrowseGrid)
- `ChoreoCard` — front card rendering
- `CardBackV5` — back card rendering
- Filter chip patterns from existing deck/browse UIs

---

## Non-Goals

- Mobile layout (this is a desktop design tool)
- Drag-and-drop reordering of sequences
- Multi-select for batch operations
- Print prep integration (stays as separate tab)
