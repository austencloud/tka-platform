# Start Position Layout Toggle in Download Card Panel

**Date:** 2026-04-20
**Status:** Draft
**Scope:** `src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte`

## Problem

The choreo card supports two start-position layouts: **Top Row** (start position sits above the first column of beats) and **Left Column** (start position sits to the left as its own column). The per-step-count override and global default already exist in `ImageCompositionManager`, but the deleted `CardSettingsModal` was the only place users could pick. With that modal gone, users can no longer change the layout — the setting is stranded.

The Download Card panel (`ExportImagePanel.svelte`) is the natural home for this control: it already owns every other per-card visual toggle.

## Goal

Expose the Top Row / Left Column choice in `ExportImagePanel.svelte` using the existing split-pill visual pattern (Light / Dark Theme), wired to the existing per-step-count override API.

## Non-Goals

- Not touching `StaticSettings.svelte` in the generic Export Panel. That path doesn't render the card-style start-position row/column, so the toggle would be meaningless there. Whether `StaticSettings` is live or cruft is a separate investigation.
- Not adding a separate "Start Position on/off" control. That toggle (`includeStartPosition`) is also missing from this panel but is out of scope for this change.
- Not changing the global default (`imageComposition.startPositionLayout`). Only the per-step-count override is touched.
- Not removing the existing inline column picker from the ChoreoCard context menu.

## Design

### State hookup

`ImageCompositionManager` already provides:
- `getStartPositionLayoutForStepCount(stepCount: number): "row" | "column"` — reads override, falls back to global default.
- `setStartPositionLayoutForStepCount(stepCount, value)` — stores override. When `value` equals the global default, the override auto-clears (see `image-composition-state.svelte.ts:387-391`). No explicit reset UI needed.
- `compositionVersion` reactivity already wired in `ExportImagePanel.svelte`.

Add one `$derived`:

```ts
const startPosLayout = $derived.by(() => {
  void compositionVersion;
  return imageComposition.getStartPositionLayoutForStepCount(beatCount);
});
```

### Desktop sidebar

New `setting-row` between Mandala (`line 443-452`) and Columns (`line 454-465`), matching the Theme split-pill structure (`line 467-485`):

```
Start Pos   [ Top Row | Left Column ]
```

- Two `<button class="chip">` with `class:active={startPosLayout === "row"|"column"}` and `aria-pressed`.
- Click handler: `imageComposition.setStartPositionLayoutForStepCount(beatCount, "row" | "column")`.
- No icons — Theme uses icons because sun/moon are universally recognized; Top Row / Left Column do not have an icon vocabulary and text-only stays consistent with Content chips.

### Mobile bento

Inside the existing `RailBentoSheet` ("Content" sub-sheet), add a new `rt-section` after "Extras" (after `line 264`):

```
Start Pos
[ Top Row ]  [ Left Column ]
```

- Same `rt-chip-row` / `rt-chip` classes as the other mobile sections.
- Same click handlers as desktop.
- Matches the visual rhythm of Header / Footer / Pictograph / Extras sections.

No change to the 3-tile bottom row (Content / Columns / Theme).

### Labels

- Group label: **"Start Pos"** (matches `setting-label` brevity already used in the panel — "QR", "Mandala", "Theme").
- Option labels: **"Top Row"** and **"Left Column"** (match the labels previously used in the deleted modal).

## Files Touched

- `src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte` — add `startPosLayout` derived + two render sites (desktop sidebar, mobile bento sub-sheet).

## Testing

- Manual: open sequence viewer with a 4-beat and an 8-beat sequence, toggle between Top Row and Left Column, verify the ChoreoCard preview re-renders correctly in both.
- Verify the choice persists per step-count (set 4-beat to Top Row, 8-beat to Left Column, switch between them, settings stick).
- Verify that picking the value matching the global default removes the override (inspected via settings-state persistence — no visible UI, but correct per existing state semantics).
- Mobile: verify the new section appears in the Content sub-sheet and doesn't overflow.

## Rollback

Revert the single `ExportImagePanel.svelte` edit. No state-model changes, no migrations, no new dependencies.
