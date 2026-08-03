# Community Gallery Minimum Length — Design

**Date:** 2026-06-30
**Status:** Approved, implementing

## Problem

The community gallery (`publicSequences`) should only hold sequences of 4+ steps.
A different creator published a one-count sequence to the gallery. The existing
guard is also wrong in the other direction: `MIN_SEQUENCE_STEPS = 2` blocks
1-count sequences from the user's **own private library**, which the policy
allows.

Austen's policy:
- **Personal library:** any length. A 1-count sequence is fine if you really want one.
- **Community gallery:** 4-step minimum to post.

## Policy → tiers

| Steps | Personal library | Community gallery |
|------:|:-----------------|:------------------|
| 0 (empty) | blocked (nothing to save) | blocked |
| 1–3 | saved (private) | blocked |
| 4+ | saved | allowed |

"Steps" = persisted motion steps (`stepPairings.length`, the source of truth;
see `getPersistedStepCount`). Start position is not a step.

## Single source of truth — `sequence-min-length.ts`

```ts
export const MIN_SAVE_STEPS = 1;       // absolute floor to save at all
export const MIN_COMMUNITY_STEPS = 4;  // floor to post to the community gallery

getPersistedStepCount(seq): number      // unchanged
isEmptySequence(seq): boolean           // count < MIN_SAVE_STEPS  (0 steps)
meetsCommunityMinimum(seq): boolean     // count >= MIN_COMMUNITY_STEPS
```

`MIN_SEQUENCE_STEPS` and `isOneCountSequence` are removed; all callers move to
the new API.

## Enforcement points

1. **`PublicIndexSyncer.syncToPublicIndex` (authoritative):** throw if
   `!meetsCommunityMinimum`. This is the one choke point every publish path
   routes through (per `docs/architecture/save-paths.md`), so the invariant
   "nothing under 4 steps is in `publicSequences`" holds no matter the caller.

2. **Save paths degrade, never hard-fail (graceful):**
   - `LibrarySaveService.saveSequence` and `LibraryRepository.saveSequence`
     block only `isEmptySequence` (you can't save nothing).
   - When the requested visibility is `public` but the sequence is under 4
     steps, the visibility is **degraded to `private` before the write** so the
     stored doc and the public mirror stay consistent (no `visibility:"public"`
     doc missing from the mirror). The UI layer (`LibrarySaveService`) shows a
     toast.

3. **Explicit make-public blocks (`updateSequence` → covers `setVisibility` /
   `publishSequence`):** changing an already-saved sequence to `public` when it
   is under 4 steps throws a `LibraryError("INVALID_DATA")`. This is an explicit
   publish action, so it blocks with a clear toast rather than silently
   degrading.

4. **Save panel:** `isTooShort` → `isEmptySequence` (Save is enabled for
   1-count). The **Make Public toggle is disabled** when the sequence is under
   `MIN_COMMUNITY_STEPS`, with an inline note ("Needs at least 4 steps to post to
   the community. Saves to your library."). The toggle is also force-cleared if
   the sequence drops under the minimum while the panel is open. The
   degrade+toast in `LibrarySaveService` remains as a backstop for non-panel
   publish paths (forks default to public, programmatic saves).

## Toast copy

- Degraded on save: **"Needs at least 4 steps to post to the community gallery. Saved to your library."**
- Explicit publish of under-4: **"Needs at least 4 steps to post to the community gallery."**

## Existing violations

A read-only audit script (`scripts/diagnostics/audit-community-min-length.ts`)
scans `publicSequences`, reports the count plus the id/word/step-count of every
sub-4 doc. No deletion — Austen purges manually (right-click remove) or approves
a one-shot.

## Tests

`tests/unit/library/sequence-min-length.test.ts` rewritten for the new API:
`isEmptySequence` (0 only), `meetsCommunityMinimum` (≥4 boundary), constants.
