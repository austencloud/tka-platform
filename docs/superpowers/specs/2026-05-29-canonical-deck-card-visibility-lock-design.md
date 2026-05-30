# Canonical Deck-Card Visibility Lock — Design

**Date:** 2026-05-29
**Status:** Approved design, implementation gated on concurrent render refactor

## Problem

Choreo-card visibility is governed by three unsynced settings stores feeding one
`image-composer` through several render front-ends with inconsistent defaults.
The released-deck / print-preview cards are meant to be a **fixed playing-card
design**, but they were inheriting user-mutable state:

- `ExportImagePanel` (sequence-viewer download) writes the user's toggles into the
  global `VisibilityStateManager` (`getSettings().visibility`).
- `image-composer.getVisibilitySettings` has a fallback branch that **reads the
  global vm** whenever a caller passes a *partial* `visibilityOverrides`.
- `ChoreoCardExport` passed partial overrides, so a user's sequence-viewer
  non-radial / elemental toggle leaked onto the cards they were releasing.

Directive (Austen, 2026-05-29): released decks, the print preview, the deck
releaser, and the whole Choreo-cards tab are **not flexible** — they are designed
for playing-card size and must not reflect modifications made in the sequence
viewer. The only flexible card surface is the sequence-viewer download.

## Goal

A hard wall between two visibility domains:

- **Flexible** — sequence-viewer download (`ExportImagePanel` +
  `sequence-modal-exporter`). Reads/writes the global vm. User owns it.
  **Unchanged by this work.**
- **Locked** — deck releaser + print preview + released decks + the whole
  Choreo-cards tab (incl. CardDesigner). Renders from a single canonical profile
  constant. Never reads the vm.

Locking does not reduce future flexibility: the canonical look is a one-line edit
to the constant.

## Sourcing model

No user pictograph toggles exist on the locked path. Every field has exactly one
source:

| Field | Source | Value |
|---|---|---|
| grid, hand-points, TKA, non-radial, reversals, positions, TnD-text | canonical constant | grid/TKA/hand-points ON; non-radial/reversals*/positions/TnD per table |
| elemental | canonical builder, per card | `tndElement != null` |
| word | canonical | always on (text derived from sequence) |
| QR | canonical | always on for deck cards |
| start-position + layout | deck config | `getCatalogLayoutPolicy` (set at deck generation) |
| theme | deck config | rainbow for now |

(*reversals ON.)

## The constant + builder

New file: `src/lib/features/choreo-card/domain/canonical-card-visibility.ts`

```ts
export const CANONICAL_DECK_CARD_PROFILE = Object.freeze({
  showGrid: true,
  showTKA: true,
  handPointVisibility: "all" as const,
  showNonRadialPoints: false,
  showReversals: true,
  showPositions: false,
  showTnD: false,
  addWord: true,
  showQRCode: true,
});

export function buildCanonicalCardVisibility(args: { tndElement?: unknown }) {
  return {
    ...CANONICAL_DECK_CARD_PROFILE,
    showElemental: args.tndElement != null,
    printMode: true,
    darkMode: false,
  };
}
```

`start-position` (+ layout) and `theme` remain explicit deck-config params passed
alongside — untouched by this constant.

**Call-site split:** `addWord` is a top-level `composeOptions` field, not a
`visibilityOverrides` member; `showQRCode` and the pictograph-visibility fields go
inside `visibilityOverrides`. The builder returns one flat profile for a single
source of truth; `PrintCardRenderer` routes `addWord` to `composeOptions.addWord`
and spreads the rest into `composeOptions.visibilityOverrides`. (`image-composer`'s
visibility type already tolerates the extra `addWord`/`showQRCode` keys; only the
documented fields are read.)

## Changes

1. **New** `canonical-card-visibility.ts` (constant + builder above).
2. **`PrintCardRenderer.renderFront`** — spread `buildCanonicalCardVisibility({ tndElement })`
   into `composeOptions.visibilityOverrides`. Stop reading
   `options.showGrid / showTKA / handPointsVisible / showWord / showQRCode`. The
   worker path (`composeFrontBitmap` → `composition.worker.ts`) inherits the same
   set because it serializes `composeOptions`; no separate worker change.
   Re-establishes elemental-for-TnD (which a concurrent edit reverted) as part of
   the profile.
3. **Remove dead user toggles + state** — drop Grid / HandPts / TKA / Word / QR
   controls and their `choreoCard.*` localStorage keys from `ChoreoCardTab`,
   `DesignerSettingsSidebar`, and `ChoreoCardVisibility`; remove the props
   threaded through `CatalogBrowser` → `PrintPreviewPages`. CardDesigner included.
   The Choreo-cards tab has no pictograph-visibility controls after this.
4. **Regression tripwire** — dev-only `console.warn` in
   `image-composer.getVisibilitySettings` when a `deckCard` render arrives with a
   partial `visibilityOverrides`. Behavior unchanged; the flexible path keeps the
   vm-fallback intentionally.
5. **Cache** — bump `CARD_RENDER_SCHEMA` in `PrintPreviewPages.buildCacheKey`
   whenever the canonical constant changes, so stale `DeckCardBlobCache` /
   `cardCache` entries self-invalidate.

## Out of scope (unchanged)

- Sequence-viewer flexible path: `ExportImagePanel`, `sequence-modal-exporter`.
  Keeps reading/writing the global vm.
- start-position layout policy and theme sourcing (deck config).
- The `?? true` default normalization and the cache-key spine unification (audit
  recommendations 3 & 4) — separate follow-ups, not required for the wall.
- Merging `ThumbnailRenderer` + `PrintCardRenderer` (audit recommendation 5).

## The seal

The flexible path *depends* on the vm-fallback (it passes partial overrides on
purpose to inherit user settings), so the fallback stays. The locked path cannot
reach it because `buildCanonicalCardVisibility` always emits the full set. Intent
lives at the call site, not in a "did you fill every field" accident. The dev
warn (change #4) catches any future locked-intent caller that regresses to
partial overrides.

## Testing

- Unit: `buildCanonicalCardVisibility` returns the frozen profile + correct
  `showElemental` for `tndElement` present/absent.
- Integration: toggle non-radial / elemental in the sequence viewer, then render a
  deck card — assert the deck card is unchanged (the wall holds).
- Visual: released-deck card front matches the canonical look; TnD-deck cards show
  the element glyph fit to natural aspect; generic cards stay clean.

## Timing / collision

A concurrent session is actively refactoring `PrintCardRenderer` and
`PrintPreviewPages` (it added the worker-pool front path and reverted an interim
elemental edit). Implementation of this design is **gated on that refactor
landing** to avoid muddying each other's work. The spec is safe to finalize now.
