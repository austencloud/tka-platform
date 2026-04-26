---
status: backlog
value: 2
effort: S
score: 8
remaining: "Suites 2-4: RoomGraph, GameBridge, ResourceDisposal"
last_triaged: 2026-04-26
---
# Museum Game Integration Tests

**Date:** 2026-04-04
**Status:** Approved
**Scope:** 4 test suites covering physics, topology, game bridge, and resource disposal

---

## Context

The museum game has 18 test files covering layout engines, grid connectivity, wall stamping, IK math, and room geometry. These are solid unit tests on deterministic systems.

What's missing: tests that exercise the *game mechanics* layer — the physics provider that handles collision/sliding, the room graph data integrity, the game bridge command dispatch, and resource cleanup. These are all layout-independent and testable today without waiting for room designs to stabilize.

## Design Principles

1. **Zero external dependencies.** No Three.js, no WebSocket, no browser, no renderer. Pure class instantiation with synthetic data or mocks.
2. **Layout-independent.** Every test uses a synthetic grid or mock bindings. Room rearrangements don't break tests.
3. **Silent bug focus.** Every test catches something that would produce wrong behavior without anyone noticing immediately.
4. **Follow existing patterns.** Use vitest, same describe/it structure as `RoomValidator.test.ts` and `MuseumGridConnectivity.test.ts`.

---

## Suite 1: Physics Collision (`tests/unit/museum/MuseumPhysicsProvider.test.ts`)

### What We're Testing

`MuseumPhysicsProvider` — grid-based collision with wall-sliding, jumping, teleport, and root motion. Pure class, no Three.js.

### Test Fixture

A 5x5 tile grid with a wall in the center:

```
. . . . .
. F F F .      F = floor, W = wall (solid)
. F W F .      . = void (no tile entry = impassable)
. F F F .
. . . . .
```

Tile size: 0.5 (so world space is 2.5m x 2.5m). Spawn at center-left floor tile.

Helper function `makeTestGrid(tiles: [number, number, TileType][])` creates a `MuseumGrid` with the given tiles.

### Tests

#### Basic Movement
- **Walk into open floor** — `movePlayer({x: 0.1, y: 0, z: 0}, 1/60)` on open tile changes `getPlayerPosition().x`
- **Walk into wall tile** — move toward the center wall, position unchanged on blocked axis
- **Walk into void** — move toward edge (no tile), position unchanged

#### Wall-Sliding (4-Branch Collision)
- **Diagonal into corner, X open, Z blocked** — position.x changes, position.z unchanged
- **Diagonal into corner, Z open, X blocked** — position.z changes, position.x unchanged
- **Diagonal into corner, both blocked** — position unchanged entirely
- **Walk along wall** — move parallel to wall surface, slides smoothly

#### Collision Radius
- **Position 0.14 units from wall is blocked** — the disc check (COLLISION_RADIUS = 0.15) catches it, not just the center point

#### Jumping
- **Jump impulse raises Y above STANDING_Y** — `movePlayer({x:0, y:5.0, z:0}, dt)` → Y > 0.85 (5.0 matches the real bridge jump impulse)
- **Airborne → `isGrounded()` returns false**
- **Y clamps at STANDING_Y** — `movePlayer({x:0, y:-10, z:0}, dt)` → Y = 0.85, `isGrounded()` = true

#### Teleport
- **Teleport sets exact XZ, forces Y to STANDING_Y** — ignores collision grid entirely

#### Root Motion
- **`rootMotionEnabled = true` → `movePlayer` ignores XZ** — only Y changes
- **`applyRootMotion` moves XZ with collision** — wall-slide logic still applies
- **Root motion velocity reflects actual displacement** — not the requested delta

#### SOLID_TYPES Consistency
- **`"sign"` is in SOLID_TYPES but domain comment says "not solid"** — test that signs block movement (current behavior), and add a code comment noting the discrepancy for future resolution

#### Velocity Reporting
- **`getVelocity()` after blocked move has zero on blocked axis** — reports actual, not desired

---

## Suite 2: Room Graph Topology (`tests/unit/museum/RoomGraphInvariants.test.ts`)

### What We're Testing

Data integrity of `MUSEUM_ROOMS` and `MUSEUM_EDGES`. No grid building — just validating the input graph.

### Tests

#### Reference Integrity
- **Every edge's `from` room exists in MUSEUM_ROOMS**
- **Every edge's `to` room exists in MUSEUM_ROOMS**
- **Every door segment's `edgeId` matches an entry in MUSEUM_EDGES**

#### Uniqueness
- **No duplicate room IDs**
- **No duplicate edge pairs** (same from->to)

#### Structural Correctness
- **Every edge has a matching door segment on `fromWall` of `from` room**
- **Every edge has a matching door segment on `toWall` of `to` room**
- **`fromWall` and `toWall` are compatible** (north-south or east-west, not north-north)
- **Every room has at least one door segment** (not fully sealed)
- **Door width >= edge's corridorWidth** (door isn't narrower than corridor)

#### Reachability
- **BFS from "entrance" over edges visits every room** — graph-level reachability, cheaper than full grid build

---

## Suite 3: Game Bridge Commands (`tests/unit/3d/GameBridge.test.ts`)

### What We're Testing

`GameBridge.executeMethod()` dispatch — command routing, parameter handling, math, null safety. Uses mock bindings instead of real physics/camera/playback.

### Mock Bindings Factory

```typescript
function createMockBindings(overrides?: Partial<GameBridgeBindings>): GameBridgeBindings {
  return {
    physics: {
      getPlayerPosition: () => ({ x: 0, y: 0.85, z: 0 }),
      getPlayerVelocity: () => ({ x: 0, y: 0, z: 0 }),
      isGrounded: () => true,
      movePlayer: vi.fn(),
      teleportPlayer: vi.fn(),
      raycast: () => ({ hit: false, distance: 100 }),
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
```

### Tests

#### State Queries
- **`getState` returns all required fields** — position, rotation, velocity, grounded, cameraMode, isPlaying, hasSequence, timestamp
- **`getState` with no performer** — `isPlaying: false`, `hasSequence: false` (null safety)
- **`getScene` filters by radius** — performer at distance 5 included with radius 10, excluded with radius 3
- **`getScene` filters by type** — `types: ["performer"]` includes performers, excludes other types

#### Movement Commands
- **`move("forward")` calls `movePlayer` with positive Z** (when yaw = 0, forward = +Z)
- **`move("left")` applies perpendicular offset** — sin(yaw - PI/2)
- **`move` with `sprint: true`** — movement vector doubled
- **`move` with distance 3.0** — breaks into 6 steps (ceil(3/0.5))
- **`teleport(5, 0, 10)`** — calls `teleportPlayer` with exact coordinates

#### Jump
- **Jump when grounded** — `{ success: true }`, `movePlayer` called with Y impulse
- **Jump when airborne** — `{ success: false }`, `movePlayer` not called

#### Camera
- **`look(yaw: 90)` converts to radians** — `setYaw` called with PI/2
- **`lookAt` computes correct yaw to face target** — player at origin, target at (1, 0, 0) → yaw = atan2(1, 0)
- **`setCameraMode("first_person")` → success**
- **`setCameraMode("invalid")` → `{ success: false }`, mode unchanged**

#### Interaction (Stubs)
- **`interact` returns not-implemented error without crashing**
- **`selectPerformer(0)` with valid performer → success**
- **`selectPerformer(99)` out of bounds → failure**

#### Playback
- **`playback("play")` calls `performer.play()`**
- **`playback("goto", step: 3)` calls `goToStep(3)`**
- **`getPlaybackState` with no performer → safe defaults** (0 steps, not playing)

#### Error Handling
- **Unknown method → structured error message**

#### Event Emission (tick)
- **`tick()` emits `position_update` when moved > 0.1m** — threshold is `distSq > 0.01` (strictly greater), so exactly 0.1m on one axis does NOT emit. Test with 0.11m.
- **`tick()` emits `grounded_changed` when state flips**
- **`tick()` does nothing when disconnected**

---

## Suite 4: Resource Disposal (`tests/unit/3d/ResourceDisposal.test.ts`)

### What We're Testing

Cleanup completeness — connections, singletons, and data integrity through serialize/deserialize cycles.

### Tests

#### GameBridge Cleanup
- **`disconnect()` sets `isConnected()` to false**
- **`disconnect()` prevents auto-reconnect** — after disconnect, a WebSocket close event does not trigger reconnection (externally observable: `isConnected()` stays false)
- **`disconnect()` clears auth state** — `isAuthenticated` reset

#### Singleton Lifecycle
- **`destroyGameBridge()` nulls the singleton** — `getGameBridge()` returns null after destroy
- **`destroyGameBridge()` cleans window global** — `window.__gameBridge` is undefined (requires `environment: 'jsdom'` in vitest config for this test file, or skip with a `typeof window` guard)

#### Data Round-Trip (Serialization)
- **`deserializeGrid(serializeGrid(grid))` preserves all fields** — tile count, spawn, exhibits, performers, triggers, furniture
- **Round-trip preserves tile types and materials** — spot-check specific tiles
- **Empty grid round-trips cleanly** — edge case with zero tiles

### Future Expansion (When Room Transitions Land)

These tests are documented but not implemented yet. Add them when the room loading/unloading system exists:

- After room unload, geometry count returns to pre-load baseline
- After room unload, material count returns to baseline
- After 10 load/unload cycles, counts are stable (no accumulation)

Implementation approach: a `DisposalTracker` that wraps Three.js constructors and counts create/dispose pairs.

---

## File Structure

```
tests/unit/
  museum/
    MuseumPhysicsProvider.test.ts    # Suite 1: ~13 tests
    RoomGraphInvariants.test.ts      # Suite 2: ~10 tests
  3d/
    GameBridge.test.ts               # Suite 3: ~21 tests
    ResourceDisposal.test.ts         # Suite 4: ~5 tests (+3 future)
```

## Test Helpers

Shared helpers in each test file (not extracted to a shared utility — these are test-specific):

- `makeTestGrid(tiles)` — creates a MuseumGrid from coordinate/type pairs
- `createMockBindings(overrides)` — creates mock GameBridgeBindings
- `makeStandardGrid()` — the 5x5 room fixture for physics tests

## What This Does NOT Test

- Layout-specific paths ("walk from entrance to vulcan cave") — wait for layout to stabilize
- Visual rendering — use eyes or screenshots
- Real WebSocket protocol — the bridge is tested via method dispatch, not network
- Three.js disposal internals — future work with DisposalTracker
