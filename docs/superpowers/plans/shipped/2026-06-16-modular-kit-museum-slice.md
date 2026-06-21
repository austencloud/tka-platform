# Modular Kit Museum — Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kill the holes-to-sky, see-through floor, and black walls in the 3D museum by sealing the shell, then replacing the institutional wing's per-tile box walls with merged kit runs sourced from a swappable provider — leaving a clean seam for a baked Blender GLB.

**Architecture:** Three phases, each shipping working software. Phase 1 seals the existing procedural geometry (no worker-protocol change, fixes the screenshot). Phase 2 adds a pure `wall-run-resolver` + a `KitPieceProvider` seam and routes the institutional wing through merged runs built on the main thread inside `buildRoomChunk` (which already receives `wing.bounds`/`theme`), so the geometry worker is untouched. Phase 3 is the gated Blender asset drop that swaps the provider's procedural pieces for a baked GLB.

**Tech Stack:** SvelteKit, Threlte/Three.js (`BatchedMesh`, `BoxGeometry`), Vitest, the existing `museum-geometry-builder.ts` chunk pipeline.

**Spec:** `docs/superpowers/specs/2026-06-16-modular-kit-museum-design.md`

**Reference (do not modify):** `src/routes/test/museum-kit-stages/` is the approved visual of the four stages. Phase 1 ≈ stage "sealed", Phase 2 ≈ stages "merged"/"kit".

---

## File Structure

| File | Responsibility | Phase |
|---|---|---|
| `src/lib/features/museum/services/museum-geometry-builder.ts` (modify) | Floor/ceiling/exhibit-wall seal; route institutional wing to run builder | 1, 2 |
| `src/lib/features/museum/services/wall-segment-stamper.ts` (modify) | Keep wall behind exhibit plaques | 1 |
| `src/lib/features/museum/services/wall-run-resolver.ts` (create) | Pure: wall tiles + room bounds → merged runs + door openings | 2 |
| `src/lib/features/museum/domain/museum-kit-types.ts` (create) | `WallRun`, `DoorOpening`, `KitPiece`, `KitPieceProvider` types | 2 |
| `src/lib/features/museum/services/kit-piece-provider.ts` (create) | Procedural paneled provider (default) + GLB provider stub | 2 |
| `src/lib/features/museum/components/game/Museum3DScene.svelte` (modify) | Institutional lighting lift | 1 |
| `tests/unit/museum/WallRunResolver.test.ts` (create) | Resolver unit tests | 2 |
| `tests/unit/museum/KitPieceProvider.test.ts` (create) | Provider unit tests | 2 |

---

## PHASE 1 — Seal the shell (verifiable in the real museum, no worker change)

### Task 1: Solid floor (kill seams + void)

**Files:**
- Modify: `src/lib/features/museum/services/museum-geometry-builder.ts:499`

- [ ] **Step 1: Change the shared floor geometry to full-tile, thick, with an underside**

In `getSharedGeometries()` replace the floor line:

```ts
// before
if (!sharedFloorGeo) sharedFloorGeo = new BoxGeometry(TILE_SIZE - 0.02, 0.05, TILE_SIZE - 0.02);
// after — full tile width (adjacent tiles abut, no seam) + real depth (no void show-through)
if (!sharedFloorGeo) sharedFloorGeo = new BoxGeometry(TILE_SIZE, 0.2, TILE_SIZE);
```

- [ ] **Step 2: Re-center floor instances so the top stays at y≈0**

Floor instances are placed at `yPos = 0` (builder.ts:556). With 0.2 depth the top now sits at +0.1. Lower the placement so the walkable surface stays at 0: change the floor `buildBatch(... , 0)` call to `-0.1`.

Find (builder.ts:556):
```ts
const { mesh, instanceIds } = buildBatch(floorGeo, material, bucket.positions, 0);
```
Replace the `0` with `-0.1`.

- [ ] **Step 3: Verify build compiles**

Run: `npm run check:fast`
Expected: no new errors in `museum-geometry-builder.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/museum/services/museum-geometry-builder.ts
git commit -m "fix(museum): solid full-tile floor geometry (no seams, no void)" -- src/lib/features/museum/services/museum-geometry-builder.ts
```

### Task 2: Keep the wall behind exhibit plaques

**Files:**
- Modify: `src/lib/features/museum/services/museum-geometry-builder.ts:299-321`

**Why:** When an `exhibit-panel` tile has a real exhibit, the builder adds floor + a plaque but NOT a wall, leaving a full-height hole behind the plaque open to the exterior. The plaque should hang on a wall.

- [ ] **Step 1: Add the wall bucket in the exhibit branch**

In the `case "exhibit-panel":` block, the `if (exhibitDef)` path currently calls `addToFloorBucket(...)` then pushes the plaque. Add a wall behind it. Replace:

```ts
if (exhibitDef) {
  addToFloorBucket(FLOOR_COLORS.stone, worldX, worldZ);
  const facing = tile.facing ?? "south";
```
with:
```ts
if (exhibitDef) {
  // Wall behind the plaque so the exhibit isn't an open hole to the exterior.
  const wingTheme = getWingThemeAt(tileX, tileY);
  const wallColor = wingTheme ? WING_WALL_COLORS[wingTheme] : TILE_TYPE_COLORS.wall!;
  addToWallBucket(wallColor, worldX, worldZ, wingTheme ?? undefined);
  const facing = tile.facing ?? "south";
```

Note: the plaque is offset off the wall face by `PLAQUE_WALL_SHIFT[facing]`, so it still reads in front of the new wall. Removing the `addToFloorBucket` here is intentional — the tile is now a wall tile, not walkable floor.

- [ ] **Step 2: Verify the plaque still has a floor tile in front to stand on**

The adjacent interior tile (one step toward `facing`) is already a `floor`/`corridor` tile from the room carve, so the plaque remains visible from inside. Confirm by reading `wall-segment-stamper.ts` `stampSegmentTiles` — exhibit segments sit on the boundary row, interior is carved floor. No code change; this step is a read-and-confirm.

Run: `npm run check:fast`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/museum/services/museum-geometry-builder.ts
git commit -m "fix(museum): back exhibit plaques with wall (seal the hole behind exhibits)" -- src/lib/features/museum/services/museum-geometry-builder.ts
```

### Task 3: Institutional lighting lift (walls stop reading black)

**Files:**
- Modify: `src/lib/features/museum/components/game/Museum3DScene.svelte` (the global light block, ~line 1049)

**Why:** Ambient `0.15` leaves interior wall faces unlit. Until the baked GLB lands (Phase 3), lift the baseline so the sealed geometry is legible. This is the honest interim — true baked AO comes with the GLB.

- [ ] **Step 1: Read the current global light block**

Run: `grep -n "AmbientLight\|HemisphereLight" src/lib/features/museum/components/game/Museum3DScene.svelte`
Read the two lines it reports (the global `<T.AmbientLight intensity={0.15} ...>` and `<T.HemisphereLight intensity={0.3} ...>`).

- [ ] **Step 2: Add a soft key directional alongside the existing ambient/hemisphere**

Immediately after the `<T.HemisphereLight ... />` line, add:

```svelte
<!-- Interim key light so sealed walls read with form until baked GLB kits land -->
<T.DirectionalLight intensity={0.55} position={[12, 20, 8]} color="#fff4e2" castShadow={false} />
```

Do NOT raise the ambient (keeps per-room point lights meaningful); the directional alone gives surface form.

- [ ] **Step 3: Verify the route serves**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/` then navigate the museum in-app to confirm compile (HMR).
Expected: `200`, no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/museum/components/game/Museum3DScene.svelte
git commit -m "feat(museum): interim key directional so sealed walls read with form" -- src/lib/features/museum/components/game/Museum3DScene.svelte
```

### Task 4: Phase 1 verification (real museum, evidence required)

- [ ] **Step 1: Ask the user to walk the entrance wing**

Per `.claude/rules/verification-protocol.md`, visual claims need evidence. Either capture a Chrome DevTools MCP screenshot of the museum entrance (with permission) or hand the user this check: "Open the museum, walk the entrance lobby — confirm no skybox through walls, no see-through floor, walls no longer black." Record the result before claiming Phase 1 done.

---

## PHASE 2 — Merged kit runs (institutional wing)

### Task 5: Kit + run types

**Files:**
- Create: `src/lib/features/museum/domain/museum-kit-types.ts`

- [ ] **Step 1: Write the types**

```ts
import type { WingTheme } from "./museum-grid-types";
import type { Object3D } from "three";

/** A merged straight stretch of wall in TILE coordinates (inclusive endpoints). */
export interface WallRun {
  axis: "x" | "z"; // direction the run advances
  fixed: number;   // the constant tile coordinate (y for x-runs, x for z-runs)
  start: number;   // first tile along `axis`
  end: number;     // last tile along `axis` (>= start)
}

/** A doorway opening on a wall border, in TILE coordinates. */
export interface DoorOpening {
  axis: "x" | "z";
  fixed: number;
  start: number;
  end: number;
}

export interface ResolvedWalls {
  runs: WallRun[];
  doors: DoorOpening[];
  /** Corner/junction tiles emitted as posts (tile coords). */
  posts: { x: number; y: number }[];
}

/** A provider turns resolved walls into Three.js objects for one wing theme. */
export interface KitPieceProvider {
  /**
   * Build all wall geometry for a room. `tileSize`/`wallHeight` are world units.
   * Returns one parent Object3D to add to the chunk (caller sets cameraCollider).
   */
  buildWalls(
    walls: ResolvedWalls,
    theme: WingTheme,
    tileSize: number,
    wallHeight: number,
    color: string,
  ): Object3D;
}
```

- [ ] **Step 2: Verify compile**

Run: `npm run check:fast`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/museum/domain/museum-kit-types.ts
git commit -m "feat(museum): kit + wall-run domain types" -- src/lib/features/museum/domain/museum-kit-types.ts
```

### Task 6: Wall-run resolver (pure, TDD)

**Files:**
- Create: `src/lib/features/museum/services/wall-run-resolver.ts`
- Test: `tests/unit/museum/WallRunResolver.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveWallRuns } from "$lib/features/museum/services/wall-run-resolver";

// isWall over a 6x5 room border (room bounds x:0..5, y:0..4), with a 1-tile
// door gap on the south border at x=2.
const room = { x: 0, y: 0, w: 6, h: 5 };
function isWall(x: number, y: number): boolean {
  const onBorder =
    x === room.x || x === room.x + room.w - 1 ||
    y === room.y || y === room.y + room.h - 1;
  if (!onBorder) return false;
  if (y === room.y + room.h - 1 && x === 2) return false; // south door gap
  return true;
}

describe("resolveWallRuns", () => {
  it("merges each solid border into one run", () => {
    const { runs } = resolveWallRuns(room, isWall);
    // north border (y=0) is solid x:0..5
    expect(runs).toContainEqual({ axis: "x", fixed: 0, start: 0, end: 5 });
  });

  it("splits a border at a door gap into two runs", () => {
    const { runs, doors } = resolveWallRuns(room, isWall);
    // south border (y=4) split around x=2 → x:0..1 and x:3..5
    expect(runs).toContainEqual({ axis: "x", fixed: 4, start: 0, end: 1 });
    expect(runs).toContainEqual({ axis: "x", fixed: 4, start: 3, end: 5 });
    expect(doors).toContainEqual({ axis: "x", fixed: 4, start: 2, end: 2 });
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run tests/unit/museum/WallRunResolver.test.ts`
Expected: FAIL — `resolveWallRuns is not a function`.

- [ ] **Step 3: Implement the resolver**

```ts
import type { ResolvedWalls, WallRun, DoorOpening } from "../domain/museum-kit-types";

export interface RoomRect { x: number; y: number; w: number; h: number; }

/**
 * Resolve a room's perimeter into merged wall runs + door openings.
 * Walks each of the four borders, splitting maximal wall stretches at gaps.
 * Mirrors the stamper's border model (north/south advance x, east/west advance z).
 */
export function resolveWallRuns(
  room: RoomRect,
  isWall: (x: number, y: number) => boolean,
): ResolvedWalls {
  const runs: WallRun[] = [];
  const doors: DoorOpening[] = [];
  const x0 = room.x, x1 = room.x + room.w - 1;
  const y0 = room.y, y1 = room.y + room.h - 1;

  // axis="x" borders: north (y0) and south (y1). axis="z" borders: west (x0), east (x1).
  const borders: { axis: "x" | "z"; fixed: number; from: number; to: number; at: (i: number) => [number, number] }[] = [
    { axis: "x", fixed: y0, from: x0, to: x1, at: (i) => [i, y0] },
    { axis: "x", fixed: y1, from: x0, to: x1, at: (i) => [i, y1] },
    { axis: "z", fixed: x0, from: y0, to: y1, at: (i) => [x0, i] },
    { axis: "z", fixed: x1, from: y0, to: y1, at: (i) => [x1, i] },
  ];

  for (const b of borders) {
    let runStart: number | null = null;
    let gapStart: number | null = null;
    const flushRun = (end: number) => {
      if (runStart !== null) { runs.push({ axis: b.axis, fixed: b.fixed, start: runStart, end }); runStart = null; }
    };
    const flushGap = (end: number) => {
      if (gapStart !== null) { doors.push({ axis: b.axis, fixed: b.fixed, start: gapStart, end }); gapStart = null; }
    };
    for (let i = b.from; i <= b.to; i++) {
      const [tx, ty] = b.at(i);
      if (isWall(tx, ty)) { flushGap(i - 1); if (runStart === null) runStart = i; }
      else { flushRun(i - 1); if (gapStart === null) gapStart = i; }
    }
    flushRun(b.to);
    flushGap(b.to);
  }

  return { runs, doors, posts: [] };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run tests/unit/museum/WallRunResolver.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum/services/wall-run-resolver.ts tests/unit/museum/WallRunResolver.test.ts
git commit -m "feat(museum): pure wall-run resolver (borders -> merged runs + doors)" -- src/lib/features/museum/services/wall-run-resolver.ts tests/unit/museum/WallRunResolver.test.ts
```

### Task 7: Procedural kit-piece provider (default) + GLB stub

**Files:**
- Create: `src/lib/features/museum/services/kit-piece-provider.ts`
- Test: `tests/unit/museum/KitPieceProvider.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { proceduralKitProvider } from "$lib/features/museum/services/kit-piece-provider";
import type { ResolvedWalls } from "$lib/features/museum/domain/museum-kit-types";

describe("proceduralKitProvider", () => {
  it("emits one wall group spanning each run length", () => {
    const walls: ResolvedWalls = {
      runs: [{ axis: "x", fixed: 0, start: 0, end: 3 }],
      doors: [],
      posts: [],
    };
    const root = proceduralKitProvider.buildWalls(walls, "institutional", 0.5, 4.5, "#e8e4e0");
    // a run of 4 tiles at 0.5m = 2m wide; root has at least one child mesh
    expect(root.children.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run tests/unit/museum/KitPieceProvider.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the procedural provider**

```ts
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from "three";
import type { Object3D } from "three";
import type { KitPieceProvider, ResolvedWalls, WallRun } from "../domain/museum-kit-types";
import type { WingTheme } from "../domain/museum-grid-types";

const ACCENT = "#9a8f7a";

function runDims(run: WallRun, tileSize: number) {
  const count = run.end - run.start + 1;
  const len = count * tileSize;
  // center of the run in world units (tile center convention: i*tileSize + tileSize/2)
  const centerAlong = (run.start + run.end) / 2 * tileSize + tileSize / 2;
  const fixedWorld = run.fixed * tileSize + tileSize / 2;
  if (run.axis === "x") return { cx: centerAlong, cz: fixedWorld, lx: len, lz: tileSize };
  return { cx: fixedWorld, cz: centerAlong, lx: tileSize, lz: len };
}

export const proceduralKitProvider: KitPieceProvider = {
  buildWalls(walls: ResolvedWalls, _theme: WingTheme, tileSize: number, wallHeight: number, color: string): Object3D {
    const root = new Group();
    const wallMat = new MeshStandardMaterial({ color, roughness: 0.8 });
    const trimMat = new MeshStandardMaterial({ color: ACCENT, roughness: 0.6 });

    for (const run of walls.runs) {
      const { cx, cz, lx, lz } = runDims(run, tileSize);
      const wall = new Mesh(new BoxGeometry(lx, wallHeight, lz), wallMat);
      wall.position.set(cx, wallHeight / 2, cz);
      root.add(wall);
      // baseboard + cornice trim (the "panel" read; replaced by GLB art in Phase 3)
      const base = new Mesh(new BoxGeometry(lx + 0.06, 0.6, lz + 0.06), trimMat);
      base.position.set(cx, 0.3, cz);
      root.add(base);
      const top = new Mesh(new BoxGeometry(lx + 0.06, 0.5, lz + 0.06), trimMat);
      top.position.set(cx, wallHeight - 0.25, cz);
      root.add(top);
    }
    return root;
  },
};

/**
 * GLB provider stub — Phase 3 swaps this in. It will load the baked
 * `static/models/museum/kit/<theme>/` GLB pieces and place them along runs.
 * Kept as a documented seam so the wiring in Task 8 needs no change later.
 */
export const glbKitProvider: KitPieceProvider | null = null;
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run tests/unit/museum/KitPieceProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum/services/kit-piece-provider.ts tests/unit/museum/KitPieceProvider.test.ts
git commit -m "feat(museum): procedural kit-piece provider + GLB provider seam" -- src/lib/features/museum/services/kit-piece-provider.ts tests/unit/museum/KitPieceProvider.test.ts
```

### Task 8: Route the institutional wing through runs in buildRoomChunk

**Files:**
- Modify: `src/lib/features/museum/services/museum-geometry-builder.ts` (the wall-batch block, ~564-575, and `RoomChunk` interface ~473)

**Why:** `buildRoomChunk` already receives `wing` (`bounds` + `theme`). For the institutional wing, build merged run geometry from the resolver + provider instead of the per-tile wall BatchedMesh. No worker-protocol change — wall positions still arrive per-tile; we reconstruct tile coords and run the resolver on the main thread.

- [ ] **Step 1: Add a kit-walls field to RoomChunk**

In the `RoomChunk` interface (builder.ts:473), add after `wallMeshes`:

```ts
/** When set, kit-built wall group replaces wallMeshes for this chunk. */
kitWalls: import("three").Object3D | null;
```

Initialize `kitWalls: null` wherever `RoomChunk` objects are returned (search the file for `return {` inside `buildRoomChunk` and add the field).

- [ ] **Step 2: Build runs for the institutional wing**

Add imports at the top of the file:
```ts
import { resolveWallRuns } from "./wall-run-resolver";
import { proceduralKitProvider, glbKitProvider } from "./kit-piece-provider";
```

Replace the wall-batch loop (builder.ts ~563-575) with a wing-conditional:

```ts
const wallMeshes: BatchedMeshData[] = [];
let kitWalls: import("three").Object3D | null = null;

if (wing && wing.theme === "institutional") {
  // Reconstruct wall tile coords from the bucketed world positions.
  const wallTiles = new Set<string>();
  for (const [, bucket] of buckets.wallBuckets) {
    for (const p of bucket.positions) {
      const tx = Math.round(p.x / TILE_SIZE);
      const ty = Math.round(p.z / TILE_SIZE);
      wallTiles.add(`${tx},${ty}`);
    }
  }
  const b = wing.bounds;
  const room = { x: b.x, y: b.y, w: b.width, h: b.height };
  const resolved = resolveWallRuns(room, (x, y) => wallTiles.has(`${x},${y}`));
  const color = WING_WALL_COLORS.institutional;
  const provider = glbKitProvider ?? proceduralKitProvider;
  kitWalls = provider.buildWalls(resolved, "institutional", TILE_SIZE, WALL_HEIGHT, color);
  kitWalls.userData.cameraCollider = true;
} else {
  for (const [, bucket] of buckets.wallBuckets) {
    if (bucket.positions.length === 0) continue;
    const texturePack = bucket.wingTheme ? WALL_TEXTURE_MAP[bucket.wingTheme] : undefined;
    const wallMat = texturePack
      ? loadPBR(texturePack, 4, bucket.color)
      : new MeshStandardMaterial({ color: bucket.color });
    const { mesh, instanceIds } = buildBatch(wallGeo, wallMat, bucket.positions, WALL_Y_CENTER);
    mesh.userData.cameraCollider = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    wallMeshes.push({ mesh, instanceIds });
  }
}
```

Add `kitWalls` to the returned `RoomChunk`.

- [ ] **Step 3: Add kitWalls to the scene add/remove path**

Run: `grep -n "wallMeshes" src/lib/features/museum/components/game/Museum3DScene.svelte src/lib/features/museum/services/museum-geometry-streamer.ts`
Wherever `chunk.wallMeshes` is added to the scene (`scene.add(mesh)`) and removed/disposed, add the parallel handling for `chunk.kitWalls` (add the Object3D when non-null; remove + dispose its child geometries/materials on teardown). Mirror the existing wallMeshes lifecycle exactly.

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/unit/museum/` then `npm run check:fast`
Expected: museum tests pass, no new type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum/services/museum-geometry-builder.ts src/lib/features/museum/components/game/Museum3DScene.svelte src/lib/features/museum/services/museum-geometry-streamer.ts
git commit -m "feat(museum): route institutional wing walls through merged kit runs" -- src/lib/features/museum/services/museum-geometry-builder.ts src/lib/features/museum/components/game/Museum3DScene.svelte src/lib/features/museum/services/museum-geometry-streamer.ts
```

### Task 9: Phase 2 verification

- [ ] **Step 1: Walk the institutional entrance, confirm merged walls + collision**

Confirm in-app: entrance walls are continuous (no per-tile seams), the camera still collides with walls (no walk-through), doorways frame openings, fps holds. Capture a DevTools screenshot (with permission) or hand the user the specific check. Record evidence before claiming done.

---

## PHASE 3 — Blender CC0 baked kit GLB (gated asset task)

> **Physical blocker (per `.claude/rules/autonomy-and-completeness.md`):** this phase needs a Blender session + sourcing a CC0 modular interior kit (Kenney/Quaternius). It cannot be fully verified headless. Do as much via the Blender MCP as available; otherwise hand the user the exact steps.

### Task 10: Author + bake + export the institutional kit GLB

**Files:**
- Create: `static/models/museum/kit/institutional/institutional-kit.glb`
- Modify: `src/lib/features/museum/services/kit-piece-provider.ts` (implement `glbKitProvider`)

- [ ] **Step 1: Source the kit** — download a CC0 modular interior set (Kenney "Furniture Kit" / Quaternius modular rooms). Confirm CC0 license per `.claude/rules/blender-first-3d-scenes.md` sourcing section.
- [ ] **Step 2: Theme + bake in Blender** — apply institutional/marble materials, bake AO/lightmap, origin pieces to the tile module (0.5m-tileable wall section, corner, doorway).
- [ ] **Step 3: Export via the ocean pipeline** — `gltf-transform optimize` (1024 textures, WebP/KTX2, dedup, GPU-instance, weld, simplify ≤0.65, Draco, prune) → `static/models/museum/kit/institutional/`.
- [ ] **Step 4: Implement `glbKitProvider`** — load the GLB (`useGltf` + meshopt/Draco decoders per the ocean reference), place pieces along `walls.runs`/`walls.doors`. Because Task 8 already does `glbKitProvider ?? proceduralKitProvider`, no wiring change is needed — flipping `glbKitProvider` from `null` to the impl switches the wing over.
- [ ] **Step 5: Verify** — walk the wing; confirm baked lighting reads, then remove the interim directional from Task 3 if it's now redundant. Capture evidence.

---

## Self-Review

**Spec coverage:** holes→sky (Tasks 2, 8 runs + doors), see-through floor (Task 1), black walls (Task 3 interim + Task 10 baked), merged runs (Tasks 6, 8), kit provider seam + Meshy-props-slot-reserved (Task 7 leaves non-institutional wings on the existing path; props are out-of-scope per spec), Entrance/institutional slice (Task 8 gate on `theme === "institutional"`), success criteria (Tasks 4, 9, 10 verification). Covered.

**Placeholder scan:** every code step has real code; the only deferred work is Phase 3's asset authoring, explicitly flagged as a physical blocker, not a placeholder.

**Type consistency:** `resolveWallRuns(room, isWall) → ResolvedWalls`; `KitPieceProvider.buildWalls(walls, theme, tileSize, wallHeight, color) → Object3D`; `RoomChunk.kitWalls: Object3D | null`. `WallRun`/`DoorOpening`/`ResolvedWalls` defined once in `museum-kit-types.ts` and consumed unchanged in resolver, provider, and builder. Consistent.

**Risk note:** Task 8 Step 3 (streamer add/remove lifecycle for `kitWalls`) is the integration-risk step — the executor MUST read the existing `wallMeshes` add/dispose sites and mirror them exactly, or chunks will leak or fail to render on stream-out.
