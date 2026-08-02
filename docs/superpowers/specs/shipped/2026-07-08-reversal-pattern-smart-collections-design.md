---
status: active
value: 3
effort: M
remaining: "Body status: Approved (design)"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Reversal-Pattern-Aware Smart Collections + Classic Book Variations

**Date:** 2026-07-08
**Status:** Approved (design)
**Related:** `2026-07-07-founding-smart-collections-design.md`, `2026-07-06-max-turn-intensity-filter-design.md`, `2026-07-06-smart-collections-design.md`

## Goal

Make the reversal pattern a filterable dimension of smart collections, and surface
the released **Classic Book Variations** deck (manifest #009) as a fourth founding
smart collection — read-only, public, config-defined — exactly parallel to
TKA 1/2/3.

## Motivation

The three founding decks (TKA 1/2/3) are the continuous T&D alphabet, difficulty-
sliced. The **Classic Book Variations** deck (Firestore `deckReleases/counter/
manifests/009`, cardCount 19) is the SAME 19 base seeds at turn `1|1` with the
**book** reversal pattern (`PPPP` — both props reverse every step) applied. A
smart-collection rule cannot express it today because:

1. **No reversal-pattern filter.** `REVERSAL_PATTERNS` (`reversal-patterns.ts`)
   defines 15 patterns across 4 families, and each seeded variant sequence already
   carries a `reversalPattern` field, but no `BrowseFilterType` reads it.
2. **Book variants aren't in any browsable pool.** `loadCanonicalTnDSequences`
   generates only continuous variants.

## Non-Goals

- User-facing reversal-pattern gallery chip. The variants are collection-scoped
  (not in the main gallery), so there is nothing to filter there. YAGNI until a
  use case puts reversal variants in the gallery.
- Generalizing to the other 14 patterns' decks. Only deck #009 (book) exists.
  The filter supports them for free; wiring them is future work.
- Solving the gallery-flooding problem. The continuous alphabet's presence in the
  gallery is a separate, deferred decision. This design adds ZERO new gallery flood
  (book variants are collection-scoped).

## Architecture

Three independent units, following proven seams:

### 1. `REVERSAL_PATTERN` browse filter (predicate + spec plumbing)

Mirrors the `MAX_TURN_INTENSITY` filter added 2026-07-06.

- `BrowseFilterType.REVERSAL_PATTERN = "reversal_pattern"` (enum in
  `browse-enums.ts`).
- Predicate `filterByReversalPattern(seq, value)`:
  `(seq.reversalPattern ?? "continuous") === value`. Absent = continuous, matching
  the app-wide reversal display policy. Value is a pattern id string
  (`"book"`, `"continuous"`, `"red-book"`…).
- Registered in the browse-filter predicate switch alongside DIFFICULTY /
  MAX_TURN_INTENSITY, so it flows through `buildFilterSpecFromEngine` /
  `applySpecToEngine` and smart collections inherit it with no smart-collection
  code change.
- `SequenceData` gains an optional typed `reversalPattern?: string` (today an
  untyped passthrough from the reversal seeder). The passthrough shape is
  unchanged; this only types it.

No availability-deriver / chip UI (non-goal above).

### 2. Collection-scoped book-variant injector

New `loadCanonicalBookVariations(): Promise<readonly SequenceData[]>` in
`canonical-tnd-pool.ts` (or a sibling `canonical-book-pool.ts`):

- For each `TND_ELEMENTS` family → `resolveTnDFamilyCards(familyId)` → each
  matrix's `byTurn.get("1|1")` (the deck's turn pattern) — 19 seeds total.
- `transformSequence(seq, BOOK_PATTERN, edges)` applies the book reversal
  (`transformSequence` from `reversal-seed-service.ts`, `edges` from
  `loadDiamondEdges()`). `BOOK_PATTERN` = the `ResolvedReversalPattern` for book
  (`{ id:"book", label:"Book", sequence:"PPPP", isNamed:true, isCleanLoop:true }`).
- Tag each: `id = ${seedId}__t_1-1__book`, `author = CANONICAL_TND_AUTHOR`,
  `dateAdded/birthday = TND_BIRTHDAY`, `level = calculateDifficultyLevel(steps)`
  (turn 1|1 radial → level 2), `reversalPattern = "book"`, tags carry the family
  id (for `tnd-family` grouping) + `"book"`.
- `processReversals` applied last (book = a reversal every step, so dots SHOULD
  render — the opposite of the continuous decks).

Cost is 19 transforms (CSV lookup + orientation recompute), appended async, only
when the Book collection is opened. Negligible.

### 3. Founding "Classic Book Variations" collection

Fourth entry in `founding-collections.ts`:

- `id: "founding_book"`, `name: "Classic Book Variations"`, `sequenceCount: 19`.
- `filterSpec` (source `community`): `AUTHOR "T&D Alphabet"` + `REVERSAL_PATTERN
  "book"`, sortMethod `level`. There is NO exact turn-pattern filter in the
  vocabulary (the founding decks use DIFFICULTY / MAX_TURN_INTENSITY); the turn
  `1|1` scoping is done by the injector, not the rule. AUTHOR fences user content;
  REVERSAL_PATTERN:book selects the 19 injected book seeds. (The 19 are all level
  2, so an added DIFFICULTY 2 would be redundant — omit it.)
- `toSyntheticCollection` unchanged (kind `smart`, systemType `founding`,
  `isPublic`, read-only), so it renders in `MyCollectionsPanel` alongside TKA 1/2/3.
- `SmartCollectionDetailView`: the founding branch wires
  `extraCommunitySequences: loadCanonicalBookVariations` for `founding_book`
  (a per-founding-id injector switch, defaulting to `loadCanonicalTnDSequences`),
  and keeps the `tnd-family` grouping (book deck is all 6 families).

## Data Flow

Open Book collection → detail view resolves `founding_book` config →
`createBrowseEngine({ source: community, extraCommunitySequences:
loadCanonicalBookVariations, defaultSectionGroupBy: "tnd-family" })` →
injector generates 19 book-reversed 1|1 seeds tagged `reversalPattern:"book"` →
rule (`AUTHOR` + `REVERSAL_PATTERN:book`) narrows → 19 → grid groups by TnD family
with correct book reversal dots.

## Testing

- Unit: `filterByReversalPattern` — matches `book`; treats absent as `continuous`;
  rejects mismatches. (`tests/unit/browse/`).
- Unit: founding config shape — `founding_book` present, rule = author + reversal
  + turn, count 19; `isFoundingId("founding_book")` true.
- Runtime acceptance (needs browser): Book card in the rail, opens read-only, count
  19, grouped by family, book reversal dots visible; TKA 1/2/3 unaffected.

## Risks

- **Injector perf if scope widens.** Transforming the full 6×49 alphabet ×N
  patterns would be heavy. Mitigated: scoped to turn `1|1` (19). Do not widen
  without re-checking cost.
- **`byTurn` key format.** The injector reads `matrix.byTurn.get("1|1")`. Verify
  the key format against `canonical-tnd-pool.ts` at implementation (the loop there
  iterates `[pattern, seq]`; the manifest uses `"1|1"`). If the deck yields fewer
  than 19, this key is the first thing to check.
