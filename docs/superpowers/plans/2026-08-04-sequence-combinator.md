# Sequence Combinator + Analyzer Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Given two complete sequences, enumerate every closed-loop combination (concatenation / fusion / braid / hybrid, with optional ambient base-vocabulary pinches) or prove none exists — plus a lab page that renders results and revives the orphaned similarity analyzer.

**Architecture:** Three layers. Layer 0: letter calculus over a position-family graph (word-level sieve + derivation labels). Layer 1: seam-graph search — closed alternating walks over card A, 32 dihedral/color/invert variants of card B, and ambient base material, where a seam is a `GridPosition` and the rotation-faithful continuity branch is modeled as precomputed "inverted twin" sources. Layer 2: lab page at `/test/sequence-combinator` rendering results via `PictographContainer`, with the `shared/comparison` suite wired in as a similarity panel.

**Tech Stack:** TypeScript pure services under `src/lib/shared/combination/`, vitest (`npm run test -- <path>`, config `tests/config/vitest.config.ts`), Svelte 5 lab page, existing transforms (`sequence-transformer.ts`), `SequenceCanonicalizer`, `PictographContainer`, `BrowsePanel` picker recipe.

**Spec:** `docs/superpowers/specs/2026-08-04-sequence-combinator-design.md`

> **DELTAS after Task-1 code review (2026-08-04) — these override the inline code of Tasks 5–12 where they conflict:**
> 1. The continuity-fork flag is named **`rotationFaithful`** (not `inverted`): motionType PRO↔ANTI flips, rotation direction and locations preserved (Austen's FLGGFLHH G→H mutation). The existing `invertMotion` (flips both) is NOT used for twins. `CombinationResult.invertedBlocks` → `rotationFaithfulBlocks`.
> 2. `WalkSource` is a discriminated union on `kind` — card sources have non-null `sequence`; ambient sources have `ambientWord` and no sequence. No `!` assertions downstream.
> 3. Seam reads go through `seamOf(step)` / `seamEndOf(step)` from `position-groups.ts` (return `SeamState | null`) — never `step.startPosition as SeamState`. Null seams never match.
> 4. `CombinatorVerdictReport` → **`CombinationSearchReport`**; `exhausted` → **`searchComplete`**.
> 5. Defaults live in **`COMBINATOR_DEFAULTS`** exported from `domain/types.ts`; `CombinatorOptions` extends `Partial<typeof COMBINATOR_DEFAULTS>` plus optional `ambientProvider` (declared in types.ts, not the service). Task 6's local `DEFAULTS` is replaced by this const.
> 6. `cardAMaterial`/`cardBMaterial` → `cardAShare`/`cardBShare`.
> 7. `SeamEntry` deleted (search uses an inline shape).
> 8. Task 3 must record its never-hand-roll statement: sequence-engine's `LetterPositionInfo` + spell's `LetterTransitionGraph` are prior art but are alpha/beta/gamma-only and generation-bound; Layer 0 needs all 7 families + ingredient attribution.
>
> **DELTAS after Task-2 fixture hardening (2026-08-04):**
> 9. **The rotation-faithful twin operation is REDEFINED** (dataframe proof: motionType is derived from hand-path direction × prop-rotation direction, so Task 5's `flipProAnti` — flip type, keep rotation AND locations — produces rows that don't exist). Correct twin: **reverse the cyclic traversal** (reverse step order; per step swap startLocation↔endLocation per hand, startPosition↔endPosition, startOrientation↔endOrientation), **keep each motion's `rotationDirection`**, then recompute motionType via `deriveMotionType` and letters via `deriveSequenceLetters`. Proof from fixtures: twin(GGGG_CW: beta1→3→5→7, pro+cw) = `HHHH_CW` (beta1→7→5→3, anti+cw) — matches Austen's FLGGFLHH (prop rotation continuous, path reversed, G→H fallout). Task 5 must also fix `VariantDescriptor.rotationFaithful`'s doc comment in types.ts ("rotation direction and locations preserved" is wrong — rotation direction preserved, traversal reversed).
> 10. **The pictograph dataset loads under vitest** via `tests/unit/combination/pictograph-dataset.ts` → `loadPictographDatasetForTests()` (window.csvData pre-injection tier; real CsvLoader→csvParser→MotionQueryHandler pipeline, zero mocks). Task 5+ letter-derivation assertions run for real in node — no DI stubs needed.
> 11. New fixtures available: `HHHH_CW` (twin partner), `FALG` (asymmetric 8-step, Austen's card verbatim), `PHI_PSI_LOOP` (ΦΨΦΨ; PSI_STEP/PHI_STEP are its literal steps). `makeStep` routes through `withCalculatedArrowLocations` (dash arrows depend on the other hand — never compute per-motion).
>
> **DELTAS after Task-3 review (2026-08-04):**
> 12. `enumerateHybridWords` returns `{ words, searchComplete }` with `maxResults` (default 200) + `searchBudget` (default 500k nodes) options — measured 209s/4.3M results at maxLength 8 unbounded. Emitted `word` is the CANONICAL rotation (order-deterministic); `WordCandidate` carries `letters: Letter[]`; only PRIMITIVE (aperiodic) closures emit, length-1 allowed ([GG] emits "G", never GGGG). `requireAllIngredients` = exact per-occurrence owner assignment (no union over-attribution). Task 10's `candidateWords` signature: default/lab maxLength ≤ 5, and it must surface `searchComplete`; its facade test uses maxLength 4-5, NOT 8.
> 13. Layer 0 API-fitness fact: position family is invariant under all 32 spatial/color variants (zero cross-family rotation/mirror maps exist) — the sieve prefilters words only; it can never narrow Layer 1's variant choice. Tasks 8/10/11 must not expect otherwise.
> 14. `enumerateHybridWords` final contract (Task-3 round 2): iterative-deepening shortest-first selection (returned words = the N shortest, canonical-sorted within length, ingredient-order independent); ingredients identified by INDEX (duplicate display names legal — the self-combination question works); return shape `{ words, resultsTruncated, budgetExhausted, searchComplete }`. Task 10's `candidateWords` returns that full shape, sorts nothing itself, and the lab labels truncation honestly. The plan's original Task 10 code block returning `WordCandidate[]` is stale — adapt. Measured tuning facts for `candidateWords`: at the real shape the complete length-≤4 set is 1,635 words in ~1ms, so use `maxResults: 2000` (200 truncates before any both-cards word appears); filter the preview to words whose `ingredients` include BOTH card entries (that is the question the panel asks); default `searchBudget` only reaches length 5 at this shape, so `searchComplete` cannot be true above maxLength 5 — the lab labels accordingly.

**Verified reuse surface** (all confirmed in-repo 2026-08-04 — do not re-derive):

| Need | Use | Path |
|---|---|---|
| Rotate/mirror/flip/color-swap a sequence | `rotateSequence(seq, amount)` (amount = 45° steps, even amounts preserve grid mode), `mirrorSequence`, `swapColors` | `src/lib/shared/create/services/sequence-transformer.ts` |
| Flip one motion's rotation direction | `invertMotion(motion)` | `src/lib/shared/create/services/motion-transforms.ts` |
| Re-derive letters from motions | `deriveSequenceLetters(seq)` (async) | `sequence-transformer.ts` |
| Re-derive orientations from start | `recalculateAllOrientations(seq)` | `src/lib/shared/create/services/orientation-propagation.ts` |
| Rev flags | `reversalDetector.processReversals(seq)` | `src/lib/shared/create/services/reversal-detector.ts` |
| Orientation continuity check | `validateSequence(seq)` | `src/lib/features/create/spell/services/orientation-continuity-validator.ts` |
| Two hand locations → GridPosition | `getGridPositionFromLocations(blueLoc, redLoc)` | grep its export under `src/lib/features/create/construct/option-picker/` (used by `option-loader.ts:57`) |
| Next-step options from a seam | `motionQueryHandler.getNextOptionsForSequence(pictographs, gridMode)` | `src/lib/shared/pictograph/shared/services/motion-query-handler.ts` |
| Dedup hash | `new SequenceCanonicalizer(...)` via `getSequenceCanonicalizer()` | `src/lib/shared/comparison/` |
| Word naming | `deriveWord`, `simplifyRepeatedWord` | `foundation/services/word-deriver.ts`, `foundation/utils/word-simplifier.ts` |
| Start position factory | `createStartPositionData` | `src/lib/shared/foundation/domain/factories/create-start-position-data.ts` |
| Sequence/step factories | `createSequenceData`, spread-clone StepData | `foundation/domain/models/sequence-data.ts` |
| Render one step live | `<PictographContainer pictographData={step} />` | `src/lib/shared/pictograph/shared/components/PictographContainer.svelte` |
| Library picker | BrowsePanel recipe | copy `src/lib/features/coven-hub/components/CovenSequencePicker.svelte` |
| Similarity | `getSimilarityCalculator()`, `getSequenceAligner()` | `src/lib/shared/comparison/` |

**File structure:**

```
src/lib/shared/combination/
  domain/types.ts                      — SeamState, VariantDescriptor, WalkSource, WalkBlock, CombinationResult, CombinatorOptions, Verdict
  domain/base-sequence-registry.ts     — the base-word vocabulary (data)
  services/position-groups.ts          — GridPosition → GridPositionGroup
  services/letter-calculus.ts          — Layer 0 word sieve
  services/variant-generator.ts        — card B variants + inverted twins
  services/sequence-combinator.ts      — walk search (Layer 1 core)
  services/splice-builder.ts           — walk → SequenceData post-processing
  services/walk-classifier.ts          — verdicts, ranking, dedup
  get-sequence-combinator.ts           — lazy facade (mirrors shared/comparison getters)
tests/unit/combination/
  fixtures.ts                          — compact step builder + Austen's ground-truth data
  *.test.ts                            — one file per service
src/routes/test/sequence-combinator/
  +page.svelte                         — lab
  ResultStrip.svelte                   — one combination rendered as pictograph strip
```

---

### Task 1: Types + position-groups util

**Files:**
- Create: `src/lib/shared/combination/domain/types.ts`
- Create: `src/lib/shared/combination/services/position-groups.ts`
- Test: `tests/unit/combination/position-groups.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/combination/position-groups.test.ts
import { describe, it, expect } from "vitest";
import { positionGroup } from "$lib/shared/combination/services/position-groups";
import { GridPosition, GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

describe("positionGroup", () => {
  it("extracts the family from a GridPosition", () => {
    expect(positionGroup(GridPosition.ALPHA3)).toBe(GridPositionGroup.ALPHA);
    expect(positionGroup(GridPosition.BETA5)).toBe(GridPositionGroup.BETA);
    expect(positionGroup("gamma11" as GridPosition)).toBe(GridPositionGroup.GAMMA);
  });
  it("returns null for unknown strings", () => {
    expect(positionGroup("nonsense9" as GridPosition)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/combination/position-groups.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the types and the util**

```ts
// src/lib/shared/combination/domain/types.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

/** A seam is the total position between steps — a GridPosition value ("beta5"). */
export type SeamState = GridPosition;

/** Spatial/color/invert variant applied to card B (or the invert twin of A). */
export interface VariantDescriptor {
  /** 45°-step rotation, even values only in v1 (grid mode preserved). */
  readonly rotation: 0 | 2 | 4 | 6;
  readonly mirrored: boolean;
  readonly colorSwapped: boolean;
  /** Rotation-faithful twin: every motion's rotation direction flipped,
   * letters re-derived (G-run becomes H-run). */
  readonly inverted: boolean;
}

export interface WalkSource {
  readonly id: string; // "A", "A~inv", "B r2 mirror swap", "ambient:ΦΨ"
  readonly kind: "cardA" | "cardB" | "ambient";
  readonly variant: VariantDescriptor;
  /** Concrete cyclic material. Ambient sources have no fixed sequence —
   * their steps come from the option provider at search time. */
  readonly sequence: SequenceData | null;
  readonly ambientWord?: string;
}

export interface WalkBlock {
  readonly sourceId: string;
  readonly kind: WalkSource["kind"];
  /** Step index in the source where this block entered (cyclic). -1 for ambient. */
  readonly startStepIndex: number;
  readonly steps: readonly StepData[];
  readonly inverted: boolean;
  readonly ambientWord?: string;
}

export type Verdict = "SEQUENTIAL" | "FUSED" | "BRAIDED" | "HYBRID";

export interface CombinationResult {
  readonly sequence: SequenceData;
  readonly blocks: readonly WalkBlock[];
  readonly verdict: Verdict;
  readonly usedAmbient: boolean;
  readonly ambientWords: readonly string[];
  /** Fractions of result steps drawn from each card (ambient excluded). */
  readonly cardAMaterial: number;
  readonly cardBMaterial: number;
  readonly variantB: VariantDescriptor | null;
  /** Count of blocks taken from an inverted twin (rotation-faithful seams). */
  readonly invertedBlocks: number;
  readonly canonicalHash: string;
  /** "= FL + AA + GG" style ingredient sentence. */
  readonly derivation: string;
}

export interface CombinatorVerdictReport {
  readonly results: readonly CombinationResult[];
  /** True when the exhaustive bounded search found nothing — with ambient
   * enabled this is the strong impossibility claim. */
  readonly impossible: boolean;
  /** Search hit a safety cap before exhausting the space; impossibility is
   * then NOT proven, only "none found". */
  readonly exhausted: boolean;
  readonly gridModeMismatch: boolean;
}

export interface CombinatorOptions {
  readonly minBlockSize?: number; // default 1
  readonly maxResultLength?: number; // default 32, hard cap 64
  readonly maxResults?: number; // default 24
  readonly wholeUnitsOnly?: boolean; // default false
  readonly allowAmbient?: boolean; // default true
  readonly maxAmbientRun?: number; // default 2 consecutive ambient steps
  readonly allowMirror?: boolean; // default true
  readonly allowRotation?: boolean; // default true
  readonly allowColorSwap?: boolean; // default true
  readonly exploreRotationFaithful?: boolean; // default true
  /** DFS node budget before exhausted=false is reported. Default 200_000. */
  readonly searchBudget?: number;
}

export interface SeamEntry {
  readonly sourceIndex: number;
  readonly stepIndex: number;
}
```

```ts
// src/lib/shared/combination/services/position-groups.ts
import {
  GridPositionGroup,
  type GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

const GROUPS: readonly GridPositionGroup[] = Object.values(GridPositionGroup);

/** "beta5" → "beta". Null when the prefix is not a known family. */
export function positionGroup(position: GridPosition | string): GridPositionGroup | null {
  const match = /^([a-z]+)\d+$/.exec(position);
  if (!match) return null;
  const group = match[1] as GridPositionGroup;
  return GROUPS.includes(group) ? group : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/combination/position-groups.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/combination/domain/types.ts src/lib/shared/combination/services/position-groups.ts tests/unit/combination/position-groups.test.ts
git commit -m "feat(combination): domain types + position-group util" -- src/lib/shared/combination tests/unit/combination
```

---

### Task 2: Fixture builder + ground-truth fixtures from Austen's data

The conversation of 2026-08-04 supplied exact step data for GHGH (GG+HH fusion), the FALG variants, and concrete Ψ/Φ steps. These become hermetic test fixtures — no MCP calls in tests.

**Files:**
- Create: `tests/unit/combination/fixtures.ts`
- Test: `tests/unit/combination/fixtures.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/combination/fixtures.test.ts
import { describe, it, expect } from "vitest";
import { GGGG_CW, HHHH_CCW, GHGH, PSI_STEP, PHI_STEP, seamsOf } from "./fixtures";

describe("combination fixtures", () => {
  it("GGGG is a closed 4-step loop with position continuity", () => {
    const seams = seamsOf(GGGG_CW);
    for (let i = 0; i < GGGG_CW.steps.length; i++) {
      const step = GGGG_CW.steps[i]!;
      expect(step.startPosition).toBe(seams[i]);
    }
    // closure: last end = first start
    expect(GGGG_CW.steps.at(-1)!.endPosition).toBe(GGGG_CW.steps[0]!.startPosition);
  });
  it("HHHH is a closed 4-step loop", () => {
    expect(HHHH_CCW.steps.at(-1)!.endPosition).toBe(HHHH_CCW.steps[0]!.startPosition);
  });
  it("GHGH (Austen's fused example) is closed and alternates letters", () => {
    expect(GHGH.steps.map((s) => s.letter)).toEqual(["G", "H", "G", "H"]);
    expect(GHGH.steps.at(-1)!.endPosition).toBe(GHGH.steps[0]!.startPosition);
  });
  it("Ψ and Φ steps carry dash/static motions", () => {
    expect(PSI_STEP.letter).toBe("Ψ");
    expect(PHI_STEP.letter).toBe("Φ");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/combination/fixtures.test.ts`
Expected: FAIL — fixtures module not found.

- [ ] **Step 3: Write the fixture builder + data**

The builder makes a full `StepData` from compact motion specs. Transcribe motions EXACTLY from the conversation data (already embedded below where known; the GGGG/HHHH cycles extend Austen's consecutive G/H steps around the grid by 90° pattern continuation).

```ts
// tests/unit/combination/fixtures.ts
import { createSequenceData, type SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { createStartPositionData } from "$lib/shared/foundation/domain/factories/create-start-position-data";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation, GridMode, GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Letter } from "$lib/shared/foundation/domain/models/letter";

interface MotionSpec {
  type: MotionType;
  rot: RotationDirection;
  from: GridLocation;
  to: GridLocation;
  startOri: Orientation;
  endOri: Orientation;
}

export function makeStep(
  stepNumber: number,
  letter: string,
  startPosition: GridPosition,
  endPosition: GridPosition,
  blue: MotionSpec,
  red: MotionSpec
): StepData {
  const motion = (spec: MotionSpec, color: MotionColor) =>
    createMotionData({
      motionType: spec.type,
      rotationDirection: spec.rot,
      startLocation: spec.from,
      endLocation: spec.to,
      startOrientation: spec.startOri,
      endOrientation: spec.endOri,
      turns: 0,
      color,
      gridMode: GridMode.DIAMOND,
    });
  return {
    id: `fixture-${letter}-${stepNumber}`,
    stepNumber,
    letter: letter as Letter,
    startPosition,
    endPosition,
    gridMode: GridMode.DIAMOND,
    motions: {
      blue: motion(blue, MotionColor.BLUE),
      red: motion(red, MotionColor.RED),
    },
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
  } as StepData;
}

export function makeLoop(id: string, word: string, steps: StepData[]): SequenceData {
  const first = steps[0]!;
  return createSequenceData({
    id,
    name: word,
    word,
    steps,
    isCircular: true,
    gridMode: GridMode.DIAMOND,
    startPosition: createStartPositionData({
      startPosition: first.startPosition,
      endPosition: first.startPosition,
      motions: {
        blue: { ...first.motions.blue, motionType: MotionType.STATIC, endLocation: first.motions.blue.startLocation, endOrientation: first.motions.blue.startOrientation },
        red: { ...first.motions.red, motionType: MotionType.STATIC, endLocation: first.motions.red.startLocation, endOrientation: first.motions.red.startOrientation },
      },
    }),
  });
}

export function seamsOf(seq: SequenceData): GridPosition[] {
  return seq.steps.map((s) => s.startPosition as GridPosition);
}

const pro = (rot: RotationDirection, from: GridLocation, to: GridLocation, so: Orientation, eo: Orientation): MotionSpec =>
  ({ type: MotionType.PRO, rot, from, to, startOri: so, endOri: eo });
const anti = (rot: RotationDirection, from: GridLocation, to: GridLocation, so: Orientation, eo: Orientation): MotionSpec =>
  ({ type: MotionType.ANTI, rot, from, to, startOri: so, endOri: eo });

const CW = RotationDirection.CLOCKWISE;
const CCW = RotationDirection.COUNTER_CLOCKWISE;
const { NORTH: N, EAST: E, SOUTH: S, WEST: W } = GridLocation;
const IN = Orientation.IN;
const OUT = Orientation.OUT;

// GGGG clockwise cycle. Steps 7–8 of Austen's third FALG variant give
// G beta1>beta3 (n>e) and G beta3>beta5 (e>s), both hands pro cw in>in;
// the remaining two steps continue the same 90° pattern around the grid.
export const GGGG_CW = makeLoop("fx-gggg", "GGGG", [
  makeStep(1, "G", GridPosition.BETA1, GridPosition.BETA3, pro(CW, N, E, IN, IN), pro(CW, N, E, IN, IN)),
  makeStep(2, "G", GridPosition.BETA3, GridPosition.BETA5, pro(CW, E, S, IN, IN), pro(CW, E, S, IN, IN)),
  makeStep(3, "G", GridPosition.BETA5, GridPosition.BETA7, pro(CW, S, W, IN, IN), pro(CW, S, W, IN, IN)),
  makeStep(4, "G", GridPosition.BETA7, GridPosition.BETA1, pro(CW, W, N, IN, IN), pro(CW, W, N, IN, IN)),
]);

// HHHH cycle. Steps 7–8 of Austen's second example give H beta1>beta3 (n>e)
// and H beta3>beta5 (e>s), both hands anti ccw with in>out / out>in
// orientation alternation; remaining two steps continue the pattern.
export const HHHH_CCW = makeLoop("fx-hhhh", "HHHH", [
  makeStep(1, "H", GridPosition.BETA1, GridPosition.BETA3, anti(CCW, N, E, IN, OUT), anti(CCW, N, E, IN, OUT)),
  makeStep(2, "H", GridPosition.BETA3, GridPosition.BETA5, anti(CCW, E, S, OUT, IN), anti(CCW, E, S, OUT, IN)),
  makeStep(3, "H", GridPosition.BETA5, GridPosition.BETA7, anti(CCW, S, W, IN, OUT), anti(CCW, S, W, IN, OUT)),
  makeStep(4, "H", GridPosition.BETA7, GridPosition.BETA1, anti(CCW, W, N, OUT, IN), anti(CCW, W, N, OUT, IN)),
]);

// Austen's GG+HH fusion card, transcribed verbatim (4 beats, mirrored loop):
// 1 G beta5>beta7  blue pro cw s>w in>in    red pro cw s>w in>in
// 2 H beta7>beta5  blue anti cw w>s in>out  red anti cw w>s in>out
// 3 G beta5>beta3  blue pro ccw s>e out>out red pro ccw s>e out>out
// 4 H beta3>beta5  blue anti ccw e>s out>in red anti ccw e>s out>in
export const GHGH = makeLoop("fx-ghgh", "GHGH", [
  makeStep(1, "G", GridPosition.BETA5, GridPosition.BETA7, pro(CW, S, W, IN, IN), pro(CW, S, W, IN, IN)),
  makeStep(2, "H", GridPosition.BETA7, GridPosition.BETA5, anti(CW, W, S, IN, OUT), anti(CW, W, S, IN, OUT)),
  makeStep(3, "G", GridPosition.BETA5, GridPosition.BETA3, pro(CCW, S, E, OUT, OUT), pro(CCW, S, E, OUT, OUT)),
  makeStep(4, "H", GridPosition.BETA3, GridPosition.BETA5, anti(CCW, E, S, OUT, IN), anti(CCW, E, S, OUT, IN)),
]);

// AAAA: alpha-world pro cycle (A = pro/pro alpha→alpha, hands opposite).
// Derived from Austen's FALG data: A alpha3>alpha1 blue pro ccw w>s, red pro ccw e>n.
export const AAAA_CCW = makeLoop("fx-aaaa", "AAAA", [
  makeStep(1, "A", GridPosition.ALPHA3, GridPosition.ALPHA1, pro(CCW, W, S, IN, IN), pro(CCW, E, N, IN, IN)),
  makeStep(2, "A", GridPosition.ALPHA1, GridPosition.ALPHA7, pro(CCW, S, E, IN, IN), pro(CCW, N, W, IN, IN)),
  makeStep(3, "A", GridPosition.ALPHA7, GridPosition.ALPHA5, pro(CCW, E, N, IN, IN), pro(CCW, W, S, IN, IN)),
  makeStep(4, "A", GridPosition.ALPHA5, GridPosition.ALPHA3, pro(CCW, N, W, IN, IN), pro(CCW, S, E, IN, IN)),
]);

// Ψ alpha5>beta1: blue static n>n, red dash s>n (verbatim from the ΦΨΦΨ card).
export const PSI_STEP = makeStep(
  1, "Ψ", GridPosition.ALPHA5, GridPosition.BETA1,
  { type: MotionType.STATIC, rot: RotationDirection.NO_ROTATION, from: N, to: N, startOri: OUT, endOri: OUT },
  { type: MotionType.DASH, rot: RotationDirection.NO_ROTATION, from: S, to: N, startOri: IN, endOri: OUT }
);

// Φ beta5>alpha5: blue dash s>n, red static s>s (verbatim from the ΦΨΦΨ card).
export const PHI_STEP = makeStep(
  1, "Φ", GridPosition.BETA5, GridPosition.ALPHA5,
  { type: MotionType.DASH, rot: RotationDirection.NO_ROTATION, from: S, to: N, startOri: IN, endOri: OUT },
  { type: MotionType.STATIC, rot: RotationDirection.NO_ROTATION, from: S, to: S, startOri: IN, endOri: IN }
);
```

**Implementer note:** enum member names above (`MotionType.PRO`, `Orientation.IN`, `GridPosition.BETA5`, `RotationDirection.NO_ROTATION`) must be checked against the actual enums in `pictograph-enums.ts` / `grid-enums.ts` before running — fix spelling to match the real members, not the other way round. If `createMotionData` requires additional fields (e.g. `arrowLocation`), supply them from the motion's `startLocation`. If the AAAA hand-location pairs conflict with `getGridPositionFromLocations` (alpha numbering), correct the alpha indices to whatever that function returns for the given location pairs — the function is canon, the fixture labels are not.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/combination/fixtures.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git commit -m "test(combination): ground-truth fixtures from Austen's worked examples" -- tests/unit/combination
```

---

### Task 3: Letter calculus (Layer 0)

**Files:**
- Create: `src/lib/shared/combination/services/letter-calculus.ts`
- Test: `tests/unit/combination/letter-calculus.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/combination/letter-calculus.test.ts
import { describe, it, expect } from "vitest";
import {
  edgesFromSequence,
  enumerateHybridWords,
  type IngredientEdges,
} from "$lib/shared/combination/services/letter-calculus";
import { GGGG_CW, HHHH_CCW, AAAA_CCW } from "./fixtures";
import { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

const FL: IngredientEdges = {
  name: "FL",
  edges: [
    { letter: "F", from: GridPositionGroup.BETA, to: GridPositionGroup.ALPHA },
    { letter: "L", from: GridPositionGroup.ALPHA, to: GridPositionGroup.BETA },
  ],
};
const AA: IngredientEdges = {
  name: "AA",
  edges: [{ letter: "A", from: GridPositionGroup.ALPHA, to: GridPositionGroup.ALPHA }],
};
const GG: IngredientEdges = {
  name: "GG",
  edges: [{ letter: "G", from: GridPositionGroup.BETA, to: GridPositionGroup.BETA }],
};

describe("letter calculus", () => {
  it("extracts family edges from a concrete sequence", () => {
    const edges = edgesFromSequence(GGGG_CW);
    expect(edges).toHaveLength(4);
    expect(edges[0]).toMatchObject({ letter: "G", from: "beta", to: "beta" });
  });

  it("derives FALG from FL + AA + GG (Austen's canonical hybrid)", () => {
    const words = enumerateHybridWords([FL, AA, GG], { maxLength: 4 });
    const falg = words.find((w) => w.word === "FALG");
    expect(falg).toBeDefined();
    expect(falg!.ingredients).toEqual(expect.arrayContaining(["FL", "AA", "GG"]));
  });

  it("closed-walk constraint: GG + AA alone cannot interleave (no α↔β edges)", () => {
    const words = enumerateHybridWords(
      [AA, GG],
      { maxLength: 6, requireAllIngredients: true }
    );
    expect(words).toHaveLength(0);
  });

  it("HHHH edges chain with GGGG edges (both beta-world)", () => {
    const g = { name: "GG", edges: edgesFromSequence(GGGG_CW) };
    const h = { name: "HH", edges: edgesFromSequence(HHHH_CCW) };
    const words = enumerateHybridWords([g, h], { maxLength: 4, requireAllIngredients: true });
    expect(words.some((w) => w.word.includes("G") && w.word.includes("H"))).toBe(true);
  });

  it("alpha-world AAAA cannot reach beta-world GGGG without a bridge", () => {
    const a = { name: "AA", edges: edgesFromSequence(AAAA_CCW) };
    const g = { name: "GG", edges: edgesFromSequence(GGGG_CW) };
    expect(
      enumerateHybridWords([a, g], { maxLength: 8, requireAllIngredients: true })
    ).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/combination/letter-calculus.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/shared/combination/services/letter-calculus.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { positionGroup } from "./position-groups";

export interface LetterEdge {
  readonly letter: string;
  readonly from: GridPositionGroup;
  readonly to: GridPositionGroup;
}

export interface IngredientEdges {
  readonly name: string;
  readonly edges: readonly LetterEdge[];
}

export interface WordCandidate {
  readonly word: string;
  /** Ingredient names contributing at least one letter. */
  readonly ingredients: readonly string[];
}

export interface EnumerateOptions {
  readonly maxLength: number;
  /** Only emit words that draw from EVERY ingredient (default false). */
  readonly requireAllIngredients?: boolean;
}

/** Family edges of a concrete sequence's steps (skips steps missing positions). */
export function edgesFromSequence(seq: SequenceData): LetterEdge[] {
  const edges: LetterEdge[] = [];
  for (const step of seq.steps) {
    if (!step.letter || !step.startPosition || !step.endPosition) continue;
    const from = positionGroup(step.startPosition);
    const to = positionGroup(step.endPosition);
    if (!from || !to) continue;
    edges.push({ letter: step.letter, from, to });
  }
  return edges;
}

/**
 * Enumerate closed walks in the position-family graph whose edges are drawn
 * from the ingredients. Word-level sieve only: necessary, not sufficient —
 * Layer 1 decides realizability against concrete card material.
 */
export function enumerateHybridWords(
  ingredients: readonly IngredientEdges[],
  options: EnumerateOptions
): WordCandidate[] {
  // Dedup identical (letter, from, to) edges, remembering every contributor.
  const edgeMap = new Map<string, { edge: LetterEdge; owners: Set<string> }>();
  for (const ing of ingredients) {
    for (const edge of ing.edges) {
      const key = `${edge.letter}|${edge.from}|${edge.to}`;
      const existing = edgeMap.get(key);
      if (existing) existing.owners.add(ing.name);
      else edgeMap.set(key, { edge, owners: new Set([ing.name]) });
    }
  }
  const edges = [...edgeMap.values()];
  const results = new Map<string, WordCandidate>();

  const walk = (
    start: GridPositionGroup,
    current: GridPositionGroup,
    letters: string[],
    owners: Set<string>
  ) => {
    if (letters.length > options.maxLength) return;
    if (letters.length >= 2 && current === start) {
      const word = letters.join("");
      if (
        !options.requireAllIngredients ||
        ingredients.every((ing) => owners.has(ing.name))
      ) {
        // Keep the lexicographically-first rotation as the canonical word key
        // so GGHH / GHHG / HHGG rotations don't triple-report.
        const rotations = letters.map((_, i) =>
          [...letters.slice(i), ...letters.slice(0, i)].join("")
        );
        const canonical = rotations.sort()[0]!;
        if (!results.has(canonical)) {
          results.set(canonical, { word, ingredients: [...owners].sort() });
        }
      }
      // keep walking — longer closures may also exist within maxLength
    }
    for (const { edge, owners: edgeOwners } of edges) {
      if (edge.from !== current) continue;
      walk(start, edge.to, [...letters, edge.letter], new Set([...owners, ...edgeOwners]));
    }
  };

  const startGroups = new Set(edges.map((e) => e.edge.from));
  for (const start of startGroups) walk(start, start, [], new Set());
  return [...results.values()];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/combination/letter-calculus.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(combination): Layer 0 letter calculus — family-graph word sieve" -- src/lib/shared/combination tests/unit/combination
```

---

### Task 4: Base-sequence registry

**Files:**
- Create: `src/lib/shared/combination/domain/base-sequence-registry.ts`
- Test: `tests/unit/combination/base-sequence-registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/combination/base-sequence-registry.test.ts
import { describe, it, expect } from "vitest";
import {
  BASE_SEQUENCES,
  confirmedBases,
  ambientEligibleBases,
} from "$lib/shared/combination/domain/base-sequence-registry";

describe("base-sequence registry", () => {
  it("contains the MCP-documented compound bases", () => {
    const words = BASE_SEQUENCES.map((b) => b.word);
    for (const w of ["DJ", "EK", "FL", "MP", "NQ", "OR", "ΦΨ"]) {
      expect(words).toContain(w);
    }
  });
  it("contains Austen's promoted bases", () => {
    const words = BASE_SEQUENCES.map((b) => b.word);
    expect(words).toContain("WΣYθ");
    expect(words).toContain("XΔZΩ");
  });
  it("every confirmed base has edges; unconfirmed bases have null edges", () => {
    for (const base of BASE_SEQUENCES) {
      if (base.confirmed) expect(base.edges).not.toBeNull();
      else expect(base.edges).toBeNull();
    }
  });
  it("ambient-eligible = confirmed bases only", () => {
    expect(ambientEligibleBases().every((b) => b.confirmed)).toBe(true);
    expect(confirmedBases().length).toBeGreaterThanOrEqual(9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/combination/base-sequence-registry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Edges below are grounded in: the MCP alphabet reference (compounds DJ/EK/FL = β↔α cycles, MP/NQ/OR = γ cycles, ΦΨ = dash cycle), the MCP G-vs-H comparison (both β→β; G pro/pro, H anti/anti), and Austen's worked examples (F: β→α, A: α→α, L: α→β, B: α→α, Ψ: α→β, Φ: β→α). Entries whose per-letter edges are NOT yet evidenced ship `edges: null, confirmed: false` and are excluded from Layer 0 and ambient use until Austen confirms the roster (his count: 19 + promotions). DO NOT invent edges for unconfirmed entries.

```ts
// src/lib/shared/combination/domain/base-sequence-registry.ts
import { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { LetterEdge } from "../services/letter-calculus";

const A = GridPositionGroup.ALPHA;
const B = GridPositionGroup.BETA;
const G = GridPositionGroup.GAMMA;

export interface BaseSequenceEntry {
  /** Smallest repeating word ("GG" not "GGGG"). */
  readonly word: string;
  readonly edges: readonly LetterEdge[] | null;
  /** Edge data grounded in MCP/canonical data. Unconfirmed entries are
   * names-only placeholders awaiting Austen's roster review. */
  readonly confirmed: boolean;
  readonly note: string;
}

const edge = (letter: string, from: GridPositionGroup, to: GridPositionGroup): LetterEdge =>
  ({ letter, from, to });

export const BASE_SEQUENCES: readonly BaseSequenceEntry[] = [
  { word: "AA", edges: [edge("A", A, A)], confirmed: true, note: "pro/pro alpha cycle" },
  { word: "BB", edges: [edge("B", A, A)], confirmed: true, note: "anti/anti alpha cycle" },
  { word: "GG", edges: [edge("G", B, B)], confirmed: true, note: "pro/pro beta cycle" },
  { word: "HH", edges: [edge("H", B, B)], confirmed: true, note: "anti/anti beta cycle" },
  { word: "DJ", edges: [edge("D", B, A), edge("J", A, B)], confirmed: true, note: "β↔α compound" },
  { word: "EK", edges: [edge("E", B, A), edge("K", A, B)], confirmed: true, note: "β↔α compound" },
  { word: "FL", edges: [edge("F", B, A), edge("L", A, B)], confirmed: true, note: "β↔α compound" },
  { word: "ΦΨ", edges: [edge("Φ", B, A), edge("Ψ", A, B)], confirmed: true, note: "dash cycle; promoted to first-class base 2026-08-04" },
  { word: "MP", edges: [edge("M", G, G), edge("P", G, G)], confirmed: true, note: "gamma compound (MCP: γ→γ cycle)" },
  { word: "NQ", edges: [edge("N", G, G), edge("Q", G, G)], confirmed: true, note: "gamma compound (MCP: γ→γ cycle)" },
  { word: "OR", edges: [edge("O", G, G), edge("R", G, G)], confirmed: true, note: "gamma compound (MCP: γ→γ cycle)" },
  { word: "CC", edges: null, confirmed: false, note: "awaiting roster review" },
  { word: "II", edges: null, confirmed: false, note: "awaiting roster review" },
  { word: "WΣYθ", edges: null, confirmed: false, note: "Austen-promoted base; per-letter edges unconfirmed" },
  { word: "XΔZΩ", edges: null, confirmed: false, note: "Austen-promoted base; per-letter edges unconfirmed" },
];

export function confirmedBases(): BaseSequenceEntry[] {
  return BASE_SEQUENCES.filter((b) => b.confirmed);
}

/** Bases the combinator may draw ambient material from. */
export function ambientEligibleBases(): BaseSequenceEntry[] {
  return confirmedBases();
}

/** Letters available as ambient material (for option filtering). */
export function ambientLetterSet(): Set<string> {
  const letters = new Set<string>();
  for (const base of ambientEligibleBases())
    for (const e of base.edges ?? []) letters.add(e.letter);
  return letters;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/combination/base-sequence-registry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(combination): base-sequence registry (draft roster, confirmed-only ambient)" -- src/lib/shared/combination tests/unit/combination
```

---

### Task 5: Variant generator

**Files:**
- Create: `src/lib/shared/combination/services/variant-generator.ts`
- Test: `tests/unit/combination/variant-generator.test.ts`

Transforms are async (they use `motionQueryHandler`, which loads the pictograph dataset). **First check**: `grep -r "mirrorSequence\|rotateSequence" tests/` — if existing unit tests exercise these, the dataset loads under vitest and the integration assertions below run as-is. If nothing does and the dataset fails to load in node, inject the transform bundle (parameter defaulting to the real `sequenceTransformer`) and stub it in unit tests; keep the letter-mutation assertion in the lab's browser verification instead. Do not silently skip the test.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/combination/variant-generator.test.ts
import { describe, it, expect } from "vitest";
import { buildVariants, buildInvertedTwin } from "$lib/shared/combination/services/variant-generator";
import { GGGG_CW } from "./fixtures";

describe("variant generator", () => {
  it("emits 32 variants at full liberties (4 rot × 2 mirror × 2 swap × 2 invert)", async () => {
    const variants = await buildVariants(GGGG_CW, {
      allowMirror: true, allowRotation: true, allowColorSwap: true, exploreRotationFaithful: true,
    });
    expect(variants).toHaveLength(32);
  });
  it("respects liberty toggles (identity + invert only)", async () => {
    const variants = await buildVariants(GGGG_CW, {
      allowMirror: false, allowRotation: false, allowColorSwap: false, exploreRotationFaithful: true,
    });
    expect(variants).toHaveLength(2);
  });
  it("all variants preserve grid mode (even rotations only)", async () => {
    const variants = await buildVariants(GGGG_CW, {
      allowMirror: true, allowRotation: true, allowColorSwap: false, exploreRotationFaithful: false,
    });
    for (const v of variants) expect(v.sequence!.gridMode).toBe(GGGG_CW.gridMode);
  });
  it("inverted twin of GGGG has anti motions (letter re-derivation → HHHH)", async () => {
    const twin = await buildInvertedTwin(GGGG_CW);
    for (const step of twin.sequence!.steps) {
      expect(step.motions.blue.motionType).toBe("anti");
      expect(step.motions.red.motionType).toBe("anti");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/combination/variant-generator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Note on inversion: "rotation-faithful twin" = flip each motion's PRO↔ANTI type AND rotation direction stays — Austen's G(pro cw)→H(anti cw) mutation at a mirrored seam flips motion TYPE while the hand path continues. Implement `invertStepMotions` by swapping `motionType` PRO↔ANTI (STATIC/DASH/FLOAT unchanged) and leaving locations/rotation untouched, then re-derive letters via `deriveSequenceLetters` (fallback: keep original letters if derivation unavailable in node — the splice-builder re-derives again at runtime).

```ts
// src/lib/shared/combination/services/variant-generator.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { updateSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  mirrorSequence,
  rotateSequence,
  swapColors,
  deriveSequenceLetters,
} from "$lib/shared/create/services/sequence-transformer";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { VariantDescriptor, WalkSource } from "../domain/types";

const ROTATIONS: ReadonlyArray<0 | 2 | 4 | 6> = [0, 2, 4, 6];

export interface VariantLiberties {
  readonly allowMirror: boolean;
  readonly allowRotation: boolean;
  readonly allowColorSwap: boolean;
  readonly exploreRotationFaithful: boolean;
}

function describe(v: VariantDescriptor): string {
  const parts = [
    v.rotation ? `r${v.rotation}` : "",
    v.mirrored ? "mirror" : "",
    v.colorSwapped ? "swap" : "",
    v.inverted ? "inv" : "",
  ].filter(Boolean);
  return parts.length ? parts.join("+") : "id";
}

function flipProAnti(seq: SequenceData): SequenceData {
  return updateSequenceData(seq, {
    steps: seq.steps.map((step) => ({
      ...step,
      motions: {
        blue: { ...step.motions.blue, motionType: invertType(step.motions.blue.motionType) },
        red: { ...step.motions.red, motionType: invertType(step.motions.red.motionType) },
      },
    })),
  });
}

function invertType(type: MotionType): MotionType {
  if (type === MotionType.PRO) return MotionType.ANTI;
  if (type === MotionType.ANTI) return MotionType.PRO;
  return type;
}

async function withDerivedLetters(seq: SequenceData): Promise<SequenceData> {
  try {
    return await deriveSequenceLetters(seq);
  } catch {
    // Dataset unavailable (node unit tests) — splice-builder re-derives at runtime.
    return seq;
  }
}

export async function buildInvertedTwin(seq: SequenceData): Promise<WalkSource> {
  const twin = await withDerivedLetters(flipProAnti(seq));
  return {
    id: "twin",
    kind: "cardB",
    variant: { rotation: 0, mirrored: false, colorSwapped: false, inverted: true },
    sequence: twin,
  };
}

/** All admissible variants of card B under the given liberties. */
export async function buildVariants(
  cardB: SequenceData,
  liberties: VariantLiberties
): Promise<WalkSource[]> {
  const rotations = liberties.allowRotation ? ROTATIONS : ([0] as const);
  const mirrors = liberties.allowMirror ? [false, true] : [false];
  const swaps = liberties.allowColorSwap ? [false, true] : [false];
  const inverts = liberties.exploreRotationFaithful ? [false, true] : [false];

  const sources: WalkSource[] = [];
  for (const rotation of rotations) {
    for (const mirrored of mirrors) {
      let spatial = cardB;
      if (rotation) spatial = await rotateSequence(spatial, rotation);
      if (mirrored) spatial = await mirrorSequence(spatial);
      for (const colorSwapped of swaps) {
        const colored = colorSwapped ? swapColors(spatial) : spatial;
        for (const inverted of inverts) {
          const variant: VariantDescriptor = { rotation, mirrored, colorSwapped, inverted };
          const sequence = inverted ? await withDerivedLetters(flipProAnti(colored)) : colored;
          sources.push({ id: `B ${describe(variant)}`, kind: "cardB", variant, sequence });
        }
      }
    }
  }
  return sources;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/combination/variant-generator.test.ts`
Expected: PASS (4 tests). If transforms fail to load the dataset in node, apply the injection fallback described above and re-run.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(combination): B-variant generator with rotation-faithful twins" -- src/lib/shared/combination tests/unit/combination
```

---

### Task 6: Walk search — core (concatenation + interleaving, no ambient yet)

**Files:**
- Create: `src/lib/shared/combination/services/sequence-combinator.ts`
- Test: `tests/unit/combination/sequence-combinator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/combination/sequence-combinator.test.ts
import { describe, it, expect } from "vitest";
import { findCombinations } from "$lib/shared/combination/services/sequence-combinator";
import { GGGG_CW, HHHH_CCW, AAAA_CCW } from "./fixtures";

describe("sequence combinator — walk search", () => {
  it("finds a sequential combination of GGGG + HHHH (both beta-world)", async () => {
    const report = await findCombinations(GGGG_CW, HHHH_CCW, {
      allowAmbient: false, maxResultLength: 8,
    });
    expect(report.impossible).toBe(false);
    const sequential = report.results.find((r) => r.blocks.length === 2);
    expect(sequential).toBeDefined();
  });

  it("finds an interleaved (multi-block) combination of GGGG + HHHH", async () => {
    const report = await findCombinations(GGGG_CW, HHHH_CCW, {
      allowAmbient: false, maxResultLength: 8,
    });
    const fused = report.results.find((r) => r.blocks.length >= 4);
    expect(fused).toBeDefined();
    const letters = fused!.sequence.steps.map((s) => s.letter).join("");
    expect(letters).toMatch(/G/);
    expect(letters).toMatch(/H/);
  });

  it("every result is a closed loop with position continuity", async () => {
    const report = await findCombinations(GGGG_CW, HHHH_CCW, {
      allowAmbient: false, maxResultLength: 8,
    });
    for (const r of report.results) {
      const steps = r.sequence.steps;
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i]!.startPosition).toBe(steps[i - 1]!.endPosition);
      }
      expect(steps[0]!.startPosition).toBe(steps.at(-1)!.endPosition);
    }
  });

  it("proves AAAA + GGGG impossible without ambient (alpha vs beta world)", async () => {
    const report = await findCombinations(AAAA_CCW, GGGG_CW, {
      allowAmbient: false, maxResultLength: 8,
      // rotation can't bridge families: rotations map alpha→alpha
    });
    expect(report.results).toHaveLength(0);
    expect(report.impossible).toBe(true);
    expect(report.exhausted).toBe(true);
  });

  it("every result uses material from both cards", async () => {
    const report = await findCombinations(GGGG_CW, HHHH_CCW, { allowAmbient: false });
    for (const r of report.results) {
      expect(r.cardAMaterial).toBeGreaterThan(0);
      expect(r.cardBMaterial).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/combination/sequence-combinator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the search**

```ts
// src/lib/shared/combination/services/sequence-combinator.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type {
  CombinatorOptions,
  CombinatorVerdictReport,
  SeamState,
  WalkBlock,
  WalkSource,
} from "../domain/types";
import { buildVariants, buildInvertedTwin } from "./variant-generator";
import { buildResult } from "./splice-builder";
import { classifyAndRank } from "./walk-classifier";

const DEFAULTS: Required<CombinatorOptions> = {
  minBlockSize: 1,
  maxResultLength: 32,
  maxResults: 24,
  wholeUnitsOnly: false,
  allowAmbient: true,
  maxAmbientRun: 2,
  allowMirror: true,
  allowRotation: true,
  allowColorSwap: true,
  exploreRotationFaithful: true,
  searchBudget: 200_000,
};

interface PendingWalk {
  readonly blocks: WalkBlock[];
  readonly totalSteps: number;
}

/** Steps of a source, cyclically. */
function stepAt(source: WalkSource, index: number): StepData {
  const steps = source.sequence!.steps;
  return steps[((index % steps.length) + steps.length) % steps.length]!;
}

function seamBefore(source: WalkSource, index: number): SeamState {
  return stepAt(source, index).startPosition as SeamState;
}

export async function findCombinations(
  cardA: SequenceData,
  cardB: SequenceData,
  options: CombinatorOptions = {}
): Promise<CombinatorVerdictReport> {
  const opts = { ...DEFAULTS, ...options };
  const maxLen = Math.min(opts.maxResultLength, 64);

  if ((cardA.gridMode ?? "diamond") !== (cardB.gridMode ?? "diamond")) {
    return { results: [], impossible: true, exhausted: true, gridModeMismatch: true };
  }

  // Sources: card A (identity + optional inverted twin), all B variants.
  const aSource: WalkSource = {
    id: "A",
    kind: "cardA",
    variant: { rotation: 0, mirrored: false, colorSwapped: false, inverted: false },
    sequence: cardA,
  };
  const sources: WalkSource[] = [aSource];
  if (opts.exploreRotationFaithful) {
    const twin = await buildInvertedTwin(cardA);
    sources.push({ ...twin, id: "A~inv", kind: "cardA" });
  }
  sources.push(...(await buildVariants(cardB, opts)));

  // Seam entry map: seam → every (source, stepIndex) that starts there.
  const entries = new Map<SeamState, Array<{ si: number; step: number }>>();
  sources.forEach((source, si) => {
    source.sequence!.steps.forEach((_, step) => {
      const seam = seamBefore(source, step);
      const list = entries.get(seam) ?? [];
      list.push({ si, step });
      entries.set(seam, list);
    });
  });

  const rawWalks: PendingWalk[] = [];
  let budget = opts.searchBudget;
  let exhausted = true;

  // DFS. Start every walk at a step of card A (identity) — closure makes
  // other phases redundant, and fixing the frame prevents duplicate frames.
  const dfs = (
    startSeam: SeamState,
    currentSeam: SeamState,
    si: number,
    nextStep: number,
    blockSteps: StepData[],
    blockStart: number,
    blocks: WalkBlock[],
    totalSteps: number,
    usedA: boolean,
    usedB: boolean
  ): void => {
    if (budget-- <= 0) {
      exhausted = false;
      return;
    }
    const source = sources[si]!;

    // Option 1: close the walk (need both cards, ≥2 blocks incl. current).
    if (
      totalSteps >= 2 &&
      currentSeam === startSeam &&
      blockSteps.length >= opts.minBlockSize &&
      (usedA || source.kind === "cardA") &&
      (usedB || source.kind === "cardB") &&
      blocks.length >= 1
    ) {
      rawWalks.push({
        blocks: [
          ...blocks,
          {
            sourceId: source.id, kind: source.kind, startStepIndex: blockStart,
            steps: [...blockSteps], inverted: source.variant.inverted,
          },
        ],
        totalSteps,
      });
      if (rawWalks.length >= opts.maxResults * 8) return; // classifier prunes later
    }

    if (totalSteps >= maxLen) return;

    // Option 2: extend within the current source.
    {
      const step = stepAt(source, nextStep);
      if ((step.startPosition as SeamState) === currentSeam) {
        dfs(
          startSeam, step.endPosition as SeamState, si, nextStep + 1,
          [...blockSteps, step], blockStart, blocks, totalSteps + 1,
          usedA || source.kind === "cardA", usedB || source.kind === "cardB"
        );
      }
    }

    // Option 3: jump to another source at a matching seam.
    if (blockSteps.length >= opts.minBlockSize) {
      const candidates = entries.get(currentSeam) ?? [];
      for (const { si: ti, step: tstep } of candidates) {
        if (ti === si) continue;
        const target = sources[ti]!;
        // Don't bounce between a card and its own twin without progress.
        if (target.kind === source.kind && blockSteps.length === 0) continue;
        const nextBlocks: WalkBlock[] = [
          ...blocks,
          {
            sourceId: source.id, kind: source.kind, startStepIndex: blockStart,
            steps: [...blockSteps], inverted: source.variant.inverted,
          },
        ];
        const step = stepAt(target, tstep);
        dfs(
          startSeam, step.endPosition as SeamState, ti, tstep + 1,
          [step], tstep, nextBlocks, totalSteps + 1,
          usedA || target.kind === "cardA", usedB || target.kind === "cardB"
        );
      }
    }
  };

  for (let start = 0; start < cardA.steps.length; start++) {
    const seam = seamBefore(aSource, start);
    const step = stepAt(aSource, start);
    dfs(
      seam, step.endPosition as SeamState, 0, start + 1,
      [step], start, [], 1, true, false
    );
  }

  const results = await classifyAndRank(rawWalks, cardA, cardB, sources, opts);
  return {
    results,
    impossible: results.length === 0 && exhausted,
    exhausted,
    gridModeMismatch: false,
  };
}
```

**Implementer note:** `classifyAndRank` and `buildResult` do not exist yet — create minimal stubs in this task (classify: build sequences via a plain step-concat, verdict "HYBRID", no dedup; rank: identity) so these tests pass, then replace them properly in Tasks 7–8. The stubs live in the real files (`splice-builder.ts`, `walk-classifier.ts`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/combination/sequence-combinator.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(combination): seam-graph closed-walk search core" -- src/lib/shared/combination tests/unit/combination
```

---

### Task 7: Splice builder (walk → real SequenceData)

**Files:**
- Modify: `src/lib/shared/combination/services/splice-builder.ts` (replace stub)
- Test: `tests/unit/combination/splice-builder.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/combination/splice-builder.test.ts
import { describe, it, expect } from "vitest";
import { buildResult } from "$lib/shared/combination/services/splice-builder";
import { GGGG_CW, HHHH_CCW } from "./fixtures";
import { validateSequence } from "$lib/features/create/spell/services/orientation-continuity-validator";

describe("splice builder", () => {
  it("builds a renumbered, orientation-continuous, closed sequence", async () => {
    // Hand-assemble a 2-block walk: 4 G steps then 4 H steps (seam beta1).
    const blocks = [
      { sourceId: "A", kind: "cardA" as const, startStepIndex: 0, steps: [...GGGG_CW.steps], inverted: false },
      { sourceId: "B id", kind: "cardB" as const, startStepIndex: 0, steps: [...HHHH_CCW.steps], inverted: false },
    ];
    const seq = await buildResult(blocks, GGGG_CW);
    expect(seq.steps).toHaveLength(8);
    expect(seq.steps.map((s) => s.stepNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(seq.isCircular).toBe(true);
    expect(seq.word.length).toBe(8);
    // Orientations re-derived → zero continuity errors (letter-true rule).
    expect(validateSequence(seq)).toHaveLength(0);
    expect(seq.startPosition).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/combination/splice-builder.test.ts`
Expected: FAIL (stub returns unprocessed concat).

- [ ] **Step 3: Implement**

```ts
// src/lib/shared/combination/services/splice-builder.ts
import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { createStartPositionData } from "$lib/shared/foundation/domain/factories/create-start-position-data";
import { recalculateAllOrientations } from "$lib/shared/create/services/orientation-propagation";
import { deriveSequenceLetters } from "$lib/shared/create/services/sequence-transformer";
import { reversalDetector } from "$lib/shared/create/services/reversal-detector";
import { deriveWord } from "$lib/shared/foundation/services/word-deriver";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { WalkBlock } from "../domain/types";

/**
 * Assemble a closed walk's blocks into a real SequenceData:
 * renumber, rebuild start position, re-derive orientations from the walk's
 * start (letter-true seam rule), re-derive letters (inverted-twin blocks),
 * recompute reversal flags, derive the word.
 */
export async function buildResult(
  blocks: readonly WalkBlock[],
  frameCard: SequenceData
): Promise<SequenceData> {
  const rawSteps: StepData[] = [];
  for (const block of blocks) {
    for (const step of block.steps) {
      rawSteps.push({ ...step, stepNumber: rawSteps.length + 1, id: crypto.randomUUID() });
    }
  }
  const first = rawSteps[0]!;

  const startPosition = createStartPositionData({
    startPosition: first.startPosition,
    endPosition: first.startPosition,
    gridMode: first.gridMode,
    motions: {
      blue: {
        ...first.motions.blue,
        motionType: MotionType.STATIC,
        endLocation: first.motions.blue.startLocation,
        endOrientation: first.motions.blue.startOrientation,
      },
      red: {
        ...first.motions.red,
        motionType: MotionType.STATIC,
        endLocation: first.motions.red.startLocation,
        endOrientation: first.motions.red.startOrientation,
      },
    },
  });

  let seq = createSequenceData({
    name: "combination",
    word: "",
    steps: rawSteps,
    startPosition,
    isCircular: true,
    gridMode: frameCard.gridMode,
  });

  seq = recalculateAllOrientations(seq);
  try {
    seq = await deriveSequenceLetters(seq);
  } catch {
    // Dataset unavailable in node — letters stay as source letters.
  }
  seq = reversalDetector.processReversals(seq);
  const word = deriveWord(seq);
  return { ...seq, word, name: word || "combination" };
}
```

**Implementer note:** if `createStartPositionData`'s `Partial<StartPositionData>` shape differs (check `foundation/domain/factories/create-start-position-data.ts` and `StartPositionData`), adapt the call — the intent is: static both-hands position at the walk's first seam, orientations = first step's start orientations. If `recalculateAllOrientations` requires `startPosition.motions` orientations as the seed, that is exactly what we set.

- [ ] **Step 4: Run test + prior suites to verify green**

Run: `npm run test -- tests/unit/combination/`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(combination): splice builder — walks become real sequences" -- src/lib/shared/combination tests/unit/combination
```

---

### Task 8: Classifier, ranking, dedup

**Files:**
- Modify: `src/lib/shared/combination/services/walk-classifier.ts` (replace stub)
- Test: `tests/unit/combination/walk-classifier.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/combination/walk-classifier.test.ts
import { describe, it, expect } from "vitest";
import { findCombinations } from "$lib/shared/combination/services/sequence-combinator";
import { GGGG_CW, HHHH_CCW } from "./fixtures";

describe("walk classifier", () => {
  it("labels 2-block walks SEQUENTIAL and alternating unit walks FUSED", async () => {
    const report = await findCombinations(GGGG_CW, HHHH_CCW, { allowAmbient: false, maxResultLength: 8 });
    const twoBlock = report.results.find((r) => r.blocks.length === 2);
    expect(twoBlock?.verdict).toBe("SEQUENTIAL");
    const alternating = report.results.find((r) => r.blocks.length >= 4);
    expect(["FUSED", "BRAIDED", "HYBRID"]).toContain(alternating?.verdict);
  });

  it("dedups: no two results share a canonical hash", async () => {
    const report = await findCombinations(GGGG_CW, HHHH_CCW, { allowAmbient: false });
    const hashes = report.results.map((r) => r.canonicalHash);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it("derivation sentence names both cards", async () => {
    const report = await findCombinations(GGGG_CW, HHHH_CCW, { allowAmbient: false });
    expect(report.results[0]!.derivation).toMatch(/GGGG|GG/);
    expect(report.results[0]!.derivation).toMatch(/HHHH|HH/);
  });

  it("respects maxResults", async () => {
    const report = await findCombinations(GGGG_CW, HHHH_CCW, { allowAmbient: false, maxResults: 3 });
    expect(report.results.length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/combination/walk-classifier.test.ts`
Expected: FAIL (stub has no verdicts/dedup).

- [ ] **Step 3: Implement**

```ts
// src/lib/shared/combination/services/walk-classifier.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import { getSequenceCanonicalizer } from "$lib/shared/comparison/get-sequence-canonicalizer";
import type {
  CombinationResult,
  CombinatorOptions,
  Verdict,
  WalkBlock,
  WalkSource,
} from "../domain/types";
import { buildResult } from "./splice-builder";

interface PendingWalk {
  readonly blocks: WalkBlock[];
  readonly totalSteps: number;
}

function repeatUnitLength(card: SequenceData): number {
  const simplified = simplifyRepeatedWord(card.word || "");
  return simplified.length > 0 ? simplified.length : card.steps.length;
}

function classify(blocks: readonly WalkBlock[], unitA: number, unitB: number): Verdict {
  const cardBlocks = blocks.filter((b) => b.kind !== "ambient");
  if (cardBlocks.length === 2) return "SEQUENTIAL";
  const alternates = cardBlocks.every(
    (b, i) => i === 0 || b.kind !== cardBlocks[i - 1]!.kind
  );
  const wholeUnits = cardBlocks.every((b) =>
    b.kind === "cardA" ? b.steps.length % unitA === 0 : b.steps.length % unitB === 0
  );
  if (alternates && wholeUnits) return "FUSED";
  const anySubUnit = cardBlocks.some((b) =>
    b.kind === "cardA" ? b.steps.length < unitA : b.steps.length < unitB
  );
  return anySubUnit ? "BRAIDED" : "HYBRID";
}

function derivation(
  blocks: readonly WalkBlock[],
  cardA: SequenceData,
  cardB: SequenceData
): string {
  const parts: string[] = [];
  const wordA = simplifyRepeatedWord(cardA.word || "") || cardA.word || "card A";
  const wordB = simplifyRepeatedWord(cardB.word || "") || cardB.word || "card B";
  if (blocks.some((b) => b.kind === "cardA")) parts.push(wordA);
  if (blocks.some((b) => b.kind === "cardB")) parts.push(wordB);
  for (const b of blocks) {
    if (b.kind === "ambient" && b.ambientWord && !parts.includes(b.ambientWord)) {
      parts.push(b.ambientWord);
    }
  }
  return `= ${parts.join(" + ")}`;
}

export async function classifyAndRank(
  walks: readonly PendingWalk[],
  cardA: SequenceData,
  cardB: SequenceData,
  sources: readonly WalkSource[],
  opts: Required<CombinatorOptions>
): Promise<CombinationResult[]> {
  const unitA = repeatUnitLength(cardA);
  const unitB = repeatUnitLength(cardB);
  const canonicalizer = getSequenceCanonicalizer();
  const seen = new Set<string>();
  const results: CombinationResult[] = [];

  for (const walk of walks) {
    if (opts.wholeUnitsOnly) {
      const ok = walk.blocks.every((b) =>
        b.kind === "ambient"
          ? true
          : b.steps.length % (b.kind === "cardA" ? unitA : unitB) === 0
      );
      if (!ok) continue;
    }
    const sequence = await buildResult(walk.blocks, cardA);
    let hash: string;
    try {
      hash = canonicalizer.canonicalize(sequence).canonicalHash;
    } catch {
      hash = sequence.steps
        .map((s) => `${s.letter}:${s.startPosition}>${s.endPosition}`)
        .join("|");
    }
    if (seen.has(hash)) continue;
    seen.add(hash);

    const cardSteps = walk.blocks.filter((b) => b.kind !== "ambient");
    const aSteps = cardSteps.filter((b) => b.kind === "cardA").reduce((n, b) => n + b.steps.length, 0);
    const bSteps = cardSteps.filter((b) => b.kind === "cardB").reduce((n, b) => n + b.steps.length, 0);
    const total = walk.totalSteps || 1;
    const bSource = sources.find((s) => s.kind === "cardB" && walk.blocks.some((b) => b.sourceId === s.id));

    results.push({
      sequence,
      blocks: walk.blocks,
      verdict: classify(walk.blocks, unitA, unitB),
      usedAmbient: walk.blocks.some((b) => b.kind === "ambient"),
      ambientWords: [...new Set(walk.blocks.filter((b) => b.kind === "ambient").map((b) => b.ambientWord!))],
      cardAMaterial: aSteps / total,
      cardBMaterial: bSteps / total,
      variantB: bSource?.variant ?? null,
      invertedBlocks: walk.blocks.filter((b) => b.inverted).length,
      canonicalHash: hash,
      derivation: derivation(walk.blocks, cardA, cardB),
    });
  }

  // Rank: pure card material → whole-unit fusions → balance → brevity.
  results.sort((a, b) => {
    if (a.usedAmbient !== b.usedAmbient) return a.usedAmbient ? 1 : -1;
    const order: Record<Verdict, number> = { FUSED: 0, SEQUENTIAL: 1, HYBRID: 2, BRAIDED: 3 };
    if (order[a.verdict] !== order[b.verdict]) return order[a.verdict] - order[b.verdict];
    const balA = Math.abs(a.cardAMaterial - a.cardBMaterial);
    const balB = Math.abs(b.cardAMaterial - b.cardBMaterial);
    if (balA !== balB) return balA - balB;
    return a.sequence.steps.length - b.sequence.steps.length;
  });

  return results.slice(0, opts.maxResults);
}
```

- [ ] **Step 4: Run the whole combination suite**

Run: `npm run test -- tests/unit/combination/`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(combination): verdict classification, ranking, canonical dedup" -- src/lib/shared/combination tests/unit/combination
```

---

### Task 9: Ambient base material (the ΦΨ pinch)

**Files:**
- Modify: `src/lib/shared/combination/services/sequence-combinator.ts`
- Test: `tests/unit/combination/ambient.test.ts`

Design: an `AmbientOptionProvider` interface supplies candidate single steps for a seam, filtered to ambient-eligible letters. Unit tests inject a stub built from the Ψ/Φ fixture steps; the runtime provider wraps `motionQueryHandler.getNextOptionsForSequence` (wired in the lab task, verified in browser).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/combination/ambient.test.ts
import { describe, it, expect } from "vitest";
import { findCombinations } from "$lib/shared/combination/services/sequence-combinator";
import type { AmbientOptionProvider } from "$lib/shared/combination/services/sequence-combinator";
import { AAAA_CCW, HHHH_CCW, PSI_STEP, PHI_STEP, makeStep } from "./fixtures";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

// Stub: for any alpha seam offer a Ψ step to beta; for any beta seam a Φ back.
// Rotated Ψ/Φ instances are built from the fixture steps by location rotation —
// for the test it is enough to offer instances at the exact seams the fixtures
// produce (alpha5→beta1 via Ψ, beta5→alpha5 via Φ).
const stubProvider: AmbientOptionProvider = {
  async optionsAt(seam: string): Promise<StepData[]> {
    if (seam === PSI_STEP.startPosition) return [PSI_STEP];
    if (seam === PHI_STEP.startPosition) return [PHI_STEP];
    return [];
  },
};

describe("ambient material", () => {
  it("AAAA + HHHH combine only via Ψ/Φ pinches (Austen's AAAΨHHHΦ shape)", async () => {
    const noAmbient = await findCombinations(AAAA_CCW, HHHH_CCW, { allowAmbient: false });
    expect(noAmbient.results).toHaveLength(0);

    const withAmbient = await findCombinations(AAAA_CCW, HHHH_CCW, {
      allowAmbient: true, maxResultLength: 16, ambientProvider: stubProvider,
    });
    const bridged = withAmbient.results.find((r) => r.usedAmbient);
    expect(bridged).toBeDefined();
    const letters = bridged!.blocks.flatMap((b) => b.steps.map((s) => s.letter));
    expect(letters).toContain("Ψ");
    expect(letters).toContain("Φ");
    expect(bridged!.ambientWords).toContain("ΦΨ");
  });

  it("ambient runs are capped by maxAmbientRun", async () => {
    const report = await findCombinations(AAAA_CCW, HHHH_CCW, {
      allowAmbient: true, maxAmbientRun: 1, ambientProvider: stubProvider,
    });
    for (const r of report.results) {
      for (const b of r.blocks.filter((x) => x.kind === "ambient")) {
        expect(b.steps.length).toBeLessThanOrEqual(1);
      }
    }
  });
});
```

Note: the fixture seams must actually connect — `PSI_STEP` runs alpha5→beta1 and `PHI_STEP` beta5→alpha5, and `AAAA_CCW`/`HHHH_CCW` pass through alpha5/beta1/beta5. If after Task 2's alpha-index correction the seams differ, adjust the stub's steps (via `makeStep` with the corrected positions), not the engine.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/combination/ambient.test.ts`
Expected: FAIL — `ambientProvider` option and ambient jumps not implemented.

- [ ] **Step 3: Implement**

In `sequence-combinator.ts`:

1. Extend the public surface:

```ts
export interface AmbientOptionProvider {
  /** Candidate ambient steps STARTING at the given seam (already letter-filtered). */
  optionsAt(seam: SeamState): Promise<StepData[]>;
}
// CombinatorOptions gains: readonly ambientProvider?: AmbientOptionProvider;
// (add to domain/types.ts, default undefined)
```

2. Precompute, before the DFS, an ambient step pool per seam (the DFS itself stays synchronous): collect every distinct seam across all sources, call `provider.optionsAt(seam)` for each, filter letters through `ambientLetterSet()` from the registry, and tag each step with its owning base word (the registry entry whose edge set contains the letter). Store as `Map<SeamState, Array<{ step: StepData; baseWord: string }>>`.

3. In the DFS add **Option 4: take an ambient step** — allowed only when `opts.allowAmbient`, the current block is closable (`blockSteps.length >= minBlockSize`), and the current ambient run length `< maxAmbientRun`. An ambient step closes the current block (like a jump), appends an ambient block of accumulating steps (consecutive ambient steps extend the same ambient block, tracked with an `ambientRun` DFS parameter), and moves the seam to the ambient step's `endPosition`. Ambient blocks carry `kind: "ambient"`, `startStepIndex: -1`, `ambientWord: baseWord`, `inverted: false`.

4. `usedA`/`usedB` are unaffected by ambient steps (ambient never satisfies the both-cards requirement).

- [ ] **Step 4: Run the whole suite**

Run: `npm run test -- tests/unit/combination/`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(combination): ambient base-vocabulary pinches (ΦΨ bridging)" -- src/lib/shared/combination tests/unit/combination
```

---

### Task 10: Facade + runtime ambient provider

**Files:**
- Create: `src/lib/shared/combination/get-sequence-combinator.ts`
- Create: `src/lib/shared/combination/services/runtime-ambient-provider.ts`
- Test: `tests/unit/combination/facade.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/combination/facade.test.ts
import { describe, it, expect } from "vitest";
import { getSequenceCombinator } from "$lib/shared/combination/get-sequence-combinator";
import { GGGG_CW, HHHH_CCW } from "./fixtures";

describe("combinator facade", () => {
  it("exposes findCombinations and letter-calculus helpers", async () => {
    const combinator = getSequenceCombinator();
    const report = await combinator.findCombinations(GGGG_CW, HHHH_CCW, { allowAmbient: false });
    expect(report.results.length).toBeGreaterThan(0);
    const words = combinator.candidateWords(GGGG_CW, HHHH_CCW, 8);
    expect(words.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/combination/facade.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/shared/combination/services/runtime-ambient-provider.ts
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/motion-query-handler";
import { ambientLetterSet } from "../domain/base-sequence-registry";
import type { AmbientOptionProvider } from "./sequence-combinator";
import type { SeamState } from "../domain/types";

/**
 * Runtime provider: asks the option-picker's own dataset which pictographs
 * start at the seam, then keeps only ambient-eligible letters. Reuses the
 * exact machinery the construct tab uses to offer next steps.
 */
export function createRuntimeAmbientProvider(
  gridMode: GridMode,
  seamStepLookup: (seam: SeamState) => PictographData[] | Promise<PictographData[]>
): AmbientOptionProvider {
  const letters = ambientLetterSet();
  return {
    async optionsAt(seam) {
      const options = await seamStepLookup(seam);
      return options.filter(
        (o): o is StepData => !!o.letter && letters.has(o.letter)
      );
    },
  };
}
```

**Implementer note:** `motionQueryHandler.getNextOptionsForSequence(sequence, gridMode)` takes the sequence-so-far, not a bare seam. In the lab, build `seamStepLookup` by passing a one-step probe sequence ending at the seam (the walk's current last step works — see `option-loader.ts:24-71` for the position-filter pattern using `getGridPositionFromLocations`). Import whatever of that logic is reusable rather than duplicating the filter.

```ts
// src/lib/shared/combination/get-sequence-combinator.ts
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { findCombinations, type AmbientOptionProvider } from "./services/sequence-combinator";
import type { CombinatorOptions, CombinatorVerdictReport } from "./domain/types";
import {
  edgesFromSequence,
  enumerateHybridWords,
  type WordCandidate,
} from "./services/letter-calculus";
import { confirmedBases } from "./domain/base-sequence-registry";

export interface SequenceCombinator {
  findCombinations(
    cardA: SequenceData,
    cardB: SequenceData,
    options?: CombinatorOptions
  ): Promise<CombinatorVerdictReport>;
  /** Layer 0 preview: word-level hybrid candidates from the two cards. */
  candidateWords(cardA: SequenceData, cardB: SequenceData, maxLength: number): WordCandidate[];
}

let instance: SequenceCombinator | null = null;

export function getSequenceCombinator(): SequenceCombinator {
  if (!instance) {
    instance = {
      findCombinations,
      candidateWords(cardA, cardB, maxLength) {
        return enumerateHybridWords(
          [
            { name: cardA.word || "A", edges: edgesFromSequence(cardA) },
            { name: cardB.word || "B", edges: edgesFromSequence(cardB) },
            ...confirmedBases()
              .filter((b) => b.edges)
              .map((b) => ({ name: b.word, edges: b.edges! })),
          ],
          { maxLength }
        );
      },
    };
  }
  return instance;
}
export type { AmbientOptionProvider };
```

- [ ] **Step 4: Run the whole suite + typecheck**

Run: `npm run test -- tests/unit/combination/` — ALL PASS.
Run: `npm run check:fast` — no new errors in `src/lib/shared/combination/`.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(combination): facade + runtime ambient provider" -- src/lib/shared/combination tests/unit/combination
```

---

### Task 11: Lab page — inputs, engine wiring, result strips

**Files:**
- Create: `src/routes/test/sequence-combinator/+page.svelte`
- Create: `src/routes/test/sequence-combinator/ResultStrip.svelte`
- Create: `src/routes/test/sequence-combinator/lab-state.svelte.ts`

Follow the existing test-page pattern (`src/routes/test/deck-variation/+page.svelte` is the reference: `$state` locals, load on mount, control rail + results). Rules that bind here: `chip-primitives.md` (SegmentedControl for single-select knobs, FilterChipBase toggles for liberties), `no-checkboxes.md`, `clickables-look-like-buttons.md`, `no-layout-shift.md` (reserve results area, `tabular-nums` counters), `4k-native-layout.md` (rem sizing, 1680 seam).

- [ ] **Step 1: Build `lab-state.svelte.ts`**

State factory owning: `cardA`/`cardB` (SequenceData | null), source pickers' open state, `options` (every CombinatorOptions knob as `$state`), `report` (CombinatorVerdictReport | null), `running`, `candidateWords` preview, and `run()` which calls `getSequenceCombinator().findCombinations(...)` with a runtime ambient provider when ambient is enabled. Sequence inputs come from three affordances:
  1. **Library picker** — BrowsePanel recipe verbatim from `CovenSequencePicker.svelte` (engine per slot, `layout="compact"`, `onOpenFilters` + `GalleryFilterSheet`, hydrate on select via `getBrowseLoader().loadFullSequenceData(seq.id, seq.id)`).
  2. **Fixture presets** — buttons loading the Task 2 fixtures (GGGG, HHHH, AAAA) for instant demos; import them via a small re-export module `src/routes/test/sequence-combinator/demo-fixtures.ts` that duplicates the fixture builder output (test files are not importable from routes; move the builder to `src/lib/shared/combination/domain/demo-fixtures.ts` and re-export it from the test fixtures file so both share one source).
  3. **JSON paste** — textarea accepting a `SequenceData` JSON dump.

- [ ] **Step 2: Build `ResultStrip.svelte`**

One combination = header row (verdict badge, derivation sentence, variant annotation like `B r2+mirror`, ambient chips, `simplifyRepeatedWord`-simplified word) + horizontal strip of `<PictographContainer pictographData={step} />` cells (fixed cell size ~9rem, `overflow-x: auto`, reserved height — no layout shift while pictographs prepare). Block boundaries get a visible seam marker (border between blocks, block source labeled A/B/ambient with color coding). Inverted blocks get a "rotation-faithful" tag.

- [ ] **Step 3: Build `+page.svelte`**

Layout: two input slots side by side (card A / card B with picker + preset + paste affordances, each showing its loaded sequence as a mini strip), a control rail (SegmentedControl for maxResultLength presets [8/16/32] and minBlockSize [1/2/4]; FilterChipBase toggles for mirror/rotation/color-swap/rotation-faithful/ambient/whole-units), a Combine button (primary, disabled until both cards loaded), Layer 0 preview panel ("possible hybrid words" from `candidateWords`), and the ranked `ResultStrip` list. IMPOSSIBLE renders as its own prominent state naming what was tried ("no closed walk across 32 variants + ambient vocabulary"); `exhausted: false` renders as "none found within search budget" — the two must be visually distinct.

- [ ] **Step 4: Verify in browser**

`pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank`, open `https://localhost:5173/test/sequence-combinator` in a task-owned page. Load GGGG + HHHH presets, Combine, and confirm: results render as pictograph strips, a SEQUENTIAL and a FUSED/multi-block result exist, closure visible (last pictograph's end = first's start). Load AAAA + HHHH, confirm ambient Ψ/Φ pinch results appear with ambient chips. Console clean of errors.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(combination): sequence-combinator lab page" -- src/routes/test/sequence-combinator src/lib/shared/combination
```

---

### Task 12: Analyzer revival panel

**Files:**
- Create: `src/routes/test/sequence-combinator/SimilarityPanel.svelte`
- Modify: `src/routes/test/sequence-combinator/+page.svelte` (mount panel)
- Modify: `src/routes/test/sequence-combinator/lab-state.svelte.ts` (similarity state)

- [ ] **Step 1: Wire the orphaned comparison module**

In lab-state: when both cards are loaded, compute `getSimilarityCalculator().computeSimilarity(cardA, cardB)` (first real consumer — fix any import/typing rot found in `src/lib/shared/comparison/` in place, in this commit).

- [ ] **Step 2: Build `SimilarityPanel.svelte`**

Renders: overall % (large, `tabular-nums`), four dimension bars (word/motion/position/structural — fixed-width label column, no layout shift), weight sliders (0–1 per dimension, re-computes with `SimilarityOptions` weights), per-beat score sparkline (simple div-bar row), and the near-duplicate warning banner when `overallScore > 0.85` ("These cards are N% similar — combinations will feel repetitive").

- [ ] **Step 3: Unit test the revival**

```ts
// tests/unit/combination/analyzer-revival.test.ts
import { describe, it, expect } from "vitest";
import { getSimilarityCalculator } from "$lib/shared/comparison/get-similarity-calculator";
import { GGGG_CW, HHHH_CCW } from "./fixtures";

describe("comparison module revival", () => {
  it("computes a similarity report between two fixture cards", () => {
    const report = getSimilarityCalculator().computeSimilarity(GGGG_CW, HHHH_CCW);
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.overallScore).toBeLessThan(1);
    expect(report.breakdown).toBeDefined();
  });
});
```

Run: `npm run test -- tests/unit/combination/analyzer-revival.test.ts` — PASS (fix comparison-module rot until it does).

- [ ] **Step 4: Browser check**

Reload the lab, confirm the panel renders real numbers for GGGG vs HHHH and weights recompute live.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(comparison): first consumer — similarity panel in combinator lab" -- src/routes/test/sequence-combinator src/lib/shared/comparison tests/unit/combination
```

---

### Task 13: Full verification pass

- [ ] **Step 1: Full unit suite** — `npm run test -- tests/unit/combination/` → all green; paste output.
- [ ] **Step 2: One `npm run check`** (respect `resource-budget.md` gates: no other svelte-check running, ≥4 GB free) piped to a log; grep errors; fix anything in combination/lab/comparison files.
- [ ] **Step 3: Visual verification per `visual-verification-mandatory.md`** — the lab is a new surface: emulate 1920×1080, 2560×1440, 3840×2160, 1440×900, 820×1180, 960×412, 375×667 (`emulate` with dpr ×1.1 per `reference_devtools_emulate_dpr`), `take_screenshot format:"webp", quality:70` each, READ each frame (no absurdly wide controls, no orphan rows, strips scroll internally at 375, page fills 4K). Fix and re-shoot until clean. Clear emulation, close the task-owned page.
- [ ] **Step 4: The flagship demo** — in the lab: two 4-count cards → 8-count closed hybrid rendered; two 8-count cards (fuse GGGG+HHHH result saved as input via JSON paste) → 16-count hybrid. Screenshot both for Austen.
- [ ] **Step 5: Final commit + report** — commit any fixes with pathspec; report to Austen with the screenshots, the roster-review ask (unconfirmed registry entries), and next-step options (consumer scan flow spec).

---

## Deferred (spec's Future list — do NOT build)

45° cross-mode tunnels, skewed grid, rewind/invert input liberties, N-way (>2) combination UI, consumer scan flow, saving results to library.

## Plan Self-Review (done at write time)

- **Spec coverage:** Layer 0 (T3), registry (T4), variants/liberties (T5), walk search + closure + impossibility (T6), letter-true post-processing (T7), verdicts/ranking/dedup (T8), ambient/ΦΨ (T9), facade (T10), lab (T11), analyzer revival (T12), acceptance demo 4+4→8 and 8+8→16 (T13). Continuity fork = inverted twins (T5) + labeling (T8).
- **Known soft spots, flagged inline:** enum member spellings in fixtures (T2 note), transform dataset availability under vitest (T5 note), `createStartPositionData` shape (T7 note), ambient provider probe-sequence shape (T10 note). Each has a stated fallback; none blocks the plan.
- **Type consistency:** `AmbientOptionProvider.optionsAt`, `CombinatorOptions.ambientProvider`, `WalkBlock.ambientWord`, `CombinatorVerdictReport.exhausted` used consistently across T6/T9/T10/T11.
