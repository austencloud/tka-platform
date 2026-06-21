# Gallery-Sourced Decks — Design

**Date:** 2026-06-01
**Status:** Approved (brainstormed 2026-06-01)

## Goal

A third deck source in the choreo-card deck releaser: decks composed by
**filter-querying the operator's own library** (`users/{userId}/sequences`),
alongside the existing LOOP (live-generated) and TnD (enumerated) sources.
Released gallery decks appear as a sibling subsection to the TnD subsection in
the Released browse area.

## Decisions (from brainstorm)

- **Selection model:** filter query — the deck is every matching library
  sequence, capped at the deck-size input.
- **Scope:** the operator's own private library only (`users/{userId}/sequences`),
  not the public gallery.
- **Freeze vs live:** snapshot-on-release + a **Refresh from gallery** action.
  Release freezes the matched card list (printed QR cards stay reproducible);
  Refresh re-runs the filter to pull newly-matching sequences on demand.
- **Filter axes (all four):** Collection/tag · Loop type + period · Level +
  length · Word/text search.

## Architecture

Reuse the existing compose → resolve → release pipeline. A gallery deck is a new
`deckMode` branch plus a source service; most infrastructure is already generic
(cards grouped by `sourceCatalogId`, resolved per-source, persisted as
`DeckReleaseCard[]` + a `DeckRecipe`).

### Units

1. **`gallery-deck-source.ts`** (new service, `choreo-card/services/`):
   - `queryGalleryCards(filters: GalleryFilters, cap: number, userId: string): Promise<DeckReleaseCard[]>`
     — queries the user's library, applies filters, orders by `createdAt` desc,
     dedups, takes the first `cap`. Cards: `sourceCatalogId: "gallery"`,
     `sequenceId` = library sequence id, `word`, `stepCount`, `position`.
   - `resolveGalleryCards(ids: string[], userId: string): Promise<SequenceData[]>`
     — resolves library ids → full `SequenceData` via the library loader
     (`collection-manager` / library Firestore mapper).
   - Pure-ish: the Firestore loader is injectable so unit tests run with a fake.

2. **`GalleryComposeBoard.svelte`** (new, `deck-releaser/`):
   - Filter UI shown in `ConfigureStep` when `deckMode === "gallery"`.
   - Built from canonical chip primitives (`FilterChipBase` toggles, `SegmentedControl`
     single-selects) per `chip-primitives.md` — NO hand-rolled chips.
   - Collection/tag picker, loop-type + period, level + length, a word/text
     input, and the existing Deck Size cap.

3. **State** (`deck-releaser-state.svelte.ts`):
   - `deckMode` gains `"gallery"`.
   - `galleryFilters` state (the four axes) + persistence + `toRecipe`/`loadRecipe`.
   - `DeckRecipe` (`DeckRelease.ts`) gains `galleryFilters?: GalleryFilters`.

4. **`DeckReleaserTab.svelte`**:
   - `composeGalleryDeck()` on Draw → `queryGalleryCards`.
   - `loadSelectedSequences` branches `sourceCatalogId === "gallery"` →
     `resolveGalleryCards` (instead of the catalog `loadSequencesByIds`).
   - Gallery releases unpin the prop (follow the current prop setting, like TnD);
     the in-deck `DeckPropSwitcher` shows in review (`viewingTnD`-style gate
     widened to "follows-current-prop" decks).
   - **Refresh from gallery** action in the review header (gallery decks only):
     re-runs `queryGalleryCards` against the live library and re-renders.

5. **Browse subsections** (`DeckReleaserTab` + `ReleaseHistoryPanel`):
   refine the 2-way split into 3 sections, classified by `recipe?.deckMode`:
   - **Timing & Direction Decks** — `deckMode` is `"tnd"` OR absent (legacy).
   - **Gallery Decks** — `deckMode === "gallery"`.
   - **Released Decks** — `deckMode === "loop"`.
   Empty sections hidden.

6. **Release** (`deck-release-store` / release flow): unchanged storage —
   `sequences: DeckReleaseCard[]` snapshot + `recipe` carrying `galleryFilters`.

### Data model

```ts
interface GalleryFilters {
  collectionId?: string;   // users/{uid}/collections/{id}
  tagId?: string;          // users/{uid}/tags/{id}
  loopTypes?: string[];
  period?: "halved" | "quartered";
  levels?: number[];
  lengths?: number[];
  wordQuery?: string;
}
```

## Data flow

```
Draw (gallery mode)
  → queryGalleryCards(filters, cap, userId)        # library query + filter + cap
  → rs.cards = DeckReleaseCard[] (sourceCatalogId "gallery")
  → loadSelectedSequences → resolveGalleryCards    # ids → SequenceData
  → render / review

Release
  → store cards snapshot + recipe.galleryFilters

View released gallery deck
  → handleSelectRelease → loadSelectedSequences (resolveGalleryCards)
  → Refresh from gallery → queryGalleryCards(recipe.galleryFilters) → re-render
```

## Error handling

- Zero matches → toast ("No library sequences match these filters").
- Not signed in / no userId → gallery mode disabled with a hint (the releaser is
  an authenticated operator surface).
- A library id that no longer resolves (deleted sequence) → skipped, with a
  count toast on Refresh.

## Testing

- `gallery-deck-source` unit tests: filters → cards (ordering, cap, dedup);
  `resolveGalleryCards` with a fake loader (ids → SequenceData, missing-id skip).
- Browse classifier test: a 3-way split over loop / tnd / gallery / legacy
  releases lands each in the right section.

## Out of scope

- Public-gallery sourcing (others' sequences) — my-library only for now.
- Live (non-snapshot) released decks.
- New gallery storage — reuses `users/{userId}/sequences`.
