# Smart Collections — Design

**Date:** 2026-07-06
**Status:** Design approved, pending implementation plan
**Author:** Austen + Claude (brainstorming session)

## Summary

A **Smart Collection** is a Library collection defined by a saved filter rule
instead of a hand-picked list of sequences. Its members derive live: load the
pool the rule targets, apply the saved filters, render the result. Because
nothing is stored as membership, it auto-updates — new sequences that match the
rule appear the next time it is opened. Think iTunes/Photos "smart album": the
user defines a rule once, the collection maintains itself.

This sits beside the existing hand-curated (manual) collections in the same
Library surface. Manual = you pick the sequences. Smart = you pick the rule.

## Motivation

Austen's ask: any filter a user can apply to the community library should be
saveable as its own auto-updating collection — "sequences that are level 2, start
in gamma, and pass through alpha at least twice," "four-count level-3 sequences,"
"sequences with no reversals whatsoever." Google-Photos-auto-album ergonomics:
brainless, save-a-view, it keeps itself current. The manual collection system
already exists and is mature; this adds a second membership model to it rather
than a new place.

## Decisions (locked during brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| **v1 filter vocabulary** | Existing browse filters only | The save/derive/auto-update engine is orthogonal to filter vocabulary. Ship it on today's 15 filter types; computed predicates (reversal %, passes-through-position, end-letter, continuous) get added later as new browse filter types and every Smart Collection inherits them automatically. |
| **Visibility** | Private-only in v1 | A public smart collection is "a shared saved search"; mixing those into the community collection pile is the muddying Austen flagged. `isPublic` stays on the model (inherited from `LibraryCollection`), dormant — enabling sharing later is a small follow-on, not a rebuild. |
| **Name** | "Smart Collection" | Industry-standard (iTunes/Photos smart albums). Instantly signals "auto-maintained by a rule," sits naturally beside "Collections." |
| **Source pool** | Capture the saved view's source | A Smart Collection records whether the source was Community or My Library when saved. Enables both "community sequences that are level 3" and "my sequences that pass through gamma." Source is already in engine state — recording it is free. |
| **Storage model** | Extend `LibraryCollection` (Approach A) | Full reuse of the mature collections stack; smart + manual unified by construction; public/follow infra dormant-ready. |

### Approaches considered

- **A — Extend `LibraryCollection` (chosen).** Add `kind` + `filterSpec` fields;
  members derive live client-side. Reuses path, CRUD, subscriptions, rail, card,
  limits, rules, dormant public/follow infra.
- **B — Separate `SmartCollection` type + `users/{uid}/smartCollections/{id}`.**
  Rejected: duplicates list/subscribe/card/rail/detail/limits/rules/public infra;
  the two must render together anyway, so separation buys little and fights
  `never-hand-roll.md`.
- **C — Materialized (backend recompute writes real `sequenceIds`).** Rejected by
  YAGNI: needs a cloud function, goes stale between runs (not truly live), write
  amplification and cost — for a filter that runs in milliseconds on an
  already-loaded pool.

## Data model

Extend `LibraryCollection` (`src/lib/shared/library/domain/models/collection.ts:67`)
with two optional fields:

```ts
/** Discriminator. Absent or "manual" = hand-picked list (today's behavior). */
kind?: "manual" | "smart";

/** The saved rule. Present iff kind === "smart". */
filterSpec?: SmartFilterSpec;

/**
 * One saved filter. An OBJECT, not the engine's `[key, ActiveFilter]` tuple —
 * Firestore forbids arrays-of-arrays, so the localStorage tuple form cannot be
 * persisted. `type` is the string value of BrowseFilterType; `value` mirrors
 * BrowseFilterValue.
 */
interface StoredSmartFilter {
  key: string;   // engine map key, e.g. "difficulty" | "loop_type:component:mirrored"
  type: string;
  value: string | number | boolean | string[] | null;
  label: string;
  chipColor: string;
}

interface SmartFilterSpec {
  source: "community" | "my-library";
  /** Array of objects — never a nested array (Firestore constraint). */
  filters: StoredSmartFilter[];
  sortMethod: string;      // BrowseSortMethod value
  sortDirection: "asc" | "desc";
}
```

- `SmartFilterSpec` is the browse engine's active filters, serialized to a
  **Firestore-safe** shape. The engine's own persisted state
  (`create-browse-engine.svelte.ts:75` — `PersistedEngineState`) stores
  `activeFilters` as `Array<[string, ActiveFilter]>` for localStorage, but that
  tuple form is a nested array and **cannot** be written to Firestore. A tiny
  serialization helper (`smart-filter-spec.ts`) converts between the live engine
  and `StoredSmartFilter[]`. `ActiveFilter`
  (`src/lib/shared/browse/engine/types.ts:41`) values are
  `string | number | boolean | string[] | null` — all Firestore-safe as object
  fields.
- **Smart collections:** `sequenceIds` stays `[]` (unused). `sequenceCount` is a
  **cached snapshot** of the last live derivation, written on save and refreshed
  each time the detail view derives members. The rail card shows this number as a
  rule preview; mild staleness is acceptable (it is not a source of truth, the
  live grid is).
- **Back-compat:** existing docs have no `kind` → read as manual. No migration.
- **Factory:** add `createSmartCollection(name, filterSpec)` beside
  `createUserCollection` (`collection.ts:146`). **Helper:** `isSmartCollection(c)`
  beside `isSystemCollection` (`collection.ts:120`).
- **Mapper:** `mapDocToCollection` (`collection-firestore-mapper.ts:69`) reads
  `kind`/`filterSpec` when present.
- **Firestore:** same path `users/{uid}/collections/{id}`. No new rules —
  private/owner-scoped rules already cover it; `filterSpec` is inert data. The
  dormant public collectionGroup rules already gate on `isPublic`, so future
  sharing needs no rule change beyond what already exists.

## Components & data flow

### Creation entry points

1. **Primary — "Save as Smart Collection"** in the browse filter surface
   (`GalleryFilterSheet`). Enabled only when ≥1 filter is active. Reads the
   engine's current `{source, activeFilters, sortMethod, sortDirection}`, prompts
   for a name (reuse the inline-create input pattern from `MyCollectionsPanel`),
   calls `createSmartCollection`. This is the direct realization of "any filter I
   apply → its own collection."
2. **Secondary — Library rail "+New" → "New Smart Collection."** Opens the same
   filter surface in a build-a-rule mode; confirm saves. Cheap because it reuses
   `GalleryFilterSheet`. Included in v1.

### Detail view — branch on `kind`

`CollectionDetailView` (`CollectionDetailView.svelte`) branches:

- **Manual (unchanged):** member grid, Add/Scan buttons, per-card "Remove from…".
- **Smart:**
  - Header renders the rule as filter chips (reuse `ActiveFilter.label` +
    `chipColor`) plus a **Community / My Library** source badge.
  - **"Edit rule"** button reopens the filter surface seeded from `filterSpec`;
    saving writes the updated `filterSpec` and re-derives.
  - Grid = **live derivation** via an ephemeral browse engine (same pattern as
    `AddSequencesSheet` / `AllLibraryView`, per
    `[[reference_sequence_picker_reuse]]`): create engine, set
    `filterSpec.source`, inject `filterSpec.activeFilters`, render
    `engine.filteredAndSorted` through the shared `BrowseGrid`.
  - **No Add / Scan / Remove** — members are the rule's output.
  - **Empty state:** "Nothing matches this rule yet" + Edit rule affordance.

### Auto-update mechanism

There is no stored membership to go stale. Each open re-derives against the
current pool. If the community subscription is already warm (it usually is once
Browse has loaded), derivation is instant — `applyMultiFilters` is a pure,
synchronous pass over an in-memory array. New community sequences matching the
rule appear on the next derivation automatically. That is the entire
"auto-updates" behavior; no scheduler, no backend.

### Card visual

`CollectionCard` gains a smart affordance: a badge/icon distinguishing smart from
manual (default `fa-wand-magic-sparkles` when the user picks no icon), reusing
the existing `icon`/`color` fields. Same rail, same `sortOrder`/`updatedAt`
ordering as manual — smart and manual interleave in one list.

## Guardrails

1. **Add-to-collection picker excludes smart collections.**
   `CollectionPickerContent` (and the "Add to collection…" context-menu path)
   lists collections to hand-add a sequence into — smart ones must be filtered
   out (`kind !== "smart"`). You cannot hand-add into a rule-defined collection.
2. **Member ops reject smart targets.** `addSequenceToCollection` /
   `removeSequenceFromCollection` (`collection-manager.ts:301`,`:354`) throw/no-op
   when the target is smart (defense-in-depth; the UI already hides the buttons).
3. **Limits.** Smart collections count toward `MAX_COLLECTIONS_PER_USER` (100).
   No per-member cap (membership is derived, not stored).
4. **Deck promotion disabled for smart in v1.** `deckMetadata` promotion assumes a
   fixed member list; guard/hide the affordance for smart collections. Deferred:
   materialize-on-promote (snapshot the derived members into a printable deck).
5. **Save requires ≥1 filter.** An empty rule equals the whole pool; block the
   save with a hint rather than create a "collection of everything."
6. **Self-reference guard.** A smart rule may include the `COLLECTION` filter
   type (nested membership) — but must not target its own id. Guard at save/edit.

## Error handling & edge cases

- **Unknown filter type in a saved spec** (a filter type retired after the spec
  was saved): `applyFilter` ignores unknown types gracefully; the derivation
  simply drops that predicate. No crash.
- **Source = my-library while signed out:** the my-library pool is empty →
  empty-state renders. Expected.
- **Cached `sequenceCount` drift:** the rail preview number can lag the live grid
  by one view; the detail grid is always authoritative and refreshes the cache.

## Testing

Unit (logic, `tests/unit/…`):
- `filterSpec` round-trip: serialize → deserialize equals the source, matching
  `PersistedEngineState` handling.
- `isSmartCollection` discriminates correctly (absent `kind`, `"manual"`,
  `"smart"`).
- Picker exclusion: smart collections absent from the add-target list.
- Member-op rejection: `addSequenceToCollection`/`removeSequenceFromCollection`
  reject a smart target.
- Derivation equivalence: `applyMultiFilters(pool, spec.activeFilters)` equals a
  freshly-configured engine's `filteredAndSorted` for the same source.

Component tests: test-on-fix only, per `component-test-discipline.md`. No new
browser tests unless a bug forces one.

No backend, no cloud function, no scheduled job.

## Reuse ledger (never-hand-roll gate)

| Need | Reused artifact |
|---|---|
| Filter serialization | `PersistedEngineState` / `activeFilters` (`create-browse-engine.svelte.ts:75`) |
| Filter predicate | `applyFilters` / `applyMultiFilters` (`multi-filter.ts:20`) |
| Live-derivation engine | ephemeral `createBrowseEngine` (as `AddSequencesSheet`/`AllLibraryView`) |
| Collection CRUD + subscriptions | `collection-manager.ts` (create/update/delete/subscribe) |
| List/rail + card | `MyCollectionsPanel.svelte`, `CollectionCard.svelte` |
| Detail grid | `CollectionDetailView.svelte` + shared `BrowseGrid` |
| Filter surface (create/edit rule) | `GalleryFilterSheet` |
| Name-create input | inline-create pattern in `MyCollectionsPanel` |
| Firestore path/rules/limits | `users/{uid}/collections/{id}`, existing rules, existing caps |

New code is confined to: the two model fields + factory/helper, a
`CollectionDetailView` branch, a "Save as Smart Collection" action, a "+New Smart
Collection" rail entry, and the six guardrails.

## Deferred (explicitly out of v1)

- Public / shared smart collections (`isPublic` dormant on the model).
- Computed filter types (reversal percentage, passes-through-position count,
  end-letter, continuous / no-reversal). Added later as browse filter types;
  Smart Collections inherit them automatically with no further work here.
- Deck promotion for smart collections (materialize-on-promote).
- Community discovery / follow for smart collections (follow infra already
  exists; enabling is a follow-on once public is on).
