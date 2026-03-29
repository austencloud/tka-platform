# Unified Sequence Engine Design

**Date:** 2026-03-16
**Status:** Approved
**Goal:** Single source of truth for all sequence generation logic. Both the Svelte app and MCP server consume from `@tka/sequence-engine`. Zero drift possible. Built for decades.

---

## Problem

The MCP server and Svelte app have completely separate sequence generation implementations:

- **MCP** has beam search + constraint scoring + bridge finding, but lacks Type 6 filtering, prop type consistency, rotation continuity, and LOOP executors.
- **App** has 14 LOOP executors + rewound, domain filtering, rotation handling, but uses greedy random selection with no constraints, no bridges, no intelligent search.

They're complementary halves of what should be one system. The MCP tools can't serve as an autonomous test harness because they produce different results than the app.

---

## Solution

Merge both systems into a two-layer shared package with a unified generation pipeline:

- **Core layer** — Stable primitives: types, transition graph, orientation math, position maps
- **Generation layer** — Active pipeline: beam search builder, constraints (domain + style), bridges, LOOP executors, turn allocation, analysis, test harness

App's domain rules become hard constraints. MCP's beam search becomes the only builder. Both consumers import the same classes.

---

## Package Structure

```
packages/sequence-engine/src/
├── core/                          # Stable primitives (rarely change)
│   ├── types/                     # Domain types, enums, interfaces
│   │   ├── motion-types.ts        # MotionData, MotionType, RotationDirection
│   │   ├── position-types.ts      # GridPosition, GridLocation, GridMode
│   │   ├── sequence-types.ts      # SequenceStep, StartPosition, BuildResult
│   │   ├── loop-types.ts          # LOOPType, SliceSize, LOOPComponent, LOOPResult
│   │   └── pictograph-types.ts    # PictographData (variation data consumed by builder)
│   ├── transition-graph/          # Letter transition data + queries
│   │   └── TransitionGraph.ts
│   ├── orientation/               # Orientation math
│   │   ├── OrientationCalculator.ts
│   │   └── OrientationPropagator.ts
│   ├── positions/                 # Position maps, rotation tables
│   │   ├── position-maps.ts
│   │   └── PositionAnalyzer.ts
│   └── letters/                   # Letter parsing + classification
│       ├── LetterParser.ts        # Word string → letter array (handles Greek letters)
│       └── LetterClassifier.ts    # Letter → Type (1-6) classification
│
├── generation/                    # Active generation logic
│   ├── builder/                   # The unified builder
│   │   ├── SequenceBuilder.ts     # Entry point: build(options) → BuildResult
│   │   ├── BeamSearch.ts          # Search algorithm (configurable width)
│   │   └── SearchState.ts         # State tracked per beam path
│   ├── data/                      # Data access abstraction
│   │   └── IVariationProvider.ts  # Interface: getVariations(letter, position) → PictographData[]
│   ├── constraints/               # All constraint implementations
│   │   ├── IConstraint.ts         # Interface: evaluate(context) → ConstraintScore
│   │   ├── ConstraintSet.ts       # Hard + soft grouping with weights
│   │   ├── ConstraintContext.ts   # Context passed to each constraint
│   │   ├── presets.ts             # "smooth", "reversal", "isolation", etc.
│   │   ├── domain/                # App's domain rules (always-on hard constraints)
│   │   │   ├── Type6Constraint.ts           # No Type 6 at L1; L2+ needs turns > 0
│   │   │   ├── PropTypeConstraint.ts        # Match selected prop type
│   │   │   ├── PositionContinuityConstraint.ts  # Start == previous end
│   │   │   └── FloatConstraint.ts           # Float type conversion + prefloat
│   │   └── style/                 # Style constraints (from presets/natural language)
│   │       ├── DashPreferenceConstraint.ts
│   │       ├── ReversalConstraint.ts
│   │       ├── ContinuityConstraint.ts
│   │       ├── HandPathConstraint.ts
│   │       ├── MotionTypeConstraint.ts
│   │       ├── PerHandDashConstraint.ts
│   │       └── RotationDirectionConstraint.ts
│   ├── bridges/                   # Bridge finding + scoring
│   │   ├── BridgeFinder.ts        # Find single-letter bridges between positions
│   │   └── BridgeScorer.ts        # Score bridges using same ConstraintSet
│   ├── turns/                     # Turn allocation by level
│   │   └── TurnAllocator.ts
│   ├── scoring/                   # Variation scoring
│   │   └── VariationScorer.ts
│   ├── parsing/                   # Natural language → constraints
│   │   ├── ConstraintParser.ts
│   │   ├── patterns.ts
│   │   └── synonyms.ts
│   └── reporting/                 # Constraint satisfaction reports
│       └── ReportGenerator.ts
│
├── loop/                          # LOOP operations (circular sequences)
│   ├── detection/
│   │   ├── LOOPDetector.ts        # Detect LOOP components from sequence
│   │   └── OrientationCycleDetector.ts  # Detect 1x/2x/4x cycle requirements
│   ├── execution/                 # All 14 LOOP executors (source: LOOPExecutorSelector.ts)
│   │   ├── LOOPExecutorSelector.ts
│   │   ├── StrictRotatedExecutor.ts
│   │   ├── StrictMirroredExecutor.ts
│   │   ├── StrictFlippedExecutor.ts
│   │   ├── StrictSwappedExecutor.ts
│   │   ├── StrictInvertedExecutor.ts
│   │   ├── RewoundExecutor.ts
│   │   ├── MirroredSwappedExecutor.ts
│   │   ├── SwappedInvertedExecutor.ts
│   │   ├── MirroredInvertedExecutor.ts
│   │   ├── RotatedSwappedExecutor.ts
│   │   ├── RotatedInvertedExecutor.ts
│   │   ├── MirroredRotatedExecutor.ts
│   │   ├── MirroredRotatedInvertedExecutor.ts
│   │   ├── MirroredSwappedInvertedExecutor.ts
│   │   └── MirroredRotatedInvertedSwappedExecutor.ts
│   ├── targeting/                 # Circular generation: targeted end position
│   │   ├── LOOPEndPositionSelector.ts      # Determine required end position for LOOP
│   │   ├── RotatedEndPositionSelector.ts   # Specific to rotated patterns
│   │   └── PartialSequenceGenerator.ts     # Generate sequence constrained to target end
│   ├── validation/
│   │   ├── LOOPValidator.ts             # Validate position pairs for LOOP ops
│   │   └── position-pair-maps.ts        # Halved/quartered position pair tables
│   ├── extension/
│   │   ├── SequenceExtender.ts          # Check extendability + extend via bridges
│   │   └── OrientationCycleExtender.ts  # Extend to complete orientation cycles
│   └── LetterLookup.ts                 # Derive letter from motion parameters
│
├── analysis/                      # Post-generation analysis
│   ├── ReversalDetector.ts
│   ├── SequenceAnalyzer.ts
│   └── OrientationAlignmentCalculator.ts
│
└── harness/                       # Batch verification
    ├── BatchGenerator.ts          # Run N generations, collect results
    ├── DistributionAnalyzer.ts    # Statistical analysis of outputs
    └── HarnessReport.ts           # Report types
```

---

## Data Access: IVariationProvider

The builder needs access to pictograph variation data. The app loads this from CSV files (async, browser). The MCP server loads it upfront into memory (sync, Node). The engine abstracts this via an interface:

```typescript
// generation/data/IVariationProvider.ts

interface IVariationProvider {
  /** Get all pictograph variations for a letter at a given position */
  getVariations(letter: string, position: GridPosition, gridMode: GridMode): PictographData[];

  /** Get all pictograph variations for a grid mode (for start position selection) */
  getAllVariations(gridMode: GridMode): PictographData[];
}
```

Each consumer provides its own implementation:
- **MCP**: Wraps the in-memory pictograph data loaded at startup (sync)
- **App**: Wraps the existing `ISequenceDataProvider` / CSV loader (pre-loaded before generation starts)

The `SequenceBuilder` constructor takes an `IVariationProvider`:

```typescript
const builder = new SequenceBuilder(variationProvider);
const result = builder.build(options);
```

`build()` is **synchronous**. Both consumers must ensure data is loaded before calling build. The app already pre-loads CSV data; this just formalizes that contract.

---

## Letter Parsing

Word strings like "MAGIC" need to be split into letter arrays. TKA has multi-character letters (Greek letters like Σ, Φ, τ). The engine includes `LetterParser` in `core/letters/` which handles this. Currently lives in `mcp-server/src/core/word-simplifier.ts` — moves into the engine.

---

## Unified Builder API

```typescript
interface BuildOptions {
  word: string;
  gridMode: "diamond" | "box" | "skewed";
  level: 1 | 2 | 3;

  // Optional
  constraintPreset?: ConstraintPresetName;
  constraints?: string;                     // Natural language
  startPosition?: GridPosition;
  propType?: PropType;
  beamWidth?: number;                       // Default 10. Set 1 for greedy random.
  maxTurnIntensity?: number;                // 0-3

  // LOOP (for circular sequences)
  loop?: {
    type: LOOPType;
    sliceSize: SliceSize;
    useTargetedGeneration?: boolean;  // True = generate toward target end position
                                      // False = generate full then bridge (default)
  };
}

interface BuildResult {
  sequence: SequenceStep[];
  startPosition: StartPosition;
  bridgeStepIndices: number[];
  constraintReport: ConstraintReport;
  metrics: { statesExplored: number; beamPrunings: number };

  loop?: {
    derivedWord: string;
    seedWord: string;
    components: LOOPComponent[];
    derivedBeatIndices: number[];
    orientationCycleMultiplier: number;  // 1x, 2x, or 4x
  };
}
```

---

## Generation Pipeline

Seven stages, executed in order:

### 1. Letter Parsing

`LetterParser.parse(word)` → `string[]`. Handles multi-character Greek letters, validates all letters exist in transition graph.

### 2. Constraint Assembly

Parse `constraintPreset` or `constraints` string into a `ConstraintSet`. Inject domain hard constraints automatically based on `level` and `propType`:

| Constraint | Type | When Active |
|-----------|------|-------------|
| Type6Constraint | Hard | Always |
| PropTypeConstraint | Hard | When `propType` specified |
| PositionContinuityConstraint | Hard | Always |
| FloatConstraint | Hard | Always |

Style constraints come from the preset or parser. "smooth" activates ContinuityConstraint (1.0), HandPathConstraint (0.8), RotationContinuityConstraint (0.6).

**Note on rotation direction:** The app currently treats rotation continuity as a hard filter when `PropContinuity.CONTINUOUS` is set. In the unified engine, this becomes a hard constraint (not soft) when continuous mode is active, preserving the app's behavior. When not in continuous mode, it's a soft constraint.

### 3. Start Position Selection

Filter for valid start positions (where startPos === endPos). Score by constraints if multiple candidates. Use specified position if provided. Configurable whether to restrict to Type 6 positions or allow any valid start.

### 4. Turn Allocation

`TurnAllocator.allocate(wordLength, level, maxIntensity)` → per-hand turn arrays. Same logic currently shared by both MCP and app (identical implementations).

### 5. Beam Search

For each letter in the word:
1. Get all variations from `IVariationProvider` at each active beam state's end position
2. Hard constraints eliminate invalid variations (score 0 = dropped)
3. Soft constraints score remaining (weighted sum → total score)
4. If no valid variations: `BridgeFinder` finds bridge letters, scores them with same `ConstraintSet`, inserts best bridge, then retries the original letter
5. Keep top `beamWidth` states by cumulative score
6. Dead beams (no valid options, no bridges) are pruned
7. **Step-by-step orientation propagation** after each step is placed (app's approach, faster than post-build)
8. Assign rotation directions to dash/static motions per step

`beamWidth: 1` effectively becomes greedy "pick the best single option" — equivalent to the app's current behavior but with constraint scoring instead of random selection.

### 6. Post-Processing

- Detect reversals (mark beats where rotation direction changes)
- Handle float conversions (prefloat backup)
- Generate constraint satisfaction report

**Arrow positioning is NOT part of the engine.** It's a rendering concern that stays in the app. The app calls arrow positioning after receiving `BuildResult`.

### 7. LOOP Extension (if requested)

Two strategies, selectable via `loop.useTargetedGeneration`:

**Strategy A: Generate-then-bridge (default)**
- Build full sequence for the word
- Check if end position is LOOP-compatible with start
- If not: use `BridgeFinder` to find bridge to compatible position
- Execute LOOP transformation

**Strategy B: Targeted generation (app's current circular approach)**
- `LOOPEndPositionSelector` determines required end position for the LOOP type
- `PartialSequenceGenerator` generates the sequence with an additional hard constraint: final step must end at the target position
- Execute LOOP transformation directly (no bridging needed)

After LOOP execution:
- `OrientationCycleDetector` determines if 2x or 4x repetitions are needed
- `OrientationCycleExtender` extends if necessary
- Return extended sequence with LOOP metadata including `orientationCycleMultiplier`

---

## Constraint Interface

```typescript
interface IConstraint {
  readonly name: string;
  readonly type: "hard" | "soft";
  evaluate(context: ConstraintContext): ConstraintScore;
}

interface ConstraintContext {
  /** The candidate variation being evaluated */
  candidate: PictographData;

  /** The letter being placed at this step */
  letter: string;

  /** Index of the current step (0-based, excluding start position) */
  stepIndex: number;

  /** Total number of steps in the sequence (excluding start position) */
  totalSteps: number;

  /** Previously selected variations in the sequence (full history for multi-step constraints) */
  previousSteps: PictographData[];

  /** Difficulty level (1-3) */
  level: number;

  /** Assigned turns for this step */
  turnAllocation: TurnAllocation;

  /** Grid mode */
  gridMode: GridMode;

  /** Selected prop type (if any) */
  propType?: PropType;
}

interface ConstraintScore {
  score: number;        // 0.0 to 1.0
  satisfied: boolean;   // Hard: must be true. Soft: informational.
  reason?: string;
}
```

This extends the existing `ConstraintContext` (which has `candidate`, `letter`, `stepIndex`, `totalSteps`, `previousSteps`) with the additional fields needed by the new domain constraints (`level`, `turnAllocation`, `gridMode`, `propType`). Existing constraint implementations continue to work unchanged.

---

## Bridge System

Bridges use the same constraint pipeline as regular steps:

```typescript
interface BridgeOption {
  bridgeLetter: string;
  variation: PictographData;
  fromPosition: GridPosition;
  toPosition: GridPosition;
  availableLOOPs: LOOPOption[];   // Pre-computed by LOOPValidator
}
```

When a letter has no valid variations at a beam state's current position:
1. `BridgeFinder.findOptions(fromPosition, targetLetter)` returns candidates
2. Each bridge option is scored by the same `ConstraintSet`
3. Best-scoring bridge is inserted as an extra step
4. Original letter is retried from the new position
5. If no bridges exist, beam state dies

No separate bridge scoring logic. No `rotationRelation` filtering. The constraint system handles everything uniformly.

---

## LOOP Executors

14 executors + rewound from the app (source of truth: `LOOPExecutorSelector.ts`):

| Executor | LOOPType |
|----------|----------|
| StrictRotatedExecutor | ROTATED |
| StrictMirroredExecutor | MIRRORED |
| StrictFlippedExecutor | FLIPPED |
| StrictSwappedExecutor | SWAPPED |
| StrictInvertedExecutor | INVERTED |
| RewoundExecutor | STRICT_REWOUND |
| MirroredSwappedExecutor | MIRRORED_SWAPPED |
| SwappedInvertedExecutor | SWAPPED_INVERTED |
| MirroredInvertedExecutor | MIRRORED_INVERTED |
| RotatedSwappedExecutor | ROTATED_SWAPPED |
| RotatedInvertedExecutor | ROTATED_INVERTED |
| MirroredRotatedExecutor | MIRRORED_ROTATED |
| MirroredRotatedInvertedExecutor | MIRRORED_INVERTED_ROTATED |
| MirroredSwappedInvertedExecutor | (compound) |
| MirroredRotatedInvertedSwappedExecutor | MIRRORED_ROTATED_INVERTED_SWAPPED |

```typescript
interface ILOOPExecutor {
  execute(sequence: SequenceStep[], startPosition: StartPosition): LOOPResult;
}

interface LOOPResult {
  extendedSequence: SequenceStep[];
  derivedWord: string;
  seedWord: string;
  components: LOOPComponent[];
  derivedBeatIndices: number[];
}
```

**Refactoring note:** The app's executors currently import from app-specific paths (`$lib/shared/pictograph/...`, `$lib/shared/foundation/...`). Moving them to the engine requires replacing these imports with engine-internal `core/` imports. This is substantial refactoring work, not a simple file move.

---

## Test Harness

```typescript
interface BatchOptions {
  word: string;
  count: number;
  buildOptions: Omit<BuildOptions, "word">;
}

interface BatchReport {
  totalGenerated: number;
  failures: number;
  failureReasons: string[];
  startPositionDistribution: Record<string, number>;
  letterDistribution: Record<string, number>;
  bridgeFrequency: number;
  averageConstraintSatisfaction: number;
  loopSuccessRate: number;
  averageScore: number;
  scoreStdDev: number;
  worstSequenceScore: number;
}
```

`BatchGenerator.run(options)` calls `SequenceBuilder.build()` N times and aggregates. MCP exposes this as a tool for autonomous validation.

**Validation criteria for "known-good" sequences:**
- Position continuity: every step's start position matches previous step's end position
- Constraint satisfaction: all hard constraints satisfied (score > 0)
- No bridge-free failures: if the word is buildable, the builder finds a path
- LOOP correctness: if LOOP requested, the extended sequence forms a valid LOOP
- Orientation consistency: propagated orientations match expected values

---

## Consumer Integration

### App

```typescript
// src/lib/shared/di/containers/generation-container.ts
import { SequenceBuilder } from "@tka/sequence-engine/generation";
import { LOOPExecutorSelector } from "@tka/sequence-engine/loop";

export function createGenerationContainer(variationProvider: IVariationProvider) {
  return createContainer()
    .add({ sequenceBuilder: () => new SequenceBuilder(variationProvider) })
    .add({ loopExecutorSelector: () => new LOOPExecutorSelector() });
}
```

`generate-actions.svelte.ts` becomes a thin reactive wrapper:
- Converts UI state (spell mode, customize options) into `BuildOptions`
- Calls `sequenceBuilder.build(options)`
- Converts `BuildResult` into `SequenceData` for the UI
- Calls arrow positioning on the result (rendering concern stays in app)

All generation logic lives in the engine. The app owns only UI state, data format conversion, and arrow positioning.

### MCP Server

```typescript
// mcp-server/src/tools/generate-sequence.ts
import { SequenceBuilder } from "@tka/sequence-engine/generation";

const builder = new SequenceBuilder(variationProvider);
const result = builder.build({ word, constraintPreset: "smooth", level: 1 });
```

Same class, same function, same result. MCP's `sequence-builder.ts`, `constrained-builder.ts`, and all local constraint/bridge/loop files get deleted.

### Package Exports

The package.json needs subpath exports:

```json
{
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" },
    "./core": { "types": "./src/core/index.ts", "default": "./src/core/index.ts" },
    "./generation": { "types": "./src/generation/index.ts", "default": "./src/generation/index.ts" },
    "./loop": { "types": "./src/loop/index.ts", "default": "./src/loop/index.ts" },
    "./analysis": { "types": "./src/analysis/index.ts", "default": "./src/analysis/index.ts" },
    "./harness": { "types": "./src/harness/index.ts", "default": "./src/harness/index.ts" }
  }
}
```

**Note:** These are subpath entry points, not barrel re-exports. Each index.ts is the composition root for that layer, not a re-export of every file.

---

## Existing Package Restructure

The existing `packages/sequence-engine/` already has code at `src/constraints/`, `src/loop/`, `src/services/`, `src/data/`. Phase 1 includes reorganizing these into the `core/` and `generation/` structure:

- `src/constraints/` → `src/generation/constraints/` (existing 7 style constraints + infrastructure)
- `src/loop/` → `src/loop/` (stays, but gets expanded with app's executors)
- `src/services/implementations/TransitionGraph.ts` → `src/core/transition-graph/`
- `src/services/implementations/OrientationCalculator.ts` → `src/core/orientation/`
- `src/services/implementations/OrientationPropagator.ts` → `src/core/orientation/`
- `src/domain/models/` → `src/core/types/`
- `src/data/` → stays or merges into `core/`

This is a file reorganization step at the start of Phase 1, before adding new code.

---

## Migration Strategy

Sequential, not big-bang:

### Phase 1: Build the Engine
1. Reorganize existing `sequence-engine` files into `core/` and `generation/` structure
2. Add `IVariationProvider` interface and `LetterParser`
3. Refactor app's 14+1 LOOP executors to remove app-specific imports, move into `loop/execution/`
4. Move app's LOOP targeting services (`LOOPEndPositionSelector`, `RotatedEndPositionSelector`, `PartialSequenceGenerator`) into `loop/targeting/`
5. Move MCP's beam search into `generation/builder/`
6. Implement 4 domain constraints (Type6, PropType, PositionContinuity, Float) as IConstraint
7. Implement unified SequenceBuilder with 7-stage pipeline
8. Add subpath exports to package.json
9. Unit test: position continuity, constraint satisfaction, LOOP correctness against known-good sequences

### Phase 2: Wire MCP
- Create MCP's `IVariationProvider` implementation wrapping in-memory data
- Replace MCP's local builders with engine imports
- Delete `mcp-server/src/core/sequence-builder.ts`
- Delete `mcp-server/src/core/constraints/` (entire directory — already duplicated in engine)
- Delete `mcp-server/src/core/loop/` (entire directory)
- Delete `mcp-server/src/core/turn-allocator.ts`
- Delete `mcp-server/src/core/orientation-calculator.ts`, `orientation-propagation.ts`
- Validate MCP output matches previous behavior

### Phase 3: Wire App
- Create app's `IVariationProvider` implementation wrapping CSV data loader
- Replace app's GenerationOrchestrator, StepGenerationOrchestrator, PictographFilter with engine's SequenceBuilder
- Replace app's LOOP executors, validators, extenders with engine imports
- Slim down `generate-actions.svelte.ts` to UI wrapper (BuildOptions assembly + BuildResult → SequenceData conversion + arrow positioning)
- Delete app's local generation services (see full deletion list below)
- Validate app output through UI testing

### Phase 4: Harness + Cleanup
- Add BatchGenerator and DistributionAnalyzer
- Expose batch generation via MCP tool
- Delete all dead code from both consumers
- Run batch validation: 50+ sequences across common words, verify distribution health

---

## Incompatibilities to Resolve During Phase 1

| Issue | MCP Behavior | App Behavior | Resolution |
|-------|-------------|-------------|------------|
| Start position selection | Hardcodes Type 6 (α, β, γ) | Any pictograph with startPos===endPos | Configurable, default to Type 6 |
| Type 6 filtering | None | Excludes by level | Domain hard constraint (always active) |
| Bridge strategy | Automatic bridge insertion | No bridges | Always available, beam search handles it |
| Prop type filtering | None | Filters to selected prop | Domain hard constraint when propType specified |
| Failure recovery | Prune beam state | Fallback to unfiltered | Prune (beam search handles gracefully) |
| Orientation timing | Post-sequence rebuild | Step-by-step during generation | Step-by-step (app's approach) |
| Rotation direction | Via constraint if specified | Hard filter when CONTINUOUS mode | Hard constraint when continuous, soft otherwise |
| Circular generation | Not supported | Targeted end position approach | Both strategies available via `useTargetedGeneration` flag |
| Data access | Sync in-memory | Async CSV (pre-loaded) | `IVariationProvider` interface, sync `build()` |
| Arrow positioning | Not applicable | Calculated during generation | Stays in app, called after `build()` returns |
| @tka/render-core dependency | Not used | Not used | Engine has no render-core dependency. Pure generation logic. |

---

## What Gets Deleted After Migration

### From MCP Server
- `mcp-server/src/core/sequence-builder.ts`
- `mcp-server/src/core/constraints/` (entire directory)
- `mcp-server/src/core/loop/` (entire directory)
- `mcp-server/src/core/turn-allocator.ts`
- `mcp-server/src/core/orientation-calculator.ts`
- `mcp-server/src/core/orientation-propagation.ts`
- `mcp-server/src/core/word-simplifier.ts`

### From App
- `src/lib/features/create/generate/services/implementations/GenerationOrchestrator.ts`
- `src/lib/features/create/generate/services/implementations/StepGenerationOrchestrator.ts`
- `src/lib/features/create/generate/services/implementations/PictographFilter.ts`
- `src/lib/features/create/generate/circular/services/implementations/` (all executors + selector)
- `src/lib/features/create/generate/circular/services/implementations/LOOPEndPositionSelector.ts`
- `src/lib/features/create/generate/circular/services/implementations/RotatedEndPositionSelector.ts`
- `src/lib/features/create/generate/circular/services/implementations/PartialSequenceGenerator.ts`
- `src/lib/features/create/shared/services/implementations/BridgeFinder.ts`
- `src/lib/features/create/shared/services/implementations/LOOPValidator.ts`
- `src/lib/features/create/shared/services/implementations/SequenceExtender.ts`
- `src/lib/features/create/shared/services/implementations/StartPositionSelector.ts`
- `src/lib/features/create/generate/services/implementations/TurnManager.ts`
- `src/lib/features/create/generate/services/implementations/StepConverter.ts`
- `src/lib/features/create/generate/circular/services/implementations/LOOPParameterProvider.ts`
- `src/lib/features/create/generate/circular/services/implementations/LOOPTypeResolver.ts`
- Various contracts/interfaces replaced by engine interfaces
