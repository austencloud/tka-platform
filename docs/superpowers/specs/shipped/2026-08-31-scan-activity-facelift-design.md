# Scan Activity: TKA-First Scan Atlas

**Date:** 2026-08-31
**Module:** Choreo Cards > Scan Atlas
**Status:** Shipped

## Problem

The current admin view has the right data and the wrong hierarchy. A full-width
search row, cache-maintenance card, four metric tiles, map, recent list, and an
empty inspector all compete at once. At large widths the page becomes three
unrelated dark columns; at short landscape widths its fixed map height clips the
workspace. Scan words also leak through as raw repeated strings in ordinary UI
type, so the page does not read as part of the TKA application.

The map has two functional problems as volume grows: every update destroys and
recreates every marker, and colocated scans collapse into one visual point. Its
12px marker is also too small to operate reliably and is not exposed through the
accessible Advanced Marker interaction contract.

This design supersedes the presentation and interaction sections of the
2026-06-22 map-first design. Its data-source, authorization, coordinate-honesty,
and notification-target decisions remain in force.

## Outcome

Build a **TKA-first Scan Atlas**: a map-led operational workspace with a compact
word-first activity rail. The resting view contains only the live atlas and its
activity stream. Selecting a scan introduces the card inspector as a deliberate
workspace change; there is no permanent empty third rail.

The canonical route is `/choreo_card/scan-atlas`. The former
`/choreo_card/scan-activity` route remains a migrated alias so bookmarks,
persisted tabs, notification targets, and browser history keep their intent.

## Canonical owners

- `TkaLabel` / `TKAWordGlyph` own visible TKA word lettering.
- `simplifyRepeatedWord` owns human-readable and accessible word shortening.
- `ExpandableSearchBar` owns the compact search interaction.
- `SegmentedControl` owns the all/owned scope.
- `FilterChipBase` owns the active city-filter affordance.
- `PanelGroup` owns structural panel insertion and resizing.
- `Crossfade` owns cheap cache-status swaps.
- `GlobalUserMap` remains the only Google map owner. The existing
  `@googlemaps/markerclusterer` dependency supplies clustering.

No feature-local glyph renderer, search control, cluster implementation, panel
transition, or word compressor is introduced.

## Information architecture

### Compact atlas bar

One bar contains:

1. `Scan Atlas` and the connection state;
2. an honest compact summary: scans, mapped locations, cards, and cities;
3. the all/owned segmented control;
4. expandable search;
5. city-filter chip when active;
6. retry when the live connection fails; and
7. an `Operator tools` disclosure for legacy preview-cache maintenance.

Cache warming remains fully functional, but it is secondary operational work.
The disclosure stays open while warming is active, while an error is present,
or after progress exists, so ongoing work cannot disappear.

### Workspace

Resting desktop layout:

```
+---------------------------+------------------+
|                           | Recent activity  |
|          map              | word-first rows  |
|                           |                  |
+---------------------------+------------------+
```

Selected desktop layout:

```
+-------------------+--------------+--------------+
|        map        | activity     | card details |
+-------------------+--------------+--------------+
```

`PanelGroup` inserts and removes the selected inspector with canonical layout
motion. The activity rail remains mounted and keeps its scroll position.

Compact layouts flatten the split panes and use a single scrollable document:
map, activity, then selected details. Short landscape gives the map a bounded
viewport instead of preserving a fixed 360-460px minimum.

## TKA word contract

Every scan word follows one path:

1. resolve the card word, falling back to its short code;
2. run `simplifyRepeatedWord` for accessible text, map titles, and plain-text
   metadata;
3. render the visible word through `TkaLabel` / `TKAWordGlyph`;
4. never place a long repeated raw word in the list, inspector title, marker
   title, or accessible name.

Short codes remain ordinary monospace metadata. Cities and timestamps remain
supporting text, not peers of the word.

## Map behavior

- Scan markers use a minimum 44px interactive surface with a smaller visual
  core and a clear selected state.
- Interactive `AdvancedMarkerElement` instances opt into `gmpClickable` and
  remain keyboard operable.
- Colocated and nearby markers cluster through `MarkerClusterer`.
- The map reconciles markers by scan ID. Unchanged markers retain their
  instances; changed markers update in place; removed markers are detached.
- Selecting a marker selects the matching activity row and card. Selecting a
  row continues to focus the map.
- Marker titles and cluster labels use simplified text and real scan counts.
- No unlocated scan is plotted and no coordinate is fabricated.

## Motion and focus

- Inspector insertion/removal uses `PanelGroup` presence motion.
- Cache content-state swaps use `Crossfade` with height animation.
- Keyed activity filtering/reordering uses `animate:flip` and `flipDuration()`
  where it does not conflict with list virtualization or focus.
- Closing the inspector restores focus to the scan row that opened it when that
  row remains visible.
- Reduced-motion preferences collapse all transitions to their final state.

## Responsive rules

The module responds to its own container, not the browser viewport.

- Wide: map + activity, with selected inspector inserted as a third panel.
- Medium: map + activity remain side by side; inspector stacks beneath or the
  workspace flattens when three usable columns no longer fit.
- Compact: one vertical document with a 220-320px map, activity list, and
  selected details.
- Short landscape: header controls wrap once, map height is bounded by available
  block size, and the page scrolls without hiding activity controls.
- 2560px and 3840px use the same readable type sizes as 1440px. Additional
  space increases map area and breathing room, not typography.

## States

- Initial load: a map-shaped skeleton and list-row skeletons.
- Empty mapped result: overlay the honest unmapped count while retaining the
  activity list.
- Missing API key: retain the activity rail and show a map-panel notice; do not
  discard all scan controls.
- Connection error: cached activity remains visible with a retry action.
- Card-details error: keep the selected scan and offer a focused details retry.
- Search/city filter with zero results: state what filter is active and provide
  the existing clear action.

## Scope

### In scope

- `ScanActivityTab.svelte` composition and responsive styles.
- `ScanCellWarmControls.svelte` disclosure-ready presentation and motion.
- `RecentScansList.svelte` TKA word hierarchy and focus hooks.
- `ScanCardPeek.svelte` TKA title and close-focus behavior.
- `GlobalUserMap.svelte` marker accessibility, clustering, selection, and stable
  reconciliation.
- Scan map-label simplification in `scan-activity-state.svelte.ts`.
- Focused component/state tests and visual verification.

### Out of scope

- Changing Firestore collections, authorization, or scan logging.
- Backfilling historical coordinates.
- Public scan-atlas access.
- Heatmaps, time scrubbing, journey arcs, or a replacement map implementation.

## Verification

Automated proof:

- state tests for simplified marker labels and unchanged geo filtering;
- component tests for repeated-word shortening, TKA glyph rendering, selection,
  and focus restoration;
- map tests for marker reconciliation and accessible interaction where the
  Google API seam can be exercised deterministically;
- focused TypeScript/Svelte diagnostics for every changed path.

Visual proof on the real route:

- 375x667, 960x412, 820x1180, 1440x900, 1920x1080, 2560x1440, and 3840x2160;
- 200% zoom at a desktop viewport;
- resting, selected, filtered, operator-tools, loading/empty/error when they can
  be reached without fabricating production data;
- mouse and keyboard selection, inspector close/focus return, marker cluster
  expansion, and reduced motion.
