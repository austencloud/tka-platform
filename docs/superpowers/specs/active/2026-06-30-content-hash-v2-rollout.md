# Content-Hash V2 Rollout (Option A) — Spec

> Status: **mechanism built + proven, live-core wiring + migration GATED on
> Austen.** Implements Option A from the reversal findings
> (`2026-06-30-reversal-derivation-reconciliation-findings.md`): exclude
> round-trip-derived fields from the identity hash so re-derivation can't change
> identity, killing the phantom-fork-on-resave.

## Goal

A sequence's `contentHash` (the SHA-256 identity used by fork detection + dedup)
must be **invariant under `hydrate()`**. Today it includes `blueReversal`,
`redReversal`, and `gridMode` — all re-derived on every load — so a plain
load → "Save to library" can mint a different hash than the stored one and
**fork the doc** with no user edit. V2 drops exactly those three fields.

## What's built this session (safe, committed, zero runtime change)

- **V2 hasher** — `sequence-content-hasher.ts`. `computeHash(seq, version?)`;
  `HASH_VERSION_V1` / `HASH_VERSION_V2`; `CONTENT_HASH_VERSION` (the active
  version) **stays at V1**, so production behavior is byte-identical. V2 is
  reachable only by explicit argument (migration + tests).
- **Proof** — `tests/unit/content-hash-v2-fork-proof.test.ts` (7 tests, green):
  - FORK-PROOF: flipping a reversal flag or `gridMode` changes V1 but **not** V2;
    a real motion change (turns) changes both.
  - COLLISION-SAFE over the 460-seq corpus: distinctV1=460, distinctV2=459,
    **falseMerges=0**. The single V2 merge (`QΛ` ↔ `QΛQΛQΛQΛ`) shares one physical
    motion fingerprint — a genuine duplicate V1 split on a stale derived field
    that V2 correctly unifies. V2 never merges physically-distinct sequences,
    because every reversal *variant* already differs in flipped motion content
    (`reversal-seed-service.ts`).
  - V1 byte-stability lock (golden hash) so V1 can never silently drift.
- **Migration** — `scripts/migrations/rehash-content-v2.ts` (dry-run default;
  recomputes `contentHash` under V2 + sets `contentHashVersion: 2` across user
  library, public mirror, and system catalogs).

## Step 1 — version-aware fork detection + lazy rehash — BUILT (default-inert at V1)

Done this pass (commit alongside this spec update). Inert while
`CONTENT_HASH_VERSION === V1`; activates when flipped to V2.

- **Pure decision** — `fork-decision.ts` `decideFork()`. On a version mismatch
  it recomputes the stored content's hash at the active version (via an injected
  closure) so a basis change never looks like a content change; a real edit
  still forks. Unit-tested: `tests/unit/library/fork-decision.test.ts` (7 green,
  incl. the cross-version "bump ≠ fork" and "edit still forks" cases).
- **Fork detection** (`library-repository.ts` saveSequence) now calls
  `decideFork`; at V1 with no stored version it is byte-identical to the prior
  behavior (no recompute path taken).
- **Lazy rehash backstop**: the update branch's write path already persists
  `contentHash: incomingHash` (active basis) + the new
  `contentHashVersion: CONTENT_HASH_VERSION`, so a cross-version doc self-heals
  to the active version on its next save — no fork.
- **Persisted field**: `contentHashVersion` added to the write, the
  `LibrarySequenceDocSchema` (passthrough; now first-class optional), and the
  `LibrarySequence` model.
- **Not changed**: `hasMatchingContent` / dedup query still matches on
  `contentHash` alone — correct once the migration normalizes everything to V2;
  the only pre-migration gap is a temporary missed-dup (a duplicate, never
  corruption). `updateSequence` does not touch `contentHash`, so it needs no
  change.

## What remains (GATED — needs Austen creds / deploy)

### 2. Run the migration

`npx tsx scripts/migrations/rehash-content-v2.ts --apply` (needs prod Firestore
admin — Austen). Eagerly rewrites every doc to a V2 hash + version 2.

### 3. Flip the active version

Set `CONTENT_HASH_VERSION = HASH_VERSION_V2` and deploy.

## Rollout ordering (prevents mass-fork + client/migration race)

1. **Ship step-1 (version-aware fork detection + lazy rehash) with
   `CONTENT_HASH_VERSION` still V1.** App now tolerates a `contentHashVersion`
   field and never forks on version mismatch. No behavior change yet (everything
   is V1).
2. **Run the migration (step 2).** Stored hashes move to V2 + version 2. A
   still-V1 client that reads a V2 doc and saves does **not** fork — the
   version-aware guard sees the version gap and lazy-rehashes/compares within
   version. (Offline/old clients are covered by the same guard.)
3. **Flip to V2 + deploy (step 3).** Active basis is now V2; lazy rehash mops up
   any unmigrated stragglers on access.

Doing step 1 before step 2 is what makes the whole thing race-free. The migration
script's header repeats this.

## Why not just exclude the fields and migrate (no versioning)?

Without a version, the window between "V2 app deploys" and "migration completes"
(and any offline client on the old basis) mass-forks: `incomingHash(V2) !=
existingHash(V1)` for every unmigrated doc. Versioning + lazy rehash removes the
race entirely and is the standard content-addressable migration pattern.

## Scope notes

- **Identity hash only.** The render-cache key `hashSequenceContent`
  (`content-hasher.ts`) is intentionally left including reversal flags — when the
  dots change, the rendered card changes, so the cache *should* invalidate. Only
  `computeHash` (fork/dedup identity) changes.
- **Not in scope:** the detector's missed *hand* reversals (under-detection — a
  separate correctness track, Option C in the findings) and Option B (stop
  overriding stored flags on read). This rollout fixes identity/fork only.

## Risk + rollback

- The live change is confined to identity/fork comparison + an added persisted
  field. Until step 3, `CONTENT_HASH_VERSION` is V1 and outputs are unchanged;
  step 1 is inert behavior with all-V1 data.
- Rollback: revert the flip (step 3) — lazy rehash + version-aware compare keep
  mixed-version data consistent, so a downgrade does not fork.
- The migration is idempotent and re-runnable; dry-run first.
