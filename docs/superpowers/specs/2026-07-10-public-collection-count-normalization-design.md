# Public Collection Count Normalization — Design

**Date:** 2026-07-10
**Status:** Approved (option A)

## Problem

`public-collection-loader.ts` is the only door foreign collections enter the app
through, but it returns raw docs whose `sequenceCount` (and `sequenceIds`)
include the owner's PRIVATE members. Visitors can only ever see public members,
so every consumer had to remember to patch the count via `countPublicMembers`.
Three surfaces drifted (community cards, foreign detail header, followed rail),
each fixed reactively. Opt-in correctness guarantees a fourth incident.

## Decision

Normalize at the door. The loader never lets a raw private-inclusive count
escape:

- Internal `toPublicView(collection)`:
  - manual collections → `sequenceCount` replaced by
    `countPublicMembers(sequenceIds)`; on count error, fall back to stored count
  - smart collections → keep stored count (membership derives from filterSpec;
    ids unused)
- Applied inside every public-facing getter: `getPublicCollection`,
  `getAllPublicCollections`, `getUserPublicCollections`.
- `countPublicMembers` becomes module-private (no export).
- Consumers delete their patch code: `community-collections-state.svelte.ts`,
  `followed-collections-state.svelte.ts`. `CollectionDetailView` keeps
  `members.length` (truth by construction once members load).
- Owner's own library never routes through this loader, so owners still see
  their true total. Correct and intended.

## Invariant (JSDoc on the loader)

> Anything returned from this module has `sequenceCount` equal to the number of
> PUBLIC members a visitor will actually see.

## Anti-drift enforcement

Contract test (same pattern as `sequence-viewer-shell-contract.test.ts`):

- `countPublicMembers` is not exported from the loader / not imported anywhere
  outside it.
- Loader unit tests cover: manual count override, smart passthrough, error
  fallback, empty-ids short-circuit, >30-id chunking.

## Rejected

- **B — denormalized `publicSequenceCount` field:** write-path bookkeeping on
  every publish/unpublish/membership change, stale risk; deferred pending
  visibility-policy direction.
- **C — shared helper each surface calls:** still opt-in; doesn't kill the smell.

## Cost

Same aggregate-count queries as today, moved inside the loader. One count query
per manual collection per load (chunked per 30 ids), parallelized.
