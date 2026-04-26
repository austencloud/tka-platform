# Deck Hand Path Cards

**Date:** 2026-03-19
**Status:** Approved

## Problem

The L1 deck has 64 sequences mapping to 18 unique hand paths. Users need to see the spatial patterns (hand path cards) at the top of each family section before the individual sequence cards.

## Design

### UI: Hand path row in DeckFamilySection

Each family section shows a "Hand Paths" row at the top of its expanded content. One card per unique `handPathId` within that family (2-4 cards per family). These are regular ChoreoCards rendered with `handPathMode: true`.

### Data flow

```
DeckFamilySection receives sequences[]
  → group by metadata.handPathId (from Firestore)
  → pick first sequence per handPathId as representative
  → render ChoreoCard with handPathMode=true (hand path row)
  → render all ChoreoCards normally (sequence grid below)
```

### Pipeline wiring

`handPathMode` flows through the existing rendering pipeline:

```
ChoreoCard { handPathMode }
  → PropAwareThumbnail { visibility.handPathMode }
    → ThumbnailRenderer → SequenceExportOptions.visibilityOverrides.handPathMode
      → ImageComposer → PictographVisibilityOptions.handPathMode
        → PreviewCellRenderOptions.handPathMode (already implemented)
```

### Files modified

| File | Change |
|---|---|
| `ChoreoCard.svelte` | Add `handPathMode?: boolean` prop, pass to visibility settings |
| `IThumbnailKeyDeriver.ts` | Add `handPathMode` to `ThumbnailVisibilitySettings` |
| `ThumbnailKeyDeriver.ts` | Include `handPathMode` in hash |
| `ThumbnailRenderer.ts` | Pass `handPathMode` through to visibilityOverrides |
| `ImageComposer.ts` | Pass `handPathMode` to PreviewCellRenderOptions |
| `PictographVisibilityOptions` (wherever defined) | Add `handPathMode` field |
| `DeckFamilySection.svelte` | Group by handPathId, render hand path row |

### What hand path cards show

- HAND prop SVGs (not staff)
- Float arrows for shift motions
- Dash arrows for dash motions
- No TKA letter overlay
- No reversal indicators
- No word label
- Hands at 0° rotation (no orientation)

### What hand path cards don't show

- Letters, turns, or any TKA notation
- Word labels (no `addWord`)
- LOOP icon strip (hand paths are universal, not sequence-specific)
- Click-to-open behavior (hand paths are reference, not interactive)
