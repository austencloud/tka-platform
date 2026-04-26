# Indoor Scene Architecture Design

**Date:** 2026-03-28
**Status:** Draft
**Scope:** New IndoorScene component, RoomGeometryBuilder, Archive migration

---

## Problem

The Archive destination bypasses all existing 3D infrastructure. It uses a hand-rolled FPS camera and box primitives with zero collision detection. Meanwhile, the platform has production-ready Rapier physics, a unified camera controller, terrain colliders, and interaction detection — none of which the Archive uses.

The Archive is planned as 5-8 wings (indoor rooms). Each wing built the current way means copy-pasting physics setup, manually placing geometry at float coordinates that don't align, and no collision. This doesn't scale.

## Solution

Three new pieces:

1. **IndoorScene** — A lightweight Threlte scene component for enclosed rooms. Has Rapier physics, player controller, and UnifiedCameraController. No terrain, vegetation, biomes, or atmosphere.

2. **RoomGeometryBuilder** — Takes a semantic room description and outputs grid-snapped geometry + matching Rapier colliders. Walls always meet at corners. Objects snap to valid positions.

3. **Room Description Format** — Declarative data format for defining rooms. Semantic ("pedestal centered on north wall") not coordinate-based. Supports multi-room connections for future wing-to-wing navigation.

## Architecture

### System Overview

```
RoomDefinition (semantic data)
    ↓
RoomGeometryBuilder (deterministic placement on 0.5m grid)
    ↓
SolvedRoom { walls, floor, ceiling, objects, colliders, spawnPoint }
    ↓
IndoorScene (renders meshes + creates Rapier colliders + player controller)
    ↓
Wing Component (adds exhibits, lighting, interactions)
```

### Future Extension Point

When multiple wings need spatial coordination (doorways aligning, corridor routing), a **RoomLayoutSolver** slots in above the builder:

```
WingDefinition[] (all wings)
    ↓
RoomLayoutSolver (constraint satisfaction — positions wings relative to each other)
    ↓
RoomDefinition[] (each wing with absolute position + connection points)
    ↓
RoomGeometryBuilder (per wing)
    ↓
IndoorScene
```

The builder becomes a subroutine the solver calls per-room. The room description format supports this from day one via the `connections` field.

---

## Component 1: Room Description Format

### Types

```typescript
// src/lib/shared/3d/indoor/domain/room-types.ts

type WallId = "north" | "south" | "east" | "west";

interface RoomDefinition {
  id: string;
  name: string;
  shape: "rectangular"; // future: "L-shaped", "circular"

  // Dimensions in meters
  width: number;   // east-west
  depth: number;   // north-south
  height: number;  // floor to ceiling

  walls: {
    thickness: number; // default 0.5m (1 grid cell)
    material: WallMaterialId;
  };

  entrance: EntranceDefinition;
  connections?: ConnectionDefinition[]; // future wing-to-wing doors

  objects: RoomObjectDefinition[];
  lighting: RoomLightDefinition[];

  spawn: {
    wall: WallId;        // which wall the player starts near
    distance: number;    // meters from that wall
    facing: WallId;      // direction player looks at start
  };
}

interface EntranceDefinition {
  wall: WallId;
  width: number;     // meters
  height: number;    // meters
  offset: "center" | number; // center or meters from wall start
  corridor?: {
    depth: number;   // how far the corridor extends from the room
    height: number;  // corridor ceiling height (may differ from room)
    width?: number;  // defaults to entrance width if omitted
  };
}

interface ConnectionDefinition {
  toWingId: string;
  wall: WallId;
  width: number;
  height: number;
  offset: "center" | number;
}

interface RoomObjectDefinition {
  id: string;
  type: RoomObjectType; // "pedestal", "torch-mount", "bench", "pillar", etc.
  placement: ObjectPlacement;
}

type ObjectPlacement =
  | { anchor: "wall"; wall: WallId; position: "center" | number; distance: number; height?: number }
  | { anchor: "center"; offsetX?: number; offsetZ?: number; height?: number }
  | { anchor: "corner"; walls: [WallId, WallId]; distance: number; height?: number };

type RoomObjectType =
  | "pedestal"
  | "torch-mount"
  | "bench"
  | "pillar"
  | "display-case"
  | "alcove";

type RoomLightDefinition =
  | { type: "torch"; targetObjectId: string; intensity?: number }
  | { type: "spotlight"; target: string; angle: number; intensity?: number; color?: string }
  | { type: "ambient"; color: string; intensity: number }
  | { type: "hemisphere"; color: string; intensity: number };

type WallMaterialId = "stone" | "marble" | "wood" | "metal" | "sandstone";
```

### Example: Discovery Chamber (Wing 1)

```typescript
const DISCOVERY_CHAMBER: RoomDefinition = {
  id: "wing-1-discovery",
  name: "Discovery Chamber",
  shape: "rectangular",
  width: 10,
  depth: 12,
  height: 4.5,
  walls: { thickness: 0.5, material: "stone" },
  entrance: {
    wall: "south", width: 3, height: 3.2, offset: "center",
    corridor: { depth: 4, height: 3.2, width: 2.8 },
  },
  connections: [], // Wing 1 has no connections yet
  objects: [
    {
      id: "tablet-pedestal",
      type: "pedestal",
      placement: { anchor: "wall", wall: "north", position: "center", distance: 1.5 },
    },
    {
      id: "torch-e1",
      type: "torch-mount",
      placement: { anchor: "wall", wall: "east", position: 0.3, distance: 0, height: 2.5 },
    },
    {
      id: "torch-e2",
      type: "torch-mount",
      placement: { anchor: "wall", wall: "east", position: 0.7, distance: 0, height: 2.5 },
    },
    {
      id: "torch-w1",
      type: "torch-mount",
      placement: { anchor: "wall", wall: "west", position: 0.3, distance: 0, height: 2.5 },
    },
    {
      id: "torch-w2",
      type: "torch-mount",
      placement: { anchor: "wall", wall: "west", position: 0.7, distance: 0, height: 2.5 },
    },
  ],
  lighting: [
    { type: "ambient", color: "#2a1808", intensity: 0.4 },
    { type: "hemisphere", color: "#1a1008", intensity: 0.25 },
    { type: "spotlight", target: "tablet-pedestal", angle: 30, intensity: 3 },
  ],
  spawn: { wall: "south", distance: 2, facing: "north" },
};
```

### Design Decisions

- **Wall positions use normalized 0-1 range** (e.g., `position: 0.3` = 30% along the wall). This decouples object placement from room dimensions — change the room size and objects redistribute proportionally.
- **`connections` field is forward-compatible.** Today it's empty. When Wing 2 exists, Wing 1 gets `{ toWingId: "wing-2", wall: "north", width: 2.5, height: 3, offset: "center" }` and the builder carves the opening.
- **Object IDs enable cross-referencing.** Lighting can target objects by ID. Interaction zones can reference objects by ID. This avoids coordinate coupling.

---

## Component 2: RoomGeometryBuilder

### Location

```
src/lib/shared/3d/indoor/
  domain/
    room-types.ts           — Types above
  services/
    contracts/
      IRoomGeometryBuilder.ts
    implementations/
      RoomGeometryBuilder.ts
```

### Interface

```typescript
interface IRoomGeometryBuilder {
  build(definition: RoomDefinition): SolvedRoom;
}

interface SolvedRoom {
  // Visual geometry (for rendering)
  walls: SolvedWallSegment[];
  floor: SolvedSurface;
  ceiling: SolvedSurface;
  entrance: SolvedEntrance;
  objects: SolvedObject[];

  // Convenience lookup (O(1) by ID instead of array search)
  objectsById: Map<string, SolvedObject>;

  // Physics geometry (for Rapier colliders — uses existing ColliderConfig convention)
  colliders: ColliderDefinition[];

  // Player
  spawnPoint: { x: number; y: number; z: number };
  spawnFacing: number; // yaw in radians

  // World-space offset (rooms can be placed above world origin)
  worldOffset: { x: number; y: number; z: number }; // default (0, 0, 0)

  // Metadata
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  gridCellSize: number; // 0.5m
}

interface SolvedWallSegment {
  position: [number, number, number]; // center
  size: [number, number, number];     // width, height, depth
  rotationY: number;
  materialId: WallMaterialId;
}

interface SolvedSurface {
  position: [number, number, number];
  size: [number, number, number];
  materialId: WallMaterialId;
}

interface SolvedEntrance {
  // Wall sections around the entrance opening
  segments: SolvedWallSegment[];
  // The opening itself (for door frames, trigger zones, lighting)
  opening: {
    position: [number, number, number]; // center of opening
    size: [number, number];             // width, height
    facing: number;                     // outward normal as yaw radians
  };
  // Corridor geometry (if entrance has a corridor)
  corridor?: {
    walls: SolvedWallSegment[];
    floor: SolvedSurface;
    ceiling: SolvedSurface;
  };
}

interface SolvedObject {
  id: string;
  type: RoomObjectType;
  position: [number, number, number];
  rotationY: number;
}

interface ColliderDefinition {
  shape: "box";
  position: [number, number, number]; // center
  size: [number, number, number];     // full extents (matches existing ColliderConfig convention)
}
```

### Grid Snapping

All output coordinates are snapped to the 0.5m grid:

```typescript
const GRID_CELL = 0.5; // meters

function snap(value: number): number {
  return Math.round(value / GRID_CELL) * GRID_CELL;
}
```

Wall endpoints, object positions, entrance boundaries — everything snaps. This guarantees:
- Walls meet at corners (both endpoints on grid)
- Colliders align with visual geometry (same snapped coordinates)
- No sub-pixel gaps between surfaces

### Wall Generation Algorithm

For a rectangular room (width W, depth D, height H, wall thickness T):

1. Compute inner bounds: `minX = 0`, `maxX = W`, `minZ = 0`, `maxZ = D`
2. Generate 4 wall segments (north, south, east, west) as boxes
3. For each entrance/connection, split the wall into sub-segments around the opening
4. Snap all coordinates to grid
5. Generate matching collider for each wall segment (same position, same size)
6. Floor collider: thin box at y=0 spanning full room
7. Ceiling collider: thin box at y=H spanning full room

Corner handling: walls overlap at corners by wall thickness. The north and south walls span the full room width including corners. The east and west walls fit between them. This ensures no gap at any corner.

### Object Placement Algorithm

For each object in the definition:

1. Resolve wall anchor to world coordinates:
   - `wall: "north"` → z = wallThickness (inner face of north wall)
   - `position: 0.3` → x = roomWidth * 0.3
   - `distance: 1.5` → offset 1.5m perpendicular from wall into room
2. Snap to grid
3. Compute facing direction (perpendicular to anchor wall, toward room center)
4. No overlap check needed for Phase 1 (objects are sparse). Phase 2 adds validation.

---

## Component 3: IndoorScene

### Location

```
src/lib/shared/3d/indoor/
  IndoorScene.svelte
```

### What It Reuses (Existing Infrastructure)

| System | File | How Used |
|--------|------|----------|
| Rapier world | `shared/3d/physics/rapier-world.ts` | Physics simulation |
| Player controller | `shared/3d/physics/player-controller.ts` | Capsule, ground detect, collision |
| Physics provider | `shared/3d/physics/RapierPhysicsProvider.ts` | Bridge to camera controller |
| Camera controller | `shared/3d/camera/services/implementations/CameraMovementController.ts` | First-person movement |
| Input providers | `shared/3d/input/providers/` | Keyboard, pointer lock, touch |
| GalleryCanvas | `realm/destinations/gallery/components/GalleryCanvas.svelte` | WebGPU-capable canvas |

### What It Creates New

- Static Rapier colliders from `SolvedRoom.colliders`
- Mesh rendering from `SolvedRoom.walls/floor/ceiling`
- Material lookup from `WallMaterialId`
- Spawn point initialization

### Prerequisites (Changes to Existing Code)

**CameraMovementController needs a `setYaw(radians)` method.** Currently `yaw` is private with no setter — the only way to change it is through `update()` with look input deltas. IndoorScene needs to set the initial facing direction from `room.spawnFacing`. Add `setYaw(yaw: number)` and `setPitch(pitch: number)` to `ICameraMovementController` and the implementation.

### Interaction Detection

Each wing component owns its own interaction detection (proximity checks, E-key handling). IndoorScene does not provide a built-in interaction system. Wings can use the existing `InteractionDetector` pattern from the museum destination, or simple distance checks as the current DiscoveryChamber does. A shared indoor interaction system is a Phase 3 concern.

### Props

```typescript
interface IndoorSceneProps {
  room: SolvedRoom;
  eyeHeight?: number;    // default 1.7
  moveSpeed?: number;    // default 2.5
  gravity?: number;      // default -9.81 (standard gravity; WorldScene uses -20 for snappier outdoor feel)
  children: Snippet;     // destination content (exhibits, custom lighting, interactions)
}
```

### Lifecycle

```
onMount:
  1. GalleryCanvas initializes (WebGPU detection)
  2. Rapier WASM loads → create physics world
  3. Create static colliders from room.colliders (fixed rigid bodies)
  4. Create player controller (capsule at room.spawnPoint)
  5. Create RapierPhysicsProvider wrapping player controller
  6. Initialize CameraMovementController in FIRST_PERSON mode
  7. Set initial camera yaw from room.spawnFacing
  8. Start frame loop: physics step → movement → render

per frame (useTask):
  1. Read keyboard/mouse input
  2. physicsWorld.step()
  3. cameraController.update(delta, input)
  4. Sync camera position from physics provider

onDestroy:
  1. Dispose Rapier world
  2. Remove event listeners
  3. Exit pointer lock
```

### Rendering

Each `SolvedWallSegment` renders as a `T.Mesh` with `T.BoxGeometry`:

```svelte
{#each room.walls as wall}
  <T.Mesh position={wall.position} rotation.y={wall.rotationY}>
    <T.BoxGeometry args={wall.size} />
    <T.MeshStandardMaterial
      color={getMaterialColor(wall.materialId)}
      roughness={getMaterialRoughness(wall.materialId)}
      metalness={getMaterialMetalness(wall.materialId)}
      side={THREE.DoubleSide}
    />
  </T.Mesh>
{/each}
```

Material properties are looked up from a material registry. Phase 1 uses solid colors matching the current Discovery Chamber aesthetic. Phase 2 can add PBR textures.

### Collider Creation

Uses the existing `createRigidBody()` helper from `rapier-world.ts` which accepts `RigidBodyConfig` + `ColliderConfig` and handles half-extent conversion internally:

```typescript
import { createRigidBody } from "$lib/shared/3d/physics/rapier-world";

for (const collider of room.colliders) {
  createRigidBody(physicsState, {
    bodyConfig: {
      type: "fixed",
      position: { x: collider.position[0], y: collider.position[1], z: collider.position[2] },
    },
    colliderConfig: {
      shape: "box",
      size: collider.size, // full extents — helper divides by 2 for Rapier
      friction: 0.8,
      restitution: 0.0,
    },
  });
}
```

---

## Component 4: Validation

### Automated Checks (Run After Build)

```typescript
interface IRoomValidator {
  validate(definition: RoomDefinition, solved: SolvedRoom): ValidationResult;
}

interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
}

interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
  location?: [number, number, number];
}
```

### Checks Performed

| Check | Severity | Description |
|-------|----------|-------------|
| Wall closure | error | All wall endpoints connect (no gaps at corners) |
| Floor coverage | error | Floor spans full room bounds |
| Ceiling coverage | error | Ceiling spans full room bounds |
| Collider-visual match | error | Every visual wall has a matching collider |
| Spawn inside room | error | Spawn point is within room bounds and not inside a wall |
| Entrance walkable | error | Entrance opening has no collider blocking it |
| Object inside room | warning | All objects placed within room bounds |
| Object not overlapping | warning | No two objects occupy the same grid cells |

### Physics Validation (Phase 2)

Spawn a test capsule and walk it along each wall via Rapier simulation. If it passes through, the collider is wrong. This catches edge cases the geometric checks miss.

---

## Component 5: Archive Migration

### What Changes

| Current | New |
|---------|-----|
| `FirstPersonCamera.svelte` (hand-rolled) | Removed — IndoorScene uses UnifiedCameraController |
| `chamber-geometry.ts` (coordinate arrays) | Replaced by `RoomDefinition` data |
| `DiscoveryChamber.svelte` (box loops) | Simplified — IndoorScene renders the room |
| `ArchiveDestination.svelte` (GalleryCanvas wrapper) | Uses `<IndoorScene>` instead |
| No collision | Full Rapier collision from grid-snapped colliders |

### What Stays

| Component | Why |
|-----------|-----|
| `TabletExhibit.svelte` | Exhibit content is wing-specific |
| `TorchLight.svelte` | Lighting is wing-specific |
| `PlaqueOverlay.svelte` | Interaction UI is wing-specific |
| `archive-state.svelte.ts` | State management is wing-specific |
| `lascaux-plaque.ts` | Lore content is wing-specific |

### New ArchiveDestination Structure

```svelte
<IndoorScene room={solvedRoom} eyeHeight={1.7} moveSpeed={2.5}>
  <!-- Wing-specific content -->
  <TabletExhibit position={solvedRoom.objectsById.get('tablet-pedestal')?.position} />

  {#each torchObjects as torch}
    <TorchLight position={torch.position} />
  {/each}

  <!-- Wing-specific lighting -->
  <T.SpotLight ... />
</IndoorScene>

<!-- HTML overlays (outside 3D scene) -->
{#if archiveState.isOverlayOpen}
  <PlaqueOverlay ... />
{/if}
```

---

## File Structure

```
src/lib/shared/3d/indoor/
  IndoorScene.svelte                          — Main component
  domain/
    room-types.ts                             — RoomDefinition, SolvedRoom, etc.
    material-registry.ts                      — WallMaterialId → color/roughness/metalness
  services/
    contracts/
      IRoomGeometryBuilder.ts
      IRoomValidator.ts
    implementations/
      RoomGeometryBuilder.ts                  — Semantic → grid-snapped geometry
      RoomValidator.ts                        — Automated room checks

src/lib/features/realm/destinations/archive/
  ArchiveDestination.svelte                   — Migrated to use IndoorScene
  domain/
    wing-definitions.ts                       — RoomDefinition for each wing
    chamber-geometry.ts                       — DELETED (replaced by wing-definitions)
    lascaux-plaque.ts                         — Unchanged
    archive-types.ts                          — Unchanged
  components/
    FirstPersonCamera.svelte                  — DELETED (replaced by IndoorScene)
    DiscoveryChamber.svelte                   — Simplified (only wing-specific exhibits)
    TabletExhibit.svelte                      — Unchanged
    TorchLight.svelte                         — Unchanged
    PlaqueOverlay.svelte                      — Unchanged
  state/
    archive-state.svelte.ts                   — Unchanged
```

---

## Phased Implementation

### Phase 1: Core (This Spec)

- RoomDefinition types
- RoomGeometryBuilder (rectangular rooms, single entrance, wall/center/corner anchored objects)
- IndoorScene component (Rapier physics, player controller, camera, mesh rendering)
- RoomValidator (geometric checks)
- Archive Wing 1 migration
- Material registry (solid colors matching current aesthetic)

### Phase 2: Visual Quality (Future)

- PBR textures and normal maps for wall materials
- GLB model substitution for objects (torch models, detailed pedestals)
- Baked ambient occlusion at wall-floor junctions
- Volumetric torch light (if WebGPU available)

### Phase 3: Multi-Wing (Future)

- RoomLayoutSolver (constraint satisfaction for wing positioning)
- Connection rendering (doorways, corridors between wings)
- Wing-to-wing navigation (walk through doorway → load next wing)
- Transition effects (lighting fade, loading states)
- Shared wall handling: adjacent rooms sharing a wall must avoid double-thickness geometry (solver deduplicates shared wall segments)
- Shared indoor interaction system (proximity + angle detection, extracted from per-wing logic)

### Phase 4: Editor (Future)

- In-scene object placement (drag to move)
- Room dimension editing
- Material picker
- Save/load room definitions to/from Firestore

---

## Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `@dimforge/rapier3d-compat` | latest | Physics (verify upgrade during implementation) |
| `@threlte/core` | existing | Three.js rendering |
| `three` | existing | 3D primitives |

No new dependencies. Everything builds on existing infrastructure.

---

## Testing Strategy

Following the project's "earned tests" philosophy:

| What | Test? | Why |
|------|-------|-----|
| RoomGeometryBuilder output | Yes | Grid snapping math, wall closure, corner handling — silent bugs if wrong |
| RoomValidator checks | Yes | Validation logic is pure functions with clear assertions |
| IndoorScene rendering | No | Visual — you'll see if it's broken |
| Material registry lookup | No | Trivial map lookup |
| Archive migration | No | Visual verification in browser |

Tests for builder and validator go in `tests/unit/indoor/`.

---

## Success Criteria

1. Walk into the Discovery Chamber and hit a wall you can't walk through
2. Walls meet at corners with no visible gaps
3. Player stays on the floor (no falling through)
4. Entrance is walkable (no invisible collider blocking it)
5. Same visual quality as current chamber (warm stone, torchlight, tablet)
6. New wings can be added by writing a RoomDefinition — no physics wiring needed
