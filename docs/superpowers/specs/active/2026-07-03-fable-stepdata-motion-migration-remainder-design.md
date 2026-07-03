# Fable Spec 4 — StepData→Step + MotionData→Motion Migration Remainder

**Date:** 2026-07-03 · **Autonomy: CHECKPOINT** (highest-blast-radius, most regression-prone subsystem) · Index: `2026-07-03-fable-dispatch-index.md`

> Dispatch context: root cause **B** — this is the migration that has to keep identity/derivation invariants intact across the whole corpus while replacing the core step/motion types. A wrong invariant here silently corrupts letters, dedup verdicts, and hashes; the compiler cannot flag it.

## Problem

The core subtype unification shipped 2026-07-02 (app `StepData`/`MotionData` redefined so absence = an `isVisible:false` static placeholder). The **remainder** is the real migration:

- the full **~235-file replacement** of app `StepData` with the canonical lean `Step`, and
- the sibling **`MotionData` → `Motion` split**,

both of which the original plan flagged as intricate and **not yet safe to execute as written**.

## Evidence (read all four)

- **Conversion plan:** `docs/superpowers/specs/active/2026-06-30-stepdata-step-conversion-plan.md`. Its own **§0 CORRECTION falsifies the plan's premise mid-execution:** *"The 'widening' premise in §1 is WRONG as stated… StepData is NOT assignable to Step… the '~120 files of free widening' does not exist until this is fixed."* The wave/cluster classifications later in the plan are therefore **suspect until re-validated.**
- **Scope doc:** `docs/superpowers/specs/active/2026-06-30-stepdata-step-migration-scope.md` — notes the `MotionData`→`Motion` split hits *"the most intricate, regression-prone subsystem in the app, with no rendering parity harness."*
- **Presence register:** `docs/superpowers/specs/active/2026-07-01-presence-as-signal-register.md` — 110 sites where "is this motion present?" changes meaning after adoption; a "silent data corruption tier" of 32 sites touching hashing / TnD / loopability / equivalence-dedup where a wrong invariant rewrites letters or flips dedup verdicts.
- **Absence encoding (shipped, the resolved design):** `docs/superpowers/specs/active/2026-07-02-stepdata-step-absence-encoding-design.md` (approach B).

**Landmine — the loop-wrap reversal semantics:** the app `processReversals` has a loop-boundary wrap that the engine `deriveReversals` lacks. Swapping implementations during the migration silently changes reversal dots on the first beats of every loop — which feed the identity hash. Coordinate with Specs 2 and 3.

## What exists

- Absence encoding shipped (see above).
- **Partial parity scaffolding** under `scripts/migrations/`: `step-constructability-check.ts`, `step-roundtrip-parity.ts`, `step-lossy-mutation-test.ts`, `data-parity-guard.ts`. Useful, but **no rendering parity harness** — nothing proves a migrated step renders pixel-identical to the original.

## Fable's task

1. **Re-run the corrected analysis.** The plan's premise was falsified; re-derive which files actually widen freely vs need shape changes, and re-validate the wave/cluster classifications from scratch.
2. **Make the A+B coupling decision** (the plan's explicit open strategic question — see below).
3. **Build a rendering parity harness FIRST** — the missing guardrail. The `MotionData`→`Motion` subsystem is the most regression-prone in the app; do not migrate it without a harness that proves render parity before/after.
4. **Migrate in re-validated waves**, each gated by the parity harness + the constructability/roundtrip scripts.

## Open decisions (left to Fable — the plan's explicit fork)

From the conversion plan's open strategic question, decide before executing:
1. **Merge A + B** (do the `Step` replacement and the `Motion` split together), or
2. **Transitional app-local `Step` shape** (an intermediate type that widens cleanly, migrate in two hops), or
3. **Re-run a corrected analysis** and let the data pick.

## Guardrails + definition of done

- **CHECKPOINT:** present (a) the re-validated file analysis, (b) the A/B/C decision with rationale, and (c) the rendering-parity-harness plan to Austen **before** executing any migration wave.
- Rendering parity harness green before and after every wave.
- Every "silent corruption tier" site from the presence register (identity / derivation / dedup / hashing) explicitly verified — these do not surface to the compiler or the eye.
- Preserve (or deliberately reconcile, in coordination with Specs 2/3) the loop-wrap reversal semantics; a silent change there corrupts identity.
- MCP-ground every domain claim; verify knowledge-base facts at the canonical source.
- Commit own changes only, explicit pathspec; this migration will run alongside other agents — do not sweep unrelated staged work.

## Dependencies

- Shares root cause **B** (identity/derivation) with Spec 3. V2 hashing excludes `gridMode` + reversal flags — know that when reasoning about what the migration may safely change.
- The loop-wrap landmine ties this to Specs 2 and 3. Sequence and coordinate.
