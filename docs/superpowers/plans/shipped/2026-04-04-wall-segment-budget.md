# Wall Segment Budget System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the museum's fractional exhibit placement system with wall segment budgets so invalid placements are unrepresentable by construction.

**Architecture:** Each wall becomes an ordered array of typed segments (door, exhibit, torch, gap, rope, sign). Room dimensions are auto-computed from segment totals. The builder stamps segments deterministically — no searching, no repositioning.

**Tech Stack:** TypeScript, Vitest, Svelte 5

**Spec:** `docs/superpowers/specs/2026-04-04-wall-segment-budget-design.md`

**Testing philosophy:** This project follows "earned tests" — test the pure algorithms (segment width computation, wall length, room auto-sizing, segment stamping) because those produce silent bugs. Don't test glue code or rendering.

---

## File Structure

### New Files
- `src/lib/features/museum/domain/wall-segment-types.ts` — Segment type definitions, width constants, `computeWallLength()`, `computeRoomDimensions()`
- `src/lib/features/museum/services/contracts/IWallSegmentStamper.ts` — Interface
- `src/lib/features/museum/services/implementations/WallSegmentStamper.ts` — Stamps segments onto tile grid, produces door position map
- `src/lib/features/museum/services/contracts/IMuseumRoomSerializer.ts` — JSON serialization interface
- `src/lib/features/museum/services/implementations/MuseumRoomSerializer.ts` — Serialize/deserialize/validate
- `tests/unit/museum/WallSegmentTypes.test.ts` — Tests for pure dimension functions
- `tests/unit/museum/WallSegmentStamper.test.ts` — Tests for segment stamping

### Modified Files
- `src/lib/features/museum/domain/layout-types.ts` — New RoomNode/PlacedRoom with walls, remove old placement types
- `src/lib/features/museum/data/museum-room-graph.ts` — All 16 rooms rewritten with wall segments
- `src/lib/features/museum/services/implementations/MuseumGridBuilder.ts` — Use WallSegmentStamper, remove old placement logic
- `src/lib/features/museum/services/implementations/GraphLayoutEngine.ts` — Use computeRoomDimensions()
- `src/lib/features/museum/services/implementations/CorridorRouter.ts` — Accept door position map
- `src/lib/features/museum/services/implementations/MuseumDesignValidator.ts` — Strip eliminated rules
- `src/lib/features/museum/domain/museum-design-rules.ts` — Remove unused constants
- `src/lib/features/museum/MuseumModule.svelte` — Update dev validation wiring
- `tests/unit/museum/GraphLayoutEngine.test.ts` — Update for new RoomNode shape
- `tests/unit/museum/MuseumFloorPlan.test.ts` — Delete (tests dead code)

### Deleted Files
- `src/lib/features/museum/data/museum-floor-plan.ts` — Entire file (dead code)

---

## Task 1: Wall Segment Types + Pure Functions

**Files:**
- Create: `src/lib/features/museum/domain/wall-segment-types.ts`
- Create: `tests/unit/museum/WallSegmentTypes.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/unit/museum/WallSegmentTypes.test.ts
import { describe, it, expect } from "vitest";
import {
  computeSegmentWidth,
  computeWallLength,
  computeRoomDimensions,
} from "$lib/features/museum/domain/wall-segment-types";
import type { WallSegment, WallDefinition } from "$lib/features/museum/domain/wall-segment-types";

describe("computeSegmentWidth", () => {
  it("returns correct width for each segment type", () => {
    expect(computeSegmentWidth({ type: "door", edgeId: "a->b", width: 4 })).toBe(4);
    expect(computeSegmentWidth({ type: "exhibit", refId: "x", size: "standard", facing: "south" })).toBe(2);
    expect(computeSegmentWidth({ type: "exhibit", refId: "x", size: "large", facing: "south" })).toBe(4);
    expect(computeSegmentWidth({ type: "exhibit", refId: "x", size: "dev-whiteboard", facing: "south" })).toBe(6);
    expect(computeSegmentWidth({ type: "torch" })).toBe(1);
    expect(computeSegmentWidth({ type: "screen", refId: "x", facing: "south" })).toBe(3);
    expect(computeSegmentWidth({ type: "rope", edgeId: "a->b", width: 6 })).toBe(6);
    expect(computeSegmentWidth({ type: "sign", refId: "x" })).toBe(2);
    expect(computeSegmentWidth({ type: "gap", minTiles: 5 })).toBe(5);
  });
});

describe("computeWallLength", () => {
  it("sums segment widths plus margins", () => {
    const wall: WallDefinition = {
      segments: [
        { type: "gap", minTiles: 3 },
        { type: "exhibit", refId: "x", size: "standard", facing: "south" },
        { type: "gap", minTiles: 4 },
        { type: "door", edgeId: "a->b", width: 4 },
        { type: "gap", minTiles: 3 },
      ],
      minMargin: 2,
    };
    // 2 + 3 + 2 + 4 + 4 + 3 + 2 = 20
    expect(computeWallLength(wall)).toBe(20);
  });

  it("returns just margins for empty wall", () => {
    const wall: WallDefinition = { segments: [], minMargin: 3 };
    expect(computeWallLength(wall)).toBe(6);
  });
});

describe("computeRoomDimensions", () => {
  it("uses max of north/south for width, east/west for height", () => {
    const room = {
      id: "test",
      name: "Test",
      material: "stone" as const,
      theme: "cave" as const,
      walls: {
        north: { segments: [{ type: "gap" as const, minTiles: 10 }], minMargin: 2 },
        south: { segments: [{ type: "gap" as const, minTiles: 6 }], minMargin: 2 },
        east: { segments: [{ type: "gap" as const, minTiles: 8 }], minMargin: 2 },
        west: { segments: [{ type: "gap" as const, minTiles: 4 }], minMargin: 2 },
      },
    };
    const dims = computeRoomDimensions(room);
    // Width: max(14, 10) + 2 = 16. Height: max(12, 8) + 2 = 14.
    expect(dims.w).toBe(16);
    expect(dims.h).toBe(14);
  });

  it("respects minInteriorWidth/minInteriorHeight overrides", () => {
    const room = {
      id: "test",
      name: "Test",
      material: "stone" as const,
      theme: "cave" as const,
      walls: {
        north: { segments: [], minMargin: 1 },
        south: { segments: [], minMargin: 1 },
        east: { segments: [], minMargin: 1 },
        west: { segments: [], minMargin: 1 },
      },
      minInteriorWidth: 20,
      minInteriorHeight: 16,
    };
    const dims = computeRoomDimensions(room);
    expect(dims.w).toBe(22); // 20 + 2
    expect(dims.h).toBe(18); // 16 + 2
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/museum/WallSegmentTypes.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/lib/features/museum/domain/wall-segment-types.ts` with:
- All segment type definitions (DoorSegment, ExhibitSegment, TorchSegment, ScreenSegment, RopeSegment, SignSegment, GapSegment, WallSegment union)
- WallDefinition interface
- `SEGMENT_WIDTHS` constant map for fixed-width segments
- `computeSegmentWidth(segment: WallSegment): number`
- `computeWallLength(wall: WallDefinition): number`
- `computeRoomDimensions(room: { walls, minInteriorWidth?, minInteriorHeight? }): { w, h }`

Reference the spec's "Segment Tile Widths" table and "Room Auto-Sizing" section for exact values.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/museum/WallSegmentTypes.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum/domain/wall-segment-types.ts tests/unit/museum/WallSegmentTypes.test.ts
git commit -m "feat(museum): add wall segment type definitions and dimension computation"
```

---

## Task 2: Update layout-types.ts

**Files:**
- Modify: `src/lib/features/museum/domain/layout-types.ts`

This task updates the type system. It will temporarily break compilation of files that import the old types — that's expected and fixed in subsequent tasks.

- [ ] **Step 1: Read the current file**

Read `src/lib/features/museum/domain/layout-types.ts` to understand exact current state.

- [ ] **Step 2: Update RoomNode**

Remove from `RoomNode`:
- `minWidth`, `maxWidth`, `minHeight`, `maxHeight`
- `exhibits?: ExhibitPlacement[]`
- `torches?: TorchPlacement[]`
- `screens?: ScreenPlacement[]`

Add to `RoomNode`:
- `walls: { north: WallDefinition; south: WallDefinition; east: WallDefinition; west: WallDefinition }`
- `minInteriorWidth?: number`
- `minInteriorHeight?: number`

Import `WallDefinition` from `./wall-segment-types`.

- [ ] **Step 3: Update PlacedRoom**

Same changes as RoomNode — replace `exhibits?`, `torches?`, `screens?` with `walls`.

- [ ] **Step 4: Update FurniturePlacement**

Add `"scaffolding"` and `"sign"` to the `role` union:
```typescript
role: "bench" | "pedestal" | "bookshelf" | "lamp" | "plant" | "scaffolding" | "sign";
```

- [ ] **Step 5: Remove old types**

Delete `ExhibitPlacement`, `TorchPlacement`, `ScreenPlacement` interfaces. Keep `PerformerPlacement`, `FurniturePlacement`, `RoomEdge`, `GridConfig`, `CorridorSegment`, `LayoutResult`, `ValidationResult`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/museum/domain/layout-types.ts
git commit -m "refactor(museum): update RoomNode and PlacedRoom types for wall segments"
```

---

## Task 3: WallSegmentStamper

**Files:**
- Create: `src/lib/features/museum/services/contracts/IWallSegmentStamper.ts`
- Create: `src/lib/features/museum/services/implementations/WallSegmentStamper.ts`
- Create: `tests/unit/museum/WallSegmentStamper.test.ts`

- [ ] **Step 1: Write the interface**

```typescript
// services/contracts/IWallSegmentStamper.ts
import type { MuseumTile } from "../../domain/museum-grid-types";
import type { PlacedRoom, RoomEdge } from "../../domain/layout-types";
import type { ExhibitDefinition } from "../../domain/museum-grid-types";

export interface DoorPosition {
  x: number;
  y: number;
  wall: string;
  edgeId: string;
}

export interface StampResult {
  exhibits: ExhibitDefinition[];
  doorPositions: DoorPosition[];
}

export interface IWallSegmentStamper {
  stampRoom(
    tiles: Map<string, MuseumTile>,
    room: PlacedRoom,
    edges: RoomEdge[],
  ): StampResult;
}
```

- [ ] **Step 2: Write the test file**

Test a small room with known segments. Verify:
- Exhibit-panel tiles are placed at correct positions along walls
- Door tiles are placed as floor (walkable opening)
- Torch tiles are placed correctly
- Rope tiles are non-walkable
- Gap positions remain as floor (already carved)
- Door positions are reported correctly in the result
- Segments that exceed wall length throw an error

```typescript
// tests/unit/museum/WallSegmentStamper.test.ts
import { describe, it, expect } from "vitest";
import { WallSegmentStamper } from "$lib/features/museum/services/implementations/WallSegmentStamper";
import { tileKey } from "$lib/features/museum/domain/museum-grid-types";
import type { MuseumTile } from "$lib/features/museum/domain/museum-grid-types";
import type { PlacedRoom } from "$lib/features/museum/domain/layout-types";

function makeFloorGrid(x: number, y: number, w: number, h: number): Map<string, MuseumTile> {
  const tiles = new Map<string, MuseumTile>();
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      tiles.set(tileKey(x + dx, y + dy), { type: "floor", material: "stone" });
    }
  }
  return tiles;
}

describe("WallSegmentStamper", () => {
  const stamper = new WallSegmentStamper();

  it("places exhibit-panel tile on north wall", () => {
    // Room at (0,0), 16x12. North wall exhibit at gap(3) + exhibit.
    const room: PlacedRoom = {
      id: "test", name: "Test", x: 0, y: 0, w: 16, h: 12,
      material: "stone", theme: "cave",
      walls: {
        north: {
          segments: [
            { type: "gap", minTiles: 3 },
            { type: "exhibit", refId: "test-ex", size: "standard", facing: "south" },
          ],
          minMargin: 2,
        },
        south: { segments: [], minMargin: 2 },
        east: { segments: [], minMargin: 2 },
        west: { segments: [], minMargin: 2 },
      },
    };
    const tiles = makeFloorGrid(0, 0, 16, 12);
    const result = stamper.stampRoom(tiles, room, []);

    // Exhibit starts at x = 0 + 1 + margin(2) + gap(3) = 6, y = 0 (north wall)
    // Standard exhibit is 2 tiles wide, so tiles at (6,0) and (7,0)
    const tile6 = tiles.get(tileKey(6, 0));
    const tile7 = tiles.get(tileKey(7, 0));
    expect(tile6?.type).toBe("exhibit-panel");
    expect(tile7?.type).toBe("exhibit-panel");
    expect(result.exhibits).toHaveLength(1);
    expect(result.exhibits[0].id).toBe("test-ex");
  });

  it("places door as floor tiles and reports position", () => {
    const room: PlacedRoom = {
      id: "test", name: "Test", x: 10, y: 20, w: 20, h: 14,
      material: "stone", theme: "cave",
      walls: {
        north: {
          segments: [
            { type: "gap", minTiles: 3 },
            { type: "door", edgeId: "test->other", width: 4 },
          ],
          minMargin: 2,
        },
        south: { segments: [], minMargin: 2 },
        east: { segments: [], minMargin: 2 },
        west: { segments: [], minMargin: 2 },
      },
    };
    const tiles = makeFloorGrid(10, 20, 20, 14);
    const result = stamper.stampRoom(tiles, room, []);

    // Door starts at x = 10 + 1 + 2 + 3 = 16, y = 20 (north wall)
    // Door is 4 tiles wide: (16,20), (17,20), (18,20), (19,20)
    for (let x = 16; x <= 19; x++) {
      const tile = tiles.get(tileKey(x, 20));
      expect(tile?.type).toBe("door");
    }

    expect(result.doorPositions).toHaveLength(1);
    expect(result.doorPositions[0].edgeId).toBe("test->other");
    // Door center: x = 16 + 2 = 18 (center of 4-tile span)
    expect(result.doorPositions[0].x).toBe(18);
    expect(result.doorPositions[0].y).toBe(20);
  });

  it("throws if segments exceed wall length", () => {
    const room: PlacedRoom = {
      id: "tiny", name: "Tiny", x: 0, y: 0, w: 6, h: 6,
      material: "stone", theme: "cave",
      walls: {
        north: {
          segments: [{ type: "door", edgeId: "a->b", width: 10 }],
          minMargin: 2,
        },
        south: { segments: [], minMargin: 0 },
        east: { segments: [], minMargin: 0 },
        west: { segments: [], minMargin: 0 },
      },
    };
    const tiles = makeFloorGrid(0, 0, 6, 6);
    expect(() => stamper.stampRoom(tiles, room, [])).toThrow();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/museum/WallSegmentStamper.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the implementation**

Create `WallSegmentStamper.ts`. Key logic:
- For each wall (north/south/east/west), iterate segments in order
- Track a `cursor` position starting at `wallStart + 1 + minMargin` (the `+1` skips the corner tile)
- For horizontal walls (north/south): cursor advances along X, Y is fixed at room boundary
- For vertical walls (east/west): cursor advances along Y, X is fixed at room boundary
- Each segment type stamps its tile(s) at the cursor and advances cursor by segment width
- Door segments stamp `{ type: "door" }` tiles
- Exhibit segments stamp `{ type: "exhibit-panel", refId, facing }` tiles and push to exhibits array
- Torch segments stamp `{ type: "torch" }` tiles
- Rope segments stamp `{ type: "rope" }` tiles
- Sign segments stamp `{ type: "sign", refId }` tiles
- Gap segments do nothing (floor already carved)
- After all segments, assert `cursor + minMargin <= wallEnd` or throw
- Collect door center positions into `doorPositions` array
- Look up exhibit content from `ROOM_CONTENT` (import from `museum-room-content.ts`)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/museum/WallSegmentStamper.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/museum/services/contracts/IWallSegmentStamper.ts \
        src/lib/features/museum/services/implementations/WallSegmentStamper.ts \
        tests/unit/museum/WallSegmentStamper.test.ts
git commit -m "feat(museum): add WallSegmentStamper with deterministic segment placement"
```

---

## Task 4: Update GraphLayoutEngine

**Files:**
- Modify: `src/lib/features/museum/services/implementations/GraphLayoutEngine.ts`
- Modify: `tests/unit/museum/GraphLayoutEngine.test.ts`

- [ ] **Step 1: Update the engine**

Import `computeRoomDimensions` from `../../domain/wall-segment-types`.

In `computeLayout()`, replace lines 48-49:
```typescript
// OLD:
const w = room.minWidth + Math.floor((room.maxWidth - room.minWidth) / 2);
const h = room.minHeight + Math.floor((room.maxHeight - room.minHeight) / 2);
// NEW:
const { w, h } = computeRoomDimensions(room);
```

Same change in the side-branch placement loop (lines 98-99).

In `createPlacedRoom()`, copy `walls` instead of `exhibits`/`torches`/`screens`:
```typescript
// OLD:
exhibits: room.exhibits,
performers: room.performers,
torches: room.torches,
screens: room.screens,
furniture: room.furniture,
// NEW:
walls: room.walls,
performers: room.performers,
furniture: room.furniture,
```

- [ ] **Step 2: Update the test file**

The existing `GraphLayoutEngine.test.ts` imports `MUSEUM_ROOMS` which will have the new shape after Task 6. For now, update the test to work with the new `RoomNode` type by creating minimal test rooms with `walls` instead of `minWidth`/`maxWidth`. The existing tests that use `MUSEUM_ROOMS` will be updated in Task 6 when the room data is rewritten.

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/museum/GraphLayoutEngine.test.ts`
Expected: PASS (or skip if MUSEUM_ROOMS not yet converted — revisit after Task 6)

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/museum/services/implementations/GraphLayoutEngine.ts \
        tests/unit/museum/GraphLayoutEngine.test.ts
git commit -m "refactor(museum): use computeRoomDimensions in GraphLayoutEngine"
```

---

## Task 5: Update CorridorRouter

**Files:**
- Modify: `src/lib/features/museum/services/implementations/CorridorRouter.ts`

- [ ] **Step 1: Update routeCorridor signature**

Add optional `doorPositionMap` parameter:

```typescript
routeCorridor(
  fromRoom: PlacedRoom,
  toRoom: PlacedRoom,
  edge: RoomEdge,
  doorPositionMap?: Map<string, { x: number; y: number }>,
): CorridorSegment[]
```

- [ ] **Step 2: Update getDoorPosition**

Check the map first, fall back to wall center:

```typescript
private getDoorPosition(
  room: PlacedRoom,
  wall: string,
  edgeId: string,
  doorPositionMap?: Map<string, { x: number; y: number }>,
): DoorPosition {
  const mapped = doorPositionMap?.get(edgeId);
  if (mapped) return mapped;

  // Fallback: wall center (preserves behavior for edges without stamped doors)
  // ... existing center calculation ...
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: May have errors from files not yet migrated — that's OK. The CorridorRouter itself should have no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/museum/services/implementations/CorridorRouter.ts
git commit -m "refactor(museum): CorridorRouter accepts door position map"
```

---

## Task 6: Rewrite Room Definitions

**Files:**
- Modify: `src/lib/features/museum/data/museum-room-graph.ts`

This is the largest data migration task. Convert all 16 rooms from the old `exhibits[]`/`torches[]` format to `walls: { north, south, east, west }` with segment arrays.

- [ ] **Step 1: Read the current room definitions**

Read `museum-room-graph.ts` to reference each room's exhibits, torches, and door walls.

- [ ] **Step 2: Convert each room**

For each of the 16 rooms, use the door wall table from the spec to determine which walls have doors. For each wall:
1. If the wall has a door: place exhibit segments BEFORE or AFTER the door segment, separated by gap segments
2. If the wall has exhibits only: place exhibit segments with gap segments between them
3. If the wall has torches: place torch segments at the positions specified
4. Add `minMargin: 2` on every wall
5. For rooms needing floor space (collaboration with 4 performers, isolation with cubicle grid): add `minInteriorWidth`/`minInteriorHeight`
6. For VTG wing and construction zone: add `furniture` entries with `role: "scaffolding"` for interior scaffolding

7. Verify `"scaffolding"` exists as a tile type in `src/lib/features/museum/domain/museum-grid-types.ts` and `src/lib/features/museum/domain/tile-registry.ts`. If not, add it to both. (It likely already exists since the old floor plan stamps scaffolding tiles.)

Key rooms requiring special attention:
- **digital**: west wall gets `RopeSegment` for VTG connection
- **collaboration**: needs `minInteriorWidth`/`minInteriorHeight` for 4 performers
- **isolation**: needs interior overrides for cubicle grid
- **entrance**: tall hallway, needs `minInteriorHeight: 48` (current is 50 tiles tall, 16 wide)
- **vtg-wing**: scaffolding as furniture, sign as wall segment
- **construction-zone**: scaffolding as furniture, sign as wall segment

- [ ] **Step 3: Update MUSEUM_EDGES**

The edge definitions stay the same — they reference rooms by ID and specify `fromWall`/`toWall`. No changes needed to the edges array.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -50`
Expected: Type errors in MuseumGridBuilder (still using old API) — that's expected and fixed in Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum/data/museum-room-graph.ts
git commit -m "feat(museum): convert all 16 rooms to wall segment format"
```

---

## Task 7: Integrate WallSegmentStamper into MuseumGridBuilder

**Files:**
- Modify: `src/lib/features/museum/services/implementations/MuseumGridBuilder.ts`

This is the core integration task. Replace the old placement pipeline with the new segment-based pipeline.

- [ ] **Step 1: Read current MuseumGridBuilder**

Understand the full `build()` method and what needs to change.

- [ ] **Step 2: Remove old placement code**

Delete these methods entirely:
- `placeExhibits()`
- `placeTorches()`
- `placeDevWhiteboards()`
- `findWallBackedPosition()`
- `findNonOverlappingPosition()`
- `hasWallBehind()`
- `hasWallBehindSpan()`
- `carveDoorwayFlare()`
- `rangesOverlap()`
- `recordOccupancy()`
- `alongCoord()`

Delete the `wallOccupancy` field and `EXHIBIT_HALF_SPAN` constant.

Replace the `import { placeTile } from "../../data/museum-floor-plan"` line with a local private helper:

```typescript
private placeTile(tiles: Map<string, MuseumTile>, x: number, y: number, tile: MuseumTile): void {
  tiles.set(tileKey(x, y), tile);
}
```

This is needed because `placePerformers()` and `placeFurniture()` (which are kept) use `placeTile`.

- [ ] **Step 3: Add WallSegmentStamper integration**

Import `WallSegmentStamper` and use it in the `build()` method.

Replace Step 4 in the build pipeline:
```typescript
// OLD Step 4:
// for (const room of layout.rooms) {
//   this.placeExhibits(tiles, room, exhibits);
//   this.placeTorches(tiles, room);
//   ...
// }

// NEW Step 4: Stamp wall segments + collect door positions
const stamper = new WallSegmentStamper();
const allDoorPositions = new Map<string, { x: number; y: number }>();

for (const room of layout.rooms) {
  const result = stamper.stampRoom(tiles, room, edges);
  exhibits.push(...result.exhibits);
  for (const dp of result.doorPositions) {
    allDoorPositions.set(dp.edgeId, { x: dp.x, y: dp.y });
  }
  this.placePerformers(tiles, room, performers);
  this.placeFurniture(room, furniture);
}
```

- [ ] **Step 4: Update corridor routing to use door positions**

Pass the `allDoorPositions` map to the corridor router:
```typescript
// In Step 2 (corridor routing), move AFTER Step 4 (segment stamping)
// so door positions are available
for (const edge of edges) {
  const fromRoom = roomLookup.get(edge.from);
  const toRoom = roomLookup.get(edge.to);
  if (!fromRoom || !toRoom) continue;
  const segments = this.corridorRouter.routeCorridor(fromRoom, toRoom, edge, allDoorPositions);
  corridorData.push({ edge, segments });
}
```

**Important pipeline reorder:** Corridors must be routed AFTER segment stamping (to know door positions), but corridor CARVING must happen before wall derivation. So the sequence becomes:
1. Carve room floors
2. Stamp wall segments (produces door positions)
3. Route corridors (using door positions)
4. Carve corridor floors
5. Derive walls
6. Place performers + furniture

- [ ] **Step 5: Remove doorway flare carving**

Delete the Phase 1c loop that calls `carveDoorwayFlare()`. Door openings are now handled by the door segments themselves.

- [ ] **Step 6: Handle scaffolding in placeFurniture**

Update `placeFurniture()` to stamp scaffolding tiles for `role: "scaffolding"`:
```typescript
if (placement.role === "scaffolding") {
  tiles.set(tileKey(px, py), { type: "scaffolding" });
}
```

(Or handle in the existing `placeTile` call pattern — depends on how other furniture roles work.)

- [ ] **Step 7: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -50`
Expected: Errors from MuseumDesignValidator (still using old types) — fixed in Task 8.

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/museum/services/implementations/MuseumGridBuilder.ts
git commit -m "feat(museum): integrate WallSegmentStamper into MuseumGridBuilder"
```

---

## Task 8: Simplify MuseumDesignValidator + Design Rules

**Files:**
- Modify: `src/lib/features/museum/services/implementations/MuseumDesignValidator.ts`
- Modify: `src/lib/features/museum/domain/museum-design-rules.ts`

- [ ] **Step 1: Strip eliminated rules from validator**

Delete these methods:
- `checkWallBacked()`
- `checkCornerAvoidance()`
- `checkEntranceClearance()`
- `checkSpacing()`
- `checkWallCoverage()`
- `computeWallPosition()` (helper used by eliminated rules)
- `wallOutwardDelta()`, `getRoomCorners()`, `wallLength()` helpers

Keep `getWallMidpoint()` — it's used by `checkSightline()` which is retained.

Keep:
- `checkSightline()` — needs updating to read exhibit positions from wall segments
- `checkAnchorPresence()` — needs updating to scan wall segments for `isAnchor`
- `checkAnchorPlacement()` — needs updating similarly
- `buildEntranceMap()` — unchanged
- `logViolations()` — unchanged
- `validateAll()` — updated to call only retained checks
- `validateRoom()` — updated similarly

- [ ] **Step 2: Update retained checks to read from wall segments**

The anchor checks need to iterate wall segments to find exhibits with `isAnchor: true` instead of reading from `ExhibitPlacement[]`.

For sightline: the check still traces a line from the entrance to the anchor. It needs the anchor's actual tile position. This can be computed by walking the wall segments (same algorithm as the stamper) to find the anchor's tile coordinate.

- [ ] **Step 3: Strip eliminated constants from design rules**

In `museum-design-rules.ts`, remove:
- `CORNER_AVOIDANCE`
- `ENTRANCE_CLEARANCE`
- `EXHIBIT_SPACING`
- `MAX_WALL_COVERAGE`

Keep:
- `DEV_WHITEBOARDS_ENABLED`
- `OPPOSITE_WALL`

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum/services/implementations/MuseumDesignValidator.ts \
        src/lib/features/museum/domain/museum-design-rules.ts
git commit -m "refactor(museum): simplify validator to segment-aware checks only"
```

---

## Task 9: Update MuseumModule.svelte + Delete Dead Code

**Files:**
- Modify: `src/lib/features/museum/MuseumModule.svelte`
- Delete: `src/lib/features/museum/data/museum-floor-plan.ts`
- Delete: `tests/unit/museum/MuseumFloorPlan.test.ts`

- [ ] **Step 1: Update dev validation block in MuseumModule.svelte**

Lines 163-197. Update the `PlacedRoom` reconstruction to pull `walls` from the room graph:

```typescript
const placedRooms = generatedGrid.wings.map(wing => {
  const src = roomMap.get(wing.id);
  return {
    id: wing.id,
    name: wing.name,
    x: wing.bounds.x,
    y: wing.bounds.y,
    w: wing.bounds.width,
    h: wing.bounds.height,
    material: src?.material ?? "stone",
    theme: wing.theme,
    walls: src?.walls,       // NEW
    performers: src?.performers,
  };
});
```

- [ ] **Step 2: Delete museum-floor-plan.ts**

The entire file is dead code. Delete it.

- [ ] **Step 3: Delete MuseumFloorPlan.test.ts**

Tests the dead code. Delete it.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run tests/unit/museum/`
Expected: All museum tests pass. The old floor plan tests are gone.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean — no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A src/lib/features/museum/ tests/unit/museum/
git commit -m "refactor(museum): update MuseumModule wiring, delete dead floor plan code"
```

---

## Task 10: JSON Serialization Layer

**Files:**
- Create: `src/lib/features/museum/services/contracts/IMuseumRoomSerializer.ts`
- Create: `src/lib/features/museum/services/implementations/MuseumRoomSerializer.ts`

- [ ] **Step 1: Write the interface**

```typescript
// services/contracts/IMuseumRoomSerializer.ts
import type { RoomNode, RoomEdge } from "../../domain/layout-types";

export interface SerializationResult {
  rooms: RoomNode[];
  edges: RoomEdge[];
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface IMuseumRoomSerializer {
  serialize(rooms: RoomNode[], edges: RoomEdge[]): string;
  deserialize(json: string): SerializationResult;
  validate(json: string): { valid: boolean; errors: ValidationError[] };
}
```

- [ ] **Step 2: Write the implementation**

`MuseumRoomSerializer.ts`:
- `serialize()`: `JSON.stringify({ version: 1, rooms, edges }, null, 2)`
- `deserialize()`: `JSON.parse()` with type assertion, basic structure validation
- `validate()`: Check required fields exist, segment types are valid, edgeIds reference valid edges, wall definitions have required properties

This is a foundation for future editor integration. Keep it simple — structural validation, not semantic validation.

Note: The spec mentions a `museum-room-schema.json` file. This is deferred — the serializer does runtime validation without a separate schema file. A JSON Schema can be generated from the TypeScript types later if VS Code autocomplete for `.json` files is needed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/museum/services/contracts/IMuseumRoomSerializer.ts \
        src/lib/features/museum/services/implementations/MuseumRoomSerializer.ts
git commit -m "feat(museum): add JSON serialization layer for room definitions"
```

---

## Task 11: Integration Verification

**Files:** None new — this is a verification task.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run tests/unit/museum/`
Expected: All tests pass.

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: Clean.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Verify zero design violations**

Start the dev server (or use the user's running instance at localhost:5173). Navigate to the museum module. Check the browser console for design violations.

Expected: `🏛️ Museum Design: All rooms pass` — zero violations.

If there ARE violations, they should only be `sightline` or `anchor` related (retained checks), NOT `wall-backed`, `entrance-clearance`, `corner-avoidance`, `spacing`, or `wall-coverage`.

- [ ] **Step 5: Verify room connectivity**

Check that all 16 rooms are reachable by walking through the museum. The layout validator already checks this at build time, but visual confirmation is valuable.

- [ ] **Step 6: Commit any fixes**

If any issues were found and fixed, commit them.

---

## Task Summary

| Task | What | Depends On |
|------|------|-----------|
| 1 | Wall segment types + pure functions | — |
| 2 | Update layout-types.ts | 1 |
| 3 | WallSegmentStamper | 1, 2 |
| 4 | Update GraphLayoutEngine | 1, 2 |
| 5 | Update CorridorRouter | 3 |
| 6 | Rewrite 16 room definitions | 2 |
| 7 | Integrate stamper into builder | 3, 4, 5, 6 |
| 8 | Simplify validator + design rules | 2, 7 |
| 9 | Update MuseumModule + delete dead code | 7, 8 |
| 10 | JSON serialization layer | 2 |
| 11 | Integration verification | 7, 8, 9 |

**Parallelizable:** Tasks 1-2 are sequential foundations. Tasks 3, 4, 5, 6, 10 can run in parallel after 1-2. Tasks 7-9 are sequential after their dependencies. Task 11 is the final gate.
