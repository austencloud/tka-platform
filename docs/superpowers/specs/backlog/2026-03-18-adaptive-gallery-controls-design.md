---
status: backlog
value: 4
effort: S
remaining: Full build — responsive gallery controls
depends_on: ""
plan_path: plans/backlog/2026-03-18-adaptive-gallery-controls.md
tags: []
last_triaged: 2026-04-26
---
# Adaptive Gallery Controls

**Date:** 2026-03-18
**Status:** Approved
**Problem:** On wide screens (4K monitors), the browse gallery top bar wastes horizontal space. Filter chips are hidden behind a toggle button, giving users zero guidance about available filtering options.

## Solution

Responsive adaptive layout: on wide screens (container > 900px), filter chips render directly in the top bar alongside source/sort/search controls. The filter toggle button disappears. On narrow screens (<900px), behavior is unchanged — collapsible panel with toggle.

### Wide Layout (>900px container width)

```
[Community | My Library]  [Sort v]  |  [Level v] [heart] [Letter] [Length v] [Pattern v] [Grid v] [Position]  |  [search] [- 4 +]
                                    ^                                                                         ^
                                 divider                                                                   divider
```

- Filter chips flow inline between sort and right actions
- Filter toggle button hidden via CSS
- Subtle vertical dividers (1px, 24px tall) separate logical groups
- Active filter bar renders below the top bar when filters are applied

### Narrow Layout (<900px container width)

Unchanged from current behavior:
- Filter toggle button visible
- Collapsible InlineFilterPanel with chips inside
- Active filter bar inside the collapsible panel

## Architecture

### Key Insight: Dual Render Locations, Same Components

The 7 filter chip components (`LevelFilterChip`, `FavoritesFilterChip`, etc.) are unchanged. They render in one of two locations based on container width:

1. **Wide:** Inside a new `inline-filters` section within `SequenceTopBarControls`
2. **Narrow:** Inside `InlineFilterPanel` (existing collapsible panel)

This is achieved with CSS `display: none` toggling via container queries — no JS width detection needed.

### Component Changes

#### `SequenceTopBarControls.svelte`

- Accepts all filter-related props (same as InlineFilterPanel currently receives)
- Renders filter chips in a new `.inline-filters` flex section between sort and actions
- Wraps the section in a container-query-controlled class that hides on narrow screens
- Filter toggle button gets a container-query class that hides on wide screens
- Vertical dividers between groups

#### `SequenceDisplayPanel.svelte`

- Passes filter props to both `SequenceTopBarControls` and `InlineFilterPanel`
- `InlineFilterPanel` gets a container-query class to hide entirely on wide screens
- Active filter bar renders conditionally below the top bar on wide screens (outside the collapsible panel)

#### `InlineFilterPanel.svelte`

- Gets a wrapper class that hides it on wide screens via container query
- No internal changes needed

### Container Query Strategy

The `SequenceDisplayPanel` already has `container-type: inline-size`. We add a named container:

```css
.sequence-display-panel {
  container-type: inline-size;
  container-name: gallery;
}
```

Then in child components:

```css
/* Hide on wide screens */
@container gallery (min-width: 900px) {
  .filter-toggle-button { display: none; }
  .collapsible-filter-panel { display: none; }
}

/* Show on wide screens */
@container gallery (min-width: 900px) {
  .inline-filters { display: flex; }
}
```

### Overflow Handling

On screens between 900-1200px, chips may be tight. The `.inline-filters` section uses:
- `overflow-x: auto` with `scrollbar-width: none`
- `flex-shrink: 1` with `min-width: 0` to allow compression
- Chips keep `flex-shrink: 0` to maintain readability

### Active Filter Bar Placement

**Wide:** Renders as a standalone bar below the top bar controls, outside InlineFilterPanel. Only visible when filters are active.

**Narrow:** Stays inside InlineFilterPanel as today.

This means `ActiveFilterBar` renders in two locations (CSS show/hide), or we move it to always render below the top bar and hide/show based on active filters only.

**Decision:** Move `ActiveFilterBar` to always render below the top bar, independent of `InlineFilterPanel`. Simplifies the logic — it shows when filters are active, period. The InlineFilterPanel loses its ActiveFilterBar and becomes purely the chip row for narrow screens.

## Files to Modify

| File | Change |
|------|--------|
| `SequenceDisplayPanel.svelte` | Add container name, pass filter props to top bar, move ActiveFilterBar outside InlineFilterPanel, add wide-screen hide class to InlineFilterPanel |
| `SequenceTopBarControls.svelte` | Accept filter props, render inline filter chips section, hide filter toggle on wide, add vertical dividers |
| `InlineFilterPanel.svelte` | Remove ActiveFilterBar render (moved to parent), add hide-on-wide class |

## Files NOT Modified

- All 7 filter chip components (unchanged)
- `ActiveFilterBar.svelte` (unchanged, just rendered in a new location)
- `FilterChipRow.svelte` (unchanged)
- `SortPopover.svelte` (unchanged)
- `ExpandableSearchBar.svelte` (unchanged)
- All state management (unchanged)
- `GalleryTab.svelte` (unchanged — props already flow through SequenceDisplayPanel)

## Breakpoint: 900px

Why 900px:
- 7 chips at ~100px each = ~700px for filters
- Source toggle ~200px + sort ~100px + search ~48px + zoom ~80px = ~428px
- Total ~1128px fits comfortably above 900px with the flex layout
- Below 900px, chips would be too cramped — use the toggle panel instead

## Accessibility

- `aria-hidden` toggles match CSS visibility
- Filter chips maintain all existing ARIA attributes
- Vertical dividers are `aria-hidden="true"` decorative elements
- Screen reader announcements unchanged
- Keyboard navigation through inline chips uses natural tab order
- `prefers-reduced-motion` respected (no new animations)

## Testing

Visual verification only (earned tests philosophy). Check:
1. 4K monitor: all chips visible inline, no toggle button
2. 1080p: chips inline if panel is wide enough, graceful overflow scroll
3. Mobile: unchanged behavior, toggle + collapsible panel
4. Filter application: active filter bar appears below top bar on all sizes
5. All 7 filters functional in both locations
