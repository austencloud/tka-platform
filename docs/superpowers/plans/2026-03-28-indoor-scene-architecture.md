# Indoor Scene Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an IndoorScene component with grid-based room geometry, Rapier physics collision, and migrate the Archive's Discovery Chamber to use it.

**Architecture:** Semantic room definitions → RoomGeometryBuilder (grid-snapped geometry + colliders) → IndoorScene (Rapier physics + UnifiedCameraController + mesh rendering). Reuses existing physics, camera, and input infrastructure.

**Tech Stack:** Svelte 5, Threlte, Three.js, Rapier 3D (WASM), ITI DI

**Spec:** `docs/superpowers/specs/2026-03-28-indoor-scene-architecture-design.md`

---

## File Structure

```
NEW FILES:
src/lib/shared/3d/indoor/
  domain/
    room-types.ts                    — RoomDefinition, SolvedRoom, all types
    material-registry.ts             — WallMaterialId → color/roughness/metalness
  services/
    contracts/
      IRoomGeometryBuilder.ts        — Builder interface
      IRoomValidator.ts              — Validator interface
    implementations/
      RoomGeometryBuilder.ts         — Semantic → grid-snapped geometry
      RoomValidator.ts               — Automated room checks
  IndoorScene.svelte                 — Main component

src/lib/features/realm/destinations/archive/
  domain/
    wing-definitions.ts              — RoomDefinition for Discovery Chamber

tests/unit/indoor/
  RoomGeometryBuilder.test.ts        — Builder tests
  RoomValidator.test.ts              — Validator tests

MODIFIED FILES:
src/lib/shared/3d/camera/services/contracts/ICameraMovementController.ts  — Add setYaw/setPitch
src/lib/shared/3d/camera/services/implementations/CameraMovementController.ts  — Implement setYaw/setPitch
src/lib/features/realm/destinations/archive/ArchiveDestination.svelte  — Use IndoorScene
src/lib/features/realm/destinations/archive/components/DiscoveryChamber.svelte  — Simplify to exhibits only

DELETED FILES:
src/lib/features/realm/destinations/archive/components/FirstPersonCamera.svelte
src/lib/features/realm/destinations/archive/domain/chamber-geometry.ts
src/lib/features/realm/destinations/archive/state/archive-state-bridge.svelte.ts

NOTES:
- RoomGeometryBuilder and RoomValidator are instantiated directly (no DI container).
  They are pure stateless services with no dependencies — DI registration adds no value
  here. If they gain dependencies in Phase 3, register them then.
- archive-state-bridge.svelte.ts was a module-level bridge for passing state between
  WorldSceneContent and ArchiveDestination. IndoorScene renders inside the same component
  tree, so the bridge is dead code.
- worldOffset is set by the destination component after calling builder.build(), not by
  the builder itself. The builder produces local-space geometry; the destination decides
  where to place it in world space. IndoorScene reads worldOffset and applies it.
```

---

### Task 1: Add setYaw/setPitch to CameraMovementController

**Files:**
- Modify: `src/lib/shared/3d/camera/services/contracts/ICameraMovementController.ts`
- Modify: `src/lib/shared/3d/camera/services/implementations/CameraMovementController.ts`

- [ ] **Step 1: Add setYaw and setPitch to the interface**

In `src/lib/shared/3d/camera/services/contracts/ICameraMovementController.ts`, add before the closing `}` of `ICameraMovementController`:

```typescript
	/**
	 * Set camera yaw directly (radians). Used for spawn facing direction.
	 */
	setYaw(yaw: number): void;

	/**
	 * Set camera pitch directly (radians). Used for spawn look angle.
	 */
	setPitch(pitch: number): void;
```

- [ ] **Step 2: Implement setYaw and setPitch**

In `src/lib/shared/3d/camera/services/implementations/CameraMovementController.ts`, add the methods to the class:

```typescript
	setYaw(yaw: number): void {
		this.yaw = yaw;
	}

	setPitch(pitch: number): void {
		this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
	}
```

- [ ] **Step 3: Verify build**

Run: `npm run check 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/camera/services/contracts/ICameraMovementController.ts \
        src/lib/shared/3d/camera/services/implementations/CameraMovementController.ts
git commit -m "feat(camera): add setYaw/setPitch to CameraMovementController

IndoorScene needs to set initial facing direction from room spawn config.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Room Type Definitions

**Files:**
- Create: `src/lib/shared/3d/indoor/domain/room-types.ts`

- [ ] **Step 1: Create the room types file**

Create `src/lib/shared/3d/indoor/domain/room-types.ts` with all types from the spec:

```typescript
/**
 * Room Description Format
 *
 * Semantic room definitions for indoor scenes. Rooms are described
 * in terms of walls, entrances, objects, and lighting — not coordinates.
 * The RoomGeometryBuilder converts these to grid-snapped geometry.
 */

// ── Input types (what you write to define a room) ──

export type WallId = "north" | "south" | "east" | "west";

export type WallMaterialId = "stone" | "marble" | "wood" | "metal" | "sandstone";

export interface RoomDefinition {
	id: string;
	name: string;
	shape: "rectangular";
	/** East-west dimension in meters */
	width: number;
	/** North-south dimension in meters */
	depth: number;
	/** Floor to ceiling in meters */
	height: number;
	walls: {
		thickness: number;
		material: WallMaterialId;
	};
	entrance: EntranceDefinition;
	/** Future wing-to-wing doors */
	connections?: ConnectionDefinition[];
	objects: RoomObjectDefinition[];
	lighting: RoomLightDefinition[];
	spawn: {
		wall: WallId;
		distance: number;
		facing: WallId;
	};
}

export interface EntranceDefinition {
	wall: WallId;
	/** Opening width in meters */
	width: number;
	/** Opening height in meters */
	height: number;
	/** "center" or meters from wall start */
	offset: "center" | number;
	corridor?: {
		depth: number;
		height: number;
		width?: number;
	};
}

export interface ConnectionDefinition {
	toWingId: string;
	wall: WallId;
	width: number;
	height: number;
	offset: "center" | number;
}

export interface RoomObjectDefinition {
	id: string;
	type: RoomObjectType;
	placement: ObjectPlacement;
}

export type ObjectPlacement =
	| { anchor: "wall"; wall: WallId; position: "center" | number; distance: number; height?: number }
	| { anchor: "center"; offsetX?: number; offsetZ?: number; height?: number }
	| { anchor: "corner"; walls: [WallId, WallId]; distance: number; height?: number };

export type RoomObjectType =
	| "pedestal"
	| "torch-mount"
	| "bench"
	| "pillar"
	| "display-case"
	| "alcove";

export type RoomLightDefinition =
	| { type: "torch"; targetObjectId: string; intensity?: number }
	| { type: "spotlight"; target: string; angle: number; intensity?: number; color?: string }
	| { type: "ambient"; color: string; intensity: number }
	| { type: "hemisphere"; color: string; intensity: number };

// ── Output types (what the builder produces) ──

export interface SolvedRoom {
	walls: SolvedWallSegment[];
	floor: SolvedSurface;
	ceiling: SolvedSurface;
	entrance: SolvedEntrance;
	objects: SolvedObject[];
	objectsById: Map<string, SolvedObject>;
	colliders: ColliderDefinition[];
	spawnPoint: { x: number; y: number; z: number };
	spawnFacing: number;
	worldOffset: { x: number; y: number; z: number };
	bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
	gridCellSize: number;
}

export interface SolvedWallSegment {
	position: [number, number, number];
	size: [number, number, number];
	rotationY: number;
	materialId: WallMaterialId;
}

export interface SolvedSurface {
	position: [number, number, number];
	size: [number, number, number];
	materialId: WallMaterialId;
}

export interface SolvedEntrance {
	segments: SolvedWallSegment[];
	opening: {
		position: [number, number, number];
		size: [number, number];
		facing: number;
	};
	corridor?: {
		walls: SolvedWallSegment[];
		floor: SolvedSurface;
		ceiling: SolvedSurface;
	};
}

export interface SolvedObject {
	id: string;
	type: RoomObjectType;
	position: [number, number, number];
	rotationY: number;
}

export interface ColliderDefinition {
	shape: "box";
	position: [number, number, number];
	size: [number, number, number];
}

// ── Constants ──

export const GRID_CELL = 0.5;

export function snapToGrid(value: number): number {
	return Math.round(value / GRID_CELL) * GRID_CELL;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run check 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/indoor/domain/room-types.ts
git commit -m "feat(indoor): add room definition and solved room types

Semantic room descriptions + grid-snapped output types for the
RoomGeometryBuilder. Forward-compatible connections field for
future multi-wing support.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Material Registry

**Files:**
- Create: `src/lib/shared/3d/indoor/domain/material-registry.ts`

- [ ] **Step 1: Create material registry**

```typescript
/**
 * Material Registry
 *
 * Maps WallMaterialId to Three.js material properties.
 * Phase 1: solid colors matching Discovery Chamber aesthetic.
 * Phase 2: PBR textures with normal maps.
 */

import type { WallMaterialId } from "./room-types";

export interface MaterialProperties {
	color: number;
	roughness: number;
	metalness: number;
}

const MATERIALS: Record<WallMaterialId, MaterialProperties> = {
	stone: { color: 0x5a4a3a, roughness: 0.92, metalness: 0.02 },
	marble: { color: 0xd4c5a9, roughness: 0.3, metalness: 0.05 },
	wood: { color: 0x8b6914, roughness: 0.85, metalness: 0.0 },
	metal: { color: 0x666666, roughness: 0.4, metalness: 0.7 },
	sandstone: { color: 0xc2a278, roughness: 0.9, metalness: 0.01 },
};

// Floor and ceiling are slightly darker/lighter variants of the wall material
const FLOOR_DARKEN = 0.85;
const CEILING_DARKEN = 0.7;

function darkenColor(color: number, factor: number): number {
	const r = Math.floor(((color >> 16) & 0xff) * factor);
	const g = Math.floor(((color >> 8) & 0xff) * factor);
	const b = Math.floor((color & 0xff) * factor);
	return (r << 16) | (g << 8) | b;
}

export function getWallMaterial(id: WallMaterialId): MaterialProperties {
	return MATERIALS[id];
}

export function getFloorMaterial(id: WallMaterialId): MaterialProperties {
	const wall = MATERIALS[id];
	return { ...wall, color: darkenColor(wall.color, FLOOR_DARKEN) };
}

export function getCeilingMaterial(id: WallMaterialId): MaterialProperties {
	const wall = MATERIALS[id];
	return { ...wall, color: darkenColor(wall.color, CEILING_DARKEN) };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/indoor/domain/material-registry.ts
git commit -m "feat(indoor): add material registry for wall/floor/ceiling materials

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: RoomGeometryBuilder — Tests First

**Files:**
- Create: `src/lib/shared/3d/indoor/services/contracts/IRoomGeometryBuilder.ts`
- Create: `tests/unit/indoor/RoomGeometryBuilder.test.ts`

- [ ] **Step 1: Create builder interface**

```typescript
// src/lib/shared/3d/indoor/services/contracts/IRoomGeometryBuilder.ts

import type { RoomDefinition, SolvedRoom } from "../../domain/room-types";

export interface IRoomGeometryBuilder {
	build(definition: RoomDefinition): SolvedRoom;
}
```

- [ ] **Step 2: Write failing tests**

Create `tests/unit/indoor/RoomGeometryBuilder.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { RoomGeometryBuilder } from "$lib/shared/3d/indoor/services/implementations/RoomGeometryBuilder";
import type { RoomDefinition } from "$lib/shared/3d/indoor/domain/room-types";
import { GRID_CELL } from "$lib/shared/3d/indoor/domain/room-types";

function makeSimpleRoom(overrides: Partial<RoomDefinition> = {}): RoomDefinition {
	return {
		id: "test-room",
		name: "Test Room",
		shape: "rectangular",
		width: 10,
		depth: 12,
		height: 4,
		walls: { thickness: 0.5, material: "stone" },
		entrance: { wall: "south", width: 3, height: 3, offset: "center" },
		objects: [],
		lighting: [],
		spawn: { wall: "south", distance: 2, facing: "north" },
		...overrides,
	};
}

describe("RoomGeometryBuilder", () => {
	const builder = new RoomGeometryBuilder();

	describe("wall generation", () => {
		it("generates 4 wall groups for a room with no entrance", () => {
			const room = makeSimpleRoom({
				entrance: { wall: "south", width: 0, height: 0, offset: "center" },
			});
			const solved = builder.build(room);
			// North, south, east, west walls + entrance segments
			expect(solved.walls.length).toBeGreaterThanOrEqual(4);
		});

		it("splits south wall into segments around entrance", () => {
			const solved = builder.build(makeSimpleRoom());
			// South wall split into left section, right section (entrance carved out)
			// Plus north, east, west = at least 5 segments
			expect(solved.walls.length).toBeGreaterThanOrEqual(4);
			// Entrance should have segments
			expect(solved.entrance.segments.length).toBeGreaterThan(0);
		});

		it("snaps all wall coordinates to grid", () => {
			const solved = builder.build(makeSimpleRoom({ width: 10.3, depth: 11.7 }));
			for (const wall of solved.walls) {
				for (const coord of wall.position) {
					expect(coord % GRID_CELL).toBeCloseTo(0, 5);
				}
				for (const dim of wall.size) {
					expect(dim % GRID_CELL).toBeCloseTo(0, 5);
				}
			}
		});
	});

	describe("corner closure", () => {
		it("total wall coverage spans full room perimeter", () => {
			const room = makeSimpleRoom({ width: 10, depth: 12 });
			const solved = builder.build(room);
			// Find the widest wall segment on each axis — should match room dimensions
			const xSpanningWalls = solved.walls.filter((w) => w.size[0] >= room.width - 0.01);
			const zSpanningWalls = solved.walls.filter((w) => w.size[2] >= room.depth - 0.01);
			// North and/or south walls should span full width
			expect(xSpanningWalls.length).toBeGreaterThanOrEqual(1);
			// East and/or west walls should span full depth
			expect(zSpanningWalls.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("floor and ceiling", () => {
		it("generates floor spanning full room", () => {
			const solved = builder.build(makeSimpleRoom());
			expect(solved.floor.size[0]).toBeCloseTo(10, 1); // width
			expect(solved.floor.size[2]).toBeCloseTo(12, 1); // depth
		});

		it("generates ceiling at room height", () => {
			const solved = builder.build(makeSimpleRoom());
			expect(solved.ceiling.position[1]).toBeCloseTo(4, 1); // height
		});
	});

	describe("colliders", () => {
		it("generates a collider for every wall segment", () => {
			const solved = builder.build(makeSimpleRoom());
			const wallCount = solved.walls.length + solved.entrance.segments.length;
			// At minimum: walls + floor + ceiling colliders
			expect(solved.colliders.length).toBeGreaterThanOrEqual(wallCount + 2);
		});

		it("collider positions match wall positions", () => {
			const solved = builder.build(makeSimpleRoom());
			// Each wall should have a corresponding collider at the same position
			for (const wall of solved.walls) {
				const matchingCollider = solved.colliders.find(
					(c) =>
						Math.abs(c.position[0] - wall.position[0]) < 0.01 &&
						Math.abs(c.position[1] - wall.position[1]) < 0.01 &&
						Math.abs(c.position[2] - wall.position[2]) < 0.01
				);
				expect(matchingCollider).toBeDefined();
			}
		});
	});

	describe("object placement", () => {
		it("places wall-anchored object at correct position", () => {
			const room = makeSimpleRoom({
				objects: [
					{
						id: "pedestal",
						type: "pedestal",
						placement: { anchor: "wall", wall: "north", position: "center", distance: 1.5 },
					},
				],
			});
			const solved = builder.build(room);
			const ped = solved.objectsById.get("pedestal");
			expect(ped).toBeDefined();
			// Should be centered on X axis (room width 10 → x ≈ 5)
			expect(ped!.position[0]).toBeCloseTo(5, 0);
			// Should be 1.5m from north wall inner face
			expect(ped!.position[2]).toBeGreaterThan(1);
			expect(ped!.position[2]).toBeLessThan(3);
		});

		it("places center-anchored object at room center", () => {
			const room = makeSimpleRoom({
				objects: [
					{
						id: "center-obj",
						type: "pillar",
						placement: { anchor: "center" },
					},
				],
			});
			const solved = builder.build(room);
			const obj = solved.objectsById.get("center-obj");
			expect(obj).toBeDefined();
			expect(obj!.position[0]).toBeCloseTo(5, 0); // center X
			expect(obj!.position[2]).toBeCloseTo(6, 0); // center Z
		});

		it("places corner-anchored object near wall intersection", () => {
			const room = makeSimpleRoom({
				objects: [
					{
						id: "corner-obj",
						type: "pillar",
						placement: { anchor: "corner", walls: ["north", "east"], distance: 1 },
					},
				],
			});
			const solved = builder.build(room);
			const obj = solved.objectsById.get("corner-obj");
			expect(obj).toBeDefined();
			// Should be near north-east corner, offset by distance
			expect(obj!.position[0]).toBeGreaterThan(room.width - 2);
			expect(obj!.position[2]).toBeLessThan(2);
		});

		it("populates objectsById map", () => {
			const room = makeSimpleRoom({
				objects: [
					{ id: "a", type: "pedestal", placement: { anchor: "center" } },
					{ id: "b", type: "pillar", placement: { anchor: "center", offsetX: 2 } },
				],
			});
			const solved = builder.build(room);
			expect(solved.objectsById.size).toBe(2);
			expect(solved.objectsById.get("a")).toBeDefined();
			expect(solved.objectsById.get("b")).toBeDefined();
		});
	});

	describe("spawn point", () => {
		it("places spawn near specified wall", () => {
			const solved = builder.build(makeSimpleRoom());
			// Spawn: wall south, distance 2, facing north
			// South wall is at z = depth (12), so spawn z ≈ 12 - 2 = 10
			expect(solved.spawnPoint.z).toBeGreaterThan(8);
			expect(solved.spawnPoint.z).toBeLessThan(12);
		});

		it("sets spawn facing as yaw radians", () => {
			const solved = builder.build(makeSimpleRoom());
			// Facing north = looking toward -Z = yaw 0 or Math.PI depending on convention
			expect(typeof solved.spawnFacing).toBe("number");
		});
	});

	describe("entrance", () => {
		it("provides entrance opening geometry", () => {
			const solved = builder.build(makeSimpleRoom());
			expect(solved.entrance.opening).toBeDefined();
			expect(solved.entrance.opening.size[0]).toBeCloseTo(3, 1); // width
			expect(solved.entrance.opening.size[1]).toBeCloseTo(3, 1); // height
		});

		it("generates corridor when defined", () => {
			const room = makeSimpleRoom({
				entrance: {
					wall: "south",
					width: 3,
					height: 3.2,
					offset: "center",
					corridor: { depth: 4, height: 3.2, width: 2.8 },
				},
			});
			const solved = builder.build(room);
			expect(solved.entrance.corridor).toBeDefined();
			expect(solved.entrance.corridor!.walls.length).toBeGreaterThan(0);
			expect(solved.entrance.corridor!.floor).toBeDefined();
			expect(solved.entrance.corridor!.ceiling).toBeDefined();
		});
	});

	describe("world offset", () => {
		it("defaults to zero offset", () => {
			const solved = builder.build(makeSimpleRoom());
			expect(solved.worldOffset).toEqual({ x: 0, y: 0, z: 0 });
		});
	});
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/indoor/RoomGeometryBuilder.test.ts 2>&1 | tail -10`
Expected: FAIL — `Cannot find module`

- [ ] **Step 4: Commit test file**

```bash
git add src/lib/shared/3d/indoor/services/contracts/IRoomGeometryBuilder.ts \
        tests/unit/indoor/RoomGeometryBuilder.test.ts
git commit -m "test(indoor): add RoomGeometryBuilder tests (red phase)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: RoomGeometryBuilder — Implementation

**Files:**
- Create: `src/lib/shared/3d/indoor/services/implementations/RoomGeometryBuilder.ts`

- [ ] **Step 1: Implement the builder**

Create `src/lib/shared/3d/indoor/services/implementations/RoomGeometryBuilder.ts`. This is the core algorithm. Key responsibilities:

1. Convert room dimensions to grid-snapped bounds
2. Generate wall segments (north/south span full width for corner closure)
3. Split entrance wall into sub-segments around opening
4. Generate corridor geometry if defined
5. Place objects relative to wall anchors
6. Generate matching colliders for all geometry
7. Compute spawn point from wall + distance + facing

The implementation should:
- Use `snapToGrid()` from room-types for all output coordinates
- Generate `ColliderDefinition` with `size` (full extents) matching each visual segment
- Build the `objectsById` Map from the objects array
- Convert `WallId` facing directions to yaw radians: north=`Math.PI`, south=0, east=`-Math.PI/2`, west=`Math.PI/2`
- Handle entrance `offset: "center"` by computing `(wallLength - entranceWidth) / 2`

The file will be ~200-300 lines. Key functions to implement:
- `build(definition)` — orchestrator
- `buildWalls(def)` — 4 walls + entrance splitting
- `buildEntranceWall(def)` — split one wall around an opening
- `buildCorridor(def, entrancePos)` — corridor walls/floor/ceiling
- `buildFloorAndCeiling(def)` — single surfaces
- `placeObjects(def, wallPositions)` — resolve anchors to coordinates
- `buildColliders(walls, entrance, floor, ceiling, corridor)` — mirror geometry
- `computeSpawnPoint(def)` — wall + distance to world coordinates

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/unit/indoor/RoomGeometryBuilder.test.ts 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 3: Fix any failures and re-run until green**

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/indoor/services/implementations/RoomGeometryBuilder.ts
git commit -m "feat(indoor): implement RoomGeometryBuilder

Converts semantic room definitions to grid-snapped geometry with
matching Rapier colliders. Handles wall splitting for entrances,
corridor generation, and object placement relative to walls.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: RoomValidator — Tests and Implementation

**Files:**
- Create: `src/lib/shared/3d/indoor/services/contracts/IRoomValidator.ts`
- Create: `src/lib/shared/3d/indoor/services/implementations/RoomValidator.ts`
- Create: `tests/unit/indoor/RoomValidator.test.ts`

- [ ] **Step 1: Create validator interface**

```typescript
// src/lib/shared/3d/indoor/services/contracts/IRoomValidator.ts

import type { RoomDefinition, SolvedRoom } from "../../domain/room-types";

export interface ValidationIssue {
	severity: "error" | "warning";
	message: string;
	location?: [number, number, number];
}

export interface ValidationResult {
	passed: boolean;
	issues: ValidationIssue[];
}

export interface IRoomValidator {
	validate(definition: RoomDefinition, solved: SolvedRoom): ValidationResult;
}
```

- [ ] **Step 2: Write failing tests**

Create `tests/unit/indoor/RoomValidator.test.ts` testing:
- Valid room passes with no issues
- Spawn point outside room bounds → error
- Missing floor collider → error
- Entrance blocked by collider → error
- Object outside room bounds → warning

- [ ] **Step 3: Implement validator**

Create `src/lib/shared/3d/indoor/services/implementations/RoomValidator.ts` with checks:
- `checkFloorCoverage` — floor size matches room bounds
- `checkCeilingCoverage` — ceiling at correct height
- `checkSpawnInsideRoom` — spawn within bounds, not inside wall
- `checkEntranceWalkable` — no collider overlapping entrance opening
- `checkObjectsInsideRoom` — all objects within bounds
- `checkColliderVisualMatch` — every wall has a collider

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/indoor/RoomValidator.test.ts 2>&1 | tail -10`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/indoor/services/contracts/IRoomValidator.ts \
        src/lib/shared/3d/indoor/services/implementations/RoomValidator.ts \
        tests/unit/indoor/RoomValidator.test.ts
git commit -m "feat(indoor): add RoomValidator with geometric checks

Validates wall closure, floor/ceiling coverage, spawn placement,
entrance walkability, and collider-visual alignment.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Wing 1 Definition (Discovery Chamber)

**Files:**
- Create: `src/lib/features/realm/destinations/archive/domain/wing-definitions.ts`

- [ ] **Step 1: Create the Discovery Chamber room definition**

Translate the existing `chamber-geometry.ts` dimensions into a `RoomDefinition`. Reference the existing file at `src/lib/features/realm/destinations/archive/domain/chamber-geometry.ts` for exact dimensions:
- Room: 10m wide, 12m deep, 4.5m high
- Walls: 0.5m thick, stone
- Entrance: south wall, 3m wide, 3.2m high, centered
- Corridor: 4m deep, 3.2m high, 2.8m wide
- Pedestal: centered on north wall, 1.5m from wall
- 4 torches: 2 on east wall, 2 on west wall at positions 0.3 and 0.7, height 2.5m
- Spawn: near south wall, 2m in, facing north

```typescript
import type { RoomDefinition } from "$lib/shared/3d/indoor/domain/room-types";

export const DISCOVERY_CHAMBER: RoomDefinition = {
	id: "wing-1-discovery",
	name: "Discovery Chamber",
	shape: "rectangular",
	width: 10,
	depth: 12,
	height: 4.5,
	walls: { thickness: 0.5, material: "stone" },
	entrance: {
		wall: "south",
		width: 3,
		height: 3.2,
		offset: "center",
		corridor: { depth: 4, height: 3.2, width: 2.8 },
	},
	connections: [],
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
		{ type: "spotlight", target: "tablet-pedestal", angle: 30, intensity: 3, color: "#fff0d0" },
	],
	spawn: { wall: "south", distance: 2, facing: "north" },
};
```

- [ ] **Step 2: Verify build**

Run: `npm run check 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/realm/destinations/archive/domain/wing-definitions.ts
git commit -m "feat(archive): add Discovery Chamber room definition

Semantic room description replacing chamber-geometry.ts coordinate
arrays. Same dimensions, now grid-snappable.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: IndoorScene Component

**Files:**
- Create: `src/lib/shared/3d/indoor/IndoorScene.svelte`

This is the main component. It:

1. Wraps GalleryCanvas (for WebGPU support)
2. Initializes Rapier physics world on mount — pass `{ x: 0, y: gravity, z: 0 }` to `initPhysicsWorld()` (default gravity prop is -9.81, NOT the WorldScene default of -20)
3. Creates static box colliders from `SolvedRoom.colliders` using `createRigidBody()`
4. Creates player controller via `createPlayerController()`
5. Creates physics provider via `createRapierPhysicsProvider()`
6. Initializes `CameraMovementController` in FIRST_PERSON mode
7. Sets initial yaw via the new `setYaw()` method
8. Renders wall/floor/ceiling meshes from `SolvedRoom`
9. Renders entrance segments and corridor if present
10. Applies `room.worldOffset` to all mesh positions and collider translations
11. Runs physics step + camera update in `useTask` loop
12. Provides children snippet slot for wing-specific content
13. On destroy: call `physicsState.world.free()` which disposes all rigid bodies and colliders created in that world

**Props must include `onPositionChange` callback** (not in original spec but needed by ArchiveDestination for interaction proximity detection):
```typescript
interface IndoorSceneProps {
  room: SolvedRoom;
  eyeHeight?: number;       // default 1.7
  moveSpeed?: number;       // default 2.5
  gravity?: number;         // default -9.81
  onPositionChange?: (pos: { x: number; y: number; z: number }) => void;
  children: Snippet;
}
```

- [ ] **Step 1: Create IndoorScene.svelte**

Key imports needed:
```typescript
import { T, useThrelte, useTask } from "@threlte/core";
import { onMount, onDestroy, type Snippet } from "svelte";
import * as THREE from "three";
import GalleryCanvas from "$lib/features/realm/destinations/gallery/components/GalleryCanvas.svelte";
import { initPhysicsWorld, createRigidBody } from "$lib/shared/3d/physics/rapier-world";
import { createPlayerController } from "$lib/shared/3d/physics/player-controller";
import { createRapierPhysicsProvider } from "$lib/shared/3d/physics/RapierPhysicsProvider";
import { CameraMovementController } from "$lib/shared/3d/camera/services/implementations/CameraMovementController";
import { getWallMaterial, getFloorMaterial, getCeilingMaterial } from "./domain/material-registry";
import type { SolvedRoom, SolvedWallSegment, SolvedSurface } from "./domain/room-types";
```

The component needs two layers:
- An outer wrapper that provides GalleryCanvas
- An inner component (or inline) that has access to Threlte context via `useThrelte()`

Follow the pattern from `WorldSceneContent.svelte` for physics initialization, but much simpler (no chunks, no terrain, no vegetation).

- [ ] **Step 2: Verify build**

Run: `npm run check 2>&1 | tail -10`
Expected: 0 errors (warnings OK)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/indoor/IndoorScene.svelte
git commit -m "feat(indoor): add IndoorScene component

Lightweight Threlte scene with Rapier physics, player controller,
and UnifiedCameraController for indoor rooms. No terrain, vegetation,
or atmosphere — just walls, floors, ceilings, and collision.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Migrate ArchiveDestination

**Files:**
- Modify: `src/lib/features/realm/destinations/archive/ArchiveDestination.svelte`
- Modify: `src/lib/features/realm/destinations/archive/components/DiscoveryChamber.svelte`
- Delete: `src/lib/features/realm/destinations/archive/components/FirstPersonCamera.svelte`
- Delete: `src/lib/features/realm/destinations/archive/domain/chamber-geometry.ts`

- [ ] **Step 1: Rewrite ArchiveDestination.svelte**

Replace the current GalleryCanvas + FirstPersonCamera + DiscoveryChamber composition with IndoorScene:

```svelte
<script lang="ts">
	import IndoorScene from "$lib/shared/3d/indoor/IndoorScene.svelte";
	import { RoomGeometryBuilder } from "$lib/shared/3d/indoor/services/implementations/RoomGeometryBuilder";
	import { DISCOVERY_CHAMBER } from "./domain/wing-definitions";
	import { createArchiveState } from "./state/archive-state.svelte";
	import DiscoveryChamber from "./components/DiscoveryChamber.svelte";
	import PlaqueOverlay from "./components/PlaqueOverlay.svelte";

	const archiveState = createArchiveState();
	const builder = new RoomGeometryBuilder();
	const solvedRoom = builder.build(DISCOVERY_CHAMBER);

	// World offset: existing archive uses groundY = 8
	solvedRoom.worldOffset = { x: 0, y: 8, z: 0 };

	let playerPosition = $state({ x: 0, y: 0, z: 0 });

	function handlePlaqueClose() {
		archiveState.closePlaque();
		const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-engine]");
		canvas?.requestPointerLock();
	}
</script>

<div class="archive-scene">
	<IndoorScene
		room={solvedRoom}
		eyeHeight={1.7}
		moveSpeed={2.5}
		onPositionChange={(pos) => { playerPosition = pos; }}
	>
		<DiscoveryChamber
			{solvedRoom}
			{playerPosition}
			{archiveState}
		/>
	</IndoorScene>

	<div class="crosshair"></div>

	{#if !archiveState.isOverlayOpen}
		<div class="hint">Click to explore</div>
	{/if}

	{#if archiveState.interactionTargetId && !archiveState.isOverlayOpen}
		<div class="interaction-prompt">
			<div class="prompt-key">E</div>
			<div class="prompt-text">Examine</div>
		</div>
	{/if}

	{#if archiveState.isOverlayOpen && archiveState.activePlaqueContent}
		<PlaqueOverlay
			content={archiveState.activePlaqueContent}
			visible={true}
			onClose={handlePlaqueClose}
		/>
	{/if}
</div>
```

Keep existing CSS styles.

- [ ] **Step 2: Simplify DiscoveryChamber.svelte**

Remove all wall/floor/ceiling rendering (IndoorScene handles that now). Keep only:
- Exhibit content (TabletExhibit)
- Torch lights (TorchLight)
- Custom lighting (AmbientLight, HemisphereLight, SpotLight)
- Interaction detection (distance check + E key)

The component receives `solvedRoom` instead of `groundY` and uses `solvedRoom.objectsById` to find object positions.

- [ ] **Step 3: Delete old files**

Delete these files — they're fully replaced:
- `FirstPersonCamera.svelte` — replaced by IndoorScene's camera controller
- `chamber-geometry.ts` — replaced by wing-definitions.ts
- `archive-state-bridge.svelte.ts` — was a module-level bridge for WorldSceneContent; IndoorScene renders in the same component tree so no bridge needed

- [ ] **Step 4: Verify build**

Run: `npm run check 2>&1 | tail -10`
Expected: 0 errors

- [ ] **Step 5: Test in browser**

Open the Archive in the running dev server. Verify:
1. Room renders with walls, floor, ceiling
2. Torches and tablet exhibit are visible
3. Click to enter — pointer lock activates
4. WASD/arrow keys move the player
5. Walk into a wall — you stop (collision works!)
6. Walk to the entrance — you can walk through it
7. Press E near the tablet — plaque opens
8. Visual quality matches the previous chamber (warm stone, torchlight)

- [ ] **Step 6: Commit**

```bash
git add -A src/lib/features/realm/destinations/archive/
git commit -m "feat(archive): migrate Discovery Chamber to IndoorScene

Replaces hand-rolled FPS camera and manual box geometry with
IndoorScene component. Adds Rapier collision detection, grid-snapped
walls, and reuses the unified camera controller.

Deletes FirstPersonCamera.svelte and chamber-geometry.ts.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Run Full Test Suite and Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run 2>&1 | tail -20`
Expected: All tests pass (including new indoor tests)

- [ ] **Step 2: Run typecheck**

Run: `npm run check 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Visual verification in browser**

Navigate to the Archive destination. Walk around the Discovery Chamber. Confirm:
- [ ] Walls are solid (can't walk through)
- [ ] Floor is solid (don't fall through)
- [ ] Corners have no gaps
- [ ] Entrance corridor is walkable
- [ ] Exhibit interaction works (E key near pedestal)
- [ ] Plaque overlay displays and closes correctly
- [ ] Torchlight illuminates the room
- [ ] Visual quality matches or exceeds the previous implementation

- [ ] **Step 4: Final commit if any cleanup needed**
