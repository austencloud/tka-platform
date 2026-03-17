# Generation Parity: Compositional Shared Engine

**Date:** 2026-03-17
**Status:** Design
**Goal:** Full parity between MCP tools and in-app generation. Same engine, same constraints, same results.

---

## Problem

The app and MCP server generate sequences through completely different code paths:

- **App:** Random-walk beat-by-beat selection (`StepGenerationOrchestrator` + `PictographFilter`), app-specific LOOP executors, app-specific orientation propagation, app-specific turn allocation
- **MCP:** Beam search with constraint scoring (`SequenceBuilder` + `BeamSearch`), shared engine LOOP layer, shared orientation propagation, shared turn allocation

There is no parity. Testing via MCP tells you nothing about what the app will produce. The shared engine (`packages/sequence-engine/`) was built to fix this, but the app hasn't been migrated to use it.

Additionally, the shared engine's preset system has domain accuracy issues (e.g., "isolation" is defined as "all pro motions" when it should be "pro shift with zero turns") and the presets enumerate arbitrary combinations of orthogonal dimensions instead of allowing free composition.

## Design Decisions (from brainstorming)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Generation algorithm | Always beam search, retire random walk | Parity requires same algorithm. Beam search with `smooth` default produces better results than random. |
| LOOP migration | Full LOOP migration | Full parity means full parity. |
| UI changes | None. Default to `smooth` behind the scenes. | Engine parity, not UI expansion. Preset UI is a follow-up. |
| Level handling | Level is a separate input, not a compositional dimension | Level is a domain invariant (L1 *cannot* have turns), not a preference. |
| Constraint composition | Engine-level `buildConstraintSet(options)` | One function both MCP and app call. Presets and NL parsing both resolve to `ConstraintOptions`. |
| Data access | Single `IVariationProvider` implementation per platform | No adapters. The app implements `IVariationProvider` directly, absorbing `LetterQueryHandler` responsibilities. |

---

## Workstream 1: Compositional Constraint System

### The Problem with Presets

The current 11 presets hard-code combinations of orthogonal dimensions:

- `pro-cw` exists but `pro-ccw` doesn't
- `anti-ccw` exists but `anti-cw` doesn't
- `isolation` is defined as "all pro motions" but should be "pro shift with zero turns"
- `no-dash` actually already allows statics (it only excludes dash motion type), but the preset name implies "shifts only" which is misleading
- No way to compose arbitrary combinations

### The Solution: `ConstraintOptions`

A structured type representing the orthogonal dimensions of constraint:

```typescript
interface ConstraintOptions {
  /** Pro, anti, or any motion type. Default: "any" */
  motionType?: "pro" | "anti" | "any";

  /** Clockwise, counter-clockwise, or any. Default: "any" */
  rotationDirection?: "cw" | "ccw" | "any";

  /** Specific turn value or any. Default: "any" */
  turns?: number | "any";

  /** Which motion families to include/exclude (shift, dash, static). Default: all included.
   *  Named "motionFamily" because shift/dash/static are motion types, not hand path families.
   *  Hand paths are cw/ccw/dash/static/hashIn/hashOut — a separate concept. */
  motionFamily?: {
    include?: ("shift" | "dash" | "static")[];
    exclude?: ("shift" | "dash" | "static")[];
  };

  /** Prop spin continuity preference. Default: "any" */
  propContinuity?: "maximize" | "allow-reversals" | "force-reversals";

  /** Hand path continuity preference. Default: "any" */
  handPathContinuity?: "maximize" | "allow-reversals" | "force-reversals";
}
```

### The Composition Function

```typescript
function buildConstraintSet(options: ConstraintOptions): ConstraintSet
```

This is the single entry point. It reads the structured options and instantiates the appropriate constraint classes (which already exist and are already compositional):

- `motionType: "pro"` -> `MotionTypeConstraint({ motionType: "pro", hand: "both", mode: "require" })`
- `rotationDirection: "cw"` -> `RotationDirectionConstraint({ direction: "cw", hand: "both", mode: "require" })`
- `motionFamily: { exclude: ["dash"] }` -> `MotionTypeConstraint({ motionType: "dash", hand: "both", mode: "exclude" })`
- `propContinuity: "maximize"` -> `ContinuityConstraint("maximize")`
- `propContinuity: "force-reversals"` -> `ReversalConstraint("every")`
- `handPathContinuity: "maximize"` -> `HandPathReversalConstraint` with maximize config
- `handPathContinuity: "force-reversals"` -> `HandPathReversalConstraint("every")`
- `turns: 0` -> Turn filtering constraint (new, filters variations to zero-turn only)

The underlying constraint classes (`MotionTypeConstraint`, `RotationDirectionConstraint`, `ContinuityConstraint`, etc.) remain unchanged. They're already compositional. The preset layer is the only thing that changes.

### Named Presets Become Aliases

Presets are redefined as `ConstraintOptions` objects:

```typescript
const PRESET_ALIASES: Record<string, ConstraintOptions> = {
  // Flow presets
  "smooth": { propContinuity: "maximize", handPathContinuity: "maximize" },
  "smooth-hands": { handPathContinuity: "maximize" },
  "smooth-props": { propContinuity: "maximize" },

  // Reversal presets
  "reversal": { propContinuity: "force-reversals" },
  "maximum-chaos": { propContinuity: "force-reversals", handPathContinuity: "force-reversals" },

  // Motion type presets (corrected)
  // Isolation = pro shift at zero turns. Type 6 (static) excluded because
  // static motions have no rotation — they're not "pro" in any meaningful sense.
  "isolation": { motionType: "pro", turns: 0, motionFamily: { include: ["shift"] } },
  "antispin": { motionType: "anti", propContinuity: "maximize" },

  // Exclusion presets
  "no-dash": { motionFamily: { exclude: ["dash"] } },
  "no-static": { motionFamily: { exclude: ["static"] } },
  "maximize-dash": { motionFamily: { include: ["dash"] } },
};
```

Note: `pro-cw` and `anti-ccw` are removed as dedicated presets. Users compose these naturally: `{ motionType: "pro", rotationDirection: "cw" }`.

### Natural Language Parsing

The existing `parseConstraintSet()` function is updated to resolve to `ConstraintOptions` first, then call `buildConstraintSet()`. This ensures all three paths (structured options, presets, natural language) produce identical constraint sets:

```
ConstraintOptions ──→ buildConstraintSet() ──→ ConstraintSet
PresetName ──→ PRESET_ALIASES[name] ──→ buildConstraintSet() ──→ ConstraintSet
"all pro motions" ──→ parseToOptions() ──→ buildConstraintSet() ──→ ConstraintSet
```

### Prerequisite: Unify `MotionData` Types

The engine currently has **two incompatible `MotionData` interfaces**:

1. **Constraint layer** (`generation/constraints/types.ts`): has `color`, no `turns`, no `plane`
2. **Core layer** (`core/types/sequence-engine-types.ts`): has `turns`, `plane`, no `color`

The `TurnConstraint` needs `turns` on the constraint-layer `MotionData` to evaluate candidates. The fix: unify to a single `MotionData` type in the core layer that includes all fields. The constraint-layer `PictographData` references the core `MotionData` with `turns` and `plane`. The `color` field can be optional (only populated when coming from CSV data that includes it).

```typescript
// Single MotionData in core/types/sequence-engine-types.ts
export interface MotionData {
  motionType: string;
  startLocation: string;
  endLocation: string;
  rotationDirection: string;
  startOrientation?: string;
  endOrientation?: string;
  turns?: number | "fl";
  plane?: "wall" | "wheel" | "overhead";
  color?: string;  // Present in CSV data, not needed by engine logic
}
```

The constraint layer's `types.ts` re-exports this type instead of defining its own.

### New: Turn Filtering Constraint

To support `turns: 0` (required for isolation), a new constraint class is needed. This filters variations where motions have non-zero turns. This is a hard constraint — if you ask for zero turns, you get zero turns.

With `MotionData` unified (above), the constraint can read `candidate.blueMotion.turns` and `candidate.redMotion.turns` directly.

```typescript
class TurnConstraint implements IVariationConstraint {
  // Evaluates candidate's blue/red motion turn values
  // Hard reject if turns don't match the specified value
  // turns === undefined treated as 0 (no rotation allocated yet)
}
```

### Changes to `SequenceBuilder`

`SequenceBuilder.assembleConstraints()` currently handles preset lookup and NL parsing separately. It changes to:

1. If `constraintPreset` is provided, resolve via `PRESET_ALIASES[name]` -> `buildConstraintSet()`
2. If `constraints` (NL string) is provided, parse to `ConstraintOptions` -> `buildConstraintSet()`
3. If `constraintOptions` (new field on `BuildOptions`) is provided, call `buildConstraintSet()` directly
4. Domain hard constraints (Type6, PositionContinuity, Float, PropType) are added separately as before

`BuildOptions` gains a new optional field:

```typescript
interface BuildOptions {
  // ... existing fields ...
  constraintOptions?: ConstraintOptions;  // New: structured composition
}
```

---

## Workstream 2: App `IVariationProvider` Implementation

### Current State

The app loads pictograph data through `LetterQueryHandler`:
- Loads CSV once, caches as `ParsedCsvRow[]`
- `getAllPictographVariations(gridMode)` returns all ~800+ rows as `PictographData[]`
- No indexed lookup by letter+position

The MCP server has `MCPVariationProvider`:
- Pre-indexes all pictographs by `${letter}:${position}` key
- O(1) lookup via `getVariations(letter, position, gridMode)`

### Design

Create `BrowserVariationProvider` implementing `IVariationProvider` directly:

- **Owns CSV loading and parsing** (absorbs `LetterQueryHandler` responsibilities)
- **Pre-indexes by `letter:position`** on load, matching MCP's strategy
- **Registered in DI container** as a singleton
- **Consumed by both** the generation pipeline (via `SequenceBuilder`) and the rendering pipeline (replaces `LetterQueryHandler` usage)

```typescript
class BrowserVariationProvider implements IVariationProvider {
  private index: Map<string, PictographData[]> = new Map();
  private allVariations: PictographData[] = [];

  async initialize(gridMode: string): Promise<void> {
    // Load CSV, parse, build index
  }

  getVariations(letter: string, position: string, gridMode: string): PictographData[] {
    return this.index.get(`${letter}:${position}`) ?? [];
  }

  getAllVariations(gridMode: string): PictographData[] {
    return this.allVariations;
  }
}
```

### Type Alignment

The shared engine defines `PictographData` in `packages/sequence-engine/src/generation/constraints/types.ts` with fields: `letter`, `startPosition`, `endPosition`, `timing`, `direction`, `blueMotion`, `redMotion`.

The app defines `PictographData` in `src/lib/shared/pictograph/shared/domain/models/PictographData.ts` with additional rendering fields.

The `BrowserVariationProvider` maps from the app's richer type to the engine's minimal type at load time. The engine only needs the motion data fields, not rendering metadata.

### What Gets Retired

- `LetterQueryHandler` — its CSV loading + caching responsibilities absorbed by `BrowserVariationProvider`
- Any code that calls `letterQueryHandler.getAllPictographVariations()` for generation purposes

---

## Workstream 3: Generate Panel Migration

### Freeform Generation

**Current:** `GenerationOrchestrator.generateFreeformSequence()` orchestrates 6 steps using `StepGenerationOrchestrator` (random walk), `TurnAllocator`, `PictographFilter`, etc.

**After:** `GenerationOrchestrator.generateFreeformSequence()` delegates to `SequenceBuilder.build()`:

```typescript
private async generateFreeformSequence(options: GenerationOptions): Promise<SequenceData> {
  const builder = new SequenceBuilder(this.variationProvider);

  const result = builder.build({
    word: options.word ?? this.generateRandomWord(options.length),
    gridMode: options.gridMode,
    level: this.metadataService.mapDifficultyToLevel(options.difficulty),
    constraintOptions: { propContinuity: "maximize", handPathContinuity: "maximize" }, // smooth default
    startPosition: options.startPosition?.startPosition,
    propType: options.propType,
    maxTurnIntensity: options.turnIntensity,
  });

  return this.convertBuildResultToSequenceData(result, options);
}
```

**Key change:** The app currently generates sequences by *length* (N random beats), not by *word*. This needs a bridge: either generate a random word of the requested length first, or add a `length`-based mode to `SequenceBuilder` that picks random letters.

### Circular (LOOP) Generation

**Current:** `GenerationOrchestrator.generateCircularSequence()` uses app-specific `IPartialSequenceGenerator`, `ILOOPExecutorSelector`, `ILOOPEndPositionSelector`, etc.

**After:** Delegates to `SequenceBuilder.build()` with `loop` options:

```typescript
private async generateCircularSequence(options: GenerationOptions): Promise<SequenceData> {
  const builder = new SequenceBuilder(this.variationProvider);

  const result = builder.build({
    word: options.word ?? this.generateRandomWord(options.length),
    gridMode: options.gridMode,
    level: this.metadataService.mapDifficultyToLevel(options.difficulty),
    constraintOptions: { propContinuity: "maximize" },
    startPosition: options.startPosition?.startPosition,
    loop: {
      type: options.loopType ?? "strict_rotated",
      sliceSize: options.sliceSize ?? "halved",
      useTargetedGeneration: true,
    },
  });

  return this.convertBuildResultToSequenceData(result, options);
}
```

**Prerequisite:** The shared engine's `extendWithLOOP()` is currently a stub (line 303 of `SequenceBuilder.ts`). It needs full wiring to the LOOP layer's executors. This is the largest piece of work in the migration.

### `BuildResult` to `SequenceData` Conversion

A conversion function maps the shared engine's output type to the app's domain model:

```typescript
private convertBuildResultToSequenceData(
  result: BuildResult,
  options: GenerationOptions
): SequenceData {
  // Map SequenceStep[] -> StepData[]
  // Create StartPositionData from result.startPosition
  // Apply reversal detection
  // Create SequenceData with metadata
}
```

### What Gets Retired from the App

| File | Reason |
|------|--------|
| `StepGenerationOrchestrator.ts` | Replaced by `SequenceBuilder` beam search |
| `PictographFilter.ts` | Replaced by constraint system |
| `TurnAllocator.ts` (app) | Replaced by shared `TurnAllocator` |
| `LOOPParameterProvider.ts` | Absorbed into `SequenceBuilder` LOOP options |
| `PartialSequenceGenerator.ts` | Replaced by shared engine LOOP generation |
| `LOOPEndPositionSelector.ts` | Replaced by shared engine LOOP layer |
| `LOOPExecutorSelector.ts` (app) | Replaced by shared engine LOOP executors |
| All 18 app LOOP executors | Replaced by shared engine (15 existing + 3 Complementary to port) |
| `OrientationCycleDetector.ts` (app) | Replaced by shared engine's `OrientationCycleDetector` |
| `OrientationCycleExtender.ts` (app) | Replaced by shared engine's `OrientationCycleExtender` |
| `rederiveLettersFromMotions()` logic | Replaced by shared engine's `LetterLookup` |
| App-side orientation propagation | Replaced by shared `OrientationPropagator` |
| `LetterQueryHandler.ts` | Absorbed by `BrowserVariationProvider` |

### What Stays

| File | Reason |
|------|--------|
| `GenerationOrchestrator.ts` | Stays as orchestrator, but delegates to shared engine |
| `SequenceMetadataManager.ts` | App-specific metadata creation |
| `ReversalDetector.ts` (app) | May stay if app-specific detection differs from engine |
| `StartPositionSelector.ts` | UI-specific start position picking |

### `propContinuity` Value Mapping

Three different systems use different names for the same concept:

| App (`GenerationOptions`) | Engine (`ConstraintOptions`) | Engine LOOP (`LOOPGenerationOptions`) |
|--------------------------|---------------------------|--------------------------------------|
| `"continuous"` | `"maximize"` | `"continuous"` |
| `"random"` | `"allow-reversals"` | `"non-continuous"` |
| (no equivalent) | `"force-reversals"` | (no equivalent) |

The `GenerationOrchestrator` maps from app values to engine values when calling `SequenceBuilder.build()`:
- `PropContinuity.CONTINUOUS` -> `{ propContinuity: "maximize" }`
- `PropContinuity.RANDOM` -> `{ propContinuity: "allow-reversals" }`

---

## Workstream 4: Complete LOOP Integration in Shared Engine

The `SequenceBuilder.extendWithLOOP()` is a stub. The LOOP layer exists in the engine (`packages/sequence-engine/src/loop/`) with 15 executors, but the builder doesn't wire to them.

### Missing Executors: App Has 18, Engine Has 15

Three "Complementary" executors exist in the app but were never ported to the engine:

| Executor | App path |
|----------|----------|
| `MirroredRotatedComplementaryLOOPExecutor` | `circular/services/implementations/` |
| `MirroredRotatedComplementarySwappedLOOPExecutor` | `circular/services/implementations/` |
| `SwappedComplementaryLOOPExecutor` | `circular/services/implementations/` |

These must be ported to the shared engine before the app can retire its LOOP layer. Without them, 3 LOOP types would silently disappear.

### Letter Re-derivation

The app's `GenerationOrchestrator.rederiveLettersFromMotions()` (line 326) dynamically imports `motionQueryHandler` to look up letters from transformed motion configurations after LOOP execution. This is critical post-processing — LOOP executors copy source beat letters but the transformed motions may correspond to different letters. The shared engine needs equivalent functionality, likely via `LetterLookup` (which already exists in the engine's loop layer).

### What's needed

1. **Port 3 Complementary executors** to the shared engine
2. `SequenceBuilder.extendWithLOOP()` calls the LOOP execution pipeline:
   - Select executor based on `LoopOptions.type`
   - Determine end position for seed sequence based on LOOP type + slice size
   - Execute LOOP transformation on the seed steps
   - Re-derive letters from transformed motions (via `LetterLookup`)
   - Return extended sequence with LOOP metadata
3. The builder's seed generation must respect end-position constraints (the seed must end at the position required by the LOOP type). The new `endPosition` field on `BuildOptions` handles this.
4. The LOOP executors currently operate on `PictographData[]`. The builder produces `SequenceStep[]`. Either:
   - a) Convert `SequenceStep[]` back to `PictographData[]` for executors (wasteful)
   - b) Update executors to work with `SequenceStep[]` directly (proper)

   Option (b) is correct. The executors should operate on the engine's types.

### Orientation Cycle Detection

The engine already has `OrientationCycleDetector` and `OrientationCycleExtender` in its loop layer. The app's `OrientationCycleDetector` is retired — the engine's version is used instead. This closes the duplication.

---

## Length-Based vs Word-Based Generation

The app currently generates by *length* (user picks "8 beats"). The shared engine generates by *word* (user provides "BOOK"). These are fundamentally different:

- **Word-based:** Each letter maps to a specific hand-path family. Bridges are inserted automatically. The word IS the specification.
- **Length-based:** Random letters are selected to fill N beats. No bridges needed because there's no target word.

### Resolution

Add a `length`-based mode to `SequenceBuilder`:

```typescript
interface BuildOptions {
  // Either word OR length must be provided (word changes from required to optional)
  word?: string;
  length?: number;

  // End position constraint (user-specified or LOOP-required)
  endPosition?: string;

  // Letter inclusion/exclusion (ported from app's GenerationOptions)
  mustContainLetters?: string[];
  mustNotContainLetters?: string[];

  // ... existing fields ...
}
```

**Breaking change:** `word` becomes optional (was required). `LetterParser.parse()` is only called when `word` is provided. Length-based mode skips letter parsing entirely.

When `length` is provided without `word`:
1. Pick a random start position
2. For each beat, query available letters from the current position
3. Use beam search to select the best letter+variation based on constraints
4. No bridge letters needed (each step is a direct transition)

This is essentially what the app does today (random walk), but through the beam search with constraint scoring. The beam search naturally selects from available transitions at each position, so it handles length-based generation without modification — it just needs a "pick next letter" mode alongside "place specific letter."

---

## Migration Order

1. **Unify `MotionData` types** — prerequisite for TurnConstraint and type sanity
2. **Compositional constraint system** — `buildConstraintSet()` + `ConstraintOptions` + `TurnConstraint`
3. **MCP tools update** — update MCP to use `buildConstraintSet()` / `ConstraintOptions` (must happen immediately after step 2, since MCP is the only current consumer and will break if presets change without updating its calls)
4. **Port 3 Complementary LOOP executors** to shared engine
5. **Complete LOOP integration** — wire `extendWithLOOP()` to executors, letter re-derivation, orientation cycle detection
6. **Length-based generation mode** — add `length` option to `SequenceBuilder`, make `word` optional
7. **`BrowserVariationProvider`** — data access layer for the app
8. **Generate panel rewiring** — swap orchestrator internals to use shared engine
9. **Retire dead code** — remove replaced services

---

## Testing Strategy

Following the "earned tests" philosophy, tests are warranted here because:

- Constraint composition is pure logic with subtle interaction bugs (silent corruption risk)
- LOOP transformations produce wrong letters if executor logic is off (silent corruption)
- Beam search + constraints produce different sequences than random walk — need to verify correctness

### What to test

- `buildConstraintSet()` produces correct constraint instances for each option
- Named presets resolve to correct `ConstraintOptions`
- `SequenceBuilder.build()` with `smooth` default produces valid, continuous sequences
- `SequenceBuilder.build()` with `isolation` produces only pro-shift-zero-turn variations
- LOOP extension produces circular sequences (end position matches start)
- Length-based generation produces sequences of exactly N beats
- `BrowserVariationProvider` returns same results as `MCPVariationProvider` for same input data
- Regression: length-based beam search produces valid sequences for all position groups (beam search must not be more restrictive than random walk was)

---

## Success Criteria

1. `generate_sequence(word: "BOOK", constraintPreset: "smooth")` via MCP produces a sequence using the same code path as clicking "Generate" in the app with default settings
2. All named presets are domain-accurate (isolation = pro shift zero turns, etc.)
3. Arbitrary constraint compositions work: `{ motionType: "pro", rotationDirection: "ccw" }` produces pro-ccw sequences
4. LOOP generation through the app uses the shared engine's 18 executors (15 existing + 3 Complementary ported)
5. Zero duplicate orientation propagation, turn allocation, or LOOP execution code between app and MCP
6. `LoopOptions.type` and `LoopOptions.sliceSize` use proper union types (not bare strings) for compile-time safety
7. Single `MotionData` type across the engine — no dual definitions
