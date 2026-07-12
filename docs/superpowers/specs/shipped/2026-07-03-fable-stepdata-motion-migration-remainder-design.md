# Fable Spec 4 — StepData→Step + MotionData→Motion Migration Remainder

**Date:** 2026-07-03 · **Status: DONE 2026-07-11** — W0 2026-07-05 (`cd2b8ee349`), W1+W2 2026-07-09, remaining slices closed as not-worth-executing 2026-07-11; full record in `2026-07-05-stepdata-migration-checkpoint-package.md` §5-6 · **Autonomy: CHECKPOINT** (highest-blast-radius, most regression-prone subsystem) · Index: `2026-07-03-fable-dispatch-index.md`

> Dispatch context: root cause **B** — this is the migration that has to keep identity/derivation invariants intact across the whole corpus while replacing the core step/motion types. A wrong invariant here silently corrupts letters, dedup verdicts, and hashes; the compiler cannot flag it.

## Problem

The core subtype unification shipped 2026-07-02 (app `StepData`/`MotionData` redefined so absence = an `isVisible:false` static placeholder). The **remainder** is the real migration:

- the full **~235-file replacement** of app `StepData` with the canonical lean `Step`, and
- the sibling **`MotionData` → `Motion` split**,

both of which the original plan flagged as intricate and **not yet safe to execute as written**.

## Evidence (read all four)

- **Conversion plan:** `docs/superpowers/specs/active/2026-06-30-stepdata-step-conversion-plan.md`. Its own **§0 CORRECTION falsifies the plan's premise mid-execution:** _"The 'widening' premise in §1 is WRONG as stated… StepData is NOT assignable to Step… the '~120 files of free widening' does not exist until this is fixed."_ The wave/cluster classifications later in the plan are therefore **suspect until re-validated.**
- **Scope doc:** `docs/superpowers/specs/active/2026-06-30-stepdata-step-migration-scope.md` — notes the `MotionData`→`Motion` split hits _"the most intricate, regression-prone subsystem in the app, with no rendering parity harness."_
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

---

## Progress — 2026-07-05 (analysis + guardrail slice DONE; migration itself still open)

Checkpoint package: `2026-07-05-stepdata-migration-checkpoint-package.md` (same directory).

1. **Corrected analysis re-run at HEAD.** The §0-CORRECTION blocker no longer exists — the
   2026-07-02 unification made `StepData extends Step` / `MotionData extends Motion` by
   declaration, so the plan's waves 1–6 are obsolete as written. Full presence-register
   re-validation (all 110 sites): 85 re-encoded, 5 gone (engine-delegated), 14
   legitimately raw, **6 stragglers** (2 absence-blind in the corruption tier + 4 dead
   gates). MotionData census (168 files): 75 producer / 40 view-reader / 45 structural /
   8 type-only. StepData census (213 files): 78 producer / 40 extras-reader / 49
   structural / 45 type-only.
2. **A/B/C decision: C (data-driven).** B is already shipped as the permanent subtype
   redefinition; A's forced rewrite buys nothing. Remaining migration = Wave 0 straggler
   fixes + Wave 1 free widening (~120 overlapping file-slots) + Wave 2 extras retirement
   (`isStep`/`isSelected`/factory dedup). Render pipeline keeps required view fields —
   named non-goal.
3. **Rendering-parity harness BUILT + COMMITTED** (`tests/render-parity/`,
   `src/lib/shared/render/parity/render-parity-core.ts`). The old pixel page was
   empirically blind to arrows/props (no preparer wired) AND reversal dots (flags
   dropped); the v2 core fixes both, the page now shares it. Automated wave gate:
   `npm run test:render-parity[:capture|:compare]` — capture→compare proved 360/360
   pixel-identical at HEAD; teeth tests prove the reversal/structural/arrow channels
   detect injected drift; failure path writes baseline|current|diff triplets.
4. **Loop-wrap landmine reconciled against Spec 2's canon** (not re-decided): app
   `processReversals` is a thin delegate of engine `deriveReversals(steps, { loop })`
   since `6423f92e2b` — D1's premise is gone.
5. Nets green at HEAD before any wave: presence guards 21/21 · data-parity 0-drift
   (202×8) · roundtrip LOSSLESS (202/2,758×7) · render-parity 360/360 · svelte-check 0/0.

**Open:** execute waves 0–2 after checkpoint approval, each gated by the full net.
