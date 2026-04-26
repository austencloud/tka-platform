# Sequence Picker Modal Filter Redesign

**Date:** 2026-03-16
**Goal:** Bring the SequencePickerModal's filtering UX to parity with the browse gallery's modern chip-based filter system.

---

## Problem

The SequencePickerModal has a dated sidebar+basic-search layout while the browse gallery uses modern inline filter chips with Greek letter search, color-coded active filter indicators, and dismissible filter badges. Users switching between the two feel the quality gap.

**Current picker has:** Level sidebar (desktop only), favorites toggle, plain text search, sort dropdown, zoom controls.

**Browse gallery has:** 6 filter chip types (Level, Favorites, Letter, Length, Pattern, Position), ExpandableSearchBar with Greek letter picker, ActiveFilterBar with dismissible color-coded chips + "Clear all", all in a responsive inline layout.

---

## Design

### Approach: Import Browse Filter Components Directly

The picker already imports BrowseGrid, BrowseFilter, BrowseSorter, and BrowseThumbnailProvider from `features/browse/`. Importing the filter UI components from browse is consistent with this existing dependency direction.

No extraction to shared. No duplication. Just reuse.

### Components to Delete

| File | Reason |
|------|--------|
| `PickerSidebar.svelte` | Replaced by inline filter chips |
| `PickerFilterChips.svelte` | Replaced by FilterChipRow + browse chips |

### Components to Rewrite

| File | Changes |
|------|---------|
| `SequencePickerModal.svelte` | Remove sidebar layout, add filter chip state, add active filter tracking, wire new filter callbacks |
| `PickerToolbar.svelte` | Replace plain search with ExpandableSearchBar, keep sort + zoom controls |

### Components to Import from Browse

| Component | Path | Purpose |
|-----------|------|---------|
| `FilterChipRow` | `browse/sequences/filtering/components/inline-filter/FilterChipRow.svelte` | Horizontal scrollable chip container |
| `FilterChipBase` | (used internally by chips) | Base chip styling and behavior |
| `ActiveFilterBar` | `browse/sequences/filtering/components/inline-filter/ActiveFilterBar.svelte` | Dismissible active filter display |
| `LevelFilterChip` | `browse/.../chips/LevelFilterChip.svelte` | Level 1/2/3 dropdown chip |
| `FavoritesFilterChip` | `browse/.../chips/FavoritesFilterChip.svelte` | Favorites toggle chip |
| `LengthFilterChip` | `browse/.../chips/LengthFilterChip.svelte` | Beat count dropdown chip |
| `ExpandableSearchBar` | `browse/shared/components/ExpandableSearchBar.svelte` | Search with Greek letter picker |

### Filters Included

| Filter | Chip Color | Behavior in Picker |
|--------|-----------|-------------------|
| Level | `--semantic-info` (blue) | Same as browse: All/1/2/3 dropdown |
| Favorites | `#ec4899` (pink) | Same as browse: toggle on/off |
| Length | `#f59e0b` (amber) | Dropdown with available beat counts. When `requiredBeatCount` prop is set, chip shows as locked/disabled with the locked count displayed |
| Search | N/A | ExpandableSearchBar replaces plain input. Greek letter picker for Σ, Δ, Θ, Ω, Φ, Ψ, Λ, α, β, γ |

### Filters Excluded (for now)

| Filter | Reason |
|--------|--------|
| Letter (starting letter) | Opens a sheet/drawer inside a modal — clunky nested UX. Greek letter search via ExpandableSearchBar covers the main use case. |
| Pattern (LOOP types) | Requires LOOP detection data that may not be precomputed for all sequences in the picker context. Can add later. |
| Position (start/end) | Opens another sheet inside the modal. Too much nesting for a picker. |

### New Layout Structure

```
SequencePickerModal
├── Header (title, source toggle, close) — unchanged
├── PickerToolbar (REWRITTEN)
│   ├── SortControls (sort dropdown — kept)
│   ├── ExpandableSearchBar (NEW — replaces plain search)
│   └── ZoomControls (kept)
├── FilterChipRow (NEW — from browse)
│   ├── LevelFilterChip
│   ├── FavoritesFilterChip
│   └── LengthFilterChip (disabled when requiredBeatCount is set)
├── ActiveFilterBar (NEW — from browse)
│   ├── Dismissible color-coded active filter chips
│   └── "Clear all" button (when 2+ filters active)
└── Grid Container
    └── BrowseGrid — unchanged
```

### State Additions to SequencePickerModal

```typescript
// New state variables
let letterFilter = $state<string | null>(null);   // future use
let lengthFilter = $state<number | null>(null);    // user-selected length (separate from requiredBeatCount)
let activeFilterList = $state<ActiveFilter[]>([]);  // for ActiveFilterBar

// Derived: available lengths from loaded sequences
const availableLengths = $derived.by(() => {
  const lengths = new Set(sequences.map(s => s.beatCount ?? s.steps?.length ?? 0));
  return [...lengths].filter(l => l > 0).sort((a, b) => a - b);
});
```

### Filtering Pipeline Update

The existing pipeline stays the same but adds the new length filter:

1. `requiredBeatCount` (prop-locked, always first)
2. `levelFilter` (if set)
3. `favoritesOnly` (if toggled)
4. `lengthFilter` (NEW — user-selected, only when `requiredBeatCount` is null)
5. `searchQuery` (if text entered)
6. Sort applied last

### Active Filter Tracking

Build `activeFilterList` as a `$derived` from active filter state. When `requiredBeatCount` is non-null, `lengthFilter` is excluded from both the pipeline and the active filter list.

```typescript
const activeFilterList = $derived.by(() => {
  const filters: ActiveFilter[] = [];
  if (levelFilter != null) {
    filters.push({ type: BrowseFilterType.DIFFICULTY, value: levelFilter, label: `Level ${levelFilter}`, chipColor: "var(--semantic-info)" });
  }
  if (favoritesOnly) {
    filters.push({ type: BrowseFilterType.FAVORITES, value: true, label: "Favorites", chipColor: "#ec4899" });
  }
  if (lengthFilter != null && requiredBeatCount == null) {
    filters.push({ type: BrowseFilterType.LENGTH, value: lengthFilter, label: `${lengthFilter} beats`, chipColor: "#f59e0b" });
  }
  if (searchQuery.trim()) {
    filters.push({ type: BrowseFilterType.CONTAINS_LETTERS, value: searchQuery, label: `"${searchQuery}"`, chipColor: "var(--theme-accent)" });
  }
  return filters;
});
```

### onRemoveFilter Handler

`ActiveFilterBar` requires an `onRemoveFilter(type: string)` callback. Map each `BrowseFilterType` string back to clearing its corresponding state variable:

```typescript
function handleRemoveFilter(type: string) {
  if (type === BrowseFilterType.DIFFICULTY) levelFilter = null;
  else if (type === BrowseFilterType.FAVORITES) favoritesOnly = false;
  else if (type === BrowseFilterType.LENGTH) lengthFilter = null;
  else if (type === BrowseFilterType.CONTAINS_LETTERS) searchQuery = "";
}
```

### FavoritesFilterChip Adapter

The browse chip's interface is `onToggle: (active: boolean) => void` where it passes the NEW desired state. Wire as: `onToggle={(active) => { favoritesOnly = active; }}`.

### getFilteredCount

Not provided in the picker context. The chips handle this gracefully — they just omit counts when the prop is undefined.

### requiredBeatCount Handling

When `requiredBeatCount` is set (e.g., beat mapping needs exactly 8-beat sequences):
- LengthFilterChip renders with `disabled={true}`
- Chip label shows the locked count (e.g., "8 beats")
- Chip appears active with a lock icon indication
- User cannot change the length filter
- `lengthFilter` is excluded from both the pipeline and `activeFilterList`

### Container Query Setup

`FilterChipRow` uses `@container inline-filter (max-width: 360px)` for chip wrapping. The parent element in the picker must declare:

```css
container-type: inline-size;
container-name: inline-filter;
```

Without this, the container query silently fails and chips won't wrap on narrow viewports.

### ExpandableSearchBar and Clear All

`ExpandableSearchBar` maintains its own internal `inputValue`. It does NOT accept an external `searchQuery` prop. When "Clear all" is clicked, we set `searchQuery = ""` in the filtering pipeline but cannot programmatically reset the search bar's displayed text. This is acceptable — the filter pipeline clears correctly, and the user can clear the search bar manually. A `value` prop could be added to ExpandableSearchBar in a follow-up if needed.

### Mobile Responsiveness

The new layout is inherently responsive:
- FilterChipRow scrolls horizontally on narrow screens
- ExpandableSearchBar collapses to icon on mobile
- No sidebar means no desktop/mobile layout split — same layout everywhere
- ActiveFilterBar scrolls horizontally when many filters active

### Result Count

Show result count as a subtle text label between the zoom controls and the grid: "{N} sequences" in dim text, right-aligned in the toolbar.

### Source Toggle

The `source` state ("community" / "my-library") header toggle exists but is non-functional today — `loadSequences()` always loads all metadata regardless. This is a pre-existing issue, not introduced by this redesign. Out of scope.

### i18n

The browse filter chips use `t()` for translations. All required i18n keys already exist since the chips are unchanged. The picker's own hardcoded strings (title, state messages) remain as-is — out of scope.

---

## Files Changed

| File | Action |
|------|--------|
| `src/lib/shared/components/sequence-picker/SequencePickerModal.svelte` | Rewrite: remove sidebar layout, add filter chip row + active filter bar, new state management |
| `src/lib/shared/components/sequence-picker/PickerToolbar.svelte` | Rewrite: replace plain search with ExpandableSearchBar, keep sort + zoom |
| `src/lib/shared/components/sequence-picker/PickerSidebar.svelte` | Delete |
| `src/lib/shared/components/sequence-picker/PickerFilterChips.svelte` | Delete |

---

## Success Criteria

1. Picker modal uses inline filter chips matching browse gallery's visual language
2. Greek letter search works (Σ, Δ, Θ, etc.)
3. Active filters shown as dismissible color-coded chips with "Clear all"
4. Level, Favorites, and Length filters all work
5. requiredBeatCount locks the length chip when set
6. No sidebar on any screen size — uniform inline chip layout
7. Sort + zoom controls preserved
8. All existing picker functionality (source toggle, sequence selection, loading/error/empty states) unchanged
9. TypeScript compiles clean (`npm run check`)
