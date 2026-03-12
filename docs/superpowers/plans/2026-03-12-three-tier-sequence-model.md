# Three-Tier Compositional Sequence Model — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure SequenceData so a full sequence is compositionally built from two SoloPropData objects, each containing a HandPathData, with a transitional getter that prevents any breakage during migration.

**Architecture:** New types (HandPathData, SoloPropData, SoloPropStepData, StepPairingData) are added first. SequenceData gains compositional fields alongside existing `steps[]`. A transitional getter delegates `steps` access to `deriveSteps()` internally. Consumers are migrated incrementally. Old fields are removed last.

**Tech Stack:** TypeScript, Svelte 5, ITI DI, Firebase/Firestore, xxhash-wasm

**Spec:** `docs/superpowers/specs/2026-03-12-three-tier-sequence-model-design.md`

**Safety guarantee:** The app works correctly after EVERY phase. The transitional `steps` getter means all 814 existing `.steps` references continue to work unchanged until explicitly migrated.

---

## Chunk 1: Foundation Types (no existing code changes)

New type definitions only. Zero risk. Nothing existing changes.

### Task 1: HandPathData type definition

**Files:**
- Create: `src/lib/shared/foundation/domain/models/HandPathData.ts`

- [ ] **Step 1: Create HandPathData interface**

```typescript
import type { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface HandPathData {
  readonly id: string;
  readonly locations: readonly GridLocation[];

  // Content-addressable identity
  readonly contentHash: string;

  // Derived query fields (denormalized for Firestore)
  readonly startLocation: GridLocation;
  readonly endLocation: GridLocation;
  readonly length: number;
  readonly bigrams: readonly string[];
  readonly uniqueLocations: readonly GridLocation[];
  readonly impliedGridMode: GridMode;
  readonly isClosed: boolean;

  // Metadata (when saved as independent artifact)
  readonly name?: string;
  readonly author?: string;
  readonly notes?: string;
  readonly thumbnails?: readonly string[];
  readonly dateCreated?: Date;
  readonly ownerId?: string;
  readonly ownerDisplayName?: string;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS (new file, no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/foundation/domain/models/HandPathData.ts
git commit -m "feat: add HandPathData type definition (tier 1)"
```

---

### Task 2: SoloPropStepData and SoloPropData type definitions

**Files:**
- Create: `src/lib/shared/foundation/domain/models/SoloPropStepData.ts`
- Create: `src/lib/shared/foundation/domain/models/SoloPropData.ts`

- [ ] **Step 1: Create SoloPropStepData interface**

```typescript
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type {
  MotionType,
  RotationDirection,
  Orientation,
  HandPath,
  SkewDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface SoloPropStepData {
  readonly startLocation: GridLocation;
  readonly endLocation: GridLocation;
  readonly startOrientation: Orientation;
  readonly endOrientation: Orientation;
  readonly motionType: MotionType;
  readonly rotationDirection: RotationDirection;
  readonly turns: number | "fl";
  readonly handPath?: HandPath | null;
  readonly skewSteps?: number | null;
  readonly skewDir?: SkewDirection | null;
  readonly duration: number;
}
```

- [ ] **Step 2: Create SoloPropData interface**

```typescript
import type { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { HandPathData } from "./HandPathData";
import type { SoloPropStepData } from "./SoloPropStepData";

export interface SoloPropData {
  readonly id: string;
  readonly steps: readonly SoloPropStepData[];
  readonly startLocation: GridLocation;
  readonly startOrientation: Orientation;

  // Content-addressable identity
  readonly contentHash: string;

  // Compositional: every solo prop contains its hand path
  readonly handPath: HandPathData;

  // Derived query fields (delegated from hand path + own data)
  readonly length: number;
  readonly bigrams: readonly string[];
  readonly impliedGridMode: GridMode;

  // Metadata
  readonly name?: string;
  readonly author?: string;
  readonly notes?: string;
  readonly thumbnails?: readonly string[];
  readonly dateCreated?: Date;
  readonly ownerId?: string;
  readonly ownerDisplayName?: string;
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/foundation/domain/models/SoloPropStepData.ts src/lib/shared/foundation/domain/models/SoloPropData.ts
git commit -m "feat: add SoloPropStepData and SoloPropData type definitions (tier 2)"
```

---

### Task 3: StepPairingData type definition

**Files:**
- Create: `src/lib/shared/foundation/domain/models/StepPairingData.ts`

- [ ] **Step 1: Create StepPairingData interface**

```typescript
import type { Letter } from "./Letter";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface StepPairingData {
  readonly letter: Letter | null;
  readonly blueReversal: boolean;
  readonly redReversal: boolean;
  readonly startPosition: GridPosition | null;
  readonly endPosition: GridPosition | null;
  // Duration is NOT stored here — derived from solo prop steps
  // Blue's duration is authoritative when combining
}
```

- [ ] **Step 2: Run typecheck, commit**

```bash
npm run check
git add src/lib/shared/foundation/domain/models/StepPairingData.ts
git commit -m "feat: add StepPairingData type definition (tier 3 pairing)"
```

---

## Chunk 2: Content Hashing Infrastructure

### Task 4: Install xxhash-wasm and create content hash service

**Files:**
- Create: `src/lib/shared/foundation/services/contracts/IContentHasher.ts`
- Create: `src/lib/shared/foundation/services/implementations/ContentHasher.ts`

- [ ] **Step 1: Create IContentHasher interface**

```typescript
// src/lib/shared/foundation/services/contracts/IContentHasher.ts
import type { SoloPropData } from "../../domain/models/SoloPropData";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface IContentHasher {
  hashHandPath(locations: readonly GridLocation[]): string;
  hashSoloProp(soloProp: Pick<SoloPropData, "startLocation" | "startOrientation" | "steps">): string;
}
```

- [ ] **Step 2: Create ContentHasher implementation**

Uses FNV-1a 128-bit (dual 64-bit hashing) for deterministic, synchronous content hashing. Encodes as Base62 (22 chars). No external dependencies needed — FNV-1a is fast enough for <10K items and provides sufficient collision resistance for content-addressable identity within user collections.

Canonical forms:
- HandPath: locations joined with `|` → `"n|e|s|w"`
- SoloProp: `"startLoc:startOri|sLoc:eLoc:mType:rDir:turns:sOri:eOri[:handPath[:skewSteps:skewDir]]|..."`

```typescript
// src/lib/shared/foundation/services/implementations/ContentHasher.ts
import type { IContentHasher } from "../contracts/IContentHasher";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SoloPropData } from "../../domain/models/SoloPropData";
import type { SoloPropStepData } from "../../domain/models/SoloPropStepData";

const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function toBase62(bytes: Uint8Array): string {
  let result = "";
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  while (value > 0n) {
    result = BASE62_CHARS[Number(value % 62n)] + result;
    value = value / 62n;
  }
  return result.padStart(22, "0");
}

function serializeStep(step: SoloPropStepData): string {
  let s = `${step.startLocation}:${step.endLocation}:${step.motionType}:${step.rotationDirection}:${step.turns}:${step.startOrientation}:${step.endOrientation}`;
  if (step.handPath != null) {
    s += `:${step.handPath}`;
    if (step.skewSteps != null) {
      s += `:${step.skewSteps}:${step.skewDir ?? ""}`;
    }
  }
  return s;
}

export class ContentHasher implements IContentHasher {
  hashHandPath(locations: readonly GridLocation[]): string {
    const canonical = locations.join("|");
    return this.hash128(canonical);
  }

  hashSoloProp(soloProp: Pick<SoloPropData, "startLocation" | "startOrientation" | "steps">): string {
    const parts = [`${soloProp.startLocation}:${soloProp.startOrientation}`];
    for (const step of soloProp.steps) {
      parts.push(serializeStep(step));
    }
    return this.hash128(parts.join("|"));
  }

  // FNV-1a 128-bit via dual 64-bit hashing. Deterministic and synchronous.
  private hash128(input: string): string {
    let h1 = 0xcbf29ce484222325n;
    let h2 = 0x100000001b3n;
    const FNV_PRIME = 0x00000100000001b3n;
    for (let i = 0; i < input.length; i++) {
      const c = BigInt(input.charCodeAt(i));
      h1 ^= c;
      h1 = (h1 * FNV_PRIME) & 0xffffffffffffffffn;
      h2 ^= c;
      h2 = (h2 * (FNV_PRIME + 2n)) & 0xffffffffffffffffn;
    }
    const bytes = new Uint8Array(16);
    for (let i = 7; i >= 0; i--) {
      bytes[i] = Number(h1 & 0xffn);
      h1 >>= 8n;
      bytes[i + 8] = Number(h2 & 0xffn);
      h2 >>= 8n;
    }
    return toBase62(bytes);
  }
}
```

- [ ] **Step 3: Run typecheck, commit**

```bash
npm run check
git add src/lib/shared/foundation/services/contracts/IContentHasher.ts src/lib/shared/foundation/services/implementations/ContentHasher.ts
git commit -m "feat: add content hashing infrastructure (FNV-1a 128-bit + Base62)"
```

---

### Task 5: HandPathData factory with derived fields

**Files:**
- Create: `src/lib/shared/foundation/services/contracts/IHandPathFactory.ts`
- Create: `src/lib/shared/foundation/services/implementations/HandPathFactory.ts`

- [ ] **Step 1: Create IHandPathFactory interface**

```typescript
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { HandPathData } from "../../domain/models/HandPathData";

export interface IHandPathFactory {
  create(locations: readonly GridLocation[], metadata?: {
    name?: string;
    author?: string;
    notes?: string;
  }): HandPathData;
}
```

- [ ] **Step 2: Create HandPathFactory implementation**

Computes all derived fields: startLocation, endLocation, length, bigrams, uniqueLocations, impliedGridMode, isClosed, contentHash.

Grid mode derivation logic:
- Filter out CENTER. If remaining are all cardinal → DIAMOND. All intercardinal → BOX. Mix → SKEWED. If CENTER present → CENTRIC.

Bigram computation: for each consecutive pair `[locations[i], locations[i+1]]`, produce `"n_e"` format string.

- [ ] **Step 3: Write test for HandPathFactory**

```typescript
// tests/unit/HandPathFactory.test.ts
import { describe, it, expect } from "vitest";
import { HandPathFactory } from "...";
import { ContentHasher } from "...";
import { GridLocation, GridMode } from "...";

describe("HandPathFactory", () => {
  const hasher = new ContentHasher();
  const factory = new HandPathFactory(hasher);

  it("derives diamond grid mode from cardinal locations", () => {
    const path = factory.create([GridLocation.NORTH, GridLocation.EAST, GridLocation.SOUTH, GridLocation.WEST]);
    expect(path.impliedGridMode).toBe(GridMode.DIAMOND);
  });

  it("derives box grid mode from intercardinal locations", () => {
    const path = factory.create([GridLocation.NORTHEAST, GridLocation.SOUTHEAST]);
    expect(path.impliedGridMode).toBe(GridMode.BOX);
  });

  it("derives skewed grid mode from mixed locations", () => {
    const path = factory.create([GridLocation.NORTH, GridLocation.SOUTHEAST]);
    expect(path.impliedGridMode).toBe(GridMode.SKEWED);
  });

  it("computes bigrams correctly", () => {
    const path = factory.create([GridLocation.NORTH, GridLocation.EAST, GridLocation.SOUTH]);
    expect(path.bigrams).toEqual(["n_e", "e_s"]);
  });

  it("detects closed paths", () => {
    const path = factory.create([GridLocation.NORTH, GridLocation.EAST, GridLocation.NORTH]);
    expect(path.isClosed).toBe(true);
  });

  it("computes deterministic content hash", () => {
    const path1 = factory.create([GridLocation.NORTH, GridLocation.EAST]);
    const path2 = factory.create([GridLocation.NORTH, GridLocation.EAST]);
    expect(path1.contentHash).toBe(path2.contentHash);

    const path3 = factory.create([GridLocation.EAST, GridLocation.NORTH]);
    expect(path3.contentHash).not.toBe(path1.contentHash);
  });
});
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test -- tests/unit/HandPathFactory.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add HandPathFactory with derived fields and tests"
```

---

### Task 6: SoloPropData factory

**Files:**
- Create: `src/lib/shared/foundation/services/contracts/ISoloPropFactory.ts`
- Create: `src/lib/shared/foundation/services/implementations/SoloPropFactory.ts`

- [ ] **Step 1: Create ISoloPropFactory interface**

```typescript
import type { SoloPropStepData } from "../../domain/models/SoloPropStepData";
import type { SoloPropData } from "../../domain/models/SoloPropData";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface ISoloPropFactory {
  create(
    steps: readonly SoloPropStepData[],
    startLocation: GridLocation,
    startOrientation: Orientation,
    metadata?: { name?: string; author?: string; notes?: string }
  ): SoloPropData;
}
```

- [ ] **Step 2: Implement SoloPropFactory**

Extracts hand path locations from steps (startLocation of each step + endLocation of last step). Uses IHandPathFactory to build the contained HandPathData. Uses IContentHasher for the solo prop hash.

- [ ] **Step 3: Write test, verify, commit**

Test: deterministic hash, hand path extraction from step locations, metadata passthrough.

```bash
npm test -- tests/unit/SoloPropFactory.test.ts
git add .
git commit -m "feat: add SoloPropFactory with hand path extraction and tests"
```

---

## Chunk 3: The Bridge (compositional fields on SequenceData + transitional getter)

This is the critical safety phase. After this chunk, SequenceData has BOTH the old `steps[]` field AND the new compositional fields. The transitional getter ensures all existing code continues to work.

### Task 7: IStepDeriver service

**Files:**
- Create: `src/lib/shared/foundation/services/contracts/IStepDeriver.ts`
- Create: `src/lib/shared/foundation/services/implementations/StepDeriver.ts`

- [ ] **Step 1: Create IStepDeriver interface**

```typescript
// src/lib/shared/foundation/services/contracts/IStepDeriver.ts
import type { SoloPropData } from "../../domain/models/SoloPropData";
import type { StepPairingData } from "../../domain/models/StepPairingData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { PropType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface ViewerPreferences {
  readonly propType: PropType;
}

export interface IStepDeriver {
  deriveSteps(
    blueSoloProp: SoloPropData,
    redSoloProp: SoloPropData,
    stepPairings: readonly StepPairingData[],
    viewerPrefs?: ViewerPreferences
  ): StepData[];

  deriveStartPosition(
    blueSoloProp: SoloPropData,
    redSoloProp: SoloPropData
  ): StartPositionData;
}
```

NOTE: `deriveStartPosition` takes two solo props rather than a full SequenceData as the spec describes. This is intentional — it avoids circular dependency (SequenceData would need to exist to derive its own start position) and is more composable. The solo props contain all the information needed (start locations and start orientations).

- [ ] **Step 2: Implement StepDeriver**

Constructor receives `IArrowLocationCalculator` and `IPropPlacementCalculator` from the DI container. During the transitional period, these may produce default placement data that renderers recalculate anyway — the critical path data (locations, orientations, motionType, turns, rotationDirection, letter, reversals) comes directly from the solo props and pairings.

For each beat index `i`:
1. Take `blueSoloProp.steps[i]` and `redSoloProp.steps[i]`
2. Rehydrate each into a `MotionData` object (add color, propType from `viewerPrefs`, compute placement data via injected calculators, set gridMode)
3. Combine with `stepPairings[i]` (letter, reversals, positions) into a `StepData`

The rehydration needs:
- `MotionColor.BLUE` / `MotionColor.RED` assigned
- `propType` from `viewerPrefs.propType` (defaults to `PropType.STAFF`)
- `arrowPlacementData` and `propPlacementData` computed via injected calculators (or defaults — placement is recalculated by renderers anyway)
- `gridMode` derived from the combined locations
- `isVisible` set to `true`
- `arrowLocation` set to startLocation (recalculated by ArrowLocationCalculator at render time)

- [ ] **Step 3: Write test for StepDeriver**

Test with a simple 2-beat sequence: verify that deriveSteps produces StepData with correct motions, letters, and reversals. Verify deriveStartPosition computes correct GridPosition from two start locations.

- [ ] **Step 4: Run tests, commit**

```bash
npm test -- tests/unit/StepDeriver.test.ts
git add .
git commit -m "feat: add IStepDeriver service for deriving StepData from compositional model"
```

---

### Task 8: Sequence decomposer (extracts solo props from existing SequenceData)

**Files:**
- Create: `src/lib/shared/foundation/services/contracts/ISequenceDecomposer.ts`
- Create: `src/lib/shared/foundation/services/implementations/SequenceDecomposer.ts`

- [ ] **Step 1: Create ISequenceDecomposer interface**

```typescript
import type { SequenceData } from "../../domain/models/SequenceData";
import type { SoloPropData } from "../../domain/models/SoloPropData";
import type { StepPairingData } from "../../domain/models/StepPairingData";

export interface ISequenceDecomposer {
  extractBlueSoloProp(sequence: SequenceData): SoloPropData;
  extractRedSoloProp(sequence: SequenceData): SoloPropData;
  extractStepPairings(sequence: SequenceData): readonly StepPairingData[];
}
```

- [ ] **Step 2: Implement SequenceDecomposer**

For each step in `sequence.steps`:
- Extract blue `MotionData` → convert to `SoloPropStepData` (strip placement data, color, propType, isVisible, gridMode, arrowLocation)
- Extract red `MotionData` → same conversion
- Extract pairing: letter, blueReversal, redReversal, startPosition, endPosition

Build `SoloPropData` via `ISoloPropFactory` (which builds `HandPathData` internally).

- [ ] **Step 3: Write test — round-trip verification**

The critical test: decompose a SequenceData into solo props + pairings, then recompose via StepDeriver. The recomposed StepData should match the original (modulo placement data which is recalculated).

```typescript
it("round-trips: decompose then derive produces equivalent steps", () => {
  const original = createTestSequence(); // helper with known steps
  const blue = decomposer.extractBlueSoloProp(original);
  const red = decomposer.extractRedSoloProp(original);
  const pairings = decomposer.extractStepPairings(original);

  const derived = deriver.deriveSteps(blue, red, pairings);

  for (let i = 0; i < original.steps.length; i++) {
    expect(derived[i].letter).toBe(original.steps[i].letter);
    expect(derived[i].motions.blue?.startLocation).toBe(original.steps[i].motions.blue?.startLocation);
    expect(derived[i].motions.blue?.endLocation).toBe(original.steps[i].motions.blue?.endLocation);
    expect(derived[i].motions.blue?.motionType).toBe(original.steps[i].motions.blue?.motionType);
    expect(derived[i].motions.red?.startLocation).toBe(original.steps[i].motions.red?.startLocation);
    // ... etc for all domain-significant fields
  }
});
```

- [ ] **Step 4: Run tests, commit**

```bash
npm test
git add .
git commit -m "feat: add SequenceDecomposer with round-trip verification test"
```

---

### Task 9: Add compositional fields to SequenceData (dual-storage transition strategy)

**Files:**
- Modify: `src/lib/shared/foundation/domain/models/SequenceData.ts`

This is the most delicate task. The SequenceData interface gains new optional fields. The `createSequenceData()` factory populates compositional fields automatically whenever `steps` are provided.

**Transition strategy (deviation from spec):** The spec describes using `Object.defineProperty` to intercept `.steps` access and derive steps on-the-fly from compositional fields. The plan instead uses **dual storage**: both `steps[]` and compositional fields are stored during the transition. This is simpler, avoids potential performance issues from deriving on every access, and achieves the same safety guarantee — all 814 `.steps` references continue to work unchanged. The `Object.defineProperty` getter approach can be layered in during Chunk 7 if needed, or skipped entirely since both paths converge at Chunk 8 (where `steps` is removed).

- [ ] **Step 1: Add new fields to SequenceData interface**

Add as OPTIONAL fields (backward compatible):

```typescript
// === NEW: Compositional structure (optional during migration) ===
readonly blueSoloProp?: SoloPropData;
readonly redSoloProp?: SoloPropData;
readonly stepPairings?: readonly StepPairingData[];

// === NEW: Content hashes for cross-tier queries ===
readonly bluePathHash?: string;
readonly redPathHash?: string;
readonly blueSoloHash?: string;
readonly redSoloHash?: string;
```

Keep `steps` as-is for now. It stays a regular field during the transition.

- [ ] **Step 2: Update createSequenceData() to populate compositional fields**

When `steps` are provided (existing path), use `SequenceDecomposer` to also populate `blueSoloProp`, `redSoloProp`, `stepPairings`, and hash fields. This means new sequences automatically get compositional data.

IMPORTANT: The decomposer is imported at the module level. Since this is a factory function (not a class), it creates the decomposer inline or receives it. For simplicity, create a standalone `decomposeSequence()` function that can be called from the factory.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: PASS — all new fields are optional, existing code unaffected.

- [ ] **Step 4: Run ALL tests**

Run: `npm test`
Expected: All existing tests pass. The new fields are additive.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/foundation/domain/models/SequenceData.ts
git commit -m "feat: add compositional fields to SequenceData (backward compatible, optional)"
```

---

### Task 10: Register new services in DI container

**Files:**
- Create: `src/lib/shared/di/containers/composition-container.ts`
- Modify: `src/lib/shared/di/container-types.ts`
- Modify: `src/lib/shared/di/index.ts`

- [ ] **Step 1: Create composition-container.ts**

```typescript
import { createContainer } from "iti";
import { ContentHasher } from "$lib/shared/foundation/services/implementations/ContentHasher";
import { HandPathFactory } from "$lib/shared/foundation/services/implementations/HandPathFactory";
import { SoloPropFactory } from "$lib/shared/foundation/services/implementations/SoloPropFactory";
import { StepDeriver } from "$lib/shared/foundation/services/implementations/StepDeriver";
import { SequenceDecomposer } from "$lib/shared/foundation/services/implementations/SequenceDecomposer";

export function createCompositionContainer() {
  return createContainer()
    .add({ contentHasher: () => new ContentHasher() })
    .add((ctx) => ({ handPathFactory: () => new HandPathFactory(ctx.contentHasher) }))
    .add((ctx) => ({ soloPropFactory: () => new SoloPropFactory(ctx.handPathFactory, ctx.contentHasher) }))
    .add((ctx) => ({ stepDeriver: () => new StepDeriver(ctx.arrowLocationCalculator, ctx.propPlacementCalculator) }))
    .add((ctx) => ({ sequenceDecomposer: () => new SequenceDecomposer(ctx.soloPropFactory) }));
}

export type CompositionContainer = ReturnType<typeof createCompositionContainer>;
```

- [ ] **Step 2: Add to container-types.ts and index.ts**

Wire into the app container following existing patterns.

- [ ] **Step 3: Run typecheck, commit**

```bash
npm run check
git add .
git commit -m "feat: register composition services in DI container"
```

---

## Chunk 4: Data Migration

### Task 11: Migration script for existing sequences

**Files:**
- Create: `scripts/migrate-compositional.ts`

NOTE: This must be a `.ts` file run via `npx tsx` because it imports ESM/TypeScript service modules (SequenceDecomposer, SoloPropFactory, ContentHasher, etc.).

- [ ] **Step 1: Write migration script**

The script:
1. Connects to Firestore via firebase-admin
2. Reads all sequences from `users/{uid}/sequences` and `publicSequences`
3. For each sequence with `steps[]` but no `blueSoloProp`:
   a. Decompose into solo props + pairings using SequenceDecomposer
   b. Compute content hashes via ContentHasher
   c. Write updated document with compositional fields added
4. Reports: X sequences migrated, Y already migrated, Z errors

Safety: the script ADDS fields, never removes. Existing `steps[]` is untouched. The script is idempotent (skip sequences that already have `blueSoloProp`).

- [ ] **Step 2: Test with dry-run flag**

```bash
npx tsx scripts/migrate-compositional.ts --dry-run
```

Reports what would be changed without writing.

- [ ] **Step 3: Run migration**

```bash
npx tsx scripts/migrate-compositional.ts
```

- [ ] **Step 4: Verify a sample sequence**

Read a sequence from Firestore, verify it has both `steps[]` AND `blueSoloProp` / `redSoloProp` / `stepPairings`.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-compositional.ts
git commit -m "feat: add migration script for compositional sequence fields"
```

---

## Chunk 5: Sequence Composer (combine operation)

### Task 12: ISequenceComposer service

**Files:**
- Create: `src/lib/shared/foundation/services/contracts/ISequenceComposer.ts`
- Create: `src/lib/shared/foundation/services/implementations/SequenceComposer.ts`

- [ ] **Step 1: Create ISequenceComposer interface**

```typescript
import type { SoloPropData } from "../../domain/models/SoloPropData";
import type { SequenceData } from "../../domain/models/SequenceData";
import type { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface ISequenceComposer {
  combine(
    assignments: { blue: SoloPropData; red: SoloPropData },
    metadata?: { name?: string; author?: string; notes?: string }
  ): Promise<SequenceData>;
}
```

- [ ] **Step 2: Implement SequenceComposer**

1. Validate step counts match (throw if different)
2. For each beat index, compute StepPairingData:
   - Letter: attempt resolution (return null if unmapped)
   - Reversals: compare beat i to beat i-1 per hand
   - GridPosition: derive from blue + red locations
3. Compute content hashes
4. Build SequenceData with `blueSoloProp`, `redSoloProp`, `stepPairings`
5. Also populate `steps[]` via StepDeriver for backward compatibility during transition
6. Derive word from letters (null → "?")

Letter resolution: for now, return null for all letters. Actual letter lookup requires the MCP domain service which is async and external. This can be wired in later. The compose operation works without letters — they're filled in asynchronously.

- [ ] **Step 3: Write test, commit**

```bash
npm test
git add .
git commit -m "feat: add SequenceComposer for combining two solo props into a sequence"
```

---

## Chunk 6: Firestore Persistence for New Tiers

### Task 13: Hand path repository

**Files:**
- Create: `src/lib/shared/foundation/services/contracts/IHandPathRepository.ts`
- Create: `src/lib/shared/foundation/services/implementations/HandPathRepository.ts`

- [ ] **Step 1: Create IHandPathRepository interface**

```typescript
import type { HandPathData } from "../../domain/models/HandPathData";

export interface HandPathFilters {
  readonly startLocation?: import("$lib/shared/pictograph/grid/domain/enums/grid-enums").GridLocation;
  readonly endLocation?: import("$lib/shared/pictograph/grid/domain/enums/grid-enums").GridLocation;
  readonly impliedGridMode?: import("$lib/shared/pictograph/grid/domain/enums/grid-enums").GridMode;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly isClosed?: boolean;
  readonly containsBigram?: string;
  readonly limit?: number;
}

export interface IHandPathRepository {
  get(id: string): Promise<HandPathData | null>;
  getByHash(contentHash: string): Promise<HandPathData | null>;
  list(filters?: HandPathFilters): Promise<HandPathData[]>;
  save(path: HandPathData): Promise<void>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 2: Implement HandPathRepository**

Uses Firestore collection `users/{uid}/handPaths`. Queries use denormalized fields (bigrams with `array-contains`, startLocation/endLocation with `where`, etc.).

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add HandPathRepository for Firestore persistence"
```

---

### Task 14: Solo prop repository

**Files:**
- Create: `src/lib/shared/foundation/services/contracts/ISoloPropRepository.ts`
- Create: `src/lib/shared/foundation/services/implementations/SoloPropRepository.ts`

Same pattern as hand path repository but for `users/{uid}/soloProps`.

- [ ] **Step 1: Create interface and implementation**
- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add SoloPropRepository for Firestore persistence"
```

---

### Task 15: Add cross-tier query methods to existing sequence repository

**Files:**
- Modify: `src/lib/features/create/shared/services/contracts/ISequenceRepository.ts`
- Modify: `src/lib/features/create/shared/services/implementations/SequenceRepository.ts`

- [ ] **Step 1: Add methods**

```typescript
getByPathHash(pathHash: string): Promise<SequenceData[]>;
getBySoloHash(soloHash: string): Promise<SequenceData[]>;
```

These query `bluePathHash` and `redPathHash` fields on sequence documents.

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add cross-tier query methods to sequence repository"
```

---

### Task 16: Firestore security rules for new collections

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add rules for handPaths and soloProps collections**

Same ownership pattern as sequences:
- `users/{uid}/handPaths/{pathId}`: read/write if auth.uid == uid
- `users/{uid}/soloProps/{soloPropId}`: read/write if auth.uid == uid
- `publicHandPaths/{pathId}`: read if authenticated, write if ownerId matches
- `publicSoloProps/{soloPropId}`: same

- [ ] **Step 2: Deploy rules**

```bash
firebase deploy --only firestore:rules
```

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: add Firestore security rules for handPaths and soloProps collections"
```

---

## Chunk 7: Consumer Migration (incremental, safe)

This is the long tail. Each task migrates one category of consumers from `sequence.steps` to explicit `deriveSteps()` or direct compositional field access. The transitional getter means these can be done in any order, at any pace.

### Task 17: Audit all `.steps` references and categorize

**Files:**
- No code changes. Research task.

- [ ] **Step 1: Find all `.steps` references**

```bash
rg "\.steps" --type ts --type svelte -l | wc -l
```

- [ ] **Step 2: Categorize into migration waves**

Wave 1 (read-only, simple substitution): Components that just read `sequence.steps` to iterate or count.
Wave 2 (write, moderate): Code that creates/modifies sequences with `steps`.
Wave 3 (complex): Code that does step manipulation (add, remove, reorder).

- [ ] **Step 3: Document in a migration tracker file**

```bash
# Create docs/migration/steps-consumer-tracker.md
# List each file, its wave, and migration status
```

- [ ] **Step 4: Commit tracker**

---

### Task 18-N: Migrate consumers by wave

Each wave is its own task. For each file in the wave:

1. Read the file, understand how it uses `.steps`
2. Replace with either:
   - `deriveSteps(seq.blueSoloProp!, seq.redSoloProp!, seq.stepPairings!)` for read-only access
   - Direct compositional field access where appropriate (e.g., `seq.blueSoloProp!.handPath` instead of extracting from steps)
3. Run typecheck
4. Commit

The `!` non-null assertions are safe because:
- All new sequences get compositional fields from the factory
- All existing sequences get them from the migration script
- The transitional getter means even if a sequence somehow lacks them, `.steps` still works

These tasks are intentionally not fully specified here because:
- The audit in Task 17 determines the exact file list
- Each file's migration is mechanical but context-dependent
- An implementing agent should handle 5-10 files per commit

---

## Chunk 8: Remove Transitional Support

Only after ALL consumers are migrated.

### Task Final: Remove `steps` field and transitional getter

**Files:**
- Modify: `src/lib/shared/foundation/domain/models/SequenceData.ts`

- [ ] **Step 1: Make compositional fields required**

Change `blueSoloProp?` → `blueSoloProp`, etc.

- [ ] **Step 2: Remove `steps` field from interface**

- [ ] **Step 3: Remove `startPosition`, `startingPosition`, `startingPositionGroup` fields**

These are now derived from solo props.

- [ ] **Step 4: Remove transitional getter from createSequenceData()**

- [ ] **Step 5: Remove `addStepToSequence()` and `removeStepFromSequence()` helpers**

These operate on the old `steps[]` model. New mutation goes through the compositional model.

- [ ] **Step 6: Run full typecheck — expect errors if any consumers were missed**

```bash
npm run check
```

Fix any remaining references.

- [ ] **Step 7: Run all tests**

```bash
npm test
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "refactor: remove transitional steps field, compositional model is sole source of truth"
```

---

## Phase Summary

| Chunk | Risk | What it does | App breaks? |
|-------|------|-------------|-------------|
| 1: Foundation Types | Zero | New files only | No |
| 2: Content Hashing | Zero | New files only | No |
| 3: The Bridge | Low | Adds optional fields to SequenceData | No |
| 4: Data Migration | Low | Adds fields to Firestore docs | No |
| 5: Sequence Composer | Zero | New service only | No |
| 6: Firestore Persistence | Zero | New collections only | No |
| 7: Consumer Migration | Low per file | Incremental substitution | No |
| 8: Remove Transition | Medium | Removes old fields | No (if 7 is complete) |

**If you stop after Chunk 3:** App works perfectly. New sequences get compositional data automatically. Old sequences still work via `steps[]`.

**If you stop after Chunk 4:** Same as above, plus all existing sequences have compositional data.

**If you stop after Chunk 6:** Same as above, plus users can save/load hand paths and solo props.

**You can stop at ANY chunk boundary and the app works.** That's the safety guarantee.

---

## Out of Scope (deferred from spec to follow-up plans)

These are in-scope per the design spec but are deferred to separate implementation plans. They build ON TOP of the compositional model and require it to be in place first:

1. **Construction palette browse UI** — card-based browser for hand paths and solo props in the Create module
2. **Choreo card rendering for tiers 1 & 2** — hand path cards (float/dash arrows, no props) and solo prop cards (one hand)
3. **Assemble tab: solo prop as valid output** — "save as solo prop" when only one hand is built
4. **Combine UI** — select two solo props, assign colors, preview, save
5. **Extraction UI** — context menu on sequences to extract hand paths or solo props
6. **Public sharing** for hand paths and solo props
