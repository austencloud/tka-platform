---
status: archived
value: 4
effort: M
remaining: ""
depends_on: ""
plan_path: ""
tags: []
superseded_by: docs/superpowers/specs/shipped/2026-07-01-gallery-drill-content-peek-design.md
last_triaged: 2026-07-29
---
# Gallery Front Door — Phase 1: Rows-of-Shelves Home (Design)

**Date:** 2026-07-01
**Status:** Archived 2026-07-29. Superseded by the shipped gallery drill.
**Supersedes the entry behavior of:** `2026-06-30-gallery-two-front-doors-design.md` (taxonomy-first `StartHere` is demoted from the entry to a secondary lane; it is not deleted)

> **ARCHIVED 2026-07-29.** The unified gallery front door shipped as gallery
> drill v7 in commit `e2d821b1f9`. The shipped drill absorbed this design's
> entry behavior, shelf intent, search path, and structure lane. Keep this file
> as design provenance; do not implement it as a second front door.


---

## Problem

The Browse gallery's newcomer entry (`StartHere`) makes the FIRST decision "Timing & Direction (TnD) base families" vs "LOOPs" — domain jargon a first-time visitor does not know. Parallel research (4 grounded investigators + external best-practice sweep, 2026-07-01) was unanimous: every successful creative/UGC catalog (Spotify, Netflix, Printables, Thingiverse, Cults3D, Figma Community, Are.na, Canva, Notion) opens on **rows of plain-language shelves** and demotes the taxonomy to a secondary "explore by structure" lane. Jargon as decision #1 is the exact Hick's-Law / vocabulary-barrier failure they design against.

## Decision (locked)

**Hybrid, phased.** Ship an algorithmic rows-of-shelves home NOW; add an owner-curated "Featured Collections" marquee LATER once its infra exists; defer "Most-loved" until there is engagement data to rank. Shelf spine for Phase 1: **discovery mix** (recency + skill + length + creators).

## Corpus reality (why these shelves, not others)

Grounded over `static/data/snapshots/public-sequences.json` (460 docs):

- **Recently added — SUPPORTED, free.** `publishedAt`/`birthday` on all docs; `dateAdded = birthday ?? publishedAt` mapped at `public-sequences-loader.ts:309`; `DATE_ADDED` sort exists (`browse-sorter.ts:82-88`).
- **Difficulty — usable, jargon-free.** `difficultyLevel` string on 381/460 (beginner 140 / intermediate 182 / advanced 59) + computed fallback (`browse-sorter.ts:14-18`). Numeric `level` is sparse (43/460) — do NOT rely on it.
- **Length — SUPPORTED but skewed.** `sequenceLength` on all; distribution ≤4:40, 5-6:4, 7-8:106, 9+:310. "Quick" (≤6, ~44) is thin but sufficient for a teaser shelf.
- **Creators — thin but human.** `ownerId`/`ownerDisplayName` on all 460; 93% one author (Austen 430; Paul 12, Elizabeth 8, Sky Guys 6, Nina 3, Kevin 1). Featured-creators curation works today via admin `isFeatured` → `getFeaturedCreators` → `FeaturedCreatorsSection`.
- **Most-loved — MISSING.** `starCount`/`viewCount`/`forkCount` are `0` on all 460, never incremented, never mapped onto `SequenceData`; the `POPULARITY` sort is secretly an `isFavorite` no-op (`browse-sorter.ts:104-108`). Deferred.
- **TnD family — not data-backed.** No `tndFamily` on public docs; needs the Phase-2 classifier backfill. Deferred.

## Phase-1 Design

### Entry / swap point

Replace the `galleryView === "start-here"` branch at `BrowseModule.svelte:507-535`. A new **`GalleryHome`** mounts in that slot with the same wiring the current `StartHere` has: `onBrowseAll` escape (→ full `GalleryTab`) and `pool={engine.sequences}`. The deep gallery (`GalleryTab` on the community engine) is unchanged.

### Layout (top → bottom)

1. **Search** — co-primary at top. Reuse the existing browse search input; submitting routes into the full engine results (browse-all with the query applied). The intent escape hatch.
2. **New arrivals** — `DATE_ADDED`, newest-first. Always populated.
3. **Good for beginners** — facet `difficultyLevel = beginner`.
4. **Quick to learn** — facet `sequenceLength ≤ 6`.
5. **Creator spotlight** — reuse `FeaturedCreatorsSection` (admin `isFeatured`).
6. **Explore by structure** — one labeled entry that opens the existing `StartHere` taxonomy step-machine (TnD/LOOP). Preserves all prior work as the power-user lane.
- **"Browse all →"** persists as the escape (already in the slot).

### Shelf mechanism (no hand-roll)

Each card shelf is an **ephemeral browse engine**: `createBrowseEngine({ persistKey: null, initialSource: "community", constraints: <locked facet>, initialSort })` (`create-browse-engine.svelte.ts:98`, constraints/lockedFilters `:107-118`). Constraints lock the facet so the shelf shows only its slice:

- New arrivals → `initialSort: DATE_ADDED`, no facet.
- Good for beginners → constraint on difficulty (beginner) via the existing DIFFICULTY filter (`browse-filter.ts`), keyed on `difficultyLevel` + fallback.
- Quick to learn → constraint on LENGTH ≤ 6 (`browse-filter.ts` LENGTH).

The Creator spotlight shelf is the existing `FeaturedCreatorsSection` component, not an engine.

### New component: `ShelfRow`

The one confirmed gap — no ChoreoCard horizontal-row primitive exists (only image-only `SampleCardCarousel`; `FamilyCardRow`/`LoopCardRow` are vertical grids). Create a small, focused **`ShelfRow`**:

- **Props:** `title: string`, `sequences: readonly SequenceData[]`, `onSeeAll?: () => void`, `onOpen: (seq) => void`.
- **Renders:** a header (`title` + optional "See all →") and a **horizontal scroll-snap strip** of `ChoreoCardThumbnail` (`onPrimaryAction = onOpen → openSequenceViewer`).
- **Sizing:** one card-height row (NOT a full-viewport carousel — the earlier mistake). Page scrolls vertically across the stacked rows, Netflix-style. Fixed card width; `overflow-x: auto` with scroll-snap; reduced-motion respected.
- Reuses `ChoreoCardThumbnail` and `openSequenceViewer` exactly as `FamilyCardRow` does.

"See all →" flips `galleryView` to browse-all (`GalleryTab`) with that shelf's facet applied to the main engine, so each shelf is a teaser into the deep grid.

### Cold-catalog empty states

- A shelf renders only when it has **≥ 3 cards**; otherwise it is **absent** (not an empty row, no reserved gap → no layout shift).
- Creator spotlight hides when no creators are featured.
- New arrivals is always populated (whole corpus), so the worst-case home still shows New arrivals + Explore by structure.

### Data honesty

- Beginner / Quick facets use `difficultyLevel` string + computed fallback, never the sparse numeric `level`.
- Any creator grouping keys on `ownerId` / `ownerDisplayName`, never the unmapped `seq.author` (`browse-filter.ts:358-367` / `browse-sorter.ts:98-102` key on the wrong field for public docs).

## Reused primitives (no rebuild)

| Need | Reuse | Path |
|---|---|---|
| Shelf data (filter+sort+source) | `createBrowseEngine` ephemeral + `constraints` | `src/lib/shared/browse/engine/create-browse-engine.svelte.ts` |
| Recency / length / difficulty sorts | `browse-sorter` | `src/lib/shared/browse/services/browse-sorter.ts` |
| Facet filters | `browse-filter` (LENGTH, DIFFICULTY, RECENT) | `src/lib/shared/browse/services/browse-filter.ts` |
| Card unit | `ChoreoCardThumbnail` (+ `openSequenceViewer`) | `src/lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte` |
| Creator spotlight | `FeaturedCreatorsSection` + `getFeaturedCreators` | `src/lib/features/browse/creators/components/FeaturedCreatorsSection.svelte` |
| Taxonomy lane | existing `StartHere` step-machine | `src/lib/features/browse/start-here/components/StartHere.svelte` |
| Swap point | `BrowseModule` gallery slot | `src/lib/features/browse/shared/components/BrowseModule.svelte:507-535` |

## Files

**Create:**
- `src/lib/features/browse/start-here/.../GalleryHome.svelte` (final path decided in the plan) — the rows-of-shelves home; composes the shelves + Explore-by-structure entry.
- `ShelfRow.svelte` — the horizontal ChoreoCard shelf primitive (grep first for any existing horizontal card-row before finalizing; research found none, but re-confirm at plan time per never-hand-roll).
- A small shelf-definition module (title + facet constraint + sort) so shelves are data, not duplicated markup.

**Modify:**
- `BrowseModule.svelte` — mount `GalleryHome` in the gallery `start-here` slot; keep `onBrowseAll`/`pool`. The `StartHere` taxonomy becomes reachable from the "Explore by structure" entry inside `GalleryHome`.

## Out of scope (later phases)

- **Featured Collections marquee** (owner-curated) — needs a featured/curated flag on `LibraryCollection`, a global collection index (today per-user N+1), and a collection-detail shelf renderer. Own spec.
- **Most-loved shelf** — needs a popularity pipeline (increment on favorite/view/fork + map `starCount` into `SequenceData` + a real comparator) AND engagement data. Own spec.
- **TnD-family shelves in browse-all** — needs the Phase-2 `tndFamily` backfill on public sequences.

## Testing / verification

- Unit: shelf-definition module (facet → constraint mapping); the ≥3-card visibility rule; the `difficultyLevel` + fallback bucketing.
- Component (vitest-browser-svelte, per `component-test-discipline`): `ShelfRow` renders a strip and fires `onOpen`; a shelf with <3 cards is absent.
- Runtime verification (per `verification-protocol`): screenshot the home with real cards on each shelf, click a card → viewer opens, "See all →" → browse-all pre-filtered, empty-shelf absence with no layout shift.

## Success criteria

A first-time visitor lands on plain-language shelves (New arrivals, Good for beginners, Quick to learn, Creator spotlight) with a search bar, never sees "TnD" or "LOOP" as a first decision, and can reach the taxonomy via an opt-in "Explore by structure" lane. No empty shelves, no layout shift, all cards clickable into the viewer.
