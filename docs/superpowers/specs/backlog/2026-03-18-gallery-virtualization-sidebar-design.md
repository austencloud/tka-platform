---
status: backlog
value: 4
effort: S
score: 16
remaining: "Visual QA — sidebar was reverted once for styling"
last_triaged: 2026-04-26
---
# Gallery Virtualization + Section Index Sidebar — Design Spec

## Problem

The browse gallery renders all 400+ sequence cards in the DOM when sections are active. The `{#key activeTab}` block in BrowseModule destroys and recreates the entire tab on every switch, meaning 400+ cards mount synchronously — creating 25,000-75,000 DOM nodes in one frame. This causes multi-second lag on tab switches.

The gallery already has a working virtualized grid (`VirtualizedSequenceGrid` using TanStack Virtual) but it's bypassed when sections are showing. Sections are the default view for sorted content.

## Solution

Two changes:

1. **Always virtualize** — Remove the sectioned rendering path. The gallery always uses `VirtualizedSequenceGrid` regardless of sort method or section state. ~20-30 cards in DOM at any time.

2. **Section Index Sidebar** — A vertical sidebar on the right (desktop only) that shows sort-dependent navigation markers. Click a marker to scroll the virtualized grid to that section's first sequence. Inspired by the legacy Python desktop app's `SequencePickerNavSidebar`.

## Architecture

### Change 1: Always-Virtualized Grid

**File:** `BrowseGrid.svelte`

Current decision logic (line 57):
```typescript
const useVirtualization = $derived(
  !disableVirtualization &&
    !showSections &&
    sequences.length > VIRTUALIZATION_THRESHOLD &&
    viewMode === "grid"
);
```

New logic — remove the `!showSections` condition:
```typescript
const useVirtualization = $derived(
  !disableVirtualization &&
    sequences.length > VIRTUALIZATION_THRESHOLD &&
    viewMode === "grid"
);
```

The sectioned rendering path (`.sections-container` with `SectionHeader` + per-section grids) is no longer used for the main gallery. It can remain for contexts that explicitly pass `disableVirtualization` (e.g., modals, pickers with small lists).

**`showSections` prop becomes unused** by BrowseGrid's virtualization decision. Section data is still computed by `browse-state-factory` for the sidebar to consume.

### Change 2: Section Index Sidebar

**New component:** `SectionIndexSidebar.svelte`

**Location:** `src/lib/features/browse/sequences/navigation/components/SectionIndexSidebar.svelte`

**Props:**
```typescript
interface Props {
  sections: SequenceSection[];
  sortMethod: BrowseSortMethod;
  onScrollToSection: (sectionIndex: number, firstSequenceIndex: number) => void;
  activeSection?: string;
}
```

**Behavior:**
- Renders a vertical list of section markers based on the current sort method
- Each marker is a button showing the section label (letter, date, beat count)
- Click fires `onScrollToSection` with the index of the first sequence in that section within the flat `displayedSequences` array
- The active section highlights based on current scroll position

**Sort-dependent labels:**

| Sort Method | Marker Labels | Example |
|-------------|--------------|---------|
| Alphabetical | First letter of each section | A, B, C, ... Σ, Θ |
| Date Added | Date group labels | "3 days ago", "1/6/2026" |
| Length | Beat counts | 4, 6, 8, 10 |

**Difficulty sort removed** per user preference (only 3 levels, not useful as a sort axis).

**Styling:**
- Fixed width: ~60-80px on desktop
- Right side of the gallery layout
- Vertically scrollable if many sections
- Buttons styled as compact pills/chips
- Active section highlighted with accent color
- Hidden on mobile (< 768px) — sections accessible via existing sort/filter controls

### Scroll-to-Section Mechanism

The sidebar needs to tell `VirtualizedSequenceGrid` to scroll to a specific row. The flow:

1. Sidebar knows which section was clicked and the index of its first sequence in the flat array
2. Convert sequence index to row index: `Math.floor(sequenceIndex / columnCount)`
3. Call TanStack Virtual's `scrollToIndex(rowIndex, { align: 'start' })`

**Integration:** `VirtualizedSequenceGrid` exposes a `scrollToRow(rowIndex: number)` method (or accepts a reactive `scrollToIndex` prop). The parent component (`SequenceDisplayPanel` or `BrowseLayout`) wires the sidebar's `onScrollToSection` to the grid's scroll method.

### Active Section Tracking

As the user scrolls the virtualized grid, the sidebar highlights which section is currently visible. This uses the virtualizer's scroll position:

1. Get the first visible row from `virtualizer.getVirtualItems()[0]`
2. Convert row index back to sequence index: `rowIndex * columnCount`
3. Find which section contains that sequence index
4. Update `activeSection` state

This runs on scroll (debounced or via virtualizer's onChange callback).

### Layout Integration

**Desktop (>= 768px):**
```
┌─────────────────────────────────────────────┐
│ Gallery Controls (filters, sort, search)     │
├──────────────────────────────────┬───────────┤
│                                  │ Section   │
│   Virtualized Grid               │ Index     │
│   (20-30 cards visible)          │ Sidebar   │
│                                  │           │
│                                  │ A         │
│                                  │ B         │
│                                  │ C ←active │
│                                  │ D         │
│                                  │ ...       │
└──────────────────────────────────┴───────────┘
```

**Mobile (< 768px):** Sidebar hidden. Sort/filter controls remain accessible via existing UI. No behavioral change on mobile.

**Implementation:** The sidebar slots into `SequenceDisplayPanel` or `BrowseLayout` as a sibling to the grid container, using CSS flexbox (`flex-direction: row`).

## Data Flow

```
browse-state-factory
  ├── displayedSequences (flat sorted array) → VirtualizedSequenceGrid
  ├── sequenceSections (grouped data) → SectionIndexSidebar
  └── currentSortMethod → SectionIndexSidebar (determines label format)

User clicks sidebar marker
  → onScrollToSection(sectionIndex, firstSequenceIndex)
  → convert to rowIndex
  → virtualizer.scrollToIndex(rowIndex, { align: 'start' })

User scrolls grid
  → virtualizer reports first visible row
  → convert to sequence index
  → find containing section
  → update activeSection highlight
```

## Edge Cases

### Empty sections
Sections with 0 sequences after filtering should not appear in the sidebar. The `showEmptySections: false` config already handles this in `SectionManager.organizeSections()`.

### Sort method changes
When the user changes sort method, both `sequenceSections` and `displayedSequences` update reactively. The sidebar re-renders with new labels. The grid re-renders with newly sorted data. No special handling needed.

### Filter changes
Filtering reduces `displayedSequences` which changes row count. Section data updates correspondingly. Both sidebar and grid react automatically.

### Few sequences (< 50)
Below the virtualization threshold, `BrowseGrid` renders the flat grid directly (no virtualization). The sidebar can still show section markers — they just scroll the non-virtualized container instead of calling virtualizer methods. Or the sidebar hides when there are too few sequences to warrant it (e.g., < 20).

### Tab switching performance
This is the core win. Switching to Gallery now mounts `VirtualizedSequenceGrid` which creates ~20-30 card components instead of 400+. The sidebar is a lightweight list of buttons. Total DOM: ~500-1,500 nodes instead of 25,000-75,000.

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/features/browse/sequences/navigation/components/SectionIndexSidebar.svelte` | Vertical section navigation sidebar |

## Files to Modify

| File | Change |
|------|--------|
| `BrowseGrid.svelte` | Remove `!showSections` from virtualization condition |
| `SequenceDisplayPanel.svelte` or `BrowseLayout.svelte` | Add sidebar to layout, wire scroll-to-section |
| `VirtualizedSequenceGrid.svelte` | Expose `scrollToRow()` method or accept scroll target prop |
| `browse-enums.ts` | Remove `DIFFICULTY_LEVEL` from `BrowseSortMethod` (optional, can defer) |

## What This Does NOT Change

- Thumbnail rendering pipeline (4-tier cache, unchanged)
- Filter/sort logic (operates on arrays, sidebar just reads the output)
- Mobile layout (sidebar hidden, no behavioral change)
- Card component (`ChoreoCardThumbnail`, unchanged)
- Prefetch system (just implemented, orthogonal to this)

## Testing Strategy

Per earned-tests philosophy: the virtualization is already tested by existing usage. The sidebar is a UI component (visible when broken). No new tests needed unless scroll-to-section math proves tricky — then a unit test for the index conversion.
