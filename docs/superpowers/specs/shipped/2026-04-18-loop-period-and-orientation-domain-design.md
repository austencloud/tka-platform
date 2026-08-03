# LOOP Period and Orientation Domain

**Date:** 2026-04-18
**Status:** Design

---

## Problem

The current LOOP system conflates two independent cycle axes — positional and orientational — into a single `sliceSize: "halved" | "quartered"` field that only applies to rotation. Five consequences follow:

1. **Orientation-rotated LOOPs aren't recognized.** A static-location sequence whose orientations cycle through the wheel is positionally trivial but structurally rotated. Today it renders as `loop: none` or `rotated` with `sliceSize: halved`, neither of which captures its real structure.

2. **Non-rotation LOOPs are second-class.** Mirrored, flipped, swapped, and inverted all implicitly assume halved positional + single-cycle orientation. Users cannot deliberately request a quartered mirrored LOOP. The generator has no API for it.

3. **The "Complete Cycle" workaround exposes an incomplete abstraction.** When a generated LOOP closes positionally but not orientationally, the UI prompts the user to extend the sequence — patching a fundamental generator gap at runtime instead of producing a closed LOOP directly.

4. **Terminology is rotation-centric.** "Slice" was inherited from the L1 Quartered Rotated Deck. It doesn't generalize to the non-rotation case, and it doesn't scale to L5 (grid-D8) or L6 (wheel-D8) where period 8 becomes possible.

5. **Deck taxonomy cannot express the real space.** The existing L1 Quartered Rotated Deck (192 sequences) is one specific intersection. Quartered Mirrored, Quartered Swapped, Quartered Rotated-in-Orientation, and their combinations are distinct deck families that the current model cannot enumerate or surface.

This design addresses all five by introducing **period** as a first-class integer property of every LOOP, by making orientation closure a generator-time constraint rather than a post-hoc extension, and by formalizing the split between location-domain and orientation-domain transformations.

---

## Conceptual Model

### Period

Every LOOP has a **period** — a positive integer equal to the number of structural subdivisions in the closed cycle. The sequence is composed of `period` consecutive chunks, each related to the previous by the LOOP's transformation set. After `period` chunks, both positions AND orientations return to their starting state.

Current system: period ∈ {2 (halved), 4 (quartered)}.
After this design: period ∈ {1, 2, 4} at L1–L4; extends to {1, 2, 4, 8} at L5+ (grid-D8) and L6+ (wheel-D8).

Period replaces the `sliceSize` enum everywhere — in data, UI, generator, detector, and docs.

### Two cycle axes

**Positional cycle** — how many pattern-chunks until grid locations repeat. Determined by the LOOP component's geometric action on the grid:
- Rotated-location: period = 4 (quartered) when 90° step, 2 (halved) when 180° step
- Mirrored-location / Flipped-location: period = 2
- Swapped / Inverted / Rewound: period = 2 positionally

**Orientational cycle** — how many pattern-chunks until prop orientations return. Determined by per-pass turn arithmetic:
- Total turns per pass (per hand) mod 2 = 0 (even integer) → orientation period 1
- Total mod 2 = 1 (odd integer) → orientation period 2
- Total mod 2 = 0.5 or 1.5 (half-integer) → orientation period 4

Floats contribute ±0.5 turns to this arithmetic (sign is a direction convention, magnitude is fixed).

**Total period = LCM(positional, orientational)** — all-powers-of-2 so LCM collapses to max in {1, 2, 4}. At L5/L6 it stays max in {1, 2, 4, 8}.

### Domains

The three geometric LOOP components (rotated, mirrored, flipped) have a `domain` qualifier:

| Component | Location | Orientation | Both |
|---|---|---|---|
| Rotated | ✓ | ✓ | ✓ |
| Mirrored | ✓ | reserved | reserved |
| Flipped | ✓ | reserved | reserved |

Rotated is the only component with full domain support in scope. Orientation variants of mirrored and flipped are mathematically valid but have no choreographic semantics in the current performance vocabulary; they are added as reserved enum values and detectable categories but not generated or surfaced.

The three non-geometric components (swapped, inverted, rewound) do not have a domain — they operate on role, motion-type, and time axes respectively.

### Zone algebra

The orientation wheel {in, out, clock, counter} partitions into two zones:

- **Radial zone:** {in, out}
- **Nonradial zone:** {clock, counter}

Whole turns traverse within a zone (in ↔ out, clock ↔ counter).  
Half turns traverse between zones (in → clock → out → counter).

**Generator rule (closed form):** orientation period > 1 requires at least one non-integer-total turn pass per hand. To deliberately generate orientation period 4, constrain per-pass per-hand turn totals so the mod-2 fractional part is 0.5. To deliberately stay at orientation period 1, keep totals as even integers.

At L6, the wheel expands to 8 orientations (4 radial + 4 interradial) and zone arithmetic gets finer — quarter-turn transits between adjacent orientations become valid. Period 8 unlocks here.

### Reserved orientation primitives

Three new LOOPComponents are added to the enum as reserved taxonomy. They are detectable but not surfaced in UI, not produced by the generator, and not exposed to users. They exist so future sequences that exhibit them can be correctly classified and so future work can promote them to first-class:

- **Zone-hold-invert** — orientations swap in↔out (within radial zone)
- **Zone-hold-flip** — orientations swap clock↔counter (within nonradial zone)
- **Zone-cross** — orientations move between radial and nonradial zones

---

## Decisions

### D1. Period replaces slice

Every data structure, service contract, field name, UI label, and doc that references `sliceSize`, `"halved"`, or `"quartered"` as an enum is migrated to `period: number`. The `SliceSize` enum is deleted after migration.

### D2. LOOPs close fully

A sequence is not a LOOP unless it closes in both position and orientation within its own length. Sequences that return position but not orientation are not valid LOOPs, do not get LOOP classification in detectors, and are not persisted as LOOPs in the library or decks.

### D3. Generator produces closed form directly

The generator accepts `loopType + period + length` and produces a fully closed sequence of that length. If the requested (loopType, period, length, level, turnIntensity, ...) combination is infeasible, the generator fails with a structured error identifying which constraint was unsatisfiable.

### D4. Complete Cycle button removed

The `needsCycleCompletion` flag and the Complete Cycle button are removed from user-facing flows. `orientationCycleExtender` and `orientationCycleDetector` stay in the codebase as lab/debug utilities — they compute from sequence steps on demand, not from a persisted `orientationCycleCount` field (see D7).

### D5. Detector is domain-aware

`LOOPDetector` and `resolveLoopDisplay` run orientation-domain detection alongside location-domain detection. The result exposes `components: LOOPComponent[]` plus per-component `domain` where applicable, and a top-level `period: number`.

### D6. Modal copy is period-aware

The LOOP explanation modal renders a copy string derived from `(period, activeComponents, domains)`. Strings are authored for all plausible combinations; unknown combinations fall back to a generic template.

### D7. Data model

`SequenceData` gains `period: number`. The `orientationCycleCount: 1 | 2 | 4` field is removed (its information is subsumed by `period` + the generator's closed-form guarantee). `loopType: string` is preserved for backward compat during migration but deprecated in favor of the component array. `LOOPGenerationOptions.sliceSize` is renamed to `period: number`.

### D8. Forward compatibility

Period is integer-valued. No hard cap. Period 8 becomes reachable when EITHER the grid expands (L5 skewed motions → grid-D8) OR the wheel expands (L6 interradial orientations → wheel-D8) OR both together. The generator, detector, and UI must not hard-code period ∈ {2, 4}. Period 8 generator and UI work is out of scope for this spec but must not be blocked by hard-coded assumptions.

### D9. Reserved orientation primitives

`LOOPComponent` enum adds `ZONE_HOLD_INVERT`, `ZONE_HOLD_FLIP`, `ZONE_CROSS`. Detector includes detection cases. Reserved primitives are filtered out of the component list before the list is handed to UI renderers (`LOOPIconStrip`, modal copy matrix, ring button), so no user-facing surface references them. They appear only in detection metadata consumed by labs and diagnostic readouts. When a real pattern emerges, promotion is a scoped follow-up.

### D10. Icon indicator

Scope-B icon work is retained: `fa-rotate` for period 2, `fa-arrows-spin` for period 4, both applied to the rotated component when that component is active. Period 8 icon is TBD — designed when L5/L6 generator lands. Other components' icons do not change based on period.

### D11. Minimum-length calculator and reactive length picker

A deterministic calculator returns `minLength(loopType, period, level, gridMode, turnIntensity) → number`. The length picker in the generator UI consumes this reactively: chips below the minimum are dimmed with an inline explanation (*"Mirrored quartered LOOPs require at least 4 beats."*). User cannot reach an infeasible configuration.

---

## Data Model Changes

### LOOPComponent enum

Current 6 primitives retained. Add 3 reserved primitives:

```ts
export enum LOOPComponent {
  ROTATED = "rotated",
  MIRRORED = "mirrored",
  FLIPPED = "flipped",
  SWAPPED = "swapped",
  INVERTED = "inverted",
  REWOUND = "rewound",
  // Reserved — detection only, no UI surface
  ZONE_HOLD_INVERT = "zone_hold_invert",
  ZONE_HOLD_FLIP = "zone_hold_flip",
  ZONE_CROSS = "zone_cross",
}

export type LOOPDomain = "location" | "orientation" | "both";

export interface DetectedComponent {
  component: LOOPComponent;
  domain?: LOOPDomain; // only present for ROTATED, MIRRORED, FLIPPED
}
```

### SequenceData fields

```diff
  interface SequenceData {
    id: string;
    word: string;
    steps: StepData[];
    isCircular: boolean;
-   orientationCycleCount?: 1 | 2 | 4;
    loopType?: string;                   // deprecated; preserved read-only during migration
+   period?: number;                     // integer, computed at save time, persisted
+   components?: LOOPComponent[];        // computed at save time, persisted
+   componentDomains?: Record<LOOPComponent, LOOPDomain>; // for ROTATED/MIRRORED/FLIPPED only
    // ...
  }
```

### LOOPDetectionResult

```diff
  interface LOOPDetectionResult {
    loopType: string | null;
-   components: ComponentId[];
+   components: DetectedComponent[];
+   period: number;  // 1 if not a LOOP
    transformationIntervals: TransformationIntervals;
    rotationDirection: "cw" | "ccw" | null;
    // ...
  }
```

### LOOPGenerationOptions

```diff
  interface LOOPGenerationOptions {
    length: number;
    loopType: LOOPType;
-   sliceSize: SliceSize;
+   period: number;                      // 2, 4, or 8 (8 requires L5+ or L6+)
    turnIntensity: number;
    level: number;
    propContinuity: "continuous" | "non-continuous";
    gridMode: "box" | "diamond";
+   componentDomains?: Partial<Record<LOOPComponent, LOOPDomain>>;
  }
```

`SliceSize` enum is deleted after migration.

---

## Detector Changes

### `resolveLoopDisplay` — orientation pass added

`src/lib/features/loop-labeler/services/loop-display-resolver.ts` gains a second detection pass:

1. **Location pass** (existing) — current `LOOPDetector.detectLOOP` on grid positions.
2. **Orientation pass** (new) — same detection algorithm applied to orientation trajectories instead of location trajectories. Uses the existing `OrientationPropagator` to compute orientation-per-beat, then runs the same quartered/halved pattern matching.
3. **Merge** — combine results. A component detected in both passes is emitted with `domain: "both"`. Detected in only one: `domain: "location"` or `"orientation"`.
4. **Period computation** — `max(positionalPeriod, orientationalPeriod)` using the LCM-collapses-to-max property.

Cache is keyed by sequence id as before. A `forceRecompute` option is added for the lab UIs.

### `LOOPDetector` contract changes

```diff
  export interface LOOPDetectionResult {
-   components: ComponentId[];
+   components: DetectedComponent[];
+   period: number;
    // ...
  }
```

Callers (ChoreoCard, CardBack, SequenceDisplay, AnimatorCanvas, VideoExportOrchestrator, ImageComposer) update to consume the new shape. The scope-B migration already centralized this behind `resolveLoopDisplay`, so changes are confined to the resolver.

### Reserved orientation primitives — detection stubs

`LOOPDetector` adds detection cases for `ZONE_HOLD_INVERT`, `ZONE_HOLD_FLIP`, `ZONE_CROSS`. They run but do not alter UI output. They are logged in detection metadata for debug / lab consumption and for eventual promotion.

---

## Generator Changes

### Orientation as a first-class beam-search constraint

Currently `SequenceBuilder` (`packages/sequence-engine/src/generation/builder/SequenceBuilder.ts`) tracks position through `SearchState` and uses `PositionReachabilityAnalyzer` to prune unreachable paths. Orientation is computed post-hoc in `OrientationPropagator`.

**Change:**

1. **Augment `SearchState`** with `blueOrientation: Orientation` and `redOrientation: Orientation`. These propagate forward through beam search using the same `calculateEndOrientation` call the propagator uses today.

2. **Add `OrientationReachabilityAnalyzer`** paralleling `PositionReachabilityAnalyzer`. Given `(requiredEndOrientation, remainingBeats, level, turnIntensity)`, returns the set of orientations from which the end state is reachable under valid variations. Used to prune beam states whose orientation drift cannot close.

3. **End-state targeting** extends from position-only to (position, orientation):
   - Compute `requiredEndPosition` from `(startPosition, loopType, period, domain)` — already partially done in `LOOPEndPositionSelector`.
   - Compute `requiredEndOrientation` from `(startOrientation, loopType, period, domain, turnParityConstraint)`.
   - Beam search accepts both as hard closure constraints.

4. **LOOPExecutor partially deprecated.** `LOOPExecutor.executeRotated` and the geometric LOOP extension paths are made unreachable for new generations — for geometric LOOPs, the transformation becomes a generator-time constraint (e.g., mirrored requires beat `i + length/2` to be the mirror-transformation of beat `i` — expressed as a variation constraint during beam search). **REWOUND is a special case and keeps its current post-hoc implementation**: it is a time-axis transformation, not a geometric one, and its closure logic (reverse motions, derive letters) is fundamentally different from geometric closure. `LOOPExecutor.executeRewound` stays reachable.

5. **Non-rotation geometric LOOP types get native generator support.** `LOOPExecutor` currently only implements REWOUND and ROTATED. Mirrored, flipped, swapped, inverted gain generator-side constraints (they never reach LOOPExecutor because they're satisfied during beam search).

### Per-pass turn parity constraint

The generator adds a `TurnParityConstraint` that enforces per-hand per-pass total-turn mod-2 equals a target value:

- Orientation period 1 → target mod-2 = 0 (even integer total)
- Orientation period 2 → target mod-2 = 1 (odd integer total)
- Orientation period 4 → target mod-2 ∈ {0.5, 1.5} (half-integer total)

This constraint is derived from `(requestedPeriod, positionalPeriod)` using `orientationPeriod = requestedPeriod / positionalPeriod` (guaranteed integer because both are powers of 2 and positionalPeriod divides requestedPeriod).

### End-orientation resolver

Paralleling `LOOPEndPositionSelector`, add `LOOPEndOrientationSelector`:

```ts
determineEndOrientation(
  startOrientation: { blue: Orientation; red: Orientation },
  loopType: LOOPType,
  period: number,
  domains: Record<LOOPComponent, LOOPDomain>,
): { blue: Orientation; red: Orientation }
```

For each (loopType, period, domain), returns the required end orientation. Examples:

- Rotated location-domain period 4: end orientation = start orientation (0-turn seed returns wheel trivially over 4 quarter-rotations)
- Rotated orientation-domain period 4: end orientation = start orientation AFTER 4 wheel rotations; turn totals must sum to half-integer per pass so the 4-cycle returns
- Mirrored period 4 (via orientation): end orientation = start orientation after 2 passes of the halved base, orientation period 2, turn totals must be odd-integer

### Minimum-length calculator

```ts
minLength(config: GenerationConfig): number
```

Closed-form based on:
- `basePatternMinimum(loopType, level)` — minimum beat count per period-chunk (typically 1 or 2 depending on level and whether the loopType permits 1-beat seeds)
- `period`
- `level`-specific constraints (e.g., L1 0-turn cannot produce orientation period > 1)

Returns the minimum length that satisfies all constraints. If the requested period × basePatternMinimum exceeds available level capacity, returns `Infinity` (signals infeasible — UI disables that period option entirely).

### Infeasibility as prevention, not failure

The generator's `generate()` function is never reached with an infeasible (loopType, period, length) because the UI's length picker cannot select such a combination. If called programmatically with an infeasible combo (from tests, from the MCP, from legacy callers), the generator throws a structured `LoopInfeasibleError` with the specific constraint that blocks.

---

## UI Changes

### Generator panel: length picker reactivity

`src/lib/features/create/generate/components/cards/` — the length card consumes `minLength(config)` and:
- Disables length chips below the minimum
- Shows an inline explanation when any chip is disabled: *"Minimum {n} beats for {loopType} {periodName} LOOPs."*
- If all chips are disabled (combination completely infeasible): surfaces a one-line message below the card indicating which axis is blocking (usually period or turnIntensity), with a link to the relevant explanation.

### Generator panel: period card replaces slice card

Current "Slice Size" card (visible only for rotated LOOPs) is replaced by a **Period** card visible for ALL LOOP types. Options: 2, 4 (and 8 at L5+/L6+). Labels: "Halved", "Quartered", "Octaved" — user-facing copy — backed by integer values.

### Generator panel: Complete Cycle button removed

`GenerateButtonCard.svelte` reverts to single-button layout. `needsCycleCompletion` state removed from `generate-actions.svelte.ts`.

### LOOP explanation modal: period-aware copy

Template renderer in the modal consumes `(period, components, domains)` and produces a copy string from a matrix. Example entries:

- Period 2, rotated, location-only: *"Rotated LOOP, halved. The second half applies a 180° rotation to the first half. Played on repeat it loops seamlessly in 2 halves."*
- Period 4, rotated, location-only: *"Rotated LOOP, quartered. The sequence divides into 4 quarters. Each quarter applies a 90° rotation to the previous. It takes all 4 to return to both the starting position and the starting orientation."*
- Period 4, mirrored, location-only (orientation-extended): *"Mirrored LOOP, quartered. Two halves mirror each other positionally, and the full cycle takes 4 quarters for the orientations to complete their own cycle."*
- Period 4, rotated, orientation-domain only: *"Rotated LOOP in orientation, quartered. Grid positions stay pinned; prop orientations rotate 90° per beat through the full wheel."*

A JSON copy matrix at `src/lib/shared/sequence-viewer/state/loop-modal-copy.ts` holds all combinations. Unknown combinations fall back to a generic: *"This sequence is a {components} LOOP with period {period}."*

### LOOPIconStrip (already done)

Scope-B work retained. Period 2 → `fa-rotate`, period 4 → `fa-arrows-spin`, both applied to the rotated component icon when active. No changes to other components' icons based on period.

---

## Migration

### Existing saved sequences

Saved sequences have `loopType: string` and `orientationCycleCount: 1 | 2 | 4`. Migration script `scripts/migrate-loop-period.cjs`:

1. For each sequence in public index + user libraries:
   - Compute `period = max(positionalPeriodFromLoopType, orientationCycleCount)`
   - Compute `components = parseComponents(loopType)` with `domain: "location"` for all geometric components (conservative default)
   - Write new fields, preserve `loopType` for read-only compat
2. No data loss — old fields retained, new fields added alongside.
3. Run once, idempotent.

### Existing decks

The L1 Quartered Rotated Deck (192 sequences) survives intact — all are `period: 4`, `components: [ROTATED]` with `domain: "location"`.

Other decks that today include sequences with `orientationCycleCount > 1` are re-classified. These sequences get `period: max(...)` and may move from "halved" deck membership to "quartered" deck membership. The migration preserves deck IDs but updates the `loop` metadata on each sequence; downstream deck-membership resolution recomputes.

Deck enumerator rewrite is **out of scope** for this spec — it runs as a separate project when this substrate lands.

### Removed fields

After migration and a deprecation period (one release):
- `SliceSize` enum
- `orientationCycleCount` field
- `LOOPGenerationOptions.sliceSize` (renamed to `period`)

`loopType: string` stays for a longer deprecation — too many external references to retire in one pass.

---

## Test Strategy

### Generator — orientation closure

New test file `packages/sequence-engine/tests/integration/orientation-closure.test.ts`:

- For every (loopType, period, level) combination, generate 10 sequences and assert `lastBeat.endOrientation === firstBeat.startOrientation` for both hands. No post-hoc extension.
- Specific regression for the Complete-Cycle-was-needed cases: swapped LOOP at alpha6 in box mode. Generator must produce closed form directly.
- Infeasibility: attempt to generate mirrored-quartered at L1 (0 turns). Assert `LoopInfeasibleError` thrown.

### Detector — domain-aware

New assertions in `tests/unit/loop-labeler/LOOPDetector.test.ts`:

- Static-alpha 4-beat sequence (your form-C example) → `components: [{ component: ROTATED, domain: "orientation" }]`, `period: 4`.
- Mirrored halved + orientation cycle 2 → `components: [{ component: MIRRORED, domain: "location" }]`, `period: 4`.
- L1 quartered rotated deck sample → `components: [{ component: ROTATED, domain: "location" }]`, `period: 4`.

### Reserved orientation primitives — detection stubs

- A hand-crafted sequence exhibiting zone-hold-invert pattern → detector emits ZONE_HOLD_INVERT in debug metadata without surfacing in UI.

### Minimum-length calculator

Pure unit tests for every (loopType, period, level) combination — known expected minimums tabulated in the test file.

### Regression — existing decks

After migration script runs on a snapshot of the current public index:
- 192 L1 Quartered Rotated Deck sequences retain `period: 4`, `components: [{ component: ROTATED, domain: "location" }]`
- No sequence loses classification (no migration produces a worse category than before)
- All sequences that previously had `orientationCycleCount > 1` now have `period` reflecting the combined cycle

---

## Out of Scope

Carved out for future specs:

- **Deck enumerator rewrite** — traverse the multidimensional deck space (loopType × period × domain × level × gridMode × turnIntensity × propContinuity × startingPositionClass) and produce enumerated decks. Downstream of this design; will become its own project after the substrate lands.
- **L5 8-grid generator** — skewed motions and 8-point grid support. Period 8 positional unlocks here. Requires grid generalization beyond this spec.
- **L6 8-wheel generator** — interradial orientations and 8-point orientation wheel. Period 8 orientational unlocks here. Requires orientation-algebra generalization.
- **Orientation primitive surfacing** — promoting `ZONE_HOLD_INVERT`, `ZONE_HOLD_FLIP`, `ZONE_CROSS` to first-class (icons, generator UI, modal copy, deck membership). Wait for evidence of real sequences needing them.
- **MCP-side generator rewrite** — the MCP package has a parallel generator in `mcp-server/src/`. It consumes the same sequence-engine package, so most changes propagate automatically, but per-MCP-tool API surfaces may need review. Scope for a follow-up plan.
- **Complete Cycle as lab tool** — repurposing `OrientationCycleExtender` as a collision-lab / orientation-lab utility. Keep the code, remove from user UI only. Lab-facing UX is its own design.

---

## Open Questions (resolve during plan writing)

- Does `LOOPType` enum survive or collapse into `{components, period, domains}`? Leaning toward: preserve as a computed display-name for named combinations (ROTATED_SWAPPED etc.), but drive all logic from the structured triple.
- Does `LOOPGenerationOptions` become redundant given that `loopType` + `period` + `domains` fully parameterize generation? Leaning toward: retire `loopType` enum from generation options, keep it as a post-hoc display label.
- What happens to the existing `parseComponents(loopType)` API used in non-ChoreoCard consumers? Leaning toward: deprecate in favor of `resolveLoopDisplay`; inline-migrate remaining callers.

---

## Why This Design

**The substrate is mathematical, not UX-driven.** Period, domain, and zone algebra describe the actual structure of TKA sequences. The current model's slice/rotation-only framing was historically adequate because L1-L4 with integer-only turns and the 4-point orientation wheel limited what could show up. As the system grows (L5+ grid-D8, L6+ wheel-D8) and as existing decks are more fully explored (non-rotation quartered LOOPs that the generator cannot produce today), the constraints tighten and the old model breaks.

**LOOPs-close-fully is a UX simplification, not a complication.** Removing the Complete Cycle button removes a foot-gun. Users who select quartered-mirrored get a closed sequence the first time. Users who hit infeasibility see an inline explanation with actionable guidance instead of a failed generation.

**Period-aware deck enumeration is where this pays off.** Each new constraint dimension (loopType × period × domain) produces finite, enumerable, cognitively-coherent deck families. The L1 Quartered Rotated Deck becomes one of many — each with its own cardinality, each teaching a distinct concept through numerous examples.

---

## Acceptance Criteria

A future implementation plan is complete if:

1. Every existing saved sequence migrates without data loss; the L1 Quartered Rotated Deck retains its 192-count integrity.
2. The generator produces orientation-closed LOOPs for every (loopType, period, level) combination that the minimum-length calculator permits. No post-hoc extension runs in the user flow.
3. The Complete Cycle button does not appear in any user-visible UI.
4. The LOOP modal shows period-aware copy for the current active sequence.
5. The static-alpha 4-beat example (form C) is correctly classified as `{ components: [{ ROTATED, domain: orientation }], period: 4 }` and the rotated icon renders as `fa-arrows-spin`.
6. All three reserved orientation primitives are represented in the `LOOPComponent` enum and have detection stubs, but do not appear in any user-facing UI.
7. Period 8 is representable in the data model without schema changes; UI gracefully handles period > 4 with a placeholder icon until L5/L6 designs land.
