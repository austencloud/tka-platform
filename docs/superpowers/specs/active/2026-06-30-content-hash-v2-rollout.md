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

## What remains (GATED — needs Austen review; touches the corruption core)

### 1. Version-aware fork detection + dedup (the live-core change)

`contentHash` alone is no longer a stable key across versions, so identity
comparisons must carry a version. Persist `contentHashVersion` next to
`contentHash`, and:

- **Fork detection** (`library-repository.ts:~295`): only compare
  `incomingHash !== existingHash` when `incomingVersion === existingVersion`. On
  a **version mismatch**, do NOT fork — the stored doc just predates the current
  hash basis; recompute its hash under the current version and treat equal
  content as the same identity (lazy rehash, below).
- **Dedup** (`hasMatchingContent`, `library-repository.ts:~590`): match within
  the active version; a cross-version lookup must rehash the candidate (or rely
  on the migration having normalized everything to V2).
- **Lazy rehash backstop**: on any load → save, if a doc's
  `contentHashVersion` is below the active version, rewrite its `contentHash` +
  `contentHashVersion` to current in place (a normal field update, NOT a fork).
  This self-heals stragglers the batch migration missed and makes ordering
  forgiving.
- **Write path** (`library-repository.ts:~431`): always persist
  `contentHashVersion: CONTENT_HASH_VERSION` alongside `contentHash`.
- **Public-mirror sync** (`updateSequence`, `library-repository.ts:~670`): mirror
  carries the same version so library + mirror stay comparable.

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
