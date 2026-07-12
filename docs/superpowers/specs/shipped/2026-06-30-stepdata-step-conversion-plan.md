# StepData → lean Step Conversion Plan (sub-migration A: TYPE migration)

> **SUPERSEDED 2026-07-05** by `2026-07-05-stepdata-migration-checkpoint-package.md` — the 2026-07-02 subtype redefinition (`StepData extends Step`) made this plan's waves 1-6 and assignability analysis obsolete. Kept for lineage. Migration closed DONE 2026-07-11 under Option C.

**Date:** 2026-06-30
**Scope:** Replace the app's `StepData` (`src/lib/shared/foundation/domain/models/step-data.ts`, `extends PictographData`) with the canonical lean `Step` from `@tka/tka-types`, **type-only**. Reversal-logic, render-cache authoring, and serialization-shape unification are explicitly **deferred** to later sub-projects (migration B).
**Inventory:** 235 files touched / flagged. 111 landmine findings.
**Bridge:** `src/lib/shared/foundation/domain/adapters/step-bridge.ts` (`stepDataToStep` / `stepToStepData` / `motionDataToMotion` / `motionToMotionData`) already exists and is the seam every wave leans on.

---

## 0. CORRECTION (2026-06-30, empirical — first cluster failed `npm run check`)

The "widening" premise in §1 below is **WRONG as stated.** Attempting the first safe
cluster (comparison trio) and running `npm run check` proved:

1. **`StepData` is NOT assignable to `Step`.** `StepData.motions` is
   `Partial<Record<MotionColor, MotionData | undefined>>` (optional); `Step.motions` is
   `{ blue: Motion; red: Motion }` (required). So retyping a consumer `StepData → Step`
   does **not** keep callers green — every caller passing `StepData`/`SequenceData.steps`
   (`StepData[]`) fails `Argument of type 'StepData' is not assignable to 'Step'`. The
   "~120 files of free widening" does not exist until this is fixed.
2. **`Step.motions` is lean `Motion`.** Adopting `Step` forces lean `Motion` on any
   consumer that touches a motion. The comparison trio broke feeding lean `Motion` into
   `motion-signature-generator.generateSignature(m: MotionData)` — a **non-render**
   `MotionData` sink. So "keep render boundaries on StepData" does NOT cover all the
   coupling; `MotionData` is the app's universal motion type, used well beyond render.

### Corrected enabler (real Wave 0, prerequisite to ALL widening)

- **Tighten `StepData.motions` to required `{ blue: MotionData; red: MotionData }`.** Since
  `MotionData` ⊇ `Motion`, a required-`MotionData` motions record IS assignable to `Step`'s
  required-`Motion` record → `StepData` becomes assignable to `Step` → widening compiles.
  Touches `create-step-data.ts` (×2 copies) `motions: {} ` default + any partial-motion
  build site. Dead `if (!blueMotion) throw` guards become harmless. VERIFY first: is a
  partial/empty-motions `StepData` ever a real persisted state, or only transient
  scaffolding? (Defensive guards exist, suggesting it's at least a transient state.)
- **Structural-only `MotionData` siblings join the cluster.** `motion-signature-generator`
  reads only structural fields — widen it to accept `Motion` so the comparison cluster is
  **4 files, not 3**. Re-validate every "safe" Wave-1 file under BOTH constraints:
  (a) reads structural-only, AND (b) never passes a motion to a `MotionData`-typed sink
  or reads a render field. The inventory only checked (a)-ish.

### Open strategic question (coupling of A and B)

Because `Step` mandates lean `Motion`, sub-migration A (StepData→Step) is **more coupled**
to migration B (MotionData→Motion split) than this plan assumed. Decide before resuming:
(1) merge A+B; (2) transitional app-local Step shape that keeps `MotionData` motions, defer
lean `Motion` to B; or (3) re-run a corrected analysis to size the genuinely-safe set.
The wave/cluster classifications below are **suspect** until re-validated under §0.

---

## 1. The real shape of this migration

This is **not** a find-and-replace. It is a directed conversion where the type system already does most of the load-bearing safety work, because of one asymmetry:

> `StepData` is a **superset** of lean `Step` (it carries every structural field plus reversal flags, selection, the `isStep` discriminator, and an embedded per-motion render cache). Therefore a function whose parameter is retyped `StepData → Step` **still accepts the StepData a producer hands it** (widening is safe). The break only happens in the other direction — when a *producer* stops emitting the extra fields, or when a *consumer* reads one of the dropped fields.

That asymmetry dictates the wave order:

1. **Consumers first (widen).** Retyping a read-consumer / type-only annotation to accept `Step` compiles immediately while every producer still emits the `StepData` superset. These are independent and parallelizable — the bulk of the 235 files.
2. **Isolated structural producers/mutators next.** Files that build steps via `createStep`/spread and only touch structural Motion fields, and are not wired into the central `SequenceData.steps` type.
3. **Core hub last.** `step-data.ts`, `create-step-data.ts`, `SequenceData.steps`, `step-deriver` — flipping these forces every still-StepData consumer to be ready. This wave is gated on every render/reversal/serialization boundary already being **bridged**, not converted.

Three boundaries never convert in sub-migration A; they stay on `StepData` and receive a **bridged** value:

- **Render boundary** — `PictographContainer` and everything downstream of it (lean `Step` is not a `PictographData`; reversal dots + manual arrow nudges live in the render cache).
- **Reversal pipeline** — `reversal-detector.processReversals` and its LOOP-WRAP semantics (engine `deriveReversals` lacks the wrap; swapping silently changes reversal dots on the first beats of every loop).
- **Serialization / identity** — `sequence-content-hasher` (×2), `content-hasher`, `extractStepPairings`, `StepDataSchema` (persisted contentHash, Firestore stepPairings, localStorage, PNG/QR wire).

**Effort:** ~7 waves. Waves 1–2 are large but mechanical and high-parallelism (≈120 files of widening + isolated structural conversion). Wave 3 (circular LOOP cluster, ~24 files) and Wave 4 (step-operations cluster) are atomic and medium-risk. Waves 5–6 are the core seam and require the bridge to be provably upstream of every deferred boundary. Wave 7 is the deferred render/reversal/serialization work that does **not** ship in this sub-migration.

---

## 2. Waves table

| Wave | Cluster theme | Risk | Convert action | Gate |
|---|---|---|---|---|
| 1 | Structural read-consumers + union-widening (`StartPositionData \| StepData` → add `Step`) | safe | Retype params/props to accept `Step`; no field reroute | Producers still emit StepData superset |
| 2 | Isolated structural producers/mutators (no central-type coupling) | safe→medium | Build via `createStep` / retype; structural Motion fields only | Each file file-disjoint or small lockstep |
| 3 | Circular LOOP executor contract (`ILOOPExecutor` + executors + composers + orientation-calculator + `compositional-utils`) | medium | Atomic `StepData[]→Step[]` swap across the whole contract | `rewound` reversal swap → defer to downstream `processReversals` |
| 4 | create step-operations cluster (`step-data-helpers` hub + handlers) | medium→high | Retype hub return to `Step`; reversal/render handlers stay on render-augmented type | `arrow-adjustment`/`prop-type`/`path-shape`/`beta-swap` handlers keep StepData (authored render-cache) |
| 5 | shared-create factory + transforms (`create-step-data`, `step-transforms`, `sequence-derived-fields`, `sequence-transforms`) | high | Introduce `createStep`; reversal swap/clear deferred to pipeline | Render-cache reconciler decision (Motion.gridMode) settled |
| 6 | shared-foundation core hub (`step-data.ts`, `sequence-data.ts`, `step-deriver`, `sequence-hydrator`, `sequence-decomposer`) | high (BLOCKER-gated) | Flip `SequenceData.steps` element type; producers emit `Step`; bridge at every deferred boundary | All Wave-7 boundaries must be **bridged** first |
| 7 | DEFERRED (migration B): render pipeline, reversal pipeline, serialization/identity, PictographContainer | blocker | **No conversion** — keep StepData, receive bridged value | Out of scope for sub-migration A |

---

## 3. FIRST SAFE CLUSTER — comparison signatures (proof of pattern)

### Files (exactly three, file-disjoint, self-contained)
- `src/lib/shared/comparison/services/sequence-aligner.ts`
- `src/lib/shared/comparison/services/step-signature-generator.ts`
- `src/lib/shared/comparison/services/spatial-transform-detector.ts`

### Why it is safe
- **Structural-only.** Every read is a lean-`Step`/`Motion` field: `motions[BLUE/RED].startLocation/endLocation/motionType/rotationDirection/turns/startOrientation/endOrientation`, `step.startPosition`, `step.endPosition`. No `blueReversal`/`redReversal`, no `isSelected`, no `isStep`, no render cache. `rendersCacheDependent=false` on all three.
- **No landmine.** None of the three appear in the landmine register.
- **Closed graph.** They exchange step objects only with each other; `sequence-aligner` consumes `step-signature-generator` + `spatial-transform-detector`. Verified: grep confirms only these three of the 8-file comparison slice reference `StepData` (the siblings — `motion-signature-generator`, `sequence-canonicalizer`, `sequence-equivalence-detector`, `similarity-calculator` — operate on `MotionData`/`SequenceData`, untouched).
- **Widening, not narrowing.** External callers still pass `StepData` (superset) into the now-`Step` params; that compiles. Nothing produces a value *from* these modules that a StepData consumer then reads.

### Recipe
1. In all three files swap `import type { StepData } from '$lib/shared/foundation/domain/models/step-data'` → `import type { Step } from '@tka/tka-types'`.
2. Retype every `StepData`/`readonly StepData[]`/`stepA: StepData`/`stepB: StepData` occurrence to `Step` / `readonly Step[]`.
3. `npm run check > /tmp/check.log 2>&1` (one cold run); `grep -niE "error" /tmp/check.log`. Expect green. If a caller breaks, it is because that caller's value is *not* assignable to `Step` (e.g. optional motions) — that caller belongs to a later wave; in that case keep the param as `Step | StepData` union to stay green, do not chase it.
4. Commit with explicit pathspec:
   ```bash
   git commit -m "refactor(comparison): accept lean Step in signature/aligner trio" -- \
     src/lib/shared/comparison/services/sequence-aligner.ts \
     src/lib/shared/comparison/services/step-signature-generator.ts \
     src/lib/shared/comparison/services/spatial-transform-detector.ts
   ```

This proves the widening pattern + the per-cluster verification loop before any producer or core-type work begins.

---

## 4. Per-cluster file lists + recipes

### Wave 1 — Structural read-consumers + union-widening (safe, high-parallelism)

These accept `Step` while producers still emit the StepData superset. Convert in independent batches; each is its own commit.

**1a. Comparison trio** — the first safe cluster (above).

**1b. Animation-engine prop/union widening** (`StartPositionData | StepData | null` → add `Step`; pure pass-throughs, no field reads):
`AnimatorCanvas.svelte`, `AnimationShareDrawer.svelte`, `SplitCanvasView.svelte`, `canvas/AnimationCanvas.svelte`, `DisassembleCanvasView.svelte`, `GlyphRenderer.svelte`, `DisassembleTransition.svelte`, `CanvasSurface.svelte`, `layers/SegmentedSequenceProgressBar.svelte`, `services/IAnimationRenderLoop.ts`, `services/animation-engine.svelte.ts`, `services/playback-sync.ts`. Recipe: widen the union to include `Step`. (`PathLinesOverlay.svelte` is a FALSE POSITIVE — local `currentStepData` identifier, no action.)

**1c. Animation-engine structural read-consumers** (read `letter`/`stepNumber`/`duration`/structural motions only): `services/step-calculator.ts`, `services/frame-builder.ts`, `services/export-glyph-prerenderer.ts`. Retype to `Step[]`.

**1d. shared-create structural read-consumers/mutators** (no reversal/render/selection): `loop-detector.ts`, `apply-turns-to-motion.ts`, `orientation-propagation.ts`, `orientation-cycle-detector.ts`, `detect-rotation-period.ts`, `sequence-metadata-manager.ts`, `turn-pattern-manager.ts`, `create-module-state-types.ts`, `panel-coordination-state.svelte.ts`. `selection-store.svelte.ts` is no-op (it IS the isSelected replacement).

**1e. shared-foundation safe read-consumers**: `word-deriver.ts`. (`solo-prop-factory.ts`, `solo-prop-data.ts`, `solo-prop-step-data.ts` are FALSE POSITIVES — `SoloPropStepData` substring; no action.)

**1f. create read-consumers** (structural): `edit/services/turn-controller.ts`, `spell/services/orientation-continuity-validator.ts`, `spell/services/sequence-metadata-manager.ts`, `spell/services/pictograph-filter.ts`, `generate/shared/services/sequence-metadata-manager.ts`, `generate/shared/services/start-position-selector.ts`. Workspace structural readers: `step-grid-display-state.svelte.ts`, `step-cell-animation-manager.ts`. Step-operations leaf: `step-removal-handler.ts`, `step-operator.ts` (facade — convert with handlers but param is structural).

**1g. card/fuse/loop-labeler structural read-consumers**: `loop-explainer.ts`, `sequence-to-entry-converter.ts`, `step-pair-analyzer.ts`, `LOOPLabelerModule.svelte` (follows converter). (`sequence-loader.ts`, `types.ts`, `sequence-models.ts` = `RawStepData`, FALSE POSITIVES.)

**1h. timeline/viewer/misc structural readers**: `timeline/notation-cell.ts`, `timeline/adapters/animator-playback-adapter.svelte.ts`, `pictograph-to-svg.ts` (widen union), `card-composer.ts`, `poi-state.svelte.ts`, `phrase-effort-lab-state.svelte.ts`, `retro/labs/ascii-pictograph-lab-state.svelte.ts`, `retro/win95/adapters/cards-adapter.ts`, `level-feature-detector.ts`, `navigation/services/position-deriver.ts`, `navigation/services/letter-deriver.ts`. FALSE POSITIVES (local `currentStepData` / `hasFullStepData` / `RawStepData` / wire `BroadcastStepData`): `SequenceViewer.svelte`, `ViewerSplitPane.svelte`, `cell-cache-key-deriver.ts`, `InlineAnimationPlayer.svelte`, `browse-filter.ts`, `TunnelRenderer.svelte`, `SingleRenderer.svelte`, `TimelinePreview.svelte`, `CellCanvas.svelte`, `CanvasSection.svelte`, `PhraseEffortLabModule.svelte`, `broadcast-schemas.ts`, `broadcast-models.ts`, `poi/.../PovAnimatorPreview` (cluster), `solo-prop-*`.

### Wave 2 — Isolated structural producers/mutators (safe→medium)

Build via `createStep` (or spread); structural Motion fields only; not yet wired to the flipped `SequenceData.steps`.
`step-operations/orientation-handler.ts`, `step-operations/duration-handler.ts`, `rotation-direction-pattern-manager.ts`, `duration-pattern-manager.ts`, `sequence-validator.ts`, `sequence-json-exporter.ts`, `construct-coordinator.ts`, `create-module-orchestrator.ts` (comment only), `create-module-initializer.ts`, `create-module-state.svelte.ts`, `option-history-manager.svelte.ts`, `auto-edit-panel-manager.svelte.ts`, `assemble-tab-state.svelte.ts`, `orientation-cycle-extender.ts`, `lab/duration-lab/DurationLabModule.svelte`. Tests follow their source: `sequence-core-state.derived.test.ts`, `sequence-validator`-adjacent fixtures.

**Discriminator fix (do here, HIGH):** `pictograph-type-guards.ts` — `isStep()` keys on `obj.isStep === true` with a `stepNumber>=1` fallback. Lean `Step` has no `isStep`; reroute the discriminator to `stepNumber`/`isBlank`/`isBridge` (or tighten to `'blueReversal' in obj` so it returns false for lean Step and forces an explicit bridge). The only control-flow consumer is `sequence-state-orchestrator.svelte.ts:414` — bridge the start-position there (`stepToStepData`) before it enters the `StepData[]` result, or gate on `isStartPosition` instead.

### Wave 3 — Circular LOOP executor contract (atomic, medium)

**Contract:** `circular/services/ILOOPExecutor.ts` + `qr/services/compositional-utils.ts` (`LOOPExecutorLike.executeLOOP`).
**Executors:** `strict-rotated`, `strict-mirrored`, `strict-swapped`, `strict-inverted`, `strict-flipped`, `rotated-inverted`, `rotated-swapped`, `mirrored-inverted`, `mirrored-swapped`, `mirrored-swapped-inverted`, `swapped-inverted`, `swapped-complementary`, `rewound`-loop-executor.
**Composers:** `mirrored-rotated`, `mirrored-rotated-inverted`, `mirrored-rotated-complementary`, `mirrored-rotated-complementary-swapped`, `mirrored-rotated-inverted-swapped`-loop-executor.
**Shared dep:** `pictograph/prop/services/orientation-calculator.ts` (`updateStartOrientations`/`updateEndOrientations` must accept `Step`).
**QR pass-through:** `compositional-decoder.ts`, `compositional-encoder.ts` (cast `as Step[]`, build start step lean).
Recipe: flip `StepData[]→Step[]` across the whole contract in one commit. All bodies are spread + structural-motion edit + orientation recalc. **`rewound-loop-executor`** swaps `blueReversal↔redReversal` — on lean Step default both to `false`; the downstream `reversalDetector.processReversals` (random-sequence-generator) is the source of truth and overwrites them, so the swap becomes inert (correct intent).

### Wave 4 — create step-operations cluster (medium→high)

**Hub:** `step-operations/step-data-helpers.ts` (`getStepDataFromState` return type → `Step`). **Convertible mutators:** `orientation-handler.ts` (Wave 2), `duration-handler.ts` (Wave 2), `turns-handler.ts` + `rotation-direction-handler.ts` (keep trailing `processReversals` — reversal deferred). **Central seam:** `sequence-step-operations.ts`, `sequence-state-orchestrator.svelte.ts` (keep `processReversals` calls; route reversal flags through the pipeline, not hand-filled literals). Tests: `step-operator.turns-letter.test.ts`, `turns-handler.test.ts`.

**Stay on StepData / render-augmented type (do NOT lean-convert here — Wave-7/deferred):** `arrow-adjustment-handler.ts`, `keyboard-arrow-adjuster.ts` (authored `manualAdjustmentX/Y`), `prop-type-handler.ts` (authored `propType`), `path-shape-handler.ts` (authored `pathShape`), `beta-swap-handler.ts` (`betaSwapped` not on lean Step). These author choreographic data the bridge drops — see Landmine register #2.

### Wave 5 — shared-create factory + transforms (high)

`create-step-data.ts` (canonical factory → introduce `createStep` in `@tka/tka-types`; drop `isStep`/`isSelected`/`betaSwapped`/reversal defaults; let pipeline own reversals). NOTE: a **duplicate** factory exists at `src/lib/shared/foundation/domain/factories/create-step-data.ts` — both copies must be handled in lockstep or they drift. Then `step-transforms.ts` (reversal swap/clear → pipeline), `sequence-derived-fields.ts` (`reconcileStepDerived` generic bound → `Step`; settle whether lean `Motion` keeps `gridMode`), `sequence-transforms.ts`. Tests follow: `sequence-derived-fields.test.ts`, `step-transforms.derived.test.ts`, `sequence-transforms.gridmode.test.ts`. Also `build-result-transformer.ts`, `sequence-importer.ts`, `sequence-domain-manager.ts` + `sequence-repository.ts`, `sequence-analyzer.ts`, `sequence-extender.ts`, `sequence-exporter.ts` (reversal read → pipeline at export time), `create-module-event-handler.ts` (keep `detectReversalForOption`), `word-sequence-generator.ts` / `random-sequence-generator.ts` / `step-converter.ts` (generate hub).

### Wave 6 — shared-foundation core hub (high, BLOCKER-gated)

`step-data.ts` (the type — repoint importers to `Step`), `sequence-data.ts` (flip `steps: readonly Step[]`), `step-deriver.ts` (emit `Step[]`, reversals from `StepPairingData`), `sequence-hydrator.ts` (keep `processReversals`; bridge before it if `deriveSteps` returns `Step[]`), `sequence-decomposer.ts` (reversal + skew reads → keep StepData or derive), `content-hasher.ts`. **Gate:** every Wave-7 boundary must already receive a **bridged** value (`stepToStepData`) before this wave flips the hub.

### Wave 7 — DEFERRED to migration B (no conversion in sub-migration A)

Keep `StepData`, receive bridged values. Render: `PictographContainer.svelte`, `PictographWithVisibility.svelte`, `StepCell.svelte`, `pictograph-to-svg.ts` (render path), `IDirectRenderer`/`canvas-2d-direct-renderer`/`web-gl-direct-renderer`, `pictograph-preparer.ts`, `layer-compositor.ts`, `layer-key-deriver.ts`, `pictograph-key-hasher.ts`, `canvas-2d-glyph-renderer.ts`, `render/services/types.ts`, `prop-interpolator.ts`, `sequence-animation-orchestrator.ts`. Reversal: `reversal-detector.ts`, `reversal-matcher.ts`, `reversal-seed-service.ts`, `reversal-transform.ts`, `step-pairing-data.ts`, `catalog-loader.ts`, `with-effective-prop-types.ts`. Serialization/identity: `sequence-content-hasher.ts` (×2), `schemas.ts` (`StepDataSchema`), `mandala-collection-types.ts` + `firebase-mandala-collection-repository.ts`, `sequence-encoder.ts` (decode-side construction → route through `createStep`/bridge, keep wire string byte-stable). Legacy bridge to retire (route to `step-bridge`): `step-pictograph-conversion.ts`.

---

## 5. Landmine register (deduped, severity-ranked)

### DEFERRED (out of scope for sub-migration A — preserve current behavior, do NOT touch the logic)

| # | Concern | Sev | Count | Disposition |
|---|---|---|---|---|
| D1 | **Reversal LOOP-WRAP semantics.** `reversal-detector.processReversals` builds `previousSteps = [...steps, ...steps.slice(0,i)]` for loops; engine `deriveReversals` LACKS the wrap. Every stored `blueReversal`/`redReversal` originates here. Swapping silently changes reversal dots on first beats of every rotated/mirrored loop. | blocker | ~25 (reversal-detector, reversal-seed-service, reversal-matrix-solver.test, reversal-matcher, reversal-transform, step-pairing-data, catalog-loader, sequence-stats-calculator, sequence-exporter, claude-code-copier, OptionGrid, create-module-event-handler, orchestrator post-mutation pass, step-transforms swap/clear, rewound-loop-executor, content-hasher, sequence-content-hasher ×2…) | KEEP-AS-IS. Type migration must route `Step → stepToStepData → processReversals`; **never** call `deriveReversals` for display flags. `stepToStepData` leaving flags `false` is correct — the pipeline refills them. |
| D2 | **Authored-not-derived render cache.** The step-bridge docstring falsely labels `pathShape`, `skewSteps/skewDir`, `arrowPlacementData.manualAdjustmentX/Y`, `isVisible`, effective `propType` as "recomputed downstream." They are **user-authored and persisted**; `stepToStepData` rebuilds them as `createMotionData` defaults, so any `Step→StepData` round-trip silently discards path-shape choices, skew, manual arrow nudges, hidden-prop toggles, and prop type. | blocker | ~35 (path-shape-handler, prop-interpolator, 3d/sequence-converter, export-frame-compositor, arrow-path-resolver, arrow-adjustment-handler, keyboard-arrow-adjuster, arrow-collision-resolver, sequence-encoder propType, decomposer skew, motion-signature-generator, mandala-geometry-calculator, PathLinesOverlay, StepEditorPanel, PathShapeGlyph, component-manager/data-transformer isVisible, orientation-calculator, with-effective-prop-types, PipelineEditorDock, PictographInspectModal, VideoRecordPanel, start-position-deriver, poi-sequence-validator, pictograph-preparer, PictographContainer…) | DEFER + GUARD. Either (a) extend lean `Step`/`Motion` to carry the authored sub-set so the bridge is lossless (migration B), or (b) do **not** migrate any module that authors/reads these until the authored-vs-derived split is formalized. Correct the bridge docstring. No Wave-1..6 file may force a `Step→StepData` round-trip across one of these reads. |
| D3 | **contentHash / persisted identity.** `sequence-content-hasher.computeHash` (and byte-identical duplicate) SHA-256s `blueReversal/redReversal/isBlank/duration` + structural motion; persisted as Firestore `contentHash` (dedup, fork-detection, variation-match, public mirror). Bridge-defaulted reversal flags change every reversal-bearing sequence's hash → dedup misses, spurious forks, `ALREADY_EXISTS` never fires. `content-hasher.serializeChoreoNode` (render cache discriminator) and `extractStepPairings` (persisted `stepPairings.blueReversal/redReversal`, mirrored to public gallery) share the blast radius. | blocker | ~8 (sequence-content-hasher ×2, content-hasher ×2 lines, sequence-decomposer, schemas isSelected, public-index-syncer) | KEEP-AS-IS / ordering invariant. Hash input stays byte-for-byte (reversal flags, key order). Guarantee `processReversals` ran before any hash/decompose; **never** feed bridge-defaulted (false) steps to a hasher. `sequence-hydrator` re-runs `processReversals` at read time — preserve that call. |
| D4 | **PictographContainer render inheritance.** Master render entry typed `StepData \| PictographData`. Lean `Step` is NOT a `PictographData`: narrowing via `"stepNumber" in data` then reading `blueReversal`/`redReversal` yields `false` (dots vanish), and `arrowPlacementData.manualAdjustmentX/Y` in the cache key is gone. Every step render funnels here; sibling render-discriminators (`'blueReversal' in pictograph` in layer-compositor / canvas-2d-glyph-renderer) return false for lean Step → reversal overlay layer skipped silently. | blocker | ~14 (PictographContainer, StepCell, PictographWithVisibility, pictograph-to-svg, IDirectRenderer + 2 impls, pictograph-preparer, preview-cell-renderer, canvas-2d-glyph-renderer, frame-builder, GlyphRenderer, museum/browse/compose leaf renderers) | DEFER. Keep render boundaries speaking `StepData`; bridge `Step→StepData` (`stepToStepData`) before the prop, and source reversals from the pipeline + selection from `selection-store`. No bare `Step` reaches a render prop. |

### MUST PRESERVE / ACT-ON within the TYPE migration (Waves 1–6)

| # | Concern | Sev | Count | Action |
|---|---|---|---|---|
| A1 | **`isStep` discriminator dies on lean Step.** `isStep()` primary check (`obj.isStep === true`) silently stops firing; only the `stepNumber>=1` fallback remains, and it still *narrows to StepData* — a type lie that grants missing fields with zero compile error. | high | ~10 (pictograph-type-guards isStep/assertIsBeat/isStartPosition, sequence-state-orchestrator:414, build-result-transformer, step-deriver, word-sequence-generator, create-step-data ×2 factories, CardArrowFixGrid, museum-exhibit-sequences, step-bridge.test) | **Wave 2.** Reroute the discriminator to `stepNumber`/`isBlank`/`isBridge`, or tighten `isStep` to `'blueReversal' in obj` so it returns false for lean Step and forces an explicit bridge. Bridge the start position at orchestrator:414. Keep `isStartPosition` (StartPositionData not migrated). Ensure lean Steps always carry `stepNumber>=1`. |
| A2 | **`isSelected` is vestigial in the persistence schema.** `StepDataSchema.isSelected` + `StepData.isSelected`/`StartPositionData.isSelected` + conditional factory spreads (duplicated across 4 factory files). No live reader (selection = `selectedStepNumber`, soon id-keyed `selection-store`). | medium/low | ~7 (schemas, step-data, start-position-data, create-step-data ×2, create-start-position-data ×2, step-pictograph-conversion read+hasStepContext) | **Wave 5/6.** Drop `isSelected` from schema (`.optional()`, Zod strips it — old persisted data just loses it harmlessly) and from both factory-pair copies. Coordinate `selection-store` (id-keyed, not persisted) vs `selectedStepNumber` (number-keyed, persisted) — do NOT leave two live sources of truth; port persistence + ~30 number-based callers together or keep an id↔number adapter. |
| A3 | **`areBeatsEqual` JSON.stringify over whole StepData.** Retyping the param to lean `Step` silently changes equality semantics (fewer keys compared, drops render cache + reversal). | landmine | 1 (`create/shared/utils/sequence-comparison.ts`) | **Wave 5.** Do NOT just swap the type — rewrite `areBeatsEqual` to compare explicit lean structural fields, or keep it on StepData. |
| A4 | **`BatchEditChanges = Partial<StepData>`** exposes reversal/category/betaSwapped as editable. | needs-cluster | 1 (`create-module-types.ts`) | **Wave 4/5.** Confirm batch-edit consumer never writes reversal/category/betaSwapped, then `Partial<Step>`; else it becomes a landmine. |
| A5 | **localStorage / Dexie tolerant boundaries.** `start-position-manager.setStartPosition` JSON.stringifies whole object; `library-save-service`/`sequence-local-cache`/`autosaver` persist fat SequenceData; `autosaver.loadDraft` skips `hydrate()`. | medium | ~4 | **Wave 6.** On read, normalize through bridge/factory + `processReversals` so old fat records and new lean records both load. Audit `autosaver.loadDraft`. Don't tighten `StepDataSchema` to reject the legacy fields. |
| A6 | **Wire-format stability (URL/QR).** `sequence-encoder` encode/decode string format + `compositional-encoder` recipe hash are stable contracts for already-shared links and printed QR. | medium/low | ~4 (sequence-encoder, compositional-encoder/decoder, public-index-syncer encoderHash) | **Wave 6/7.** Keep encode output byte-stable (it already reads structural Motion only). Route decode-side *construction* through `createStep`/bridge instead of inline `StepData` literals. Add a round-trip regression check before shipping. |

### DO-NOT-TOUCH (naming-collision / false-positive traps — scope OUT)

| Concern | Note |
|---|---|
| `reversal-constraint.ts` / `continuity-constraint.ts` / `hand-path-constraint.ts` local `blueReversal`/`redReversal` | Beam-search SCORING, computed on-the-fly from rotationDirection; never read/write `step.blueReversal`. Not the reversal pipeline. |
| `selectedArrowState.isSelected`, component `isSelected` props, ArrowData `isSelected:false` literals | Distinct arrow/prop selection subsystem — a rename sweep targeting "isSelected" must not touch these. |
| `SoloPropStepData`, `RawStepData`, `BroadcastStepData`/`BroadcastStepDataSchema` | Independent types whose names contain the `StepData` substring. No foundation import. No action. |
| Local identifiers `currentStepData`, `hasFullStepData`, `primaryStepData` | Variable names, not the type. |

---

## 6. Verification protocol (per cluster)

For every cluster, in order:
1. **Convert** the cluster's files (and only those files).
2. **One cold check:** `npm run check > /tmp/check.log 2>&1` then `grep -niE "error" /tmp/check.log`. Capture once, grep many — never re-run check to re-filter. During iteration use `npm run check:watch` (warm). Green before proceeding.
3. **Behavioral guard where a landmine touches the cluster:** run the relevant test (`reversal-matrix-solver.test.ts`, `turns-handler.test.ts`, `step-bridge.test.ts`, `sequence-derived-fields.test.ts`) — these are tripwires for the deferred reversal/discriminator/bridge contracts. They must stay green; if one fails, the cluster crossed a deferred boundary — stop and re-route through the bridge.
4. **Round-trip guard (Waves 6+):** verify `verifySequenceRoundTrip` (encoder) and a `computeHash` stability check on a known reversal-bearing sequence before any core-hub commit.
5. **Commit only your own files with explicit pathspec:**
   ```bash
   git commit -m "<message>" -- <exact files in this cluster>
   ```
   The shared index may hold other agents' work — never a bare `git commit`.

Full `npm run build` only at the sub-migration ship gate, not per cluster.

---

## 7. Deferred-work section (migration B, separate sub-project)

1. **Reversal-logic unification** — reconcile engine `deriveReversals` with the app's LOOP-WRAP `processReversals`, or formally adopt one. Until then the type migration treats reversal flags as pipeline-owned and routes through `stepToStepData → processReversals`.
2. **Authored-vs-derived render-cache split** — extend lean `Step`/`Motion` to carry the authored slice (`pathShape`, `skewSteps/skewDir`, `isVisible`, `manualAdjustmentX/Y`, effective `propType`) so the bridge is lossless, OR move authored placement to an identity-keyed override store. Required before any render/edit module migrates off StepData.
3. **Serialization / identity** — author a lean `Step` zod schema as an input-superset, plan a Firestore read/write reconciliation for `contentHash` + `stepPairings` + `CollectedMandala.steps`, keep both `sequence-content-hasher` copies in lockstep (or consolidate).
4. **PictographContainer boundary** — decide whether the render entry accepts `Step` (and bridges internally) or stays `PictographData` with callers bridging. Retire `step-pictograph-conversion.ts` in favor of `step-bridge`.
5. **Selection consolidation** — collapse `selectedStepNumber` (persisted, number-keyed) and `selection-store` (id-keyed, not persisted) to one source of truth.
6. **Delete `StepData`** — only after every consumer is off the factory and bridge; then remove `step-data.ts`, both `create-step-data` copies, and the bridge.
