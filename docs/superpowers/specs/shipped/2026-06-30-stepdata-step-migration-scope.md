# StepData → Step Migration — Scope + Plan (Sibling Unification Phase 2)

**Date:** 2026-06-30
**Status:** SUPERSEDED 2026-07-05 by `2026-07-05-stepdata-migration-checkpoint-package.md` (the 2026-07-02 subtype redefinition falsified the A/B split premise; Option C executed instead). Migration closed DONE 2026-07-11.
**Parent spec:** `docs/superpowers/specs/active/2026-04-20-sequence-engine-unification-design.md`
**Parent plan:** `docs/superpowers/plans/active/2026-04-20-sequence-engine-unification-plan.md` (Phase 2 — paths stale; this doc re-grounds them)

## Why this doc exists

The parent plan's Phase 2 ("migrate the app off `StepData`") was written 2026-04-20 against a
file layout that has since moved (`StepData` now lives at
`src/lib/shared/foundation/domain/models/step-data.ts`, not
`features/create/shared/domain/models/StepData.ts`). Phase 1 (engine) is already done — the engine
types file header reads *"Post-unification (Phase 1 complete)"*; `SequenceStep`/`MotionData` are
`@deprecated` aliases of the unified `@tka/tka-types` `Step`/`Motion`. This doc re-scopes Phase 2
against the live codebase (measured 2026-06-30) and splits it into the achievable high-value chunk
(A) and the deferred high-risk chunk (B).

## The single most important finding

Phase 2 is **two migrations**, not one. They have wildly different risk and cost, and the parent
plan conflated them:

### (A) `StepData` → `Step` — the content/editing/engine layer

- **Surface:** `StepData` referenced in 246 files / 1201 occurrences — but the bulk are type
  annotations (`: StepData` → `: Step`), compiler-guided.
- `StepData` already uses the **nested** `step.motions.blue/red` shape (same as `Step`); the feared
  flat-field rewrite mostly does not exist.
- **Real reconciliation work** (fields `Step` lacks that `StepData` carries):
  - `blueReversal` / `redReversal` → derive via `deriveReversals(steps)` (already shipped in
    `@tka/sequence-engine`). **78 occ / 31 files.**
  - `isSelected` → new `selectionStore` (keyed by step id). `isStep` discriminator → delete.
    **8 occ / 7 files.**
  - `category` (skewed mode) / `betaSwapped` (B-key beta swap) — PictographData-only; resolved at
    the render boundary, not stored on `Step` (see adapter below).
- **Difficulty: days.** Bounded, compiler-driven, low render-risk.

### (B) `MotionData` → `Motion` + `MotionView` — the render pipeline

- **Surface:** `MotionData` imported in **106 files**, spanning the entire
  pictograph / arrow-positioning / prop / render pipeline.
- App `MotionData` mixes structural fields with **embedded render data**
  (`arrowPlacementData`, `propPlacementData`, `propType`, `isVisible`, `arrowLocation`, `gridMode`,
  `skewSteps`, `skewDir`, `pathShape`). Engine `Motion` is **lean structural-only**.
- The planned 3-way split (`Motion` / `MotionView` / `MotionWithView` / `DerivedMotionData`) was
  designed but **barely wired — `MotionView`/`DerivedMotionData` appear in only 2 files.**
- Forcing `Step.motions` to lean `Motion` requires finishing this split across all 106 files,
  including the arrow-positioning calculation services (`arrow-location-calculator`,
  `directional-tuple-processor`, `special-placer`, etc.) — the most intricate, regression-prone
  subsystem in the app, with **no rendering parity harness**.
- **Difficulty: weeks. High blast radius. No safety net today.**

## Decision: decouple A from B

`Step`'s structural fields are exactly what the content/editing/engine layer needs. The render data
(`arrowPlacementData`) is **computed downstream by `pictograph-preparer`, not authored on the
step**. Therefore:

- **Execute (A) now**, with a boundary adapter so the render pipeline is untouched: the content
  layer holds `Step`; at the render boundary the existing deriver (`step-deriver` /
  `pictograph-preparer`) produces the renderable form. The render pipeline keeps consuming its
  current `MotionData`-bearing types — zero render-pipeline edits in (A).
- **Defer (B)** to its own gated sub-project, prerequisite: a rendering visual-regression harness
  built first. (B) delivers npm-publishable lean `Motion` end-to-end but is not required for the
  hardening wins.

The hardening payoff — one content type (no drift), reversals derived (can't go stale), selection
out of sequence data — **all lands with (A) alone.**

## Field maps (measured against live code)

### `Step` (target, `@tka/tka-types/src/step.ts`)
`id, letter: Letter|null, startPosition, endPosition, motions: {blue: Motion, red: Motion},
gridMode?, stepNumber, duration, variation?, isBridge?, isBlank?`

### `StepData` (current, `shared/foundation/domain/models/step-data.ts`, extends `PictographData`)
adds: `isStep?, stepNumber, duration, blueReversal, redReversal, isBlank, isSelected?`
inherits from `PictographData`: `id, letter?, startPosition?, endPosition?, motions: Partial<...>,
gridMode?, category?, betaSwapped?`

### Reconciliation
| StepData/PictographData field | Step | Resolution |
|---|---|---|
| id, letter, startPosition, endPosition, gridMode, stepNumber, duration, isBlank | ✓ | keep |
| motions: `Partial<Record<MotionColor, MotionData\|undefined>>` | `{blue, red}` required | tighten; guard undefined at construction (most sites already do) |
| blueReversal / redReversal | ✗ | `deriveReversals(steps)` |
| isSelected | ✗ | `selectionStore` |
| isStep | ✗ | delete (discriminator) |
| category / betaSwapped | ✗ | render-boundary adapter (render concern, not content) |

## Plan — sub-migration A

> Subagent-driven, compiler-gated. Each module = one green commit (explicit pathspec, own files
> only — shared `main`, parallel agents). Inner loop: `npm run check:watch`; gate: one full
> `npm run check` before each commit.

### Prerequisite — tree hygiene
- Commit the in-flight beat→step safe-tier batch first (own files only, explicit pathspec) so (A)'s
  per-module commits stay independently revertible. Requires Austen's go-ahead (commits were held).

### A.0 — Foundation (bounded, low-risk, this is where execution starts)
1. **`selectionStore`** (TDD) — `src/lib/shared/create/state/selection-store.svelte.ts`. Svelte 5
   runes, keyed by step id: `select(id, {additive})`, `deselect`, `clear`, `isSelected`.
   Discovery first (grep existing `isSelected` patterns).
2. **`deriveReversals` app wiring** — re-export/consume the engine's `deriveReversals` at the app
   boundary; one helper that maps a `Step[]` → reversal flags for the 31 reader files.
3. **`stepToRenderable` boundary adapter** — `Step` (+ presentation) → existing renderable type, so
   the render pipeline is untouched in (A).

### A.1..A.n — Module migration (per-module commits)
Order leaf→core so each commit compiles. Representative dense modules:
`shared/create/services/*` (step-transforms 25, reversal-detector 13, sequence-transforms 18),
`create/shared/components/sequence-actions/StepEditorPanel.svelte` (29),
`create/shared/state/operations/sequence-step-operations.ts` (12),
`choreo-card/services/*`, `loop-labeler/services/*`, `sequence-viewer/*`.
Per module: swap `StepData`→`Step` types; route reversal reads to `deriveReversals`; route
`isSelected` to `selectionStore`; drop `isStep`; render sinks go through `stepToRenderable`.
`npm run check` green → commit.

### A.final — delete `StepData`
When `grep StepData src/lib` is empty (excluding the file), delete `step-data.ts` +
`create-step-data` factories (or repoint to `createStep`). Full `check` + `build` + app smoke
(author a sequence, edit a step, save, open viewer).

### Verification per module
`npm run check` clean (no new errors); existing tests green; no string/UI-copy edits (this is a
type migration). App-boot smoke at A.final.

## Deferred — sub-migration B (tracked, not started)
Build a rendering visual-regression harness (pictograph PNG pixel-diff over a fixture set) FIRST,
then migrate the 106 `MotionData` files to lean `Motion` + wire `MotionView`/`DerivedMotionData`
through the arrow-positioning/prop/render pipeline. Weeks; own plan; gated on the harness.

## Risks
- **Render drift from (A)'s adapter** — mitigated: render pipeline types unchanged in (A); adapter
  feeds the existing deriver.
- **Dirty shared tree** — mitigated: commit own batch first; per-module pathspec commits.
- **`Step` immutability/missing-field compile storm** — expected and wanted; tsc surfaces every
  site; each is a real decision, not blind sed.
- **Scope creep into (B)** — guarded: any edit to an arrow-positioning/render file in (A) is a
  smell; (A) touches content/editing/engine + the single boundary adapter only.
