# Fable Spec 3 — Content-Hash V2 Gated Rollout (Execution)

**Date:** 2026-07-03 · **Autonomy: CHECKPOINT before any prod write → after Austen's go, execute end-to-end including the prod migration** · Index: `2026-07-03-fable-dispatch-index.md`

> Dispatch context: root cause **B** — round-trip-derived fields (reversal flags, `gridMode`) live inside the identity hash, so a sequence's identity is load-path- and algorithm-dependent. This spec ships the already-decided, already-built fix.

## Problem (verified, measured)

Reversal flags and `gridMode` are **recomputed on every load** (`hydrate()` overrides stored flags via `processReversals`) but are **serialized into the identity hash** (`hashSequenceContent` in `content-hasher.ts:124-125`; `computeHash` in `sequence-content-hasher.ts:62-63,67`). So:

- Load → hydrate recomputes flags Y that differ from the doc's authored flags X on **133/460 published sequences (28.9%)**.
- Resave ("Save to library", no motion edit) → `computeHash` hashes the Y-flag steps → `incomingHash(Y) !== existingHash(X)` → **fork detection creates a new UUID doc, `source:"forked"`, default `visibility:"public"`** while the toast still reads "Saved." This is a **phantom-fork-on-resave** that corrupts published identity with no user edit.

Full analysis + line-level evidence: `docs/superpowers/specs/active/2026-06-30-reversal-derivation-reconciliation-findings.md`.

## Decision (locked — do not re-litigate)

**Option A: exclude round-trip-derived fields (reversal flags + `gridMode`) from the identity hash.** This kills the phantom fork and makes derived reversals byte-stable by construction. Austen chose A on 2026-06-30.

## What's already built (inert; default is still V1 — zero runtime change today)

- **V2 hasher** behind a version constant — `sequence-content-hasher.ts`.
- **Fork-proof + collision-safe proof** — `tests/unit/content-hash-v2-fork-proof.test.ts` (7 tests: V2 invariant under re-derivation; 0 false merges over the corpus; V1 golden-locked).
- **Migration script** — `scripts/migrations/rehash-content-v2.ts` (dry-run default) + `scripts/migrations/smoke-v2-fork-safety.ts`.
- **Rollout spec (authoritative for the ordering):** `docs/superpowers/specs/active/2026-06-30-content-hash-v2-rollout.md`.

## Fable's task — execute the rollout per the rollout spec

The correct, race-safe 3-step ordering (do NOT reorder):

1. **Ship version-aware fork detection while the active basis is still V1.** Fork detection must compare like-for-like: an unmigrated V1 doc must still match its own V1 hash during the window. Without this, the interval between "V2 app deploys" and "migration completes" (plus any offline client still on V1) **mass-forks** — `incomingHash(V2) != existingHash(V1)` for every unmigrated doc.
2. **Run the migration** over the corpus (933 docs) to rehash on the V2 basis.
3. **Flip the active version to V2.**

Before the flip, re-prove collision-safety on the current corpus (the built test asserts `distinctV2=459`, `0` false merges) — never merge two physically-distinct sequences.

## Open decisions (left to Fable)

- Migration strategy: eager batch vs lazy-rehash-on-read, and batch/backup mechanics.
- Exact deploy-window handling for offline clients still on the V1 basis.
- When to flip (after what proportion migrated / what verification gate).

## Guardrails + definition of done

- **CHECKPOINT:** present the executable rollout plan + the pre-migration proofs (collision-safety counts, dry-run diff over the corpus) to Austen and get explicit go **before any prod write**. Prod credentials live in Austen's environment.
- Dry-run first; back up the corpus before any write.
- Post-migration: re-run `content-hash-v2-fork-proof.test.ts` + `smoke-v2-fork-safety.ts`; report counts (docs migrated, forks-prevented, 0 false merges).
- Irreversible over 933 docs — treat ordering as load-bearing, not advisory.

## Dependencies

- **Blocks Spec 2's enablement.** Spec 2 (hand-arc detector) increases reversal dots; those are only identity-safe once V2 has removed reversal flags from the hash. Land this first.
- Shares root cause **B** with Spec 4 (both touch identity/derivation). `gridMode` is the other derived field in the hash — Spec 4's migration work should be aware V2 excludes it.
