# Museum Game Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ~49 tests across 4 suites covering museum physics collision, room graph topology, game bridge commands, and resource disposal.

**Architecture:** Each suite is an independent vitest file with no shared test utilities. Tests use synthetic data (tiny grids, mock bindings) — no Three.js, no WebSocket, no browser. All run in the existing jsdom vitest environment.

**Tech Stack:** Vitest, TypeScript, existing project types/classes.

**Spec:** `docs/superpowers/specs/2026-04-04-museum-game-integration-tests-design.md`

---

### Task 1: Physics Collision — Basic Movement & Wall Blocking

**Files:**
- Create: `tests/unit/museum/MuseumPhysicsProvider.test.ts`

**Context:** `MuseumPhysicsProvider` at `src/lib/features/museum/services/implementations/MuseumPhysicsProvider.ts` takes a `MuseumGrid` (Map of `"x,y"` → `MuseumTile`), a tile size, and a spawn position. `SOLID_TYPES` (line 18) defines which tiles block movement. `STANDING_Y = 0.85`, `COLLISION_RADIUS = 0.15`. The `movePlayer` method (line 78) has 4 collision branches: full move, X-only slide, Z-only slide, fully blocked.

- [ ] **Step 1: Create test file with grid helper and first test**

```typescript
// tests/unit/museum/MuseumPhysicsProvider.test.ts
import { describe, it, expect } from "vitest";
import {
  MuseumPhysicsProvider,
  SOLID_TYPES,
} from "$lib/features/museum/services/implementations/MuseumPhysicsProvider";
import type { MuseumGrid, MuseumTile } from "$lib/features/museum/domain/museum-grid-types";

const TILE_SIZE = 0.5;
const STANDING_Y = 0.85;
const DT = 1 / 60;

/**
 * Build a MuseumGrid from coordinate/type pairs.
 * Only tiles explicitly listed exist — everything else is void (impassable).
 */
function makeTestGrid(
  tiles: [number, number, MuseumTile["type"]][]
): MuseumGrid {
  const tileMap = new Map<string, MuseumTile>();
  for (const [x, y, type] of tiles) {
    tileMap.set(`${x},${y}`, { type });
  }
  return {
    width: 10,
    height: 10,
    tileScale: 0.5,
    tiles: tileMap,
    wings: [],
    spawn: { x: 0, y: 0, facing: "north" },
    exhibits: [],
    performers: [],
    triggers: [],
    furniture: [],
  };
}

/**
 * 5x5 grid with floor ring around a center wall:
 *
 *   . . . . .
 *   . F F F .     (tile coords 1,1 through 3,3)
 *   . F W F .     W = wall at (2,2)
 *   . F F F .
 *   . . . . .
 *
 * World coords: tile (x,y) → world (x*0.5, z*0.5)
 */
function makeStandardGrid(): MuseumGrid {
  const floorTiles: [number, number, MuseumTile["type"]][] = [
    [1, 1, "floor"],
    [2, 1, "floor"],
    [3, 1, "floor"],
    [1, 2, "floor"],
    // (2,2) is the wall
    [3, 2, "floor"],
    [1, 3, "floor"],
    [2, 3, "floor"],
    [3, 3, "floor"],
  ];
  const wallTile: [number, number, MuseumTile["type"]] = [2, 2, "wall"];
  return makeTestGrid([...floorTiles, wallTile]);
}

describe("MuseumPhysicsProvider", () => {
  describe("basic movement", () => {
    it("walk into open floor changes position", () => {
      const grid = makeStandardGrid();
      // Spawn at tile (1,1) = world (0.5, 0.5)
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 0.5,
        y: 0,
        z: 0.5,
      });

      provider.movePlayer({ x: 0.1, y: 0, z: 0 }, DT);

      const pos = provider.getPlayerPosition();
      expect(pos.x).toBeCloseTo(0.6, 2);
      expect(pos.y).toBe(STANDING_Y);
    });

    it("walk into wall tile blocks movement on that axis", () => {
      const grid = makeStandardGrid();
      // Spawn at tile (1,2) = world (0.5, 1.0), wall is at tile (2,2) = world (1.0, 1.0)
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 0.5,
        y: 0,
        z: 1.0,
      });

      // Try to walk +X toward the wall
      provider.movePlayer({ x: 0.5, y: 0, z: 0 }, DT);

      const pos = provider.getPlayerPosition();
      // Should be blocked — X should not reach 1.0
      expect(pos.x).toBeLessThan(1.0);
    });

    it("walk into void (no tile) blocks movement", () => {
      const grid = makeStandardGrid();
      // Spawn at tile (1,1) = world (0.5, 0.5)
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 0.5,
        y: 0,
        z: 0.5,
      });

      // Try to walk -X into void (tile 0,1 doesn't exist)
      provider.movePlayer({ x: -0.5, y: 0, z: 0 }, DT);

      const pos = provider.getPlayerPosition();
      // Should stay roughly where we started
      expect(pos.x).toBeCloseTo(0.5, 1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/unit/museum/MuseumPhysicsProvider.test.ts --reporter=verbose`
Expected: 3 passing tests

- [ ] **Step 3: Commit**

```bash
git add tests/unit/museum/MuseumPhysicsProvider.test.ts
git commit -m "test(museum): add physics provider basic movement tests"
```

---

### Task 2: Physics Collision — Wall-Sliding

**Files:**
- Modify: `tests/unit/museum/MuseumPhysicsProvider.test.ts`

**Context:** The 4-branch collision in `movePlayer` (lines 92-104): try full XZ → try X-only → try Z-only → block both. Wall-sliding is what makes movement feel smooth instead of sticky.

- [ ] **Step 1: Add wall-slide tests**

Add inside the `MuseumPhysicsProvider` describe block:

```typescript
  describe("wall-sliding", () => {
    it("diagonal into corner: X open, Z blocked → slides along X", () => {
      const grid = makeStandardGrid();
      // Spawn at tile (1,1) = world (0.5, 0.5)
      // Wall is at tile (2,2) = world (1.0, 1.0)
      // Move diagonally toward the wall from below-left
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 0.5,
        y: 0,
        z: 0.5,
      });

      // Move diagonally: +X (open floor at 2,1) and +Z (toward wall area)
      provider.movePlayer({ x: 0.3, y: 0, z: 0.5 }, DT);

      const pos = provider.getPlayerPosition();
      // X should have moved (floor at tile 2,1 exists)
      // Z movement depends on collision — at minimum X should change
      expect(pos.x).toBeGreaterThan(0.5);
    });

    it("diagonal into corner: both blocked → position unchanged", () => {
      const grid = makeStandardGrid();
      // Spawn near the wall where both X and Z are blocked
      // Tile (3,2) = world (1.5, 1.0) — try to go +X into void AND +Z into void
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 1.5,
        y: 0,
        z: 1.0,
      });

      const before = provider.getPlayerPosition();
      // Move toward +X and +Z (both are void tiles)
      provider.movePlayer({ x: 0.5, y: 0, z: 0.5 }, DT);

      const after = provider.getPlayerPosition();
      expect(after.x).toBeCloseTo(before.x, 2);
      expect(after.z).toBeCloseTo(before.z, 2);
    });

    it("walk parallel to wall slides smoothly", () => {
      const grid = makeStandardGrid();
      // Spawn at tile (1,2) = world (0.5, 1.0), wall at (2,2)
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 0.5,
        y: 0,
        z: 1.0,
      });

      // Walk +Z (parallel to the wall, which is to the right)
      provider.movePlayer({ x: 0, y: 0, z: 0.3 }, DT);

      const pos = provider.getPlayerPosition();
      expect(pos.z).toBeGreaterThan(1.0);
      expect(pos.x).toBeCloseTo(0.5, 2); // X unchanged
    });
  });
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/museum/MuseumPhysicsProvider.test.ts --reporter=verbose`
Expected: 6 passing

- [ ] **Step 3: Commit**

```bash
git add tests/unit/museum/MuseumPhysicsProvider.test.ts
git commit -m "test(museum): add physics wall-sliding tests"
```

---

### Task 3: Physics Collision — Jumping, Teleport, Root Motion, Velocity

**Files:**
- Modify: `tests/unit/museum/MuseumPhysicsProvider.test.ts`

**Context:** Jump works via Y component of `desiredMovement` (line 108). `STANDING_Y = 0.85` is the ground clamp. `isGrounded()` returns true when Y <= STANDING_Y + 0.01 (line 147). `teleport()` sets XZ and forces Y to STANDING_Y (line 155). Root motion (line 81): when `rootMotionEnabled = true`, `movePlayer` ignores XZ but `applyRootMotion` handles XZ with collision. Velocity (lines 95, 98, 103, 135) reports actual displacement not desired.

- [ ] **Step 1: Add remaining physics tests**

Add inside the `MuseumPhysicsProvider` describe block:

```typescript
  describe("collision radius", () => {
    it("blocks movement when within COLLISION_RADIUS of wall", () => {
      const grid = makeStandardGrid();
      // Start at a position that's walkable but very close to the wall
      // Wall at tile (2,2) = world (1.0, 1.0)
      // Place player at X just left of wall, on same Z row
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 0.5,
        y: 0,
        z: 1.0,
      });

      // Try small moves toward the wall — should eventually be blocked
      // before reaching wall center due to COLLISION_RADIUS = 0.15
      for (let i = 0; i < 20; i++) {
        provider.movePlayer({ x: 0.05, y: 0, z: 0 }, DT);
      }

      const pos = provider.getPlayerPosition();
      // Should not reach or pass the wall center (1.0)
      expect(pos.x).toBeLessThan(1.0);
    });
  });

  describe("jumping", () => {
    it("jump impulse raises Y above STANDING_Y", () => {
      const grid = makeStandardGrid();
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 0.5,
        y: 0,
        z: 0.5,
      });

      provider.movePlayer({ x: 0, y: 5.0, z: 0 }, DT);

      expect(provider.getPlayerPosition().y).toBeGreaterThan(STANDING_Y);
    });

    it("airborne player is not grounded", () => {
      const grid = makeStandardGrid();
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 0.5,
        y: 0,
        z: 0.5,
      });

      provider.movePlayer({ x: 0, y: 5.0, z: 0 }, DT);

      expect(provider.isGrounded()).toBe(false);
    });

    it("Y clamps at STANDING_Y when falling below", () => {
      const grid = makeStandardGrid();
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 0.5,
        y: 0,
        z: 0.5,
      });

      provider.movePlayer({ x: 0, y: -10, z: 0 }, DT);

      expect(provider.getPlayerPosition().y).toBe(STANDING_Y);
      expect(provider.isGrounded()).toBe(true);
    });
  });

  describe("teleport", () => {
    it("sets exact XZ and forces Y to STANDING_Y", () => {
      const grid = makeStandardGrid();
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 0.5,
        y: 0,
        z: 0.5,
      });

      provider.teleport({ x: 5.0, y: 99.0, z: 10.0 });

      const pos = provider.getPlayerPosition();
      expect(pos.x).toBe(5.0);
      expect(pos.y).toBe(STANDING_Y);
      expect(pos.z).toBe(10.0);
    });
  });

  describe("root motion", () => {
    it("movePlayer ignores XZ when rootMotionEnabled", () => {
      const grid = makeStandardGrid();
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 0.5,
        y: 0,
        z: 0.5,
      });

      provider.rootMotionEnabled = true;
      provider.movePlayer({ x: 1.0, y: 0, z: 1.0 }, DT);

      const pos = provider.getPlayerPosition();
      expect(pos.x).toBeCloseTo(0.5, 2);
      expect(pos.z).toBeCloseTo(0.5, 2);
    });

    it("applyRootMotion moves XZ with collision", () => {
      const grid = makeStandardGrid();
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 0.5,
        y: 0,
        z: 0.5,
      });

      provider.rootMotionEnabled = true;
      provider.applyRootMotion({ x: 0.1, z: 0 });

      const pos = provider.getPlayerPosition();
      expect(pos.x).toBeCloseTo(0.6, 2);
    });

    it("applyRootMotion respects wall collision", () => {
      const grid = makeStandardGrid();
      // Near the wall
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 0.5,
        y: 0,
        z: 1.0,
      });

      provider.rootMotionEnabled = true;
      // Try to root-motion into the wall (+X toward tile 2,2)
      provider.applyRootMotion({ x: 1.0, z: 0 });

      const pos = provider.getPlayerPosition();
      expect(pos.x).toBeLessThan(1.0);
    });
  });

  describe("SOLID_TYPES consistency", () => {
    it("sign tiles block movement (matches SOLID_TYPES)", () => {
      // Note: museum-grid-types.ts has a misleading comment saying signs are "not solid",
      // but both SOLID_TYPES and tile-registry agree signs are solid/not-walkable.
      // The domain type comment should be fixed, but the behavior is correct.
      const grid = makeTestGrid([
        [1, 1, "floor"],
        [2, 1, "floor"],
        [3, 1, "sign"], // sign tile to the right
      ]);
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 0.5,
        y: 0,
        z: 0.5,
      });

      // Walk toward the sign
      provider.movePlayer({ x: 1.0, y: 0, z: 0 }, DT);

      const pos = provider.getPlayerPosition();
      // Should be blocked before reaching the sign tile center
      expect(pos.x).toBeLessThan(1.5);
    });
  });

  describe("velocity reporting", () => {
    it("reports zero velocity on blocked axis", () => {
      const grid = makeStandardGrid();
      // Tile (3,2) = world (1.5, 1.0), void to the right
      const provider = new MuseumPhysicsProvider(grid, TILE_SIZE, {
        x: 1.5,
        y: 0,
        z: 1.0,
      });

      // Try to move +X into void, +Z into void
      provider.movePlayer({ x: 0.5, y: 0, z: 0.5 }, DT);

      const vel = provider.getVelocity();
      expect(vel.x).toBe(0);
      expect(vel.z).toBe(0);
    });
  });
```

- [ ] **Step 2: Run all physics tests**

Run: `npx vitest run tests/unit/museum/MuseumPhysicsProvider.test.ts --reporter=verbose`
Expected: ~13 passing tests

- [ ] **Step 3: Commit**

```bash
git add tests/unit/museum/MuseumPhysicsProvider.test.ts
git commit -m "test(museum): add physics jump, teleport, root motion, velocity tests"
```

---

### Task 4: Room Graph Topology Invariants

**Files:**
- Create: `tests/unit/museum/RoomGraphInvariants.test.ts`

**Context:** `MUSEUM_ROOMS` (line 21) and `MUSEUM_EDGES` (line 990) in `src/lib/features/museum/data/museum-room-graph.ts`. `RoomNode` has `walls` with `segments[]` where door segments have `edgeId`. `RoomEdge` has `from`, `to`, `fromWall`, `toWall`, `corridorWidth`. These tests validate the data, not the grid builder output.

- [ ] **Step 1: Create topology test file with all tests**

```typescript
// tests/unit/museum/RoomGraphInvariants.test.ts
import { describe, it, expect } from "vitest";
import {
  MUSEUM_ROOMS,
  MUSEUM_EDGES,
} from "$lib/features/museum/data/museum-room-graph";
import type { RoomNode, RoomEdge } from "$lib/features/museum/domain/layout-types";

// Build lookup maps once
const roomById = new Map(MUSEUM_ROOMS.map((r) => [r.id, r]));
const edgeByKey = new Map(MUSEUM_EDGES.map((e) => [`${e.from}->${e.to}`, e]));

/** Get all door segments from a room's walls */
function getDoorSegments(room: RoomNode) {
  const doors: { wall: string; edgeId: string; width: number }[] = [];
  for (const [wallName, wallDef] of Object.entries(room.walls)) {
    for (const seg of wallDef.segments) {
      if (seg.type === "door" && seg.edgeId) {
        doors.push({ wall: wallName, edgeId: seg.edgeId, width: seg.width ?? 4 });
      }
    }
  }
  return doors;
}

/** Compatible wall pairs (rooms connect through opposing walls) */
const COMPATIBLE_WALLS: Record<string, string> = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
};

describe("RoomGraphInvariants", () => {
  describe("reference integrity", () => {
    it("every edge's 'from' room exists in MUSEUM_ROOMS", () => {
      for (const edge of MUSEUM_EDGES) {
        expect(
          roomById.has(edge.from),
          `Edge "${edge.from}->${edge.to}": room "${edge.from}" not found`,
        ).toBe(true);
      }
    });

    it("every edge's 'to' room exists in MUSEUM_ROOMS", () => {
      for (const edge of MUSEUM_EDGES) {
        expect(
          roomById.has(edge.to),
          `Edge "${edge.from}->${edge.to}": room "${edge.to}" not found`,
        ).toBe(true);
      }
    });

    it("every door segment's edgeId matches an entry in MUSEUM_EDGES", () => {
      for (const room of MUSEUM_ROOMS) {
        const doors = getDoorSegments(room);
        for (const door of doors) {
          expect(
            edgeByKey.has(door.edgeId),
            `Room "${room.id}" wall "${door.wall}": door edgeId "${door.edgeId}" has no matching edge`,
          ).toBe(true);
        }
      }
    });
  });

  describe("uniqueness", () => {
    it("no duplicate room IDs", () => {
      const ids = MUSEUM_ROOMS.map((r) => r.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it("no duplicate edge pairs", () => {
      const keys = MUSEUM_EDGES.map((e) => `${e.from}->${e.to}`);
      const unique = new Set(keys);
      expect(unique.size).toBe(keys.length);
    });
  });

  describe("structural correctness", () => {
    it("every edge has a matching door segment on fromWall of from room", () => {
      for (const edge of MUSEUM_EDGES) {
        const room = roomById.get(edge.from)!;
        const doors = getDoorSegments(room);
        const edgeKey = `${edge.from}->${edge.to}`;
        const match = doors.find(
          (d) => d.edgeId === edgeKey && d.wall === edge.fromWall,
        );
        expect(
          match,
          `Edge "${edgeKey}": no door on "${edge.fromWall}" wall of room "${edge.from}"`,
        ).toBeDefined();
      }
    });

    it("every edge has a matching door segment on toWall of to room", () => {
      for (const edge of MUSEUM_EDGES) {
        const room = roomById.get(edge.to)!;
        const doors = getDoorSegments(room);
        const edgeKey = `${edge.from}->${edge.to}`;
        const match = doors.find(
          (d) => d.edgeId === edgeKey && d.wall === edge.toWall,
        );
        expect(
          match,
          `Edge "${edgeKey}": no door on "${edge.toWall}" wall of room "${edge.to}"`,
        ).toBeDefined();
      }
    });

    it("fromWall and toWall are compatible directions", () => {
      for (const edge of MUSEUM_EDGES) {
        const expected = COMPATIBLE_WALLS[edge.fromWall];
        expect(
          edge.toWall,
          `Edge "${edge.from}->${edge.to}": fromWall "${edge.fromWall}" should pair with "${expected}" but got "${edge.toWall}"`,
        ).toBe(expected);
      }
    });

    it("every room has at least one door segment", () => {
      for (const room of MUSEUM_ROOMS) {
        const doors = getDoorSegments(room);
        expect(
          doors.length,
          `Room "${room.id}" has no door segments — it's fully sealed`,
        ).toBeGreaterThan(0);
      }
    });

    it("door width is >= edge corridorWidth", () => {
      for (const edge of MUSEUM_EDGES) {
        if (edge.corridorWidth === undefined) continue;

        const fromRoom = roomById.get(edge.from)!;
        const edgeKey = `${edge.from}->${edge.to}`;
        const doors = getDoorSegments(fromRoom);
        const door = doors.find((d) => d.edgeId === edgeKey);

        if (door) {
          expect(
            door.width,
            `Edge "${edgeKey}": door width ${door.width} < corridorWidth ${edge.corridorWidth}`,
          ).toBeGreaterThanOrEqual(edge.corridorWidth);
        }
      }
    });
  });

  describe("reachability", () => {
    it("BFS from entrance visits every room", () => {
      const adjacency = new Map<string, Set<string>>();
      for (const room of MUSEUM_ROOMS) {
        adjacency.set(room.id, new Set());
      }
      for (const edge of MUSEUM_EDGES) {
        adjacency.get(edge.from)?.add(edge.to);
        adjacency.get(edge.to)?.add(edge.from);
      }

      const visited = new Set<string>();
      const queue = ["entrance"];
      visited.add("entrance");

      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      const allRoomIds = new Set(MUSEUM_ROOMS.map((r) => r.id));
      const unreachable = [...allRoomIds].filter((id) => !visited.has(id));

      expect(
        unreachable,
        `Unreachable rooms from entrance: ${unreachable.join(", ")}`,
      ).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/museum/RoomGraphInvariants.test.ts --reporter=verbose`
Expected: 10 passing tests

- [ ] **Step 3: Commit**

```bash
git add tests/unit/museum/RoomGraphInvariants.test.ts
git commit -m "test(museum): add room graph topology invariant tests"
```

---

### Task 5: Game Bridge — State Queries & Movement

**Files:**
- Create: `tests/unit/3d/GameBridge.test.ts`

**Context:** `GameBridge` at `src/lib/shared/3d/debug/game-bridge.ts`. Constructor takes `GameBridgeBindings` (defined in `game-bridge-types.ts` lines 276-280: `physics: PhysicsBindings`, `camera: CameraBindings`, `playback: PlaybackBindings`). The private `executeMethod` (line 257) dispatches commands. We can't call it directly, so we test via the `handleRequest` path by simulating incoming messages. However, `handleRequest` is also private — the cleanest approach is to test through `getState`/`move`/etc. by constructing a bridge and triggering its WebSocket `onmessage`. Alternative: we test the individual private methods by making `executeMethod` accessible. Simplest approach: construct the bridge with mock bindings, establish a mock WebSocket connection, send a JSON request, and capture the response.

**Practical approach:** Since `GameBridge` is tightly coupled to WebSocket, and `executeMethod` is private, the most practical tests exercise the logic through the mock bindings + verifying the bridge's observable behavior. We'll create the bridge, mock the WebSocket using a minimal fake, send request messages, and assert on responses sent back.

- [ ] **Step 1: Create test file with mock factory and state query tests**

```typescript
// tests/unit/3d/GameBridge.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameBridge } from "$lib/shared/3d/debug/game-bridge";
import type {
  GameBridgeBindings,
  PhysicsBindings,
  CameraBindings,
  PlaybackBindings,
  PerformerLike,
  PerformerManager,
  BridgeRequest,
  BridgeResponse,
} from "$lib/shared/3d/debug/game-bridge-types";

// ── Mock Factories ──

function createMockPerformer(overrides: Partial<PerformerLike> = {}): PerformerLike {
  return {
    position: { x: 0, y: 0, z: 0 },
    isPlaying: false,
    hasSequence: false,
    currentStepIndex: 0,
    totalSteps: 0,
    loop: false,
    loadedSequence: null,
    play: vi.fn(),
    pause: vi.fn(),
    reset: vi.fn(),
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    goToStep: vi.fn(),
    ...overrides,
  };
}

function createMockPerformerManager(
  performers: PerformerLike[] = [],
  activeIndex = 0,
): PerformerManager {
  return {
    performers,
    activeIndex,
    selectPerformer: vi.fn((i: number) => {
      // no-op for testing
    }),
    setSpeed: vi.fn(),
  };
}

function createMockBindings(overrides?: {
  physics?: Partial<PhysicsBindings>;
  camera?: Partial<CameraBindings>;
  playback?: Partial<PlaybackBindings>;
}): GameBridgeBindings {
  return {
    physics: {
      getPlayerPosition: () => ({ x: 1, y: 0.85, z: 2 }),
      getPlayerVelocity: () => ({ x: 0, y: 0, z: 0 }),
      isGrounded: () => true,
      movePlayer: vi.fn(),
      teleportPlayer: vi.fn(),
      raycast: () => ({ hit: false }),
      ...overrides?.physics,
    },
    camera: {
      getYaw: () => 0,
      getPitch: () => 0,
      getMode: () => "first_person",
      setYaw: vi.fn(),
      setPitch: vi.fn(),
      setMode: vi.fn(),
      ...overrides?.camera,
    },
    playback: {
      getPerformerManager: () => null,
      getSpeed: () => 1,
      setSpeed: vi.fn(),
      ...overrides?.playback,
    },
  };
}

/**
 * Helper to exercise GameBridge methods.
 * Since executeMethod is private, we call handleRequest directly.
 *
 * IMPORTANT: Tests that call `move` must use vi.useFakeTimers() because
 * GameBridge.move() internally does `await new Promise(r => setTimeout(r, 16))`
 * per step. With fake timers, vi.runAllTimersAsync() flushes those sleeps.
 *
 * We use numeric literal 1 for WebSocket.OPEN readyState instead of the
 * WebSocket.OPEN constant, since jsdom may not define it in all configs.
 */
function createTestBridge(bindings: GameBridgeBindings) {
  const sentMessages: string[] = [];

  // Create bridge instance
  const bridge = new GameBridge(bindings, {
    wsUrl: "ws://test",
    debug: false,
    autoReconnect: false,
  });

  // Mock WebSocket — capture sent messages
  // readyState: 1 === WebSocket.OPEN (use literal to avoid jsdom dependency)
  const mockWs = {
    readyState: 1,
    send: vi.fn((data: string) => sentMessages.push(data)),
    close: vi.fn(),
    onopen: null as ((ev: Event) => void) | null,
    onclose: null as ((ev: CloseEvent) => void) | null,
    onmessage: null as ((ev: MessageEvent) => void) | null,
    onerror: null as ((ev: Event) => void) | null,
  };

  // Inject the mock WebSocket
  (bridge as any).ws = mockWs;
  (bridge as any).isAuthenticated = true;

  /** Send a request and return the response.
   *  For async methods like `move`, caller must use fake timers:
   *    vi.useFakeTimers();
   *    const promise = sendRequest("move", { direction: "forward", distance: 1 });
   *    await vi.runAllTimersAsync();
   *    const response = await promise;
   *    vi.useRealTimers();
   */
  async function sendRequest(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<BridgeResponse> {
    const request: BridgeRequest = {
      type: "request",
      id: `test-${Date.now()}-${Math.random()}`,
      method,
      params,
    };

    // Trigger the message handler (returns promise for async methods)
    await (bridge as any).handleRequest(request);

    // Find the response in sent messages
    const responses = sentMessages
      .map((s) => JSON.parse(s) as BridgeResponse)
      .filter((m) => m.type === "response" && m.id === request.id);

    return responses[responses.length - 1]!;
  }

  return { bridge, sendRequest, sentMessages, mockWs };
}

describe("GameBridge", () => {
  describe("state queries", () => {
    it("getState returns all required fields", async () => {
      const bindings = createMockBindings();
      const { sendRequest } = createTestBridge(bindings);

      const response = await sendRequest("getState");

      expect(response.error).toBeUndefined();
      const state = response.result as any;
      expect(state.position).toEqual({ x: 1, y: 0.85, z: 2 });
      expect(state.rotation).toHaveProperty("yaw");
      expect(state.rotation).toHaveProperty("pitch");
      expect(state.velocity).toBeDefined();
      expect(state.grounded).toBe(true);
      expect(state.cameraMode).toBe("first_person");
      expect(state.isPlaying).toBe(false);
      expect(state.hasSequence).toBe(false);
      expect(state.timestamp).toBeGreaterThan(0);
    });

    it("getState with no performer returns safe defaults", async () => {
      const bindings = createMockBindings({
        playback: { getPerformerManager: () => null },
      });
      const { sendRequest } = createTestBridge(bindings);

      const response = await sendRequest("getState");
      const state = response.result as any;

      expect(state.isPlaying).toBe(false);
      expect(state.hasSequence).toBe(false);
    });

    it("getScene filters performers by radius", async () => {
      const performer = createMockPerformer({
        position: { x: 5, y: 0, z: 0 },
      });
      const pm = createMockPerformerManager([performer]);
      const bindings = createMockBindings({
        physics: { getPlayerPosition: () => ({ x: 0, y: 0.85, z: 0 }) },
        playback: { getPerformerManager: () => pm },
      });
      const { sendRequest } = createTestBridge(bindings);

      // Radius 10 should include
      const r1 = await sendRequest("getScene", { radius: 10 });
      expect((r1.result as any).objects).toHaveLength(1);

      // Radius 3 should exclude
      const r2 = await sendRequest("getScene", { radius: 3 });
      expect((r2.result as any).objects).toHaveLength(0);
    });

    it("getScene filters by type", async () => {
      const performer = createMockPerformer({
        position: { x: 1, y: 0, z: 0 },
      });
      const pm = createMockPerformerManager([performer]);
      const bindings = createMockBindings({
        physics: { getPlayerPosition: () => ({ x: 0, y: 0.85, z: 0 }) },
        playback: { getPerformerManager: () => pm },
      });
      const { sendRequest } = createTestBridge(bindings);

      // Filter for performers — should include
      const r1 = await sendRequest("getScene", { radius: 10, types: ["performer"] });
      expect((r1.result as any).objects).toHaveLength(1);

      // Filter for props only — performer excluded
      const r2 = await sendRequest("getScene", { radius: 10, types: ["prop"] });
      expect((r2.result as any).objects).toHaveLength(0);
    });
  });

  describe("movement commands", () => {
    it("move forward with yaw=0 applies positive Z", async () => {
      vi.useFakeTimers();
      const movePlayer = vi.fn();
      const bindings = createMockBindings({
        physics: { movePlayer },
      });
      const { sendRequest } = createTestBridge(bindings);

      const promise = sendRequest("move", { direction: "forward", distance: 1 });
      await vi.runAllTimersAsync();
      await promise;

      expect(movePlayer).toHaveBeenCalled();
      const firstCall = movePlayer.mock.calls[0]!;
      const movement = firstCall[0] as { x: number; y: number; z: number };
      expect(movement.z).toBeGreaterThan(0);
      vi.useRealTimers();
    });

    it("move left applies perpendicular offset from yaw", async () => {
      vi.useFakeTimers();
      const movePlayer = vi.fn();
      const bindings = createMockBindings({
        physics: { movePlayer },
        camera: { getYaw: () => 0 }, // facing +Z
      });
      const { sendRequest } = createTestBridge(bindings);

      const promise = sendRequest("move", { direction: "left", distance: 1 });
      await vi.runAllTimersAsync();
      await promise;

      expect(movePlayer).toHaveBeenCalled();
      const firstCall = movePlayer.mock.calls[0]!;
      const movement = firstCall[0] as { x: number; z: number };
      // Left from +Z facing is -X direction: sin(0 - PI/2) = -1
      expect(movement.x).toBeLessThan(0);
      vi.useRealTimers();
    });

    it("move with sprint doubles the movement vector", async () => {
      vi.useFakeTimers();
      const movePlayer = vi.fn();
      const bindings = createMockBindings({
        physics: { movePlayer },
      });

      // Without sprint
      const { sendRequest: sendNormal } = createTestBridge(bindings);
      const p1 = sendNormal("move", { direction: "forward", distance: 1 });
      await vi.runAllTimersAsync();
      await p1;
      const normalZ = (movePlayer.mock.calls[0]![0] as { z: number }).z;

      // Reset and test with sprint
      movePlayer.mockClear();
      const { sendRequest: sendSprint } = createTestBridge(
        createMockBindings({ physics: { movePlayer } }),
      );
      const p2 = sendSprint("move", { direction: "forward", distance: 1, sprint: true });
      await vi.runAllTimersAsync();
      await p2;
      const sprintZ = (movePlayer.mock.calls[0]![0] as { z: number }).z;

      expect(Math.abs(sprintZ)).toBeCloseTo(Math.abs(normalZ) * 2, 2);
      vi.useRealTimers();
    });

    it("move with distance 3.0 breaks into 6 steps", async () => {
      vi.useFakeTimers();
      const movePlayer = vi.fn();
      const bindings = createMockBindings({
        physics: { movePlayer },
      });
      const { sendRequest } = createTestBridge(bindings);

      const promise = sendRequest("move", { direction: "forward", distance: 3 });
      await vi.runAllTimersAsync();
      await promise;

      // ceil(3 / 0.5) = 6 steps
      expect(movePlayer).toHaveBeenCalledTimes(6);
      vi.useRealTimers();
    });

    it("teleport calls teleportPlayer with exact coordinates", async () => {
      const teleportPlayer = vi.fn();
      const bindings = createMockBindings({
        physics: { teleportPlayer },
      });
      const { sendRequest } = createTestBridge(bindings);

      await sendRequest("teleport", { x: 5, y: 0, z: 10 });

      expect(teleportPlayer).toHaveBeenCalledWith({ x: 5, y: 0, z: 10 });
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/3d/GameBridge.test.ts --reporter=verbose`
Expected: 9 passing tests

- [ ] **Step 3: Commit**

```bash
git add tests/unit/3d/GameBridge.test.ts
git commit -m "test(3d): add game bridge state query and movement tests"
```

---

### Task 6: Game Bridge — Jump, Camera, Interaction, Playback, Errors, Events

**Files:**
- Modify: `tests/unit/3d/GameBridge.test.ts`

- [ ] **Step 1: Add remaining bridge tests**

Add inside the `GameBridge` describe block:

```typescript
  describe("jump", () => {
    it("jump when grounded succeeds and applies Y impulse", async () => {
      const movePlayer = vi.fn();
      const bindings = createMockBindings({
        physics: { isGrounded: () => true, movePlayer },
      });
      const { sendRequest } = createTestBridge(bindings);

      const response = await sendRequest("jump");
      const result = response.result as any;

      expect(result.success).toBe(true);
      expect(movePlayer).toHaveBeenCalledWith(
        expect.objectContaining({ y: 5.0 }),
        expect.any(Number),
      );
    });

    it("jump when airborne fails", async () => {
      const movePlayer = vi.fn();
      const bindings = createMockBindings({
        physics: { isGrounded: () => false, movePlayer },
      });
      const { sendRequest } = createTestBridge(bindings);

      const response = await sendRequest("jump");
      const result = response.result as any;

      expect(result.success).toBe(false);
      expect(movePlayer).not.toHaveBeenCalled();
    });
  });

  describe("camera", () => {
    it("look converts degrees to radians", async () => {
      const setYaw = vi.fn();
      const bindings = createMockBindings({
        camera: { setYaw, getYaw: () => Math.PI / 2 },
      });
      const { sendRequest } = createTestBridge(bindings);

      await sendRequest("look", { yaw: 90 });

      expect(setYaw).toHaveBeenCalledWith(expect.closeTo(Math.PI / 2, 4));
    });

    it("lookAt computes correct yaw to face target", async () => {
      const setYaw = vi.fn();
      const bindings = createMockBindings({
        physics: { getPlayerPosition: () => ({ x: 0, y: 0.85, z: 0 }) },
        camera: { setYaw },
      });
      const { sendRequest } = createTestBridge(bindings);

      // Target at (1, 0, 0) from origin — yaw should be atan2(1, 0) = PI/2
      await sendRequest("lookAt", { x: 1, y: 0.85, z: 0 });

      expect(setYaw).toHaveBeenCalledWith(expect.closeTo(Math.PI / 2, 4));
    });

    it("setCameraMode accepts valid mode", async () => {
      const setMode = vi.fn();
      const bindings = createMockBindings({ camera: { setMode } });
      const { sendRequest } = createTestBridge(bindings);

      const response = await sendRequest("setCameraMode", { mode: "first_person" });
      const result = response.result as any;

      expect(result.success).toBe(true);
      expect(setMode).toHaveBeenCalledWith("first_person");
    });

    it("setCameraMode rejects invalid mode", async () => {
      const setMode = vi.fn();
      const bindings = createMockBindings({ camera: { setMode } });
      const { sendRequest } = createTestBridge(bindings);

      const response = await sendRequest("setCameraMode", { mode: "invalid" });
      const result = response.result as any;

      expect(result.success).toBe(false);
      expect(setMode).not.toHaveBeenCalled();
    });
  });

  describe("interaction stubs", () => {
    it("interact returns not-implemented without crashing", async () => {
      const bindings = createMockBindings();
      const { sendRequest } = createTestBridge(bindings);

      const response = await sendRequest("interact", {});
      const result = response.result as any;

      expect(result.success).toBe(false);
      expect(result.error).toContain("Not implemented");
    });

    it("selectPerformer with valid index succeeds", async () => {
      const performer = createMockPerformer();
      const pm = createMockPerformerManager([performer]);
      const bindings = createMockBindings({
        playback: { getPerformerManager: () => pm },
      });
      const { sendRequest } = createTestBridge(bindings);

      const response = await sendRequest("selectPerformer", { index: 0 });
      const result = response.result as any;

      expect(result.success).toBe(true);
      expect(pm.selectPerformer).toHaveBeenCalledWith(0);
    });

    it("selectPerformer with out-of-bounds index fails", async () => {
      const pm = createMockPerformerManager([]);
      const bindings = createMockBindings({
        playback: { getPerformerManager: () => pm },
      });
      const { sendRequest } = createTestBridge(bindings);

      const response = await sendRequest("selectPerformer", { index: 99 });
      const result = response.result as any;

      expect(result.success).toBe(false);
    });
  });

  describe("playback", () => {
    it("play action calls performer.play()", async () => {
      const performer = createMockPerformer({ hasSequence: true });
      const pm = createMockPerformerManager([performer]);
      const bindings = createMockBindings({
        playback: { getPerformerManager: () => pm },
      });
      const { sendRequest } = createTestBridge(bindings);

      await sendRequest("playback", { action: "play" });

      expect(performer.play).toHaveBeenCalled();
    });

    it("goto action calls goToStep with index", async () => {
      const performer = createMockPerformer({ totalSteps: 10 });
      const pm = createMockPerformerManager([performer]);
      const bindings = createMockBindings({
        playback: { getPerformerManager: () => pm },
      });
      const { sendRequest } = createTestBridge(bindings);

      await sendRequest("playback", { action: "goto", step: 3 });

      expect(performer.goToStep).toHaveBeenCalledWith(3);
    });

    it("getPlaybackState with no performer returns safe defaults", async () => {
      const bindings = createMockBindings();
      const { sendRequest } = createTestBridge(bindings);

      const response = await sendRequest("getPlaybackState");
      const state = response.result as any;

      expect(state.isPlaying).toBe(false);
      expect(state.currentStep).toBe(0);
      expect(state.totalSteps).toBe(0);
    });
  });

  describe("error handling", () => {
    it("unknown method returns error", async () => {
      const bindings = createMockBindings();
      const { sendRequest } = createTestBridge(bindings);

      const response = await sendRequest("nonexistentMethod");

      expect(response.error).toContain("Unknown method");
    });
  });

  describe("tick events", () => {
    it("emits position_update when moved > 0.1m", () => {
      const bindings = createMockBindings({
        physics: {
          getPlayerPosition: () => ({ x: 1, y: 0.85, z: 2 }),
          getPlayerVelocity: () => ({ x: 1, y: 0, z: 0 }),
        },
      });
      const { bridge, mockWs } = createTestBridge(bindings);

      // First tick establishes baseline at (1, 0.85, 2)
      bridge.tick();

      // Update position to > 0.1m away (use 0.15m on X to exceed threshold)
      (bindings.physics as any).getPlayerPosition = () => ({
        x: 1.15,
        y: 0.85,
        z: 2,
      });

      bridge.tick();

      // Check that a position_update event was sent
      const events = (mockWs.send as any).mock.calls
        .map((c: string[]) => JSON.parse(c[0]))
        .filter((m: any) => m.type === "event" && m.event === "position_update");

      expect(events.length).toBeGreaterThan(0);
    });

    it("emits grounded_changed when state flips", () => {
      let grounded = true;
      const bindings = createMockBindings({
        physics: { isGrounded: () => grounded },
      });
      const { bridge, mockWs } = createTestBridge(bindings);

      bridge.tick(); // establishes baseline (grounded = true)

      grounded = false;
      bridge.tick(); // should emit grounded_changed

      const events = (mockWs.send as any).mock.calls
        .map((c: string[]) => JSON.parse(c[0]))
        .filter(
          (m: any) => m.type === "event" && m.event === "grounded_changed",
        );

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].data.grounded).toBe(false);
    });

    it("tick does nothing when disconnected", () => {
      const bindings = createMockBindings();
      const { bridge, mockWs } = createTestBridge(bindings);

      // Disconnect
      (bridge as any).isAuthenticated = false;
      (bridge as any).ws = null;

      // Should not throw
      expect(() => bridge.tick()).not.toThrow();
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run all bridge tests**

Run: `npx vitest run tests/unit/3d/GameBridge.test.ts --reporter=verbose`
Expected: ~25 passing tests (9 from Task 5 + ~16 from this task)

- [ ] **Step 3: Commit**

```bash
git add tests/unit/3d/GameBridge.test.ts
git commit -m "test(3d): add game bridge jump, camera, playback, error, event tests"
```

---

### Task 7: Resource Disposal & Serialization

**Files:**
- Create: `tests/unit/3d/ResourceDisposal.test.ts`

**Context:** Note: importing `game-bridge.ts` pulls in `import.meta.env` references, but the SvelteKit vite plugin in `vitest.config.ts` handles this via Vite's env transform. If tests fail on import with "import.meta is not defined", add `define: { 'import.meta.env': '{}' }` to vitest config — but this should work out of the box.

`GameBridge.disconnect()` sets `autoReconnect = false` (line 133), closes WebSocket, nulls it (line 138), resets auth (line 138). `destroyGameBridge()` at line 789 disconnects and nulls the singleton. `initGameBridge`/`getGameBridge`/`destroyGameBridge` manage the singleton (lines 754-797). Serialization: `serializeGrid`/`deserializeGrid` in `src/lib/features/museum/domain/museum-grid-types.ts` (lines 125-161) convert Map↔Record for JSON compat.

- [ ] **Step 1: Create disposal and serialization test file**

```typescript
// tests/unit/3d/ResourceDisposal.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GameBridge,
  initGameBridge,
  getGameBridge,
  destroyGameBridge,
} from "$lib/shared/3d/debug/game-bridge";
import type { GameBridgeBindings } from "$lib/shared/3d/debug/game-bridge-types";
import {
  serializeGrid,
  deserializeGrid,
  createEmptyGrid,
} from "$lib/features/museum/domain/museum-grid-types";
import type { MuseumGrid } from "$lib/features/museum/domain/museum-grid-types";

function createMinimalBindings(): GameBridgeBindings {
  return {
    physics: {
      getPlayerPosition: () => ({ x: 0, y: 0, z: 0 }),
      getPlayerVelocity: () => ({ x: 0, y: 0, z: 0 }),
      isGrounded: () => true,
      movePlayer: vi.fn(),
      teleportPlayer: vi.fn(),
      raycast: () => ({ hit: false }),
    },
    camera: {
      getYaw: () => 0,
      getPitch: () => 0,
      getMode: () => "first_person",
      setYaw: vi.fn(),
      setPitch: vi.fn(),
      setMode: vi.fn(),
    },
    playback: {
      getPerformerManager: () => null,
      getSpeed: () => 1,
      setSpeed: vi.fn(),
    },
  };
}

describe("GameBridge cleanup", () => {
  it("disconnect sets isConnected to false", () => {
    const bridge = new GameBridge(createMinimalBindings(), {
      autoReconnect: false,
    });

    // Manually set connected state
    (bridge as any).ws = {
      readyState: 1,
      close: vi.fn(),
      send: vi.fn(),
    };
    (bridge as any).isAuthenticated = true;

    expect(bridge.isConnected()).toBe(true);

    bridge.disconnect();

    expect(bridge.isConnected()).toBe(false);
  });

  it("disconnect prevents auto-reconnect", () => {
    const bridge = new GameBridge(createMinimalBindings(), {
      autoReconnect: true,
    });

    (bridge as any).ws = {
      readyState: 1,
      close: vi.fn(),
      send: vi.fn(),
    };
    (bridge as any).isAuthenticated = true;

    bridge.disconnect();

    // The config flag should now be false
    expect((bridge as any).config.autoReconnect).toBe(false);
  });

  it("disconnect clears auth state", () => {
    const bridge = new GameBridge(createMinimalBindings(), {
      autoReconnect: false,
    });

    (bridge as any).ws = {
      readyState: 1,
      close: vi.fn(),
      send: vi.fn(),
    };
    (bridge as any).isAuthenticated = true;

    bridge.disconnect();

    expect((bridge as any).isAuthenticated).toBe(false);
  });
});

describe("singleton lifecycle", () => {
  afterEach(() => {
    // Clean up singleton after each test
    destroyGameBridge();
  });

  it("destroyGameBridge nulls the singleton", () => {
    initGameBridge(createMinimalBindings(), { autoReconnect: false });

    expect(getGameBridge()).not.toBeNull();

    destroyGameBridge();

    expect(getGameBridge()).toBeNull();
  });

  it("destroyGameBridge cleans window global", () => {
    initGameBridge(createMinimalBindings(), { autoReconnect: false });

    expect((window as any).__gameBridge).toBeDefined();

    destroyGameBridge();

    expect((window as any).__gameBridge).toBeUndefined();
  });
});

describe("grid serialization round-trip", () => {
  it("preserves all fields through serialize/deserialize", () => {
    const grid: MuseumGrid = {
      width: 20,
      height: 30,
      tileScale: 0.5,
      tiles: new Map([
        ["0,0", { type: "floor", material: "marble" }],
        ["1,0", { type: "wall" }],
        ["2,0", { type: "door" }],
      ]),
      wings: [
        {
          id: "test-wing",
          name: "Test Wing",
          bounds: { x: 0, y: 0, width: 10, height: 10 },
          theme: "cave",
        },
      ],
      spawn: { x: 5, y: 5, facing: "north" },
      exhibits: [
        {
          id: "exhibit-1",
          tileX: 3,
          tileY: 4,
          plaque: { title: "Test", body: "Content" },
        },
      ],
      performers: [
        {
          id: "perf-1",
          tileX: 6,
          tileY: 7,
          facing: "south",
          autoPlay: true,
        },
      ],
      triggers: [
        {
          id: "trigger-1",
          tileX: 8,
          tileY: 9,
          action: "show-lore",
          content: { body: "Lore text" },
        },
      ],
      furniture: [
        {
          id: "bench-1",
          role: "bench",
          tileX: 2,
          tileY: 3,
          rotationY: 0,
        },
      ],
    };

    const roundTripped = deserializeGrid(serializeGrid(grid));

    expect(roundTripped.width).toBe(grid.width);
    expect(roundTripped.height).toBe(grid.height);
    expect(roundTripped.tileScale).toBe(grid.tileScale);
    expect(roundTripped.tiles.size).toBe(grid.tiles.size);
    expect(roundTripped.spawn).toEqual(grid.spawn);
    expect(roundTripped.wings).toEqual(grid.wings);
    expect(roundTripped.exhibits).toEqual(grid.exhibits);
    expect(roundTripped.performers).toEqual(grid.performers);
    expect(roundTripped.triggers).toEqual(grid.triggers);
    expect(roundTripped.furniture).toEqual(grid.furniture);
  });

  it("preserves tile types and materials", () => {
    const grid: MuseumGrid = createEmptyGrid(5, 5);
    grid.tiles.set("0,0", { type: "floor", material: "marble" });
    grid.tiles.set("1,0", { type: "wall" });

    const roundTripped = deserializeGrid(serializeGrid(grid));

    expect(roundTripped.tiles.get("0,0")).toEqual({
      type: "floor",
      material: "marble",
    });
    expect(roundTripped.tiles.get("1,0")).toEqual({ type: "wall" });
  });

  it("empty grid round-trips cleanly", () => {
    const grid = createEmptyGrid(5, 5);
    const roundTripped = deserializeGrid(serializeGrid(grid));

    expect(roundTripped.tiles.size).toBe(0);
    expect(roundTripped.width).toBe(5);
    expect(roundTripped.height).toBe(5);
    expect(roundTripped.exhibits).toEqual([]);
    expect(roundTripped.performers).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/3d/ResourceDisposal.test.ts --reporter=verbose`
Expected: 8 passing tests

- [ ] **Step 3: Commit**

```bash
git add tests/unit/3d/ResourceDisposal.test.ts
git commit -m "test(3d): add resource disposal and grid serialization tests"
```

---

### Task 8: Final Verification

**Files:** None (read-only verification)

- [ ] **Step 1: Run all tests to verify nothing regressed**

Run: `npx vitest run --reporter=verbose`
Expected: All existing tests still pass + 4 new test files pass (~49 new tests)

- [ ] **Step 2: Verify test count increased**

The baseline is 1246 passing tests. After this plan, expect ~1300 passing (1246 + ~54 new tests).

- [ ] **Step 3: Commit all together if any files were missed**

Only if needed — each task already commits.
