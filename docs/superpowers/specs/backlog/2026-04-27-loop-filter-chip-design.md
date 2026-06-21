# LOOP Filter Chip — Design Spec

## Summary

Add a LOOP dropdown filter chip to the browse filter bar. Each of the 6 LOOP primitives gets its own color-coded, icon-bearing dropdown row. Rotated splits into halved (fa-rotate) and quartered (fa-arrows-spin) — 7 filterable options total.

## Dropdown Options

| Option | Icon | Color | Filter logic |
|---|---|---|---|
| All | — | — | Clear LOOP filter |
| Rotated (halved) | `fa-rotate` | `#36c3ff` | `components` includes ROTATED + `period ≤ 2` |
| Rotated (quartered) | `fa-arrows-spin` | `#36c3ff` | `components` includes ROTATED + `period === 4` |
| Mirrored | `fa-left-right` | `#6F2DA8` | `components` includes MIRRORED |
| Flipped | `fa-up-down` | `#e91e63` | `components` includes FLIPPED |
| Swapped | `fa-shuffle` | `#26e600` | `components` includes SWAPPED |
| Inverted | `fa-adjust` | `#eb7d00` | `components` includes INVERTED |
| Rewound | `fa-backward` | `#00bcd4` | `components` includes REWOUND |

## Dropdown Row Layout

Each row: `[colored FA icon] [label] [count in parentheses]  [checkmark if selected]`

- Icon renders in component's color
- Selected row label text uses component color (matches GridMode/Level chip pattern)
- Count computed lazily when dropdown opens

## Chip Appearance

- **Icon:** `fas fa-sync-alt`
- **Inactive label:** "LOOP"
- **Active label:** Selected component name (e.g. "Rotated (halved)")
- **Active chip color:** Selected component's hex color
- **Mode:** dropdown (FilterChipBase)

## Filter Value Convention

Prefix `component:` distinguishes component-level filtering from legacy compound `loopType` values:

- `component:rotated_halved` — ROTATED + period ≤ 2
- `component:rotated_quartered` — ROTATED + period === 4
- `component:mirrored` — MIRRORED in components array
- `component:flipped` — FLIPPED
- `component:swapped` — SWAPPED
- `component:inverted` — INVERTED
- `component:rewound` — REWOUND

## Files Changed

### New
- `src/lib/features/browse/sequences/filtering/components/inline-filter/chips/LOOPFilterChip.svelte`

### Modified
- `src/lib/features/browse/sequences/display/services/implementations/BrowseFilter.ts` — extend `filterByLOOPType` to handle `component:*` values
- `src/lib/shared/browse/engine/createBrowseEngine.svelte.ts` — extend `loopTypeCounts` with per-component + halved/quartered counts
- `src/lib/shared/browse/components/BrowseFilterBar.svelte` — wire LOOPFilterChip into chip row

### Deleted
- `src/lib/features/browse/sequences/filtering/components/inline-filter/chips/PatternFilterChip.svelte` — dead code, replaced

## Design Decisions

- **Component-level filtering, not compound LOOPType filtering.** User wants "show me all sequences with Rotated" — that includes pure Rotated, Mirrored+Rotated, etc. Filtering by `seq.components` array achieves this.
- **Halved/quartered split on Rotated only.** Other components don't have period-dependent visual distinctions. The icon swap (fa-rotate vs fa-arrows-spin) is already established in LOOPIconStrip.svelte.
- **Colors/icons from loop-constants.ts.** Single source of truth. LOOPFilterChip imports from there, not hardcoded duplicates.
