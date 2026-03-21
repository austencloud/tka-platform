# Hand Path Choreo Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render hand path choreo cards for the L1 deck by constructing purpose-built PictographData from location traces, with algorithmic arrow collision resolution.

**Architecture:** A `HandPathDataBuilder` service parses `handPathId` strings into `PictographData[]` using `createMotionData()` with float/static overrides and HAND props. An `ArrowCollisionResolver` detects same-location arrows and applies fixed outward/inward offsets in the 950x950 coordinate space. Both plug into `DeckFamilySection.svelte` which already groups sequences by `handPathId`.

**Tech Stack:** Svelte 5, TypeScript, ITI DI, Vitest

**Spec:** `docs/superpowers/specs/2026-03-19-hand-path-choreo-cards-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|----------------|
| `src/lib/features/choreo-card/services/contracts/IHandPathDataBuilder.ts` | Interface for location-trace → PictographData[] |
| `src/lib/features/choreo-card/services/implementations/HandPathDataBuilder.ts` | Parses handPathId, constructs PictographData per beat |
| `src/lib/features/choreo-card/services/contracts/IArrowCollisionResolver.ts` | Interface for detecting + resolving arrow overlaps |
| `src/lib/features/choreo-card/services/implementations/ArrowCollisionResolver.ts` | Applies outward/inward offset when arrows share location |
| `tests/unit/HandPathDataBuilder.test.ts` | Tests for trace parsing and PictographData construction |
| `tests/unit/ArrowCollisionResolver.test.ts` | Tests for collision detection and offset vectors |

### Modified files
| File | Change |
|------|--------|
| `src/lib/shared/di/containers/build-container.ts` | Register both new services |
| `src/lib/shared/di/container-types.ts` | Add new service types to IAppContainerItems |
| `src/lib/features/choreo-card/components/DeckFamilySection.svelte` | Use HandPathDataBuilder for hand path card rendering |

---

## Task 1: IHandPathDataBuilder interface

**Files:**
- Create: `src/lib/features/choreo-card/services/contracts/IHandPathDataBuilder.ts`

- [ ] **Step 1: Create the interface**

```typescript
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface HandPathTrace {
  blue: GridLocation[];  // length 9: start position + 8 beat destinations
  red: GridLocation[];   // length 9: start position + 8 beat destinations
}

export interface IHandPathDataBuilder {
  /** Parse a handPathId string (e.g. "n→e→e→s|s→w→w→n") into a HandPathTrace */
  parseHandPathId(handPathId: string): HandPathTrace;

  /** Build PictographData[] (one per beat) from a location trace */
  buildFromTrace(trace: HandPathTrace): PictographData[];

  /** Convenience: parse + build in one call */
  buildFromHandPathId(handPathId: string): PictographData[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to this file

---

## Task 2: IArrowCollisionResolver interface

**Files:**
- Create: `src/lib/features/choreo-card/services/contracts/IArrowCollisionResolver.ts`

- [ ] **Step 1: Create the interface**

```typescript
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

export interface IArrowCollisionResolver {
  /** Mutate arrow placement offsets on PictographData[] to separate overlapping arrows */
  resolveCollisions(beats: PictographData[]): PictographData[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to this file

---

## Task 3: HandPathDataBuilder — test for parseHandPathId

**Files:**
- Create: `tests/unit/HandPathDataBuilder.test.ts`
- Ref: `src/lib/features/choreo-card/services/contracts/IHandPathDataBuilder.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { HandPathDataBuilder } from "$lib/features/choreo-card/services/implementations/HandPathDataBuilder";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

describe("HandPathDataBuilder", () => {
  const builder = new HandPathDataBuilder();

  describe("parseHandPathId", () => {
    it("parses a standard handPathId into blue and red traces", () => {
      const handPathId = "n→e→e→s→s→w→w→n→n|s→w→w→n→n→e→e→s→s";
      const trace = builder.parseHandPathId(handPathId);

      expect(trace.blue).toEqual([
        GridLocation.NORTH, GridLocation.EAST, GridLocation.EAST,
        GridLocation.SOUTH, GridLocation.SOUTH, GridLocation.WEST,
        GridLocation.WEST, GridLocation.NORTH, GridLocation.NORTH,
      ]);
      expect(trace.red).toEqual([
        GridLocation.SOUTH, GridLocation.WEST, GridLocation.WEST,
        GridLocation.NORTH, GridLocation.NORTH, GridLocation.EAST,
        GridLocation.EAST, GridLocation.SOUTH, GridLocation.SOUTH,
      ]);
      expect(trace.blue).toHaveLength(9);
      expect(trace.red).toHaveLength(9);
    });

    it("handles intercardinal locations", () => {
      const handPathId = "ne→se→sw→nw→ne→se→sw→nw→ne|sw→nw→ne→se→sw→nw→ne→se→sw";
      const trace = builder.parseHandPathId(handPathId);

      expect(trace.blue[0]).toBe(GridLocation.NORTHEAST);
      expect(trace.blue[1]).toBe(GridLocation.SOUTHEAST);
      expect(trace.red[0]).toBe(GridLocation.SOUTHWEST);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/HandPathDataBuilder.test.ts`
Expected: FAIL — HandPathDataBuilder module not found

---

## Task 4: HandPathDataBuilder — implementation

**Files:**
- Create: `src/lib/features/choreo-card/services/implementations/HandPathDataBuilder.ts`

- [ ] **Step 1: Implement the builder**

```typescript
import type {
  HandPathTrace,
  IHandPathDataBuilder,
} from "../contracts/IHandPathDataBuilder";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  MotionColor,
  RotationDirection,
  Orientation,
  HandPath,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";

/**
 * CW direction pairs for all 8 compass points.
 * Cardinal: N→E, E→S, S→W, W→N
 * Full 8-point: N→NE, NE→E, E→SE, SE→S, S→SW, SW→W, W→NW, NW→N
 */
const CW_PAIRS = new Set([
  "n→e", "e→s", "s→w", "w→n",           // cardinal quarter-turns
  "n→ne", "ne→e", "e→se", "se→s",       // 8-point CW cycle
  "s→sw", "sw→w", "w→nw", "nw→n",
]);

function deriveHandPath(
  start: GridLocation,
  end: GridLocation
): HandPath {
  if (start === end) return HandPath.STATIC;
  const key = `${start}→${end}`;
  return CW_PAIRS.has(key) ? HandPath.CLOCKWISE : HandPath.COUNTER_CLOCKWISE;
}

const LOCATION_STRINGS: Record<string, GridLocation> = {
  n: GridLocation.NORTH,
  e: GridLocation.EAST,
  s: GridLocation.SOUTH,
  w: GridLocation.WEST,
  ne: GridLocation.NORTHEAST,
  se: GridLocation.SOUTHEAST,
  sw: GridLocation.SOUTHWEST,
  nw: GridLocation.NORTHWEST,
  c: GridLocation.CENTER,
};

export class HandPathDataBuilder implements IHandPathDataBuilder {
  parseHandPathId(handPathId: string): HandPathTrace {
    const [bluePart, redPart] = handPathId.split("|");
    return {
      blue: bluePart.split("→").map((s) => LOCATION_STRINGS[s.trim()]),
      red: redPart.split("→").map((s) => LOCATION_STRINGS[s.trim()]),
    };
  }

  buildFromTrace(trace: HandPathTrace): PictographData[] {
    const beats: PictographData[] = [];

    for (let i = 0; i < 8; i++) {
      const blueStart = trace.blue[i];
      const blueEnd = trace.blue[i + 1];
      const redStart = trace.red[i];
      const redEnd = trace.red[i + 1];

      const blueIsMoving = blueStart !== blueEnd;
      const redIsMoving = redStart !== redEnd;

      const blueMotion = createMotionData({
        startLocation: blueStart,
        endLocation: blueEnd,
        motionType: blueIsMoving ? MotionType.FLOAT : MotionType.STATIC,
        turns: blueIsMoving ? ("fl" as MotionData["turns"]) : 0,
        color: MotionColor.BLUE,
        propType: PropType.HAND,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
        rotationDirection: RotationDirection.NO_ROTATION,
        gridMode: GridMode.DIAMOND,
        isVisible: true,
        handPath: deriveHandPath(blueStart, blueEnd),
      });

      const redMotion = createMotionData({
        startLocation: redStart,
        endLocation: redEnd,
        motionType: redIsMoving ? MotionType.FLOAT : MotionType.STATIC,
        turns: redIsMoving ? ("fl" as MotionData["turns"]) : 0,
        color: MotionColor.RED,
        propType: PropType.HAND,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
        rotationDirection: RotationDirection.NO_ROTATION,
        gridMode: GridMode.DIAMOND,
        isVisible: true,
        handPath: deriveHandPath(redStart, redEnd),
      });

      // Use first 8 chars of handPathId hash to avoid ID collisions between different hand paths
      beats.push({
        id: `hp-${this.hashTrace(trace)}-beat-${i + 1}`,
        letter: null,
        motions: {
          [MotionColor.BLUE]: blueMotion,
          [MotionColor.RED]: redMotion,
        },
        gridMode: GridMode.DIAMOND,
        startPosition: null,
        endPosition: null,
      });
    }

    return beats;
  }

  buildFromHandPathId(handPathId: string): PictographData[] {
    const trace = this.parseHandPathId(handPathId);
    return this.buildFromTrace(trace);
  }

  /** Simple hash of trace for unique beat IDs */
  private hashTrace(trace: HandPathTrace): string {
    const str = trace.blue.join("") + trace.red.join("");
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36).slice(0, 8);
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/unit/HandPathDataBuilder.test.ts`
Expected: PASS — parseHandPathId tests green

---

## Task 5: HandPathDataBuilder — test for buildFromTrace

**Files:**
- Modify: `tests/unit/HandPathDataBuilder.test.ts`

- [ ] **Step 1: Add buildFromTrace tests**

Add to the existing describe block. Also add imports for `MotionType`, `HandPath`, `PropType`, and `HandPathTrace`.

```typescript
  describe("buildFromTrace", () => {
    const { N, E, S, W } = {
      N: GridLocation.NORTH, E: GridLocation.EAST,
      S: GridLocation.SOUTH, W: GridLocation.WEST,
    };

    // Standard alternating-shift trace: blue CW from N, red CW from S
    const standardTrace: HandPathTrace = {
      blue: [N, E, E, S, S, W, W, N, N],
      red: [S, W, W, N, N, E, E, S, S],
    };

    it("produces 8 beats from a 9-location trace", () => {
      const beats = builder.buildFromTrace(standardTrace);
      expect(beats).toHaveLength(8);
    });

    it("sets float motion when hand moves", () => {
      const beats = builder.buildFromTrace(standardTrace);
      const beat1Blue = beats[0].motions.blue!;

      expect(beat1Blue.motionType).toBe(MotionType.FLOAT);
      expect(beat1Blue.turns).toBe("fl");
      expect(beat1Blue.startLocation).toBe(N);
      expect(beat1Blue.endLocation).toBe(E);
    });

    it("sets static motion when hand stays", () => {
      const beats = builder.buildFromTrace(standardTrace);
      // Beat 2: blue goes E→E (static), red goes W→N (float)
      const beat2Blue = beats[1].motions.blue!;

      expect(beat2Blue.motionType).toBe(MotionType.STATIC);
      expect(beat2Blue.turns).toBe(0);
      expect(beat2Blue.startLocation).toBe(E);
      expect(beat2Blue.endLocation).toBe(E);
    });

    it("uses HAND prop type on all motions", () => {
      const beats = builder.buildFromTrace(standardTrace);

      for (const beat of beats) {
        expect(beat.motions.blue!.propType).toBe(PropType.HAND);
        expect(beat.motions.red!.propType).toBe(PropType.HAND);
      }
    });

    it("sets null letter on all beats", () => {
      const beats = builder.buildFromTrace(standardTrace);

      for (const beat of beats) {
        expect(beat.letter).toBeNull();
      }
    });

    it("derives CW handPath for N→E, E→S, S→W, W→N", () => {
      const beats = builder.buildFromTrace(standardTrace);

      // Beat 1: blue N→E = CW
      expect(beats[0].motions.blue!.handPath).toBe(HandPath.CLOCKWISE);
      // Beat 1: red S→W = CW
      expect(beats[0].motions.red!.handPath).toBe(HandPath.CLOCKWISE);
    });

    it("derives CCW handPath for E→N", () => {
      const ccwTrace: HandPathTrace = {
        blue: [E, N, N, N, N, N, N, N, N],
        red: [S, S, S, S, S, S, S, S, S],
      };
      const beats = builder.buildFromTrace(ccwTrace);

      expect(beats[0].motions.blue!.handPath).toBe(HandPath.COUNTER_CLOCKWISE);
    });

    it("sets STATIC handPath when hand doesn't move", () => {
      const beats = builder.buildFromTrace(standardTrace);

      // Beat 2: blue E→E = static handPath
      expect(beats[1].motions.blue!.handPath).toBe(HandPath.STATIC);
    });
  });
```

Import `HandPathTrace` from the contracts file at the top.

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/HandPathDataBuilder.test.ts`
Expected: All PASS

---

## Task 6: ArrowCollisionResolver — test

**Files:**
- Create: `tests/unit/ArrowCollisionResolver.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { ArrowCollisionResolver } from "$lib/features/choreo-card/services/implementations/ArrowCollisionResolver";
import { HandPathDataBuilder } from "$lib/features/choreo-card/services/implementations/HandPathDataBuilder";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { HandPathTrace } from "$lib/features/choreo-card/services/contracts/IHandPathDataBuilder";

const { N, E, S, W } = {
  N: GridLocation.NORTH, E: GridLocation.EAST,
  S: GridLocation.SOUTH, W: GridLocation.WEST,
};

describe("ArrowCollisionResolver", () => {
  const resolver = new ArrowCollisionResolver();
  const builder = new HandPathDataBuilder();

  it("does not modify beats where arrows end at different locations", () => {
    // Blue and red trace opposite quadrants — endLocations never match
    const trace: HandPathTrace = {
      blue: [N, E, E, S, S, W, W, N, N],
      red: [S, W, W, N, N, E, E, S, S],
    };
    const beats = builder.buildFromTrace(trace);
    const resolved = resolver.resolveCollisions(beats);

    for (const beat of resolved) {
      expect(beat.motions.blue!.arrowPlacementData.manualAdjustmentX).toBe(0);
      expect(beat.motions.blue!.arrowPlacementData.manualAdjustmentY).toBe(0);
      expect(beat.motions.red!.arrowPlacementData.manualAdjustmentX).toBe(0);
      expect(beat.motions.red!.arrowPlacementData.manualAdjustmentY).toBe(0);
    }
  });

  it("applies opposite offsets when both arrows end at same location", () => {
    // Identical traces: both hands move N→E together every other beat
    const trace: HandPathTrace = {
      blue: [N, E, N, E, N, E, N, E, N],
      red: [N, E, N, E, N, E, N, E, N],
    };
    const beats = builder.buildFromTrace(trace);
    const resolved = resolver.resolveCollisions(beats);

    // Beat 1: both end at E — collision
    const b = resolved[0].motions.blue!.arrowPlacementData;
    const r = resolved[0].motions.red!.arrowPlacementData;

    expect(b.manualAdjustmentX).toBe(-(r.manualAdjustmentX ?? 0));
    expect(b.manualAdjustmentY).toBe(-(r.manualAdjustmentY ?? 0));
    expect(b.manualAdjustmentX).not.toBe(0);
  });

  it("pushes along Y axis for N collision, X axis for E collision", () => {
    // Both hands static at N for all beats
    const trace: HandPathTrace = {
      blue: [N, N, N, N, N, N, N, N, N],
      red: [N, N, N, N, N, N, N, N, N],
    };
    const beats = builder.buildFromTrace(trace);
    const resolved = resolver.resolveCollisions(beats);

    const b = resolved[0].motions.blue!.arrowPlacementData;
    // N = push along Y axis only
    expect(b.manualAdjustmentX).toBe(0);
    expect(b.manualAdjustmentY).not.toBe(0);
    // Blue pushed outward (negative Y = up toward N)
    expect(b.manualAdjustmentY).toBeLessThan(0);
  });

  it("handles alternating collision pattern from real deck data", () => {
    // HP #17 (Shift+Shift): collides on even beats (2, 4, 6, 8)
    // Hand A: S→S→W→W→N→N→E→E→S
    // Hand B: S→W→W→N→N→E→E→S→S
    // Even beats: both end at same location
    const trace: HandPathTrace = {
      blue: [S, S, W, W, N, N, E, E, S],
      red: [S, W, W, N, N, E, E, S, S],
    };
    const beats = builder.buildFromTrace(trace);
    const resolved = resolver.resolveCollisions(beats);

    // Odd beats (0, 2, 4, 6): blue static, red moving — different endLocations
    // Beat 0: blue S→S, red S→W — blue ends S, red ends W — no collision
    expect(resolved[0].motions.blue!.arrowPlacementData.manualAdjustmentX).toBe(0);

    // Even beats (1, 3, 5, 7): both end at same location — collision
    // Beat 1: blue S→W, red W→W — both end at W — collision!
    expect(resolved[1].motions.blue!.arrowPlacementData.manualAdjustmentX).not.toBe(0);

    // Beat 3: blue W→N, red N→N — both end at N — collision!
    expect(resolved[3].motions.blue!.arrowPlacementData.manualAdjustmentY).not.toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ArrowCollisionResolver.test.ts`
Expected: FAIL — ArrowCollisionResolver module not found

---

## Task 7: ArrowCollisionResolver — implementation

**Files:**
- Create: `src/lib/features/choreo-card/services/implementations/ArrowCollisionResolver.ts`

The collision resolver compares `endLocation` of blue and red motions in each beat. When they match, it applies fixed outward/inward offsets based on the shared location's direction from grid center.

**Important:** The resolver operates on `endLocation` (where the hand ends up), not the calculated arrow render position. This is simpler and covers all collision cases since two hands at the same end location will produce overlapping visual elements regardless of arrow type.

- [ ] **Step 1: Implement the resolver**

```typescript
import type { IArrowCollisionResolver } from "../contracts/IArrowCollisionResolver";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { createArrowPlacementData } from "$lib/shared/pictograph/arrow/positioning/placement/domain/createArrowPlacementData";

const OFFSET_MAGNITUDE = 50;
const DIAGONAL_MAGNITUDE = 35; // 50 / sqrt(2) ≈ 35

/** Outward direction vectors per grid location (in 950x950 coordinate space) */
const OUTWARD_OFFSETS: Record<string, { x: number; y: number }> = {
  [GridLocation.NORTH]: { x: 0, y: -OFFSET_MAGNITUDE },
  [GridLocation.EAST]: { x: OFFSET_MAGNITUDE, y: 0 },
  [GridLocation.SOUTH]: { x: 0, y: OFFSET_MAGNITUDE },
  [GridLocation.WEST]: { x: -OFFSET_MAGNITUDE, y: 0 },
  [GridLocation.NORTHEAST]: { x: DIAGONAL_MAGNITUDE, y: -DIAGONAL_MAGNITUDE },
  [GridLocation.SOUTHEAST]: { x: DIAGONAL_MAGNITUDE, y: DIAGONAL_MAGNITUDE },
  [GridLocation.SOUTHWEST]: { x: -DIAGONAL_MAGNITUDE, y: DIAGONAL_MAGNITUDE },
  [GridLocation.NORTHWEST]: { x: -DIAGONAL_MAGNITUDE, y: -DIAGONAL_MAGNITUDE },
};

export class ArrowCollisionResolver implements IArrowCollisionResolver {
  resolveCollisions(beats: PictographData[]): PictographData[] {
    return beats.map((beat) => {
      const blue = beat.motions[MotionColor.BLUE];
      const red = beat.motions[MotionColor.RED];

      if (!blue || !red) return beat;
      if (blue.endLocation !== red.endLocation) return beat;

      const offset = OUTWARD_OFFSETS[blue.endLocation];
      if (!offset) return beat;

      return {
        ...beat,
        motions: {
          [MotionColor.BLUE]: this.applyOffset(blue, offset.x, offset.y),
          [MotionColor.RED]: this.applyOffset(red, -offset.x, -offset.y),
        },
      };
    });
  }

  private applyOffset(
    motion: MotionData,
    offsetX: number,
    offsetY: number
  ): MotionData {
    return createMotionData({
      ...motion,
      arrowPlacementData: createArrowPlacementData({
        ...motion.arrowPlacementData,
        manualAdjustmentX:
          (motion.arrowPlacementData.manualAdjustmentX ?? 0) + offsetX,
        manualAdjustmentY:
          (motion.arrowPlacementData.manualAdjustmentY ?? 0) + offsetY,
      }),
    });
  }
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/ArrowCollisionResolver.test.ts`
Expected: PASS

- [ ] **Step 3: Also run HandPathDataBuilder tests to check nothing broke**

Run: `npx vitest run tests/unit/HandPathDataBuilder.test.ts tests/unit/ArrowCollisionResolver.test.ts`
Expected: All PASS

---

## Task 8: DI registration

**Files:**
- Modify: `src/lib/shared/di/containers/build-container.ts`
- Modify: `src/lib/shared/di/container-types.ts`

- [ ] **Step 1: Read current state of both files**

Read `build-container.ts` to find where `sequenceToEntryConverter` is registered (line ~277).
Read `container-types.ts` to find the IAppContainerItems type.

- [ ] **Step 2: Add imports and registration to build-container.ts**

Add imports at top:
```typescript
import { HandPathDataBuilder } from "$lib/features/choreo-card/services/implementations/HandPathDataBuilder";
import { ArrowCollisionResolver } from "$lib/features/choreo-card/services/implementations/ArrowCollisionResolver";
```

Add registration near `sequenceToEntryConverter`:
```typescript
handPathDataBuilder: () => new HandPathDataBuilder(),
arrowCollisionResolver: () => new ArrowCollisionResolver(),
```

- [ ] **Step 3: Add types to container-types.ts**

Add import:
```typescript
import type { IHandPathDataBuilder } from "$lib/features/choreo-card/services/contracts/IHandPathDataBuilder";
import type { IArrowCollisionResolver } from "$lib/features/choreo-card/services/contracts/IArrowCollisionResolver";
```

Add to the appropriate section of IAppContainerItems:
```typescript
handPathDataBuilder: IHandPathDataBuilder;
arrowCollisionResolver: IArrowCollisionResolver;
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors

---

## Task 9: Integrate into DeckFamilySection

**Files:**
- Modify: `src/lib/features/choreo-card/components/DeckFamilySection.svelte`

- [ ] **Step 1: Read current DeckFamilySection.svelte**

Read the full file, paying attention to:
- How it currently renders hand path representatives (the `handPathMode={true}` section)
- Where `handPathId` is available
- The data flow from grouped sequences to rendered cards

- [ ] **Step 2: Add hand path data construction**

Import the services from the DI container and use them to build hand path PictographData when rendering hand path representative cards. Replace the current approach (passing the representative sequence with `handPathMode={true}`) with constructed PictographData from the `handPathId`.

The integration point is where hand path cards are rendered — the builder constructs the data, the resolver fixes collisions, and the result feeds into the existing thumbnail rendering pipeline.

The exact integration depends on the current component structure (read in Step 1), but the pattern is:

```typescript
const handPathDataBuilder = container.items.handPathDataBuilder;
const arrowCollisionResolver = container.items.arrowCollisionResolver;

// For each unique handPathId in the family:
const handPathBeats = handPathDataBuilder.buildFromHandPathId(handPathId);
const resolvedBeats = arrowCollisionResolver.resolveCollisions(handPathBeats);
// Pass resolvedBeats to the thumbnail renderer
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors

---

## Task 10: Visual verification

**Files:** None (verification only)

- [ ] **Step 1: Build the project**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass, including new HandPathDataBuilder and ArrowCollisionResolver tests

- [ ] **Step 3: Ask user to visually verify**

Tell the user: "Please navigate to the L1 deck view and check:
1. Hand path cards show HAND props (small dots) instead of staff/fan props
2. Float arrows show trajectory direction
3. No TKA letter overlay on hand path cards
4. Arrows on collision beats (where both hands share a location) are separated, not stacked
5. Non-collision beats render normally"

---

## Task 11: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add src/lib/features/choreo-card/services/contracts/IHandPathDataBuilder.ts \
  src/lib/features/choreo-card/services/implementations/HandPathDataBuilder.ts \
  src/lib/features/choreo-card/services/contracts/IArrowCollisionResolver.ts \
  src/lib/features/choreo-card/services/implementations/ArrowCollisionResolver.ts \
  src/lib/shared/di/containers/build-container.ts \
  src/lib/shared/di/container-types.ts \
  src/lib/features/choreo-card/components/DeckFamilySection.svelte \
  tests/unit/HandPathDataBuilder.test.ts \
  tests/unit/ArrowCollisionResolver.test.ts
git commit -m "feat: hand path choreo cards with purpose-built data and collision resolution"
```

---

## Task 12: Cleanup old handPathMode flag (optional)

The purpose-built data approach makes the `handPathMode` render-time transform unnecessary for deck cards. This cleanup can be done now or deferred.

**Files:**
- Modify: `src/lib/shared/pictograph/shared/services/implementations/PictographPreparer.ts` — remove `transformForHandPath()` and `deriveHandPath()`
- Modify: Any files that thread `handPathMode` through the render pipeline (ImageComposer, ThumbnailRenderer, etc.)

- [ ] **Step 1: Search for all handPathMode references**

Run: `grep -r "handPathMode" src/lib/ --include="*.ts" --include="*.svelte" -l`

- [ ] **Step 2: Remove handPathMode from PictographPreparer**

Remove `transformForHandPath()` and `deriveHandPath()` methods. These are no longer called for deck rendering.

- [ ] **Step 3: Assess remaining handPathMode usages**

The `handPathMode` flag may still be useful in other contexts (e.g., sequence viewer toggle). Only remove it from the deck card rendering path. If it's only used for deck cards, remove it entirely.

- [ ] **Step 4: Verify build and tests**

Run: `npm run build && npx vitest run`
Expected: All pass

- [ ] **Step 5: Commit cleanup**

```bash
git commit -m "refactor: remove obsolete handPathMode render-time transform"
```
