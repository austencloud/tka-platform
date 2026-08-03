# LOOP Period and Orientation Domain — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-04-18-loop-period-and-orientation-domain-design.md`
**Date:** 2026-04-18

---

## Overview

10 phases. Phases 1–3 are mostly additive (new types, new detection, new resolvers) and don't break existing behavior. Phases 4–7 change generator and UI behavior. Phase 8 adds copy. Phase 9 migrates data. Phase 10 cleans up deprecated surfaces.

**Execution order constraints:**
- Phase 1 unblocks all subsequent phases (types flow through everything).
- Phases 2 and 3 can run in parallel after 1.
- Phase 4 requires 1; independent of 2 and 3.
- Phase 5 requires 1 and 4 (minLength uses generator infeasibility rules).
- Phases 6 and 7 require 4 (generator must produce closed LOOPs before UI drops the Complete Cycle fallback).
- Phase 8 requires 1 and 3 (modal consumes components + domains + period).
- Phase 9 (migration) runs after 1–3 are stable; can run before 4–7 ship to give all data the new fields.
- Phase 10 runs last, after every consumer has migrated off the deprecated surfaces.

**Verification philosophy:** every phase ends with a passing test suite and a clean `npm run check`. No phase is "done" until both pass.

**Non-destructive principle:** until Phase 10, all old fields/APIs stay functional. New fields and APIs live alongside. This lets individual phases merge independently without a flag day.

---

## Phase 1 — Data model foundation

**Goal:** add the new types and fields without changing any runtime behavior.

**Files:**
- `src/lib/features/create/generate/shared/domain/models/generate-models.ts` — extend `LOOPComponent` enum, add `LOOPDomain`, `DetectedComponent`
- `src/lib/features/create/generate/circular/domain/models/circular-models.ts` — add `period` to `LOOPGenerationOptions` (keep `sliceSize` during deprecation)
- `src/lib/shared/foundation/domain/models/SequenceData.ts` — add `period?: number`, `components?: LOOPComponent[]`, `componentDomains?: Record<LOOPComponent, LOOPDomain>`. Keep `loopType?: string` and `orientationCycleCount?: 1 | 2 | 4`.
- `src/lib/features/loop-labeler/services/contracts/ILOOPDetector.ts` — update `LOOPDetectionResult`: add `period: number`, add `componentsDetailed: DetectedComponent[]` (keep the existing `components: ComponentId[]` for now; new field lives alongside).

**Tasks:**

1. Add `LOOPDomain = "location" | "orientation" | "both"` type export.
2. Add `DetectedComponent = { component: LOOPComponent; domain?: LOOPDomain }` type export.
3. Extend `LOOPComponent` enum with `ZONE_HOLD_INVERT`, `ZONE_HOLD_FLIP`, `ZONE_CROSS`.
4. Add `period?: number` to `SequenceData`, `components?: LOOPComponent[]`, `componentDomains?: Record<LOOPComponent, LOOPDomain>`.
5. Extend `LOOPGenerationOptions` with `period?: number` (optional for now to avoid breaking callers).
6. Extend `LOOPDetectionResult` with `period: number` and `componentsDetailed: DetectedComponent[]`. `period: 1` when not a LOOP (non-circular, freeform).
7. Export a helper `periodFromLegacyFields(loopType, orientationCycleCount) → number` for migration and backward-compat read paths.
8. Update `updateSequenceData` helper in `SequenceData.ts` to preserve the new fields when merging.

**Verification:**
- `npm run check` passes.
- Existing tests unchanged, all green.
- Grep confirms new fields are wired through type system without runtime consumers yet.

---

## Phase 2 — LOOPComponent enum wiring for reserved primitives

**Goal:** reserved primitives exist in code paths and serialization but never reach the UI.

**Files:**
- `src/lib/features/loop-labeler/domain/constants/loop-components.ts` — update component ID constant map
- `src/lib/shared/components/LOOPIconStrip.svelte` — add filter that drops reserved primitives
- `src/lib/features/loop-labeler/services/loop-display-resolver.ts` — filter reserved primitives from the components Set returned to UI consumers
- `packages/render-composition/src/loop-icons.ts` — no icon entries for reserved primitives (they must not crash if passed)
- `src/lib/shared/render/services/implementations/ImageComposer.ts` — ensure serializer doesn't fail if reserved primitives appear in components

**Tasks:**

1. Define `RESERVED_ORIENTATION_PRIMITIVES = new Set<LOOPComponent>([ZONE_HOLD_INVERT, ZONE_HOLD_FLIP, ZONE_CROSS])`.
2. In `resolveLoopDisplay`, filter these out of the returned `components` Set before the resolver returns.
3. In `LOOPIconStrip`, add a guard that silently skips any LOOPComponent not in `primitiveIcons` — prevents future additions from crashing.
4. In `loop-icons.ts` (render-composition), add a guard in `renderLoopIconStrip` that skips any key not in its path table.
5. Add a unit test to `loop-display-resolver.test.ts` confirming reserved primitives are filtered.

**Verification:**
- `npm run check` passes.
- New test passes.
- Existing 15 tests from scope-B all still pass.

---

## Phase 3 — Detector orientation pass

**Goal:** detection recognizes orientation-rotated LOOPs and sets `period` correctly for all LOOPs.

**Files:**
- `src/lib/features/loop-labeler/services/implementations/LOOPDetector.ts` — add orientation-pass method
- `src/lib/features/loop-labeler/services/implementations/LOOPOrientationDetector.ts` — NEW — mirrors the positional detector's algorithm applied to orientation trajectories
- `src/lib/features/loop-labeler/services/loop-display-resolver.ts` — consume new detection result shape
- `tests/unit/loop-labeler/LOOPDetector.test.ts` — new test cases

**Tasks:**

1. Create `LOOPOrientationDetector.ts` with `detectOrientationPass(sequence): DetectedComponent[]`. Algorithm:
   - Extract per-beat (blueStartOrientation, redStartOrientation) pairs
   - Treat orientation pairs as positions on a 4-cycle (or 8-cycle for L7)
   - Run the same quartered/halved detection algorithm from `detectQuarteredPattern` / `detectHalvedPattern` on this sequence of orientation-pairs
   - Return DetectedComponents with `domain: "orientation"`
2. Extend `LOOPDetector.detectLOOP`:
   - Run existing location pass → `locationComponents: DetectedComponent[]` with `domain: "location"`
   - Run new orientation pass → `orientationComponents: DetectedComponent[]` with `domain: "orientation"`
   - Merge: if a component appears in both, promote to `domain: "both"`
   - Compute `period = max(locationPeriod, orientationPeriod)` (both in {1,2,4,8})
   - Add reserved-primitive detection: zone-hold-invert when all beats share the same radial zone; zone-hold-flip analogous for nonradial; zone-cross when transitions hop zones. Emit in `componentsDetailed` for metadata but filter before UI consumption via Phase 2 filter.
3. Update `resolveLoopDisplay` to consume the new result shape:
   - `{ components: Set<LOOPComponent>, componentDomains: Record<LOOPComponent, LOOPDomain>, period: number, rotationSliceSize?: SliceSize }`
   - `rotationSliceSize` derived from `period === 4` AND ROTATED in components, for backward compat with the scope-B icon wiring
4. Write tests:
   - Form C example (4 beats all alpha, 0.5 turns each) → `period: 4, components: [ROTATED], domain: orientation`
   - Halved mirrored with orientation cycle 2 → `period: 4, components: [MIRRORED], domain: location`
   - L1 quartered rotated (existing fixture) → `period: 4, components: [ROTATED], domain: location`
   - Non-LOOP sequence → `period: 1, components: []`

**Verification:**
- All new tests pass.
- Existing scope-B tests still pass (resolver API preserved).
- Regression: run `resolveLoopDisplay` against a sample of 20 sequences from the current library; confirm no sequence regresses from "loop" classification to "no loop."

---

## Phase 4 — Generator: orientation as beam-search constraint

**Goal:** the generator produces orientation-closed LOOPs for all (loopType, period) combinations.

**Files:**
- `packages/sequence-engine/src/generation/builder/SequenceBuilder.ts` — augment search state
- `packages/sequence-engine/src/generation/reachability/OrientationReachabilityAnalyzer.ts` — NEW
- `packages/sequence-engine/src/generation/constraints/closure/turn-parity-constraint.ts` — NEW
- `packages/sequence-engine/src/loop/targeting/LOOPEndOrientationSelector.ts` — NEW
- `packages/sequence-engine/src/loop/targeting/LOOPEndPositionSelector.ts` — extend for all LOOP types (currently only ROTATED and REWOUND have full support)
- `packages/sequence-engine/src/generation/constraints/closure/mirrored-closure-constraint.ts`, `flipped-closure-constraint.ts`, `swapped-closure-constraint.ts`, `inverted-closure-constraint.ts` — NEW per-type closure constraints
- `packages/sequence-engine/src/loop/execution/LOOPExecutor.ts` — mark geometric executor paths as deprecated (keep REWOUND)
- `packages/sequence-engine/tests/integration/orientation-closure.test.ts` — NEW
- `packages/sequence-engine/tests/integration/loop-direct-generation.test.ts` — NEW

**Tasks:**

1. **Augment `SearchState`** in `SequenceBuilder.ts`:
   - Add `blueOrientation: Orientation` and `redOrientation: Orientation` to state
   - Update state after each variation: `newOrientation = calculateEndOrientation(variation.motion, currentOrientation)` using the existing orientation calculator
2. **Implement `OrientationReachabilityAnalyzer`** paralleling `PositionReachabilityAnalyzer`:
   - Input: `(requiredEndOrientation, remainingBeats, level, turnIntensity)`
   - Output: set of orientations from which the end state is reachable
   - Used to prune beam states whose orientation drift cannot close
3. **Implement `LOOPEndOrientationSelector`**:
   - Input: `(startOrientation, loopType, period, domains, turnIntensityConfig)`
   - Output: required end orientation per hand
   - For ROTATED location-domain: end orientation = start orientation (grid rotation doesn't touch orientations)
   - For ROTATED orientation-domain period 4: end orientation = start orientation after 4 wheel rotations; requires per-pass per-hand turn total mod-2 = 0.5
   - For MIRRORED/FLIPPED/SWAPPED/INVERTED period 2: end orientation = start orientation (turn totals even per pass)
   - For period 4 via orientation extension (any non-rotation): end orientation = start orientation after 2 passes of halved base with per-pass turn totals mod-2 = 1
4. **Implement `TurnParityConstraint`**:
   - Hard constraint ensuring per-pass per-hand turn total mod-2 matches target
   - Target derived from `(period, positionalPeriod)` via `orientationPeriod = period / positionalPeriod`
   - Evaluated against the cumulative turn total projected for the pass
5. **Implement per-type closure constraints** (hard constraints consumed by beam search):
   - `MirroredClosureConstraint`: beat `i + length/period` must be the mirror-transformation of beat `i`
   - `FlippedClosureConstraint`: beat `i + length/period` must be the flip-transformation of beat `i`
   - `SwappedClosureConstraint`: beat `i + length/period` must be blue/red-swapped version of beat `i`
   - `InvertedClosureConstraint`: beat `i + length/period` must be motion-type-inverted version of beat `i`
6. **Extend `LOOPEndPositionSelector`** to handle all LOOP types in combination with period:
   - For each (loopType, period, domain): return required end position
   - For orientation-domain rotations: end position = start position (only orientations rotate)
7. **Update `SequenceBuilder.build`** to:
   - Accept `options.loop.period` alongside existing `options.loop.sliceSize` (aliased during migration)
   - Pass closure constraints to beam search based on `(loopType, period)`
   - After beam search completes, VERIFY orientation closure (sanity check — should never fail if constraints were satisfied)
   - Throw `LoopInfeasibleError` with specific constraint info when beam search exhausts states without finding a solution
8. **LOOPExecutor partial deprecation**:
   - Mark `executeRotated` and geometric branches as deprecated with a log warning if called
   - Keep `executeRewound` active (REWOUND keeps post-hoc path)
   - Add a feature flag `USE_DIRECT_GEOMETRIC_LOOP_GENERATION` defaulting to true that routes geometric LOOPs through beam search only
9. **Write tests:**
   - For every (loopType, period, level) combination, generate 10 sequences and assert `lastBeat.endOrientation === firstBeat.startOrientation` for both hands. No post-hoc extension.
   - Regression: swapped LOOP at alpha6 in box mode generates with period 4 directly.
   - Infeasibility: mirrored period 4 at L1 (0 turns) throws `LoopInfeasibleError`.
   - Quartered rotated location-domain L1 produces sequences identical in shape to the existing L1 Quartered Rotated Deck.

**Verification:**
- All new tests pass.
- Existing generator tests pass (no regression on REWOUND or on the post-hoc path for period 2 halved-rotated — that path also survives beam-search-native production).
- `npm run check` clean.
- Sample test: generate 100 sequences, run migration-aware detector on each, confirm 100% have `period: sequenceLength / basePattern` and `components.length > 0`.

---

## Phase 5 — Minimum-length calculator + reactive length picker

**Goal:** users cannot select an infeasible (loopType, period, length) combination.

**Files:**
- `packages/sequence-engine/src/generation/capacity/minimum-length-calculator.ts` — NEW
- `src/lib/features/create/generate/shared/services/implementations/MinLengthCalculator.ts` — NEW wrapper exposing the engine function to the app
- `src/lib/features/create/generate/components/cards/LengthCard.svelte` — consume calculator reactively
- `src/lib/features/create/generate/components/cards/` — period card (new, see Phase 6) also consumes calculator
- `packages/sequence-engine/tests/generation/capacity/minimum-length-calculator.test.ts` — NEW

**Tasks:**

1. Implement `minLength(config): number` in `minimum-length-calculator.ts`:
   - Inputs: `loopType, period, level, gridMode, turnIntensity, propContinuity`
   - Closed-form based on:
     - `basePatternMinimum(loopType, level)` — minimum beat count per period-chunk (1 or 2 depending on level capability)
     - `period` — multiplier
     - Level-specific capacity: L1 (0 turns) cannot produce orientation period > 1, so non-rotation period 4 at L1 returns Infinity
   - Returns integer minimum OR `Infinity` if infeasible
2. Tabulate known minimums in tests — explicit expected value per (loopType, period, level, gridMode) combination.
3. App wrapper service with DI wiring.
4. In length picker (`LengthCard.svelte`):
   - Reactive derivation: `minLength($derived from config state)`
   - Chips below minimum: visually dimmed, disabled, with tooltip: *"Minimum {n} beats for {loopType} {periodName} LOOPs."*
   - If all chips disabled: show one-line inline message below card: *"{periodName} {loopType} LOOPs require at least {n} beats at Level {level}. Increase level, reduce period, or choose a different LOOP type."*
5. Update length state to clamp to minimum on period/loopType change: if user had 4 selected and new minimum is 8, auto-adjust to 8.

**Verification:**
- New tests pass with tabulated values.
- Manual UI check: select mirrored, period 4, L1 → observe length chips disabled with inline explanation.
- `npm run check` clean.

---

## Phase 6 — Period card replaces slice card

**Goal:** every LOOP type exposes a period selector in the generator.

**Files:**
- `src/lib/features/create/generate/components/cards/SliceSizeCard.svelte` — DELETE (or rename and repurpose)
- `src/lib/features/create/generate/components/cards/PeriodCard.svelte` — NEW (or rename from SliceSizeCard)
- `src/lib/features/create/generate/shared/services/implementations/CardConfigurator.ts` — update visibility rules
- `src/lib/features/create/generate/state/generate-config-state.svelte.ts` — rename `sliceSize` → `period: number`, add migration from old state
- `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte` — wire new card

**Tasks:**

1. Rename `SliceSizeCard.svelte` → `PeriodCard.svelte`. Update icon: period 2 uses `fa-rotate`, period 4 uses `fa-arrows-spin`, period 8 placeholder.
2. Update labels: "Halved", "Quartered", (future) "Octaved". Back integer values: 2, 4, 8.
3. Update `CardConfigurator` so the Period card is visible for ALL loop types (remove the rotated-only gate).
4. Update `generate-config-state`: `period: number` replaces `sliceSize: SliceSize`. Persist as integer.
5. Period options at L1–L4: `[2, 4]`. At L5+: `[2, 4, 8]` (grid-enabled). At L7+: `[2, 4, 8]` (wheel-enabled, same visible set). Future period 8 icon added when those levels ship.
6. Period options filter reactively by `minLength`: if a given period is infeasible at the current length, the chip is disabled (user can either change period or change length — they're mutually constraining).
7. Mapping for backward compat: read-only adapter that reads legacy `sliceSize` → period during migration window.

**Verification:**
- Period card visible for every LOOP type.
- Selecting mirrored + period 4 produces a generable sequence (via Phase 4 and Phase 5).
- Selecting ROTATED + period 4 produces the expected L1 Quartered Rotated Deck shape.
- `npm run check` clean.

---

## Phase 7 — Complete Cycle button removal

**Goal:** the Complete Cycle UI is gone; generated LOOPs are always closed.

**Files:**
- `src/lib/features/create/generate/components/cards/GenerateButtonCard.svelte` — remove Complete Cycle button, revert to single-button layout
- `src/lib/features/create/generate/components/GeneratePanel.svelte` — remove `onCompleteCycle` prop
- `src/lib/features/create/generate/state/generate-actions.svelte.ts` — remove `needsCycleCompletion`, `completeCycle()`, related state
- `src/lib/features/create/generate/shared/services/implementations/BuildResultTransformer.ts` — stop stamping `orientationCycleCount` (no longer needed; generator guarantees closure)
- `src/lib/features/create/generate/circular/services/implementations/OrientationCycleExtender.ts` — KEEP, move comments to note lab-only use
- `src/lib/features/create/generate/circular/services/implementations/OrientationCycleDetector.ts` — KEEP, mark as lab-diagnostic
- Any lab/debug UIs currently using Complete Cycle stay functional (Collision Lab, orientation lab)

**Tasks:**

1. Remove Complete Cycle button and its style block from `GenerateButtonCard.svelte`.
2. Remove `needsCycleCompletion` prop/state from all callers and templates.
3. Remove `completeCycle()` action from `generate-actions.svelte.ts`.
4. Update `BuildResultTransformer` to stop computing and stamping `orientationCycleCount`. Generated sequences rely on the generator's closure guarantee.
5. Add a regression test: generate a previously-problematic sequence (e.g., swapped LOOP at alpha6 box mode period 4). Confirm:
   - Final sequence has `lastBeat.endOrientation === firstBeat.startOrientation` for both hands
   - No Complete Cycle prompt appears in the UI
6. Keep `UndoOp.EXTEND_SEQUENCE` in the UndoManager type — it is still used by the LOOPRingButton / LOOPCompletionPopover flow (user builds a sequence, selects a LOOP type to apply, `SequenceExtender.extendSequence` completes it). Only the `UndoOp.GENERATE_SEQUENCE` flow and `needsCycleCompletion`-triggered state transitions are removed.
7. Leave `orientationCycleExtender` and `orientationCycleDetector` exports intact — lab tools still import them. Add a `@deprecated` JSDoc tag mentioning "for lab use only; new sequences close during generation."
8. **SequenceExtender (ring-button flow) orientation-closure:** the existing LOOPRingButton / LOOPCompletionPopover calls `SequenceExtender.extendSequence(sequence, { loopType, sliceSize })` which routes through `LOOPExecutor`. After this phase, extensions produced by the ring button may still end in orientation-open states for non-rotation LOOP types. Add a task: after the user-selected extension runs, invoke the orientation closure path (new Phase-4 `LOOPEndOrientationSelector` + turn-parity adjustment on the extended beats) so the ring-button flow also produces closed-form output. If the closure cannot be satisfied, surface an inline warning: *"Applying this LOOP requires half-turn adjustments the sequence doesn't currently contain. Consider generating instead."* No Complete Cycle button; no silent extension.

**Verification:**
- Generate panel shows single button (no Complete Cycle).
- Manual UI run: generate 10 different LOOP types × periods. All produce closed sequences. No button ever appears.
- Existing lab tools still compile.
- `npm run check` clean.

---

## Phase 8 — Modal copy matrix

**Goal:** the LOOP explanation modal shows period-aware, domain-aware, component-aware copy.

**Files:**
- `src/lib/shared/sequence-viewer/state/loop-modal-copy.ts` — NEW — copy matrix
- `src/lib/shared/sequence-viewer/components/LoopInfoModal.svelte` (or equivalent; the screenshot in the spec reference suggests an existing modal component) — consume the matrix
- `tests/unit/sequence-viewer/loop-modal-copy.test.ts` — NEW

**Tasks:**

1. Author `loop-modal-copy.ts` with entries for every realistic (period, component, domain) combination. Structure:
   ```ts
   export function resolveLoopCopy(args: {
     period: number;
     components: Array<{ component: LOOPComponent; domain?: LOOPDomain }>;
   }): { title: string; body: string }
   ```
2. Entries to author at minimum:
   - Period 2, rotated, location: existing copy ("two halves, second is 180° rotation of first")
   - Period 4, rotated, location: "four quarters, each 90° rotation"
   - Period 2, mirrored, location: "two halves, second is left-right mirror"
   - Period 2, flipped, location: "two halves, second is top-bottom flip"
   - Period 2, swapped: "two halves, second swaps blue and red"
   - Period 2, inverted: "two halves, second uses inverted motion types"
   - Period 2, rewound: "second half plays the first in reverse"
   - Period 4, mirrored (via orientation): "two halves mirror positionally; orientations take all four quarters to complete their cycle"
   - Period 4, swapped (via orientation): analogous
   - Period 4, rotated, orientation-domain: "grid positions stay pinned; orientations rotate 90° per quarter"
   - Fallback: generic "{components} LOOP with period {period}"
3. Wire the modal to consume `resolveLoopCopy({ period, components })` from `resolveLoopDisplay` output.
4. Tests: assert specific outputs for the sample (period, components) combinations.

**Verification:**
- Modal displays correct copy for each sample sequence in the library.
- `npm run check` clean.

---

## Phase 9 — Migration script

**Goal:** existing saved sequences get the new fields without data loss.

**Files:**
- `scripts/migrate-loop-period.cjs` — NEW
- `scripts/lib/loop-migration-helpers.ts` — NEW helper module (extracts period + components + domains from legacy `loopType` + `orientationCycleCount`)
- `tests/migration/loop-period-migration.test.ts` — NEW

**Tasks:**

1. Write `loop-migration-helpers.ts`:
   - `deriveNewLoopFields(sequence): { period, components, componentDomains }` using `periodFromLegacyFields` helper from Phase 1 and component parse from existing `parseComponents` adapted to emit DetectedComponents with `domain: "location"` as the conservative default.
2. Write `migrate-loop-period.cjs`:
   - Read all sequences from public index + user libraries (use existing Firebase admin utilities in other migration scripts as a template).
   - For each sequence: compute new fields, write back. Preserve legacy fields.
   - Idempotent: running twice produces no additional changes.
   - Dry-run mode: report what would change without writing.
   - Progress bar + resume-from-failure support.
3. Test migration on a snapshot of the public index (locally):
   - 100% of sequences get `period ∈ {1, 2, 4}`.
   - 100% of circular sequences with `orientationCycleCount > 1` end up with `period >= orientationCycleCount`.
   - L1 Quartered Rotated Deck: all 192 sequences keep `period: 4, components: [{ ROTATED, location }]`.
4. Document in `docs/reference/` how to run the migration.

**Verification:**
- Dry-run over a library snapshot produces sensible diffs.
- Real run completes without errors.
- Sample re-read of migrated sequences confirms new fields present and old fields intact.

---

## Phase 10 — Cleanup and deprecation

**Goal:** old surfaces removed once no live consumer depends on them.

**Files:**
- `src/lib/features/create/generate/circular/domain/models/circular-models.ts` — remove `SliceSize` enum
- `src/lib/features/create/generate/shared/domain/models/generate-models.ts` — remove deprecated surfaces
- `src/lib/features/create/generate/shared/services/implementations/LOOPTypeResolver.ts` — deprecate `parseComponents`, point to `resolveLoopDisplay`
- `src/lib/shared/foundation/domain/models/SequenceData.ts` — remove `orientationCycleCount` field (loopType string stays longer)
- Wide grep and migration of remaining `sliceSize` references

**Tasks:**

1. Verify no runtime consumer references `SliceSize`:
   - Grep the entire codebase
   - If any exist, migrate them to `period: number`
2. Remove `SliceSize` enum and its export.
3. Remove `orientationCycleCount` from `SequenceData`. Verify all lab tools that previously read it either compute from steps or gracefully handle undefined.
4. Mark `LOOPTypeResolver.parseComponents` as `@deprecated` with JSDoc pointing to `resolveLoopDisplay`. Keep the function for one more release (external consumers may exist).
5. Mark `loopType: string` on `SequenceData` as `@deprecated` but preserve it — lots of external references (MCP tools, older exports, etc.).
6. Update `LOOPGenerationOptions`: `sliceSize` removed, `period: number` required.
7. Delete commented-out code in `generate-actions.svelte.ts` that was marked transitional in Phase 7.

**Verification:**
- `npm run check` clean.
- Full test suite passes.
- Grep confirms `SliceSize` and `orientationCycleCount` have no remaining code references (except in migration history).

---

## Cross-cutting test matrix

A test suite that runs at the end of every phase, asserting:

1. **Existing L1 Quartered Rotated Deck preserved:** 192 sequences retain their shape; detector emits `{ period: 4, components: [{ ROTATED, location }] }` for each.
2. **Form-C example correctly classified:** the 4-alpha 0.5-turn sequence from the spec renders `{ period: 4, components: [{ ROTATED, orientation }] }` and LOOPIconStrip renders `fa-arrows-spin`.
3. **Generator orientation closure:** 100 generated LOOPs across all supported (loopType, period, level) combinations all close in both position and orientation without extension.
4. **Infeasibility surfacing:** requesting mirrored period 4 at L1 produces `LoopInfeasibleError` from the generator and a disabled-chip UX in the length picker.
5. **Migration idempotency:** running the migration twice produces no diff on the second run.
6. **Modal copy presence:** every (period, components) combination that appears in the current library has an entry in the copy matrix (no fallback hits in the library scan).
7. **Reserved primitives invisible:** UI consumers never receive zone-hold-invert / zone-hold-flip / zone-cross in their components arrays.
8. **Backward-compat read path:** sequences that predate migration but haven't been migrated still render correctly in ChoreoCard / SequenceDisplay / CardBack (via the legacy field adapters).

---

## Risk register

**R1: Generator infeasibility at L1 for some period combinations.** Mitigation: document in minLength that L1 cannot produce orientation period > 1; UI chips disable correctly; users are never surprised.

**R2: LOOPExecutor.executeRotated path has existing callers in tests.** Mitigation: Phase 4 adds the feature flag, Phase 7 deprecates not removes. Tests that exercise post-hoc extension explicitly stay on the legacy path during phase 4–7; they're either migrated or removed in phase 10.

**R3: Migration write corruption.** Mitigation: Phase 9 has dry-run mode and idempotency guarantees. Back up the public index before the real run. Migration is non-destructive (adds fields, doesn't remove).

**R4: MCP-side generator out of sync.** Mitigation: the MCP consumes `@tka/sequence-engine`, so engine changes propagate. Per-tool API surfaces (loop-tools.ts) may need review — flag as follow-up work.

**R5: Scope creep during Phase 4.** Mitigation: per-type closure constraints (mirrored/flipped/swapped/inverted) are the risk. Each is a separate file; stop-ship gates per constraint type. If one proves intractable, downgrade to "period 2 only" for that type and note as limitation.

**R6: Existing decks shift category after migration.** Sequences classified as halved today may become quartered tomorrow if their orientation cycle was >1. Mitigation: Phase 9 report surfaces all re-classifications before the real run; review the list before committing to it.

**R7: SequenceExtender (ring-button) flow diverges.** The ring-button "apply LOOP" flow uses `SequenceExtender` not `SequenceBuilder`. Phase 7 addresses this by adding a closure pass after extension, but the full unification of the two pipelines is deferred. Risk: ring-button extensions may produce "applies partially" experiences at edge cases. Mitigation: surface the infeasibility inline; for critical LOOP types (common generator-user requests), write the ring-button flow through the generator via an adapter.

**R8: Level type does not yet extend to L5/L6.** The generator's level enum is currently constrained to L1-L3 in some places, L1-L4 in others. This plan's forward-compat claims for period 8 assume level support extends. That support is out-of-scope here; period 8 chips will stay disabled until the separate L5/L6 projects land. Mitigation: the data model accepts any integer period, and the UI gracefully disables period 8 chips today.

---

## Completion criteria (same as spec acceptance criteria)

1. Every saved sequence migrates without data loss; L1 Quartered Rotated Deck retains 192-count.
2. Generator produces orientation-closed LOOPs for every feasible (loopType, period, level). No user flow runs post-hoc extension.
3. Complete Cycle button does not appear in any user UI.
4. LOOP modal shows period-aware copy.
5. Form-C example correctly classified and rendered.
6. Reserved orientation primitives represented in the enum, detectable, but not user-visible.
7. Period 8 representable without schema changes; UI gracefully handles period > 4.

---

## Out of scope (carved out per spec)

- Deck enumerator rewrite (separate project)
- L5 8-grid generator (separate project)
- L6 8-wheel generator (separate project)
- Orientation primitive promotion (separate project when evidence emerges)
- MCP-side generator per-tool API review (follow-up after engine stabilizes)
- Collision-lab / orientation-lab UX updates (independent of this plan)
