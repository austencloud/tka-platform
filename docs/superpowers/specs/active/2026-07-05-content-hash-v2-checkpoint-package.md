---
status: active
value: 3
effort: L
remaining: "Unscored until triage 2026-07-25; spec body carries no status line. Needs a read-through to establish real state before this score is trusted."
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Content-Hash V2 — Checkpoint Package (Analysis/Proof Phase)

**Date:** 2026-07-05 · **Author:** Fable 5 dispatch (Spec 3, `2026-07-03-fable-content-hash-v2-rollout-execution-design.md`) · **Prod writes in this session: ZERO** (all corpus access read-only, proven below)

---

## 0. Ground truth first: the rollout was ALREADY EXECUTED on 2026-06-30

The dispatch spec (staged 2026-07-03, commit `c16e8a0db4`) describes the V2 hasher as
"inert behind a version constant, default still V1." That was stale at staging time.
Git history on current main:

| When (CDT) | Commit | What |
|---|---|---|
| 2026-06-30 14:10 | `e7331c42c1` | V2 hasher + fork-proof tests + migration script, default-off |
| 2026-06-30 16:08 | `d814ad76d3` | **Step 1** — version-aware fork detection + lazy rehash (inert at V1) |
| 2026-06-30 16:24 | `81f72d2457` | Adversarial-review hardening (cross-version recompute mirrors read path; syncer/backfills persist version) |
| 2026-06-30 22:30 | `4a9b8e872c` | **Steps 2+3** — migration applied (933 docs, 0 failed) and `CONTENT_HASH_VERSION` flipped to V2 |
| 2026-07-03 15:18 | `c16e8a0db4` | Dispatch spec staged — 3 days after the flip |

At HEAD, `sequence-content-hasher.ts:51` reads `export const CONTENT_HASH_VERSION = HASH_VERSION_V2;`
and the rollout spec (`2026-06-30-content-hash-v2-rollout.md`) records all three steps DONE.

**So this package pivots from "pre-migration checkpoint" to "post-execution verification +
decision audit":** everything the checkpoint was supposed to prove *before* the migration
has been re-proven *on the live post-migration corpus*, which is the strictly stronger claim.
No further prod action is required. **Spec 3 should be marked complete in the Fable dispatch
index, which unblocks Spec 2 (hand-arc detector) per its dependency note.**

---

## 1. Proofs (all outputs from this session, 2026-07-05)

### 1.1 Identity-hash test suites — 38/38 green on current main

```
npx vitest run --config tests/config/vitest.config.ts \
  tests/unit/content-hash-v2-fork-proof.test.ts \
  tests/unit/library/SequenceContentHasher.test.ts \
  tests/unit/library/content-hash-duplicate.test.ts \
  tests/unit/library/fork-detection.test.ts \
  tests/unit/library/fork-decision.test.ts

 ✓ tests/unit/library/content-hash-duplicate.test.ts (11 tests)
 ✓ tests/unit/library/fork-decision.test.ts (7 tests)
 ✓ tests/unit/library/SequenceContentHasher.test.ts (5 tests)
 ✓ tests/unit/library/fork-detection.test.ts (7 tests)
 ✓ tests/unit/content-hash-v2-fork-proof.test.ts (8 tests)

 Test Files  5 passed (5)
      Tests  38 passed (38)
```

Includes the V1 golden byte-stability lock (`8ac242e7…`), the cross-version
"bump ≠ fork / edit still forks" decision tests, and the hydrate→V2 determinism test.

### 1.2 Collision analysis on the real corpus — expected numbers confirmed exactly

From the fork-proof suite's corpus test (460-doc published snapshot,
`static/data/snapshots/public-sequences.json`):

```
collision-safety: analyzed=460 distinctV1=460 distinctV2=459 merges=1 falseMerges=0
  merge: words=QΛ,QΛQΛQΛQΛ fingerprints=1
```

- `distinctV2 = 459`, `falseMerges = 0` — exactly the values the dispatch spec requires.
- The single merge (`QΛ` ↔ `QΛQΛQΛQΛ`) shares **one** physical motion fingerprint:
  a genuine duplicate that V1 split on a stale derived field. V2 unifying it is
  correct dedup, not a false merge. V2 never merges physically-distinct sequences.

### 1.3 Dry-run corpus diff — post-migration steady state, zero V1 stragglers

`rehash-content-v2.ts` is **proven read-only in dry-run by code**: its only write is
`d.ref.update(...)` at line 95, gated on `if (APPLY)`; `APPLY` is true only with the
`--apply` flag (line 46). Run without `--apply` (mirroring the executed migration's
`TKA_ADMIN=1` admin-SDK environment):

```
$env:TKA_ADMIN='1'; npx tsx scripts/migrations/rehash-content-v2.ts --skip-catalogs

via admin — DRY-RUN — target identity-hash V2
──────── user library (users/PBp3GSBO6igCKPwJyLZNmVEmamI3/sequences) ────────
  scanned=483 would: rewritten=0 unchanged=483 failed=0
──────── public mirror (publicSequences) ────────
  scanned=453 would: rewritten=0 unchanged=452 failed=0
(systemCatalogs skipped via --skip-catalogs)
═══ TOTAL: scanned=936 would-rewrite=0 unchanged=935 failed=0 ═══
```

Reading of this result:

- **would-rewrite = 0** — every hydratable doc in prod already carries the V2 hash +
  `contentHashVersion: 2`. The "which docs change hash" diff is **empty**; the
  pre-migration equivalent (133/460 published docs re-derive differently, 28.9%) is
  recorded in `2026-06-30-reversal-derivation-reconciliation-findings.md` and was
  consumed by the executed migration.
- Corpus grew 933 → 936 since the 06-30 migration; the new docs are already V2,
  proving the **live write path persists the version correctly** for new saves.
- **Zero V1-basis docs also means no offline-V1 client has forked anything in the
  5 days since the flip** — a V1-basis fork would surface here as `would-rewrite ≥ 1`.
- The 1 scanned-but-unchanged-gap doc is identified in §1.5 (hash-less, motion-less; inert).

### 1.4 Full-live-path fork-safety smoke — ENTIRE corpus, zero would-fork

`smoke-v2-fork-safety.ts` contains **zero write calls** (only `.get()` + local hash
computation; exits 1 on any fork risk). `--limit 500` covers every doc in both
collections, so this is the full corpus, not a sample:

```
$env:TKA_ADMIN='1'; npx tsx scripts/migrations/smoke-v2-fork-safety.ts --limit 500

via admin — V2 fork-safety smoke — limit 500/collection
──────── user library (sampling 483) ────────
  checked=483 would-fork-on-resave=0
──────── public mirror (sampling 453) ────────
  checked=452 would-fork-on-resave=0
═══ TOTAL checked=935 would-fork-on-resave=0 ✅ NO FORKS ═══
```

For all 935 docs: `stored contentHash === migration-basis V2 hash === live-read-path V2
hash`. The phantom-fork-on-resave is dead corpus-wide, verified through the same
mapDoc→hydrate funnel `saveSequence` uses.

### 1.5 Residual diagnostics (read-only script, this session)

```
via admin — read-only residual check
systemCatalogs parent docs: 0
user library: total=483 deleted=0 noMotion=0
public mirror NO-MOTION-skip: 4def1d13-144f-4016-a1f8-f19ba2a1c950
  word=Y-Σ-ZΘY-Σ-ZΘY-Σ-ZΘY-Σ-ZΘ hasHash=false ver=none
public mirror: total=453 deleted=0 noMotion=1
```

- `systemCatalogs` is still **empty** (matches migration-time state). When the
  deck-enumerator corpus eventually persists there, its writers must set
  `contentHashVersion: 2` — `public-index-syncer` + both backfill scripts already do
  (hardened in `81f72d2457`); any *new* seeding script must follow suit.
- The single scanned-but-skipped mirror doc (`4def1d13-…a1c950`) has **no contentHash
  and no motion data**. It participates in neither fork detection nor dedup (both key
  off `contentHash`), so it is inert for identity — but it is cruft: a published doc
  that cannot render. Recommend routing to the cruft-cleanup track (verify-before-delete).

### 1.6 Live wiring intact at HEAD (post July hardening waves #23/#27)

- `library-repository.ts:311` — `saveSequence` calls `decideFork` (version-aware compare).
- `library-repository.ts:474` — update path persists `contentHashVersion: CONTENT_HASH_VERSION`
  (the lazy-rehash backstop).
- `library-schemas.ts:76` + `library-sequence.ts:133` — field is first-class optional.

---

## 2. The 3-step rollout plan (canonical, annotated with execution evidence)

Retained both as the audit record and as the **template for any future basis change
(V2→V3)**. Ordering is load-bearing; do not reorder.

### Step 1 — Ship version-aware fork detection while the active basis is still OLD

Fork detection must compare like-for-like: on a stored-vs-active version mismatch,
recompute the stored content's hash at the incoming version (`decideFork`,
`fork-decision.ts`) so a basis change never reads as a content change, while a real
edit still forks. Persist `contentHashVersion` on every write (lazy-rehash backstop).
Deploy this with the active version UNCHANGED — the code is inert until versions mix.

> Executed: `d814ad76d3` + hardening `81f72d2457`, deployed to prod (CF Pages
> `2d131e35`) before any data moved. Unit-proven by
> `tests/unit/library/fork-decision.test.ts` (7 tests, incl. cross-version
> "bump ≠ fork" and "edit still forks").

*Why this must come first:* without it, the window between "new-basis app deploys" and
"migration completes" (plus any offline client on the old basis) mass-forks —
`incomingHash(new) !== existingHash(old)` for every unmigrated doc.

### Step 2 — Migrate the corpus (eager batch, idempotent, dry-run first)

`TKA_ADMIN=1 npx tsx scripts/migrations/rehash-content-v2.ts` (dry-run) → review
counts → same command `--apply`. Per-doc field update (`contentHash` +
`contentHashVersion`), skips deleted/unhydratable docs, idempotent (re-run converges
to `would-rewrite=0`).

> Executed 2026-06-30: 933 docs rewritten (user library 481 + public mirror 452),
> 0 failed; read-only re-run confirmed `unchanged=933, would-rewrite=0`.
> Re-confirmed this session at 936 docs, `would-rewrite=0` (§1.3).

### Step 3 — Flip the active version, gated on verification

Flip `CONTENT_HASH_VERSION` only after the gate in §3.4 passes. Lazy rehash mops up
any straggler on next access. Rollback = revert the flip; version-aware compare keeps
mixed-version data consistent in both directions, so a downgrade also cannot fork.

> Executed 2026-06-30 22:30 (`4a9b8e872c`) after: migration re-run showed 0
> would-rewrite, all 38 identity tests green, canary tests re-pointed to dual-basis
> assertions, adversarial 4-lens verification recorded in the rollout spec.

---

## 3. Open decisions — resolved, with rationale

The dispatch spec left three decisions to this phase. The executed rollout implicitly
chose answers; here is the explicit audit — **all three executed choices were correct**,
with one belt-and-braces addition recommended for future migrations (§3.2).

### 3.1 Migration strategy: eager batch vs lazy-rehash-on-read → **HYBRID (eager batch + lazy backstop)** ✅ as executed

- **Eager batch wins at this scale.** 933 docs is a single-writer, seconds-long,
  idempotent pass. Lazy-only would leave the corpus mixed-version indefinitely
  (rarely-loaded and never-reloaded docs stay V1 forever), and dedup
  (`hasMatchingContent`) matches on `contentHash` alone — a mixed-basis corpus
  silently misses duplicates until every doc migrates. Eager migration collapses
  that missed-dup window to hours.
- **But lazy-rehash must exist anyway** — it is what makes the deploy window and any
  future rollback race-free (§3.3). It costs nothing extra: it's the same
  version-aware write path Step 1 ships.
- **Batch mechanics:** plain per-doc `update()` — no Firestore batching/transactions
  needed for a two-field, conflict-free write at 10³ scale. Skip-deleted +
  skip-unhydratable + idempotence make re-runs safe. This was proportionate; adding
  BulkWriter/chunked commits would be gold-plating at this corpus size (revisit only
  if `systemCatalogs` fills with the 53k deck corpus).

### 3.2 Backup mechanics → **recomputability IS the backup here; add `gcloud firestore export` only for non-recomputable migrations**

The migration overwrites exactly two fields, and the old value (`contentHash` at V1)
is a **pure deterministic function of data the migration does not touch** — re-derivable
at any time via `computeHash(seq, HASH_VERSION_V1)`. The V1 golden byte-stability test
locks that function against drift. A field-level backup would therefore have duplicated
information that cannot be lost; skipping it was sound, and rollback is structural
(revert the flip; lazy rehash re-converges) rather than restore-from-backup.

For **future** migrations that overwrite fields NOT recomputable from retained data,
the mechanic is: `gcloud firestore export gs://<bucket>/pre-<migration>-<date>`
(managed export, point-in-time, restorable per-collection) taken immediately before
`--apply`. Recommend adding that one-liner to the migration-script header template.

### 3.3 Offline-V1-client deploy-window handling → **version-aware compare + lazy rehash; residual empirically zero**

Two client classes during the window:

1. **Clients on the Step-1 app (version-aware) but V1 basis** — fully covered by
   design: `decideFork` sees the version gap, recomputes on the stored basis, and the
   write path lazy-rehashes the doc to the active version. No fork possible.
2. **Stale bundles predating Step 1** (e.g. a PWA/tab loaded before 2026-06-30 16:08
   that saves after the migration) — the one true residual: old code compares its V1
   `incomingHash` against the stored V2 hash and forks. This window cannot be closed
   client-side by any ordering; it can only be measured and, if needed, repaired.
   - **Detection signal:** any V1-basis doc appearing post-migration → shows up as
     `would-rewrite ≥ 1` in a dry-run re-run (plus `source:"forked"` on the doc).
   - **Empirical result (this session, 5 days post-flip):** `would-rewrite = 0` over
     all 936 docs. **Zero stale-bundle forks occurred.** The residual was accepted and
     the bet paid off; no repair needed.
   - **Ongoing guard:** the dry-run re-run doubles as the monitor — cheap to re-run
     any time (§4).

### 3.4 When to flip (verification gate) → **binary gate, all four required** ✅ as executed

1. Migration dry-run re-run reports `would-rewrite=0, failed=0` (corpus fully converged).
2. Full identity-hash suite green (all 5 files / 38 tests), including the
   cross-version fork-decision cases and the V1 golden lock.
3. Read-only fork-safety smoke over real prod docs: `would-fork-on-resave=0`
   (`smoke-v2-fork-safety.ts` — full live-path check, not just the hash function).
4. Version-aware code (Step 1) verifiably deployed to prod first.

Proportion-migrated thresholds ("flip at 95%") are the wrong shape for this corpus:
at 10³ docs the migration is atomic-in-practice and the gate can simply demand 100%
convergence. The executed flip satisfied all four legs same-day; all four re-verified
green in this package (§1).

---

## 4. Re-verification one-liners (for any future re-check)

```powershell
# 38 identity tests + corpus collision analysis (offline, no credentials)
npx vitest run --config tests/config/vitest.config.ts tests/unit/content-hash-v2-fork-proof.test.ts tests/unit/library/SequenceContentHasher.test.ts tests/unit/library/content-hash-duplicate.test.ts tests/unit/library/fork-detection.test.ts tests/unit/library/fork-decision.test.ts

# Corpus convergence monitor (read-only; expects would-rewrite=0)
$env:TKA_ADMIN='1'; npx tsx scripts/migrations/rehash-content-v2.ts --skip-catalogs

# Full-live-path fork-safety smoke (read-only; expects 0 forks, exit 0)
$env:TKA_ADMIN='1'; npx tsx scripts/migrations/smoke-v2-fork-safety.ts --limit 500
```

---

## 5. Follow-ups (none block anything)

1. **Mark dispatch Spec 3 complete** in `2026-07-03-fable-dispatch-index.md` — the
   spec's premise ("inert, default V1") was stale at staging; execution finished
   2026-06-30. This **unblocks Spec 2** (hand-arc detector), which was gated on V2.
2. **Cruft doc:** `publicSequences/4def1d13-144f-4016-a1f8-f19ba2a1c950` — published,
   hash-less, motion-less; can't render or dedup. Route to cruft cleanup
   (verify-before-delete applies).
3. **Future `systemCatalogs` writers** must persist `contentHashVersion: 2` when the
   deck corpus lands there (existing syncer/backfills already do).
4. **Migration template:** add the `gcloud firestore export` pre-`--apply` line for
   future migrations that overwrite non-recomputable fields (§3.2).
