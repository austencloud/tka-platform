# Unified Sequence Engine Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate sequence generation logic from both the MCP server and Svelte app into a single `@tka/sequence-engine` package so both consumers use identical code paths.

**Architecture:** Two-layer package (core primitives + generation pipeline). Beam search builder with domain hard constraints + style soft constraints. `IVariationProvider` abstracts data access so the same builder works in Node (MCP) and browser (app).

**Tech Stack:** TypeScript (strict), Vitest for unit tests, existing `@tka/sequence-engine` package as foundation.

**Spec:** `docs/superpowers/specs/2026-03-16-unified-sequence-engine-design.md`

---

## Important Implementation Notes

### Existing IConstraint Interface

The existing engine uses `ConstraintType` enum + `ConstraintMode` type, NOT the spec's `name: string` + `type: "hard" | "soft"`. Follow the existing pattern:

```typescript
// Existing interface (DO NOT change):
interface IConstraint {
  readonly type: ConstraintType;        // Enum value
  readonly mode: ConstraintMode;        // "hard" | "soft"
  readonly description: string;
  evaluate(context: ConstraintContext): ConstraintScore;
}
```

New domain constraints must add entries to the `ConstraintType` enum and implement this interface.

### Executor Inventory (Actual: 18 pure executors)

Source of truth: `src/lib/features/create/generate/circular/services/implementations/`

**Strict (6):** StrictRotated, StrictMirrored, StrictFlipped, StrictSwapped, StrictInverted, Rewound
**Compound (12):** MirroredSwapped, SwappedInverted, MirroredInverted, RotatedSwapped, RotatedInverted, MirroredRotated, MirroredRotatedInverted, MirroredSwappedInverted, MirroredRotatedInvertedSwapped, MirroredRotatedComplementary, MirroredRotatedComplementarySwapped, SwappedComplementary

Plus: LOOPExecutorSelector, LOOPDetector, OrientationCycleDetector, OrientationCycleExtender, LOOPEndPositionSelector, RotatedEndPositionSelector, PartialSequenceGenerator (not executors, but part of the LOOP infrastructure)

### File Path Note

App generation services live under `src/lib/features/create/generate/shared/services/` (note the `shared/` segment). The circular LOOP services live under `src/lib/features/create/generate/circular/services/`.

---

## Chunk 1: Core Layer Restructure

Reorganize existing `packages/sequence-engine/src/` from flat layout into the two-layer `core/` + `generation/` structure. No new logic — just moving files and updating imports.

### Task 1.1: Inline calculateEndOrientation and remove render-core dependency

The engine currently re-exports `calculateEndOrientation` from `@tka/render-core`. The spec requires the engine to have no render-core dependency. Inline the function.

**Files:**
- Modify: `packages/sequence-engine/src/orientation-calculator.ts`
- Modify: `packages/sequence-engine/package.json`
- Reference: `packages/render-core/src/calculations/orientation.ts` (lines 280-342 + helpers)

- [ ] **Step 1:** Read `packages/render-core/src/calculations/orientation.ts` to find `calculateEndOrientation`, `getHandpathDirection`, `switchOrientation`, and the `OrientationInput` interface
- [ ] **Step 2:** Copy those functions and the `OrientationInput` interface into `packages/sequence-engine/src/orientation-calculator.ts`, replacing the re-export
- [ ] **Step 3:** Remove `"@tka/render-core": "file:../render-core"` from `packages/sequence-engine/package.json` dependencies
- [ ] **Step 4:** Run `npx tsc --noEmit` in `packages/sequence-engine/` to verify
- [ ] **Step 5:** Commit: `refactor(sequence-engine): inline orientation calc, remove render-core dep`

### Task 1.2: Create core/ directory structure and move types

**Files:**
- Create: `packages/sequence-engine/src/core/types/sequence-engine-types.ts`
- Create: `packages/sequence-engine/src/core/types/index.ts`
- Move: `packages/sequence-engine/src/domain/models/SequenceEngineTypes.ts` → `core/types/`

- [ ] **Step 1:** Create `packages/sequence-engine/src/core/types/` directory
- [ ] **Step 2:** Move `src/domain/models/SequenceEngineTypes.ts` to `src/core/types/sequence-engine-types.ts`
- [ ] **Step 3:** Create `src/core/types/index.ts` that re-exports all types
- [ ] **Step 4:** Update all internal imports that referenced `domain/models/SequenceEngineTypes`
- [ ] **Step 5:** Run `npx tsc --noEmit` to verify
- [ ] **Step 6:** Commit: `refactor(sequence-engine): move types to core/ layer`

### Task 1.3: Move orientation services to core/

**Files:**
- Move: `packages/sequence-engine/src/orientation-calculator.ts` → `src/core/orientation/`
- Move: `packages/sequence-engine/src/services/implementations/OrientationPropagator.ts` → `src/core/orientation/`
- Move: `packages/sequence-engine/src/services/contracts/IOrientationPropagator.ts` → `src/core/orientation/`

- [ ] **Step 1:** Create `packages/sequence-engine/src/core/orientation/` directory
- [ ] **Step 2:** Move files, create `core/orientation/index.ts`
- [ ] **Step 3:** Update all internal imports
- [ ] **Step 4:** Run `npx tsc --noEmit`
- [ ] **Step 5:** Commit: `refactor(sequence-engine): move orientation to core/ layer`

### Task 1.4: Move transition graph to core/

**Files:**
- Move: `packages/sequence-engine/src/letter-transition-graph.ts` → `src/core/transition-graph/`
- Move: `packages/sequence-engine/src/services/implementations/TransitionGraph.ts` → `src/core/transition-graph/`
- Move: `packages/sequence-engine/src/services/contracts/ITransitionGraph.ts` → `src/core/transition-graph/`

- [ ] **Step 1:** Create `packages/sequence-engine/src/core/transition-graph/` directory
- [ ] **Step 2:** Move files, create `core/transition-graph/index.ts`
- [ ] **Step 3:** Update all internal imports
- [ ] **Step 4:** Run `npx tsc --noEmit`
- [ ] **Step 5:** Commit: `refactor(sequence-engine): move transition graph to core/ layer`

### Task 1.5: Move constraints to generation/ layer

**Files:**
- Move: `packages/sequence-engine/src/constraints/` → `src/generation/constraints/`

**Before moving:** Diff the engine's constraint files against MCP's copies at `mcp-server/src/core/constraints/` to determine which is more recent. Use the newer version.

- [ ] **Step 1:** Diff engine vs MCP constraint files: `diff -rq packages/sequence-engine/src/constraints/ mcp-server/src/core/constraints/`
- [ ] **Step 2:** If MCP has newer versions, copy those over the engine's versions first
- [ ] **Step 3:** Create `packages/sequence-engine/src/generation/` directory
- [ ] **Step 4:** Move all constraint files preserving subdirectory structure:
  - `constraints/types.ts` → `generation/constraints/types.ts`
  - `constraints/constraint-types.ts` → `generation/constraints/constraint-types.ts`
  - `constraints/implementations/` → `generation/constraints/style/` (rename: these are all style constraints)
  - `constraints/parser/` → `generation/constraints/parsing/`
  - `constraints/presets/` → `generation/constraints/presets/`
  - `constraints/reporting/` → `generation/constraints/reporting/`
  - `constraints/analysis/` → `generation/constraints/analysis/`
  - `constraints/search/` → `generation/builder/` (beam search logic becomes the builder)
- [ ] **Step 5:** Update all internal imports
- [ ] **Step 6:** Run `npx tsc --noEmit`
- [ ] **Step 7:** Commit: `refactor(sequence-engine): move constraints to generation/ layer`

### Task 1.6: Reorganize loop/ into subdirectories

**Files:**
- Reorganize: `packages/sequence-engine/src/loop/` into subdirectories

- [ ] **Step 1:** Create subdirectories: `loop/detection/`, `loop/execution/`, `loop/validation/`
- [ ] **Step 2:** Move files:
  - `loop/loop-detector.ts` → `loop/detection/LOOPDetector.ts`
  - `loop/loop-executor.ts` → `loop/execution/LOOPExecutor.ts`
  - `loop/loop-validator.ts` → `loop/validation/LOOPValidator.ts`
  - `loop/loop-types.ts` → stays at `loop/loop-types.ts`
  - `loop/letter-lookup.ts` → stays at `loop/LetterLookup.ts`
- [ ] **Step 3:** Update `loop/index.ts` and all internal imports
- [ ] **Step 4:** Run `npx tsc --noEmit`
- [ ] **Step 5:** Commit: `refactor(sequence-engine): organize loop/ into subdirectories`

### Task 1.7: Update package entry points and clean up

**Files:**
- Modify: `packages/sequence-engine/src/index.ts`
- Modify: `packages/sequence-engine/package.json`
- Delete: `packages/sequence-engine/src/domain/` (empty after move)
- Delete: `packages/sequence-engine/src/services/` (empty after move)
- Delete: `packages/sequence-engine/src/constraints/` (empty after move)
- Handle: `packages/sequence-engine/src/data/contracts/ISequenceDataProvider.ts` — move to `core/data/` (still needed by app as a data source contract)

- [ ] **Step 1:** Move `src/data/contracts/ISequenceDataProvider.ts` to `src/core/data/ISequenceDataProvider.ts`
- [ ] **Step 2:** Update `src/index.ts` to re-export from new locations
- [ ] **Step 3:** Add subpath exports to `package.json`:
  ```json
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" },
    "./core": { "types": "./src/core/index.ts", "default": "./src/core/index.ts" },
    "./generation": { "types": "./src/generation/index.ts", "default": "./src/generation/index.ts" },
    "./loop": { "types": "./src/loop/index.ts", "default": "./src/loop/index.ts" },
    "./analysis": { "types": "./src/analysis/index.ts", "default": "./src/analysis/index.ts" },
    "./harness": { "types": "./src/harness/index.ts", "default": "./src/harness/index.ts" }
  }
  ```
- [ ] **Step 4:** Create `src/core/index.ts`, `src/generation/index.ts` entry files
- [ ] **Step 5:** Create stub `src/analysis/index.ts` and `src/harness/index.ts` (populated later)
- [ ] **Step 6:** Delete empty old directories (`domain/`, `services/`, `data/`, `constraints/`)
- [ ] **Step 7:** Run `npx tsc --noEmit`
- [ ] **Step 8:** Verify all consumers still compile (MCP + app imports of `@tka/sequence-engine`)
- [ ] **Step 9:** Commit: `refactor(sequence-engine): add subpath exports, clean up old dirs`

---

## Chunk 2: Data Access + Letter Parsing + Domain Constraints

Add the `IVariationProvider` interface, letter parsing, extend the constraint system with domain types, then implement the 4 domain hard constraints.

### Task 2.1: Create IVariationProvider interface

**Files:**
- Create: `packages/sequence-engine/src/generation/data/IVariationProvider.ts`

- [ ] **Step 1:** Write the type-level test:
  ```typescript
  // packages/sequence-engine/tests/generation/data/variation-provider.test.ts
  import { describe, it, expect } from "vitest";
  import type { IVariationProvider } from "../../../src/generation/data/IVariationProvider";

  describe("IVariationProvider", () => {
    it("interface should be importable", () => {
      const provider: IVariationProvider = {
        getVariations: () => [],
        getAllVariations: () => [],
      };
      expect(provider).toBeDefined();
    });
  });
  ```
- [ ] **Step 2:** Run test to verify it fails
- [ ] **Step 3:** Create `IVariationProvider.ts`:
  ```typescript
  import type { PictographData } from "../../core/types";

  export interface IVariationProvider {
    getVariations(letter: string, position: string, gridMode: string): PictographData[];
    getAllVariations(gridMode: string): PictographData[];
  }
  ```
- [ ] **Step 4:** Run test to verify it passes
- [ ] **Step 5:** Commit: `feat(sequence-engine): add IVariationProvider interface`

### Task 2.2: Create LetterParser

**Files:**
- Create: `packages/sequence-engine/src/core/letters/LetterParser.ts`
- Create: `packages/sequence-engine/tests/core/letters/letter-parser.test.ts`
- Reference: `mcp-server/src/core/word-simplifier.ts`

- [ ] **Step 1:** Read `mcp-server/src/core/word-simplifier.ts` for existing logic
- [ ] **Step 2:** Write failing tests (ASCII words, Greek letters, dash suffixes, empty string)
- [ ] **Step 3:** Run tests to verify they fail
- [ ] **Step 4:** Implement `LetterParser` based on existing logic
- [ ] **Step 5:** Run tests to verify they pass
- [ ] **Step 6:** Commit: `feat(sequence-engine): add LetterParser`

### Task 2.3: Create LetterClassifier

**Files:**
- Create: `packages/sequence-engine/src/core/letters/LetterClassifier.ts`
- Create: `packages/sequence-engine/tests/core/letters/letter-classifier.test.ts`
- Reference: App's letter type classification (search for `getLetterType`)

- [ ] **Step 1:** Find and read the app's letter type classification logic
- [ ] **Step 2:** Write failing tests (Type 1 through Type 6 examples)
- [ ] **Step 3:** Run tests to verify they fail
- [ ] **Step 4:** Implement `LetterClassifier`
- [ ] **Step 5:** Run tests to verify they pass
- [ ] **Step 6:** Commit: `feat(sequence-engine): add LetterClassifier`

### Task 2.4: Extend ConstraintType enum and ConstraintContext for domain constraints

**MUST be done before creating any domain constraint.**

**Files:**
- Modify: `packages/sequence-engine/src/generation/constraints/constraint-types.ts`
- Modify: `packages/sequence-engine/src/generation/constraints/types.ts`

- [ ] **Step 1:** Add domain constraint types to `ConstraintType` enum:
  ```typescript
  export enum ConstraintType {
    // Existing style constraints
    MOTION_TYPE = "motionType",
    ROTATION_DIRECTION = "rotationDirection",
    CONTINUITY = "continuity",
    REVERSAL = "reversal",
    HAND_PATH = "handPath",
    POSITION_GROUP = "positionGroup",
    VTG_TIMING = "vtgTiming",
    ALTERNATING = "alternating",

    // Domain constraints (always-on)
    TYPE_6 = "type6",
    PROP_TYPE = "propType",
    POSITION_CONTINUITY = "positionContinuity",
    FLOAT = "float",
    DASH_PREFERENCE = "dashPreference",
    PER_HAND_DASH = "perHandDash",
  }
  ```
- [ ] **Step 2:** Add domain fields to `ConstraintContext`:
  ```typescript
  export interface ConstraintContext {
    // Existing fields (unchanged)
    stepIndex: number;
    totalSteps: number;
    previousSteps: PictographData[];
    candidate: PictographData;
    letter: string;

    // New domain fields
    level: number;
    turnAllocation: { blue: number; red: number };
    gridMode: string;
    propType?: string;
  }
  ```
- [ ] **Step 3:** Add new types to `CONSTRAINT_CATEGORIES` map
- [ ] **Step 4:** Verify existing constraint implementations still compile (they only use fields they need)
- [ ] **Step 5:** Run `npx tsc --noEmit`
- [ ] **Step 6:** Commit: `feat(sequence-engine): extend constraint types for domain constraints`

### Task 2.5: Create Type6Constraint

**Files:**
- Create: `packages/sequence-engine/src/generation/constraints/domain/Type6Constraint.ts`
- Create: `packages/sequence-engine/tests/generation/constraints/domain/type6-constraint.test.ts`
- Reference: `src/lib/features/create/generate/shared/services/implementations/PictographFilter.ts`

- [ ] **Step 1:** Read `PictographFilter.ts` for Type 6 filtering rules
- [ ] **Step 2:** Write failing tests:
  - Rejects Type 6 at level 1
  - Allows Type 6 at level 2 when at least one hand has turns > 0
  - Rejects Type 6 at level 2 when both hands have 0 turns
  - Always allows non-Type-6 letters
- [ ] **Step 3:** Run tests to verify they fail
- [ ] **Step 4:** Implement — uses `LetterClassifier` to determine type, checks `context.level` and `context.turnAllocation`:
  ```typescript
  export class Type6Constraint implements IConstraint {
    readonly type = ConstraintType.TYPE_6;
    readonly mode: ConstraintMode = "hard";
    readonly description = "Filters Type 6 (static) letters by level and turn allocation";

    constructor(private readonly classifier: LetterClassifier) {}

    evaluate(context: ConstraintContext): ConstraintScore {
      const letterType = this.classifier.getType(context.letter);
      if (letterType !== 6) return { score: 1, satisfied: true, reason: "Not Type 6" };
      if (context.level === 1) return { score: 0, satisfied: false, reason: "Type 6 not allowed at L1" };
      const hasTurns = context.turnAllocation.blue > 0 || context.turnAllocation.red > 0;
      if (!hasTurns) return { score: 0, satisfied: false, reason: "Type 6 requires turns > 0 at L2+" };
      return { score: 1, satisfied: true, reason: "Type 6 with turns" };
    }
  }
  ```
- [ ] **Step 5:** Run tests to verify they pass
- [ ] **Step 6:** Commit: `feat(sequence-engine): add Type6Constraint`

### Task 2.6: Create PropTypeConstraint

**Files:**
- Create: `packages/sequence-engine/src/generation/constraints/domain/PropTypeConstraint.ts`
- Create: `packages/sequence-engine/tests/generation/constraints/domain/prop-type-constraint.test.ts`

- [ ] **Step 1:** Write failing tests:
  - No propType specified → always satisfied
  - PropType matches candidate → satisfied
  - PropType mismatch → not satisfied
- [ ] **Step 2:** Implement (check candidate's prop type field against `context.propType`)
- [ ] **Step 3:** Run tests to verify they pass
- [ ] **Step 4:** Commit: `feat(sequence-engine): add PropTypeConstraint`

### Task 2.7: Create PositionContinuityConstraint

**Files:**
- Create: `packages/sequence-engine/src/generation/constraints/domain/PositionContinuityConstraint.ts`
- Create: `packages/sequence-engine/tests/generation/constraints/domain/position-continuity-constraint.test.ts`

- [ ] **Step 1:** Write failing tests:
  - First step (no previousSteps) → always satisfied
  - Candidate startPosition matches last previousStep's endPosition → satisfied
  - Mismatch → not satisfied
- [ ] **Step 2:** Implement
- [ ] **Step 3:** Run tests to verify they pass
- [ ] **Step 4:** Commit: `feat(sequence-engine): add PositionContinuityConstraint`

### Task 2.8: Create FloatConstraint

**Files:**
- Create: `packages/sequence-engine/src/generation/constraints/domain/FloatConstraint.ts`
- Create: `packages/sequence-engine/tests/generation/constraints/domain/float-constraint.test.ts`
- Reference: App's TurnManager float handling

- [ ] **Step 1:** Read app's float handling logic in `TurnManager.ts`
- [ ] **Step 2:** Write failing tests for float conversion rules
- [ ] **Step 3:** Implement
- [ ] **Step 4:** Run tests to verify they pass
- [ ] **Step 5:** Commit: `feat(sequence-engine): add FloatConstraint`

---

## Chunk 3: LOOP Executor Migration

Move all 18 LOOP executors from the app into the engine. Requires refactoring away `$lib/` imports.

### Task 3.1: Audit executor dependencies and generate reference test fixtures

**Files:**
- Read: All 18 executor files + supporting infrastructure
- Read: `circular/domain/models/circular-models.ts`
- Read: `circular/domain/constants/circular-position-maps.ts`
- Read: `circular/domain/constants/strict-loop-position-maps.ts`

- [ ] **Step 1:** Read every executor and catalog all `$lib/` imports. For each, classify:
  - (a) Already in engine → just update import path
  - (b) Type/interface → add to `core/types/`
  - (c) Logic → must port to engine
- [ ] **Step 2:** Generate reference test fixtures: run the app's `StrictRotatedLOOPExecutor` on 2-3 known input sequences, capture the output as JSON fixtures for tests
- [ ] **Step 3:** Document the dependency map
- [ ] **Step 4:** Commit: `docs: catalog LOOP executor dependencies + reference fixtures`

### Task 3.2: Move position maps and circular models to engine

**Files:**
- Create: `packages/sequence-engine/src/loop/position-maps/circular-position-maps.ts`
- Create: `packages/sequence-engine/src/loop/position-maps/strict-loop-position-maps.ts`
- Create: `packages/sequence-engine/src/loop/loop-models.ts`

- [ ] **Step 1:** Read source files in `circular/domain/`
- [ ] **Step 2:** Copy to engine, replacing `$lib/` imports with engine `core/` imports
- [ ] **Step 3:** Merge with or replace existing `loop/loop-types.ts` where overlapping
- [ ] **Step 4:** Run `npx tsc --noEmit`
- [ ] **Step 5:** Commit: `feat(sequence-engine): add LOOP position maps and circular models`

### Task 3.3: Create ILOOPExecutor interface and port strict executors (batch 1: Strict + Rewound)

**Files:**
- Create: `packages/sequence-engine/src/loop/execution/ILOOPExecutor.ts`
- Create 6 executors in `packages/sequence-engine/src/loop/execution/`:
  - `StrictRotatedExecutor.ts`
  - `StrictMirroredExecutor.ts`
  - `StrictFlippedExecutor.ts`
  - `StrictSwappedExecutor.ts`
  - `StrictInvertedExecutor.ts`
  - `RewoundExecutor.ts`

- [ ] **Step 1:** Create `ILOOPExecutor.ts` (port from app's `circular/services/contracts/ILOOPExecutor.ts`)
- [ ] **Step 2:** Port `StrictRotatedLOOPExecutor.ts` → `StrictRotatedExecutor.ts`, replacing all `$lib/` imports
- [ ] **Step 3:** Write test using reference fixture from Task 3.1: given fixture input, verify output matches fixture
- [ ] **Step 4:** Run test to verify it passes
- [ ] **Step 5:** Run `npx tsc --noEmit`
- [ ] **Step 6:** Commit: `feat(sequence-engine): port StrictRotatedExecutor`
- [ ] **Step 7:** Port `StrictMirroredExecutor.ts`, verify compiles
- [ ] **Step 8:** Port `StrictFlippedExecutor.ts`, verify compiles
- [ ] **Step 9:** Port `StrictSwappedExecutor.ts`, verify compiles
- [ ] **Step 10:** Port `StrictInvertedExecutor.ts`, verify compiles
- [ ] **Step 11:** Commit: `feat(sequence-engine): port remaining strict LOOP executors`
- [ ] **Step 12:** Port `RewoundExecutor.ts` (different behavior — reversal, not rotation)
- [ ] **Step 13:** Run `npx tsc --noEmit`
- [ ] **Step 14:** Commit: `feat(sequence-engine): port RewoundExecutor`

### Task 3.4: Port compound executors (batch 2: two-component)

**Files:**
- Create in `packages/sequence-engine/src/loop/execution/`:
  - `MirroredSwappedExecutor.ts`
  - `SwappedInvertedExecutor.ts`
  - `MirroredInvertedExecutor.ts`
  - `RotatedSwappedExecutor.ts`
  - `RotatedInvertedExecutor.ts`
  - `MirroredRotatedExecutor.ts`

- [ ] **Step 1:** Port each executor, replacing `$lib/` imports
- [ ] **Step 2:** Run `npx tsc --noEmit` after each
- [ ] **Step 3:** Commit: `feat(sequence-engine): port two-component compound LOOP executors`

### Task 3.5: Port compound executors (batch 3: three+ component)

**Files:**
- Create in `packages/sequence-engine/src/loop/execution/`:
  - `MirroredRotatedInvertedExecutor.ts`
  - `MirroredSwappedInvertedExecutor.ts`
  - `MirroredRotatedInvertedSwappedExecutor.ts`
  - `MirroredRotatedComplementaryExecutor.ts`
  - `MirroredRotatedComplementarySwappedExecutor.ts`
  - `SwappedComplementaryExecutor.ts`

- [ ] **Step 1:** Port each executor, replacing `$lib/` imports
- [ ] **Step 2:** Run `npx tsc --noEmit` after each
- [ ] **Step 3:** Commit: `feat(sequence-engine): port three+ component compound LOOP executors`

### Task 3.6: Port LOOPExecutorSelector

**Files:**
- Create: `packages/sequence-engine/src/loop/execution/LOOPExecutorSelector.ts`

- [ ] **Step 1:** Port selector, updating all imports to reference engine executors
- [ ] **Step 2:** Write test: `selector.getExecutor(LOOPType.ROTATED)` returns an executor
- [ ] **Step 3:** Write test: `selector.isSupported(LOOPType.ROTATED)` returns `true`
- [ ] **Step 4:** Run tests
- [ ] **Step 5:** Commit: `feat(sequence-engine): port LOOPExecutorSelector`

### Task 3.7: Merge LOOP detection and validation

**Files:**
- Merge: Engine's `LOOPDetector` with app's richer version
- Create: `packages/sequence-engine/src/loop/detection/OrientationCycleDetector.ts`
- Merge: Engine's `LOOPValidator` with app's version

- [ ] **Step 1:** Compare engine's `LOOPDetector` vs app's — identify what app adds
- [ ] **Step 2:** Merge app's additional logic into engine's
- [ ] **Step 3:** Port `OrientationCycleDetector` from app
- [ ] **Step 4:** Compare and merge `LOOPValidator` versions
- [ ] **Step 5:** Run `npx tsc --noEmit`
- [ ] **Step 6:** Commit: `feat(sequence-engine): merge LOOP detection and validation from app`

### Task 3.8: Port LOOP targeting services

**Files:**
- Create: `packages/sequence-engine/src/loop/targeting/LOOPEndPositionSelector.ts`
- Create: `packages/sequence-engine/src/loop/targeting/RotatedEndPositionSelector.ts`
- Create: `packages/sequence-engine/src/loop/targeting/PartialSequenceGenerator.ts`

- [ ] **Step 1:** Port each file, replacing `$lib/` imports. `PartialSequenceGenerator` needs `IVariationProvider`
- [ ] **Step 2:** Run `npx tsc --noEmit`
- [ ] **Step 3:** Commit: `feat(sequence-engine): port LOOP targeting services`

### Task 3.9: Port LOOP extension services

**Files:**
- Create: `packages/sequence-engine/src/loop/extension/SequenceExtender.ts`
- Create: `packages/sequence-engine/src/loop/extension/OrientationCycleExtender.ts`

- [ ] **Step 1:** Port from app's `create/shared/services/implementations/SequenceExtender.ts` and `circular/services/implementations/OrientationCycleExtender.ts`
- [ ] **Step 2:** Run `npx tsc --noEmit`
- [ ] **Step 3:** Commit: `feat(sequence-engine): port LOOP extension services`

---

## Chunk 4: Unified Builder

Build the 7-stage pipeline that combines the MCP's beam search with the app's domain filtering.

### Task 4.1: Create TurnAllocator

**Files:**
- Create: `packages/sequence-engine/src/generation/turns/TurnAllocator.ts`
- Create: `packages/sequence-engine/tests/generation/turns/turn-allocator.test.ts`
- Reference: `mcp-server/src/core/turn-allocator.ts` and `src/lib/features/create/generate/shared/services/implementations/TurnAllocator.ts`

- [ ] **Step 1:** Read both existing implementations, verify they're identical
- [ ] **Step 2:** Write failing tests:
  - Level 1: only 0 turns
  - Level 2: values from {0, 1, 2, 3}
  - Level 3: values from {0, 0.5, 1, 1.5, 2, 2.5, 3, "fl"}
  - Output shape: `{ blue: number[], red: number[] }` with correct length
- [ ] **Step 3:** Run tests to verify they fail
- [ ] **Step 4:** Implement (port from existing)
- [ ] **Step 5:** Run tests to verify they pass
- [ ] **Step 6:** Commit: `feat(sequence-engine): add TurnAllocator`

### Task 4.2: Refactor constrained-builder into BeamSearch

The existing `constrained-builder.ts` (moved to `generation/builder/` in Task 1.5) becomes `BeamSearch.ts`. This is a refactor, not a rewrite.

**Files:**
- Rename/refactor: `packages/sequence-engine/src/generation/builder/constrained-builder.ts` → `BeamSearch.ts`
- Modify: `packages/sequence-engine/src/generation/builder/SearchState.ts` (clean up)
- Reference: Also `generation/builder/variation-scorer.ts`, `generation/builder/bridge-scorer.ts`

- [ ] **Step 1:** Read the existing `constrained-builder.ts` thoroughly
- [ ] **Step 2:** Refactor into `BeamSearch` class:
  - Accept `IVariationProvider` instead of raw data arrays
  - Accept `ConstraintSet` (which now includes domain constraints)
  - Add step-by-step orientation propagation (app's approach) after each step
  - Add rotation direction assignment for dash/static motions per step
  - Keep existing beam width, pruning, bridge insertion logic
- [ ] **Step 3:** Write tests:
  - Given mock `IVariationProvider`, beam search produces valid sequence
  - `beamWidth: 1` → single-path result
  - Dead beams are pruned
  - Bridge insertion works when no direct path
- [ ] **Step 4:** Run tests
- [ ] **Step 5:** Delete old `constrained-builder.ts` if renamed
- [ ] **Step 6:** Commit: `refactor(sequence-engine): refactor constrained-builder into BeamSearch`

### Task 4.3: Create SequenceBuilder (main entry point)

**Files:**
- Create: `packages/sequence-engine/src/generation/builder/SequenceBuilder.ts`
- Create: `packages/sequence-engine/tests/generation/builder/sequence-builder.test.ts`

- [ ] **Step 1:** Write failing tests:
  - `build({ word: "AB", gridMode: "diamond", level: 1 })` → valid result
  - Position continuity in result
  - Constraint report included
  - Metrics included
- [ ] **Step 2:** Run tests to verify they fail
- [ ] **Step 3:** Implement 7-stage pipeline:
  ```typescript
  export class SequenceBuilder {
    constructor(private readonly variationProvider: IVariationProvider) {}

    build(options: BuildOptions): BuildResult {
      // 1. Parse letters
      const letters = this.letterParser.parse(options.word);
      // 2. Assemble constraints (domain always-on + preset/custom)
      const constraintSet = this.assembleConstraints(options);
      // 3. Select start position
      const startPosition = this.selectStart(options, constraintSet);
      // 4. Allocate turns
      const turns = this.turnAllocator.allocate(letters.length, options.level, options.maxTurnIntensity);
      // 5. Beam search
      const searchResult = this.beamSearch.search(letters, startPosition, turns, constraintSet, options.beamWidth);
      // 6. Post-processing (reversals, float conversion)
      const processed = this.postProcess(searchResult);
      // 7. LOOP extension (if requested)
      if (options.loop) return this.extendWithLOOP(processed, options.loop);
      return processed;
    }
  }
  ```
- [ ] **Step 4:** Run tests to verify they pass
- [ ] **Step 5:** Commit: `feat(sequence-engine): implement unified SequenceBuilder`

### Task 4.4: Wire constraint presets with domain constraints

**Files:**
- Modify: `packages/sequence-engine/src/generation/constraints/presets/preset-constraints.ts`

- [ ] **Step 1:** Read existing preset definitions
- [ ] **Step 2:** Ensure presets combine domain (always-on hard) + style constraints:
  - Domain constraints are injected automatically by `SequenceBuilder.assembleConstraints()`, not in presets
  - Presets only add style constraints: `"smooth"` → Continuity(1.0), HandPath(0.8), RotationDirection(0.6)
- [ ] **Step 3:** Write test: preset assembly produces expected constraint set
- [ ] **Step 4:** Commit: `feat(sequence-engine): ensure presets compose with domain constraints`

### Task 4.5: Port ReversalDetector and analysis services

**Files:**
- Create: `packages/sequence-engine/src/analysis/ReversalDetector.ts`
- Create: `packages/sequence-engine/src/analysis/SequenceAnalyzer.ts`
- Create: `packages/sequence-engine/src/analysis/OrientationAlignmentCalculator.ts`
- Reference: App's versions in `src/lib/features/create/shared/services/implementations/`

- [ ] **Step 1:** Port `ReversalDetector.ts` from app
- [ ] **Step 2:** Port `SequenceAnalyzer.ts` from app
- [ ] **Step 3:** Port `OrientationAlignmentCalculator.ts` from app
- [ ] **Step 4:** Create `src/analysis/index.ts` exporting all
- [ ] **Step 5:** Write test: sequence with direction changes has correct reversal flags
- [ ] **Step 6:** Run tests
- [ ] **Step 7:** Commit: `feat(sequence-engine): port analysis services`

### Task 4.6: Integration test — full build pipeline

**Files:**
- Create: `packages/sequence-engine/tests/integration/full-build.test.ts`
- Create: `packages/sequence-engine/tests/fixtures/test-variation-data.ts` (small subset of real data)

- [ ] **Step 1:** Create a mock `IVariationProvider` using a small subset of real pictograph data. Source this from the MCP server's in-memory data or from CSV files in `static/data/`. Include enough variations for 2-3 letter words (e.g., all A, B, C variations in diamond mode).
- [ ] **Step 2:** Write integration tests:
  - Build "AB" at level 1 → valid result with position continuity
  - Build "AB" with `constraintPreset: "smooth"` → valid result with constraint report showing satisfaction > 0
  - Build with `beamWidth: 1` → valid result
  - Build with LOOP → extended sequence with LOOP metadata
- [ ] **Step 3:** Run tests
- [ ] **Step 4:** Commit: `test(sequence-engine): full pipeline integration tests`

---

## Chunk 5: Wire MCP Server

Replace MCP's local generation code with engine imports.

### Task 5.1: Create MCPVariationProvider

**Files:**
- Create: `mcp-server/src/core/MCPVariationProvider.ts`

- [ ] **Step 1:** Read how MCP currently accesses pictograph data (in `sequence-builder.ts`)
- [ ] **Step 2:** Implement `MCPVariationProvider` wrapping in-memory data:
  ```typescript
  import type { IVariationProvider } from "@tka/sequence-engine/generation";

  export class MCPVariationProvider implements IVariationProvider {
    constructor(private readonly pictographData: Map<string, PictographData[]>) {}
    getVariations(letter, position, gridMode) { /* filter from map */ }
    getAllVariations(gridMode) { /* return all for grid mode */ }
  }
  ```
- [ ] **Step 3:** Run `npx tsc --noEmit`
- [ ] **Step 4:** Commit: `feat(mcp): create MCPVariationProvider`

### Task 5.2: Replace MCP generation with engine

**Files:**
- Modify: `mcp-server/src/core/sequence-renderer.ts` (or wherever generation is called)
- Modify: MCP tool handlers

- [ ] **Step 1:** Identify all call sites using MCP's local builders
- [ ] **Step 2:** Replace with `SequenceBuilder` from engine
- [ ] **Step 3:** Convert `BuildResult` to MCP's output format if needed
- [ ] **Step 4:** Run `npx tsc --noEmit`
- [ ] **Step 5:** Test manually: generate a sequence via MCP tool
- [ ] **Step 6:** Commit: `feat(mcp): use shared sequence engine for generation`

### Task 5.3: Delete MCP's local generation code

**Files to delete:**
- `mcp-server/src/core/sequence-builder.ts`
- `mcp-server/src/core/constraints/` (entire directory — 21 files)
- `mcp-server/src/core/loop/` (entire directory — 6 files)
- `mcp-server/src/core/turn-allocator.ts`
- `mcp-server/src/core/orientation-calculator.ts`
- `mcp-server/src/core/orientation-propagation.ts`
- `mcp-server/src/core/word-simplifier.ts`
- `mcp-server/src/core/letter-transition-graph.ts`

- [ ] **Step 1:** Grep for remaining imports of deleted files
- [ ] **Step 2:** Delete all files
- [ ] **Step 3:** Run `npx tsc --noEmit`
- [ ] **Step 4:** Test MCP generation again
- [ ] **Step 5:** Commit: `refactor(mcp): delete local generation code replaced by engine`

---

## Chunk 6: Wire App

Replace app's local generation code with engine imports.

### Task 6.1: Create AppVariationProvider

**Files:**
- Create: `src/lib/features/create/generate/shared/services/implementations/AppVariationProvider.ts`

- [ ] **Step 1:** Read how app currently loads pictograph data
- [ ] **Step 2:** Implement `AppVariationProvider` wrapping existing data source
- [ ] **Step 3:** Register in DI container
- [ ] **Step 4:** Run `npx tsc --noEmit`
- [ ] **Step 5:** Commit: `feat(app): create AppVariationProvider`

### Task 6.2: Replace app generation with engine builder

**Files:**
- Modify: `src/lib/features/create/generate/state/generate-actions.svelte.ts`
- Modify: DI container in `src/lib/shared/di/`

- [ ] **Step 1:** Read `generate-actions.svelte.ts` to understand current orchestrator calls
- [ ] **Step 2:** Replace with `SequenceBuilder.build()`:
  - Map UI state → `BuildOptions`
  - Call `builder.build(options)`
  - Convert `BuildResult` → `SequenceData`
  - Call arrow positioning after (stays in app)
- [ ] **Step 3:** Update DI container
- [ ] **Step 4:** Run `npx tsc --noEmit`
- [ ] **Step 5:** Test in browser
- [ ] **Step 6:** Commit: `feat(app): use shared sequence engine for generation`

### Task 6.3: Replace app LOOP executors with engine imports

**Files:**
- Modify: DI container LOOP registrations
- Modify: Any files importing from `circular/services/implementations/`

- [ ] **Step 1:** Update all LOOP imports to `@tka/sequence-engine/loop`
- [ ] **Step 2:** Update DI container
- [ ] **Step 3:** Run `npx tsc --noEmit`
- [ ] **Step 4:** Test LOOP generation in browser
- [ ] **Step 5:** Commit: `feat(app): use shared LOOP executors from engine`

### Task 6.4: Delete app's local generation code

**Files to delete (verify no remaining references first):**

Generation orchestration:
- `src/lib/features/create/generate/shared/services/implementations/GenerationOrchestrator.ts`
- `src/lib/features/create/generate/shared/services/implementations/StepGenerationOrchestrator.ts`
- `src/lib/features/create/generate/shared/services/implementations/PictographFilter.ts`
- `src/lib/features/create/generate/shared/services/implementations/TurnAllocator.ts`
- `src/lib/features/create/generate/shared/services/implementations/TurnManager.ts`
- `src/lib/features/create/generate/shared/services/implementations/StepConverter.ts`
- `src/lib/features/create/generate/shared/services/implementations/StartPositionSelector.ts`
- `src/lib/features/create/generate/shared/services/implementations/LOOPParameterProvider.ts`
- `src/lib/features/create/generate/shared/services/implementations/LOOPTypeResolver.ts`

LOOP executors (all 18 + selector):
- `src/lib/features/create/generate/circular/services/implementations/StrictRotatedLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/StrictMirroredLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/StrictFlippedLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/StrictSwappedLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/StrictInvertedLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/RewoundLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/MirroredSwappedLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/SwappedInvertedLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/MirroredInvertedLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/RotatedSwappedLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/RotatedInvertedLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/MirroredRotatedLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/MirroredRotatedInvertedLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/MirroredSwappedInvertedLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/MirroredRotatedInvertedSwappedLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/MirroredRotatedComplementaryLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/MirroredRotatedComplementarySwappedLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/SwappedComplementaryLOOPExecutor.ts`
- `src/lib/features/create/generate/circular/services/implementations/LOOPExecutorSelector.ts`

LOOP infrastructure:
- `src/lib/features/create/generate/circular/services/implementations/LOOPDetector.ts`
- `src/lib/features/create/generate/circular/services/implementations/LOOPEndPositionSelector.ts`
- `src/lib/features/create/generate/circular/services/implementations/OrientationCycleDetector.ts`
- `src/lib/features/create/generate/circular/services/implementations/OrientationCycleExtender.ts`
- `src/lib/features/create/generate/circular/services/implementations/PartialSequenceGenerator.ts`
- `src/lib/features/create/generate/circular/services/implementations/RotatedEndPositionSelector.ts`

Shared services:
- `src/lib/features/create/shared/services/implementations/BridgeFinder.ts`
- `src/lib/features/create/shared/services/implementations/LOOPValidator.ts`
- `src/lib/features/create/shared/services/implementations/SequenceExtender.ts`

Corresponding contract interfaces replaced by engine interfaces.

- [ ] **Step 1:** Grep for remaining imports of each file
- [ ] **Step 2:** Delete in batches, `npx tsc --noEmit` after each
- [ ] **Step 3:** Clean up DI container
- [ ] **Step 4:** Final compile check + browser test
- [ ] **Step 5:** Commit: `refactor(app): delete local generation code replaced by engine`

---

## Chunk 7: Test Harness + Final Validation

### Task 7.1: Create BatchGenerator

**Files:**
- Create: `packages/sequence-engine/src/harness/BatchGenerator.ts`
- Create: `packages/sequence-engine/src/harness/HarnessReport.ts`
- Create: `packages/sequence-engine/tests/harness/batch-generator.test.ts`

- [ ] **Step 1:** Define `BatchOptions` and `BatchReport` types in `HarnessReport.ts`
- [ ] **Step 2:** Write failing test: `BatchGenerator.run({ word: "AB", count: 10, ... })` returns report with `totalGenerated: 10`
- [ ] **Step 3:** Implement `BatchGenerator`
- [ ] **Step 4:** Run test
- [ ] **Step 5:** Commit: `feat(sequence-engine): add BatchGenerator`

### Task 7.2: Create DistributionAnalyzer

**Files:**
- Create: `packages/sequence-engine/src/harness/DistributionAnalyzer.ts`

- [ ] **Step 1:** Implement: start position distribution, letter frequency, bridge frequency, constraint satisfaction mean/stddev, score distribution
- [ ] **Step 2:** Wire into `BatchGenerator`
- [ ] **Step 3:** Commit: `feat(sequence-engine): add DistributionAnalyzer`

### Task 7.3: Export harness and optionally add MCP tool

**Files:**
- Modify: `packages/sequence-engine/src/harness/index.ts`
- Optionally create MCP batch_generate tool

- [ ] **Step 1:** Create `src/harness/index.ts` exporting all harness modules
- [ ] **Step 2:** Optionally create MCP tool for batch generation
- [ ] **Step 3:** Commit: `feat(sequence-engine): export harness`

### Task 7.4: Run batch validation

- [ ] **Step 1:** Generate 50 sequences for "BOOK" via the engine with `constraintPreset: "smooth"`, level 1
- [ ] **Step 2:** Generate 50 sequences for "MAGIC" (the word that triggered this work)
- [ ] **Step 3:** Generate 50 sequences for a word requiring bridges
- [ ] **Step 4:** Verify:
  - 0 failures for common words
  - Reasonable start position distribution
  - Constraint satisfaction > 80% average
  - Bridge frequency reasonable
- [ ] **Step 5:** Commit: `test(sequence-engine): validate batch generation`

### Task 7.5: Final cleanup

- [ ] **Step 1:** `npx tsc --noEmit` from repo root — zero generation-related errors
- [ ] **Step 2:** Run `npm test` — all pass
- [ ] **Step 3:** Grep for imports of deleted files — zero results
- [ ] **Step 4:** Review engine package — no stale files
- [ ] **Step 5:** Commit: `chore: final cleanup after sequence engine unification`
