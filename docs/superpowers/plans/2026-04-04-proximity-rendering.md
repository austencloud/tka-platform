# Proximity-Based Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mount only museum 3D components near the player, reducing initial load from 6-12s to <500ms.

**Architecture:** A generic `ProximityGrid<T>` spatial index buckets objects into cells. Museum3DScene queries nearby cells each time the player moves 2+ tiles, maintaining visible sets with hysteresis (mount at 30 tiles, unmount at 40 tiles) and batched mounting (max 5 new components per frame).

**Tech Stack:** Svelte 5, Threlte/Three.js, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-04-proximity-rendering-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/features/museum/services/contracts/IProximityGrid.ts` | Create | Generic spatial grid interface |
| `src/lib/features/museum/services/implementations/ProximityGrid.ts` | Create | Grid implementation with insert + queryRadius |
| `tests/unit/museum/ProximityGrid.test.ts` | Create | Unit tests for spatial grid |
| `src/lib/features/museum/components/game/Museum3DScene.svelte` | Modify | Wire proximity grids, replace {#each} sources, remove mountStage |
| `src/lib/features/museum/components/game/MuseumFurniture.svelte` | Modify | Accept filtered placements array instead of full grid |
| `src/lib/features/museum/components/game/MuseumTorch3D.svelte` | Modify | Add onDestroy disposal |
| `src/lib/features/museum/components/game/MuseumPlaque3D.svelte` | Modify | Add onDestroy disposal |
| `src/lib/features/museum/components/game/MuseumPerformerStation3D.svelte` | Modify | Add onDestroy disposal |

---

### Task 1: ProximityGrid service — interface + implementation + tests

**Files:**
- Create: `src/lib/features/museum/services/contracts/IProximityGrid.ts`
- Create: `src/lib/features/museum/services/implementations/ProximityGrid.ts`
- Create: `tests/unit/museum/ProximityGrid.test.ts`

- [ ] **Step 1: Write the interface**

```typescript
// src/lib/features/museum/services/contracts/IProximityGrid.ts
export interface IProximityGrid<T> {
  /** Insert an item at a tile position. */
  insert(item: T, tileX: number, tileY: number): void;
  /** Return all items within `radius` tiles of the center point. */
  queryRadius(centerX: number, centerY: number, radius: number): T[];
  /** Return total item count (for debugging). */
  readonly size: number;
}
```

- [ ] **Step 2: Write failing tests**

```typescript
// tests/unit/museum/ProximityGrid.test.ts
import { describe, it, expect } from "vitest";
import { ProximityGrid } from "$lib/features/museum/services/implementations/ProximityGrid";

describe("ProximityGrid", () => {
  it("returns items within radius", () => {
    const grid = new ProximityGrid<string>(8);
    grid.insert("A", 10, 10);
    grid.insert("B", 12, 10);
    grid.insert("C", 50, 50);
    const result = grid.queryRadius(10, 10, 5);
    expect(result).toContain("A");
    expect(result).toContain("B");
    expect(result).not.toContain("C");
  });

  it("returns empty for empty grid", () => {
    const grid = new ProximityGrid<string>(8);
    expect(grid.queryRadius(0, 0, 30)).toEqual([]);
  });

  it("handles items at cell boundaries", () => {
    const grid = new ProximityGrid<string>(8);
    grid.insert("edge", 8, 0); // exactly on cell boundary
    const result = grid.queryRadius(7, 0, 2);
    expect(result).toContain("edge");
  });

  it("reports correct size", () => {
    const grid = new ProximityGrid<string>(8);
    grid.insert("A", 0, 0);
    grid.insert("B", 10, 10);
    expect(grid.size).toBe(2);
  });

  it("does not return items just outside radius", () => {
    const grid = new ProximityGrid<number>(8);
    grid.insert(1, 0, 0);
    grid.insert(2, 0, 31); // 31 tiles away
    const result = grid.queryRadius(0, 0, 30);
    expect(result).toContain(1);
    expect(result).not.toContain(2);
  });

  it("handles large insert counts", () => {
    const grid = new ProximityGrid<number>(8);
    for (let i = 0; i < 1000; i++) {
      grid.insert(i, Math.floor(Math.random() * 200), Math.floor(Math.random() * 200));
    }
    expect(grid.size).toBe(1000);
    // Should not throw and should return subset
    const result = grid.queryRadius(100, 100, 30);
    expect(result.length).toBeLessThan(1000);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/museum/ProximityGrid.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write implementation**

```typescript
// src/lib/features/museum/services/implementations/ProximityGrid.ts
import type { IProximityGrid } from "../contracts/IProximityGrid";

export class ProximityGrid<T> implements IProximityGrid<T> {
  private readonly cells = new Map<string, { item: T; tileX: number; tileY: number }[]>();
  private readonly cellSize: number;
  private count = 0;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  get size(): number {
    return this.count;
  }

  insert(item: T, tileX: number, tileY: number): void {
    const key = this.cellKey(tileX, tileY);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push({ item, tileX, tileY });
    this.count++;
  }

  queryRadius(centerX: number, centerY: number, radius: number): T[] {
    const r2 = radius * radius;
    const minCX = Math.floor((centerX - radius) / this.cellSize);
    const maxCX = Math.floor((centerX + radius) / this.cellSize);
    const minCY = Math.floor((centerY - radius) / this.cellSize);
    const maxCY = Math.floor((centerY + radius) / this.cellSize);

    const results: T[] = [];
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(`${cx},${cy}`);
        if (!cell) continue;
        for (const entry of cell) {
          const dx = entry.tileX - centerX;
          const dy = entry.tileY - centerY;
          if (dx * dx + dy * dy <= r2) {
            results.push(entry.item);
          }
        }
      }
    }
    return results;
  }

  private cellKey(tileX: number, tileY: number): string {
    return `${Math.floor(tileX / this.cellSize)},${Math.floor(tileY / this.cellSize)}`;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/museum/ProximityGrid.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```
feat(museum): add ProximityGrid spatial index for proximity-based rendering
```

---

### Task 2: Add stable IDs to all proximity-filtered data types

**Files:**
- Modify: `src/lib/features/museum/components/game/Museum3DScene.svelte`

Currently torches, exhibit lights, and ceiling lights are plain position objects with no stable ID. Add an `id` field to each during the bucket loop.

- [ ] **Step 1: Add `id` and `tileX`/`tileY` fields to all position types**

In the script block of Museum3DScene.svelte, update ALL position type declarations to include `id`, `tileX`, and `tileY`. The proximity grid needs tile coordinates for spatial indexing and IDs for keyed `{#each}` diffing.

**Torches:**
```typescript
const torchPositions: { id: number; tileX: number; tileY: number; x: number; z: number; wallOffsetX: number; wallOffsetZ: number; wingTheme: WingTheme }[] = [];
let nextTorchId = 0;

// In the tile loop, torch case — add id, tileX, tileY:
torchPositions.push({ id: nextTorchId++, tileX, tileY, x: worldX, z: worldZ, wallOffsetX, wallOffsetZ, wingTheme: torchWingTheme });
```

**PlaquePlacement interface:**
```typescript
interface PlaquePlacement {
  id: number;       // new — incrementing counter
  tileX: number;    // new — tile coordinate for proximity grid
  tileY: number;    // new — tile coordinate for proximity grid
  worldX: number;
  worldZ: number;
  yaw: number;
  wallOffsetX: number;
  wallOffsetZ: number;
  content: PlaqueContent;
  size: PlaqueSize;
  refId: string;
}
let nextPlaqueId = 0;

// In exhibit-panel case:
plaquePlacements.push({ id: nextPlaqueId++, tileX, tileY, worldX, worldZ, /* rest unchanged */ });
```

**Exhibit light positions (near line ~1200):**
```typescript
const exhibitLightPositions: { id: number; tileX: number; tileY: number; x: number; z: number }[] = [];
let nextExhibitLightId = 0;

// When populating from plaquePlacements:
exhibitLightPositions.push({ id: nextExhibitLightId++, tileX: p.tileX, tileY: p.tileY, x: p.worldX, z: p.worldZ });
```

**Ceiling light positions (near line ~1210):**
```typescript
const ceilingLightPositions: { id: number; tileX: number; tileY: number; x: number; z: number }[] = [];
let nextCeilingLightId = 0;

// In the wing loop:
ceilingLightPositions.push({
  id: nextCeilingLightId++,
  tileX: b.x + dx,
  tileY: b.y + dy,
  x: (b.x + dx) * TILE_SIZE,
  z: (b.y + dy) * TILE_SIZE,
});
```

- [ ] **Step 3: Add keys to all `{#each}` blocks that lack them**

Update the template:
- Torches: `{#each torchPositions as torch}` → `{#each torchPositions as torch (torch.id)}`
- Exhibit lights: `{#each exhibitLightPositions as pos}` → `{#each exhibitLightPositions as pos (pos.id)}`
- Ceiling lights: `{#each ceilingLightPositions as cLight}` → `{#each ceilingLightPositions as cLight (cLight.id)}`

- [ ] **Step 4: Verify build**

Run: `npm run check 2>&1 | grep Museum3DScene`
Expected: No new errors

- [ ] **Step 5: Commit**

```
feat(museum): add stable IDs and keys to proximity-filterable components
```

---

### Task 3: Wire ProximityGrid into Museum3DScene

**Files:**
- Modify: `src/lib/features/museum/components/game/Museum3DScene.svelte`

This is the core integration task. Build the grids, compute visible sets, and replace the template sources.

- [ ] **Step 1: Import ProximityGrid and build grids during init**

After the tile bucketing loop, build one grid per component type:

```typescript
import { ProximityGrid } from "../../services/implementations/ProximityGrid";

const CELL_SIZE = 8;
const MOUNT_RADIUS = 30;
const UNMOUNT_RADIUS = 40;
const MAX_MOUNTS_PER_FRAME = 5;

const torchGrid = new ProximityGrid<typeof torchPositions[0]>(CELL_SIZE);
for (const t of torchPositions) torchGrid.insert(t, Math.round(t.x / TILE_SIZE), Math.round(t.z / TILE_SIZE));

const plaqueGrid = new ProximityGrid<PlaquePlacement>(CELL_SIZE);
for (const p of plaquePlacements) plaqueGrid.insert(p, p.tileX, p.tileY);

const performerGrid = new ProximityGrid<typeof grid.performers[0]>(CELL_SIZE);
for (const p of grid.performers) performerGrid.insert(p, p.tileX, p.tileY);

const exhibitLightGrid = new ProximityGrid<typeof exhibitLightPositions[0]>(CELL_SIZE);
for (const l of exhibitLightPositions) exhibitLightGrid.insert(l, Math.round(l.x / TILE_SIZE), Math.round(l.z / TILE_SIZE));

const ceilingLightGrid = new ProximityGrid<typeof ceilingLightPositions[0]>(CELL_SIZE);
for (const l of ceilingLightPositions) ceilingLightGrid.insert(l, Math.round(l.x / TILE_SIZE), Math.round(l.z / TILE_SIZE));
```

Also build a grid for furniture items from `grid.furniture`:
```typescript
const furnitureGrid = new ProximityGrid<typeof grid.furniture[0]>(CELL_SIZE);
for (const f of (grid.furniture ?? [])) furnitureGrid.insert(f, f.tileX, f.tileY);
```

- [ ] **Step 2: Add visible-set state and recomputation logic**

```typescript
// Visible sets — only these items get rendered
let visibleTorches = $state<typeof torchPositions>([] as any);
let visiblePlaques = $state<PlaquePlacement[]>([]);
let visiblePerformers = $state<typeof grid.performers>([]);
let visibleExhibitLights = $state<typeof exhibitLightPositions>([] as any);
let visibleCeilingLights = $state<typeof ceilingLightPositions>([] as any);
let visibleFurniture = $state<typeof grid.furniture>([]);

// Pending mount queue (batched at MAX_MOUNTS_PER_FRAME)
// Each entry: { category, item }
type MountCategory = "torch" | "plaque" | "performer" | "exhibitLight" | "ceilingLight" | "furniture";
let pendingMounts: { category: MountCategory; item: any }[] = [];

let lastCheckTX = -999;
let lastCheckTY = -999;

function recomputeVisibility(playerTX: number, playerTY: number): void {
  // Use editor/top-down bypass: if editor active or not in FPS, skip filtering
  if (museum3dEditorState.editorActive || !fpsActive) {
    visibleTorches = torchPositions;
    visiblePlaques = plaquePlacements;
    visiblePerformers = grid.performers;
    visibleExhibitLights = exhibitLightPositions;
    visibleCeilingLights = ceilingLightPositions;
    visibleFurniture = grid.furniture ?? [];
    pendingMounts = [];
    return;
  }

  lastCheckTX = playerTX;
  lastCheckTY = playerTY;

  // Helper: hysteresis union — new query + surviving old items
  // All items have tileX/tileY (added in Task 2), so no fallback needed
  function hysteresisUpdate<T extends { tileX: number; tileY: number }>(
    proxGrid: ProximityGrid<T>,
    current: T[],
    keyFn: (item: T) => string | number,
  ): T[] {
    const fromQuery = proxGrid.queryRadius(playerTX, playerTY, MOUNT_RADIUS);
    const queryKeys = new Set(fromQuery.map(keyFn));
    // Surviving old: still within unmount radius and not already in query
    const surviving = current.filter(item => {
      if (queryKeys.has(keyFn(item))) return false; // already in query result
      const dx = item.tileX - playerTX;
      const dy = item.tileY - playerTY;
      return dx * dx + dy * dy <= UNMOUNT_RADIUS * UNMOUNT_RADIUS;
    });
    return [...fromQuery, ...surviving];
  }

  visibleTorches = hysteresisUpdate(torchGrid, visibleTorches, t => t.id);
  visiblePlaques = hysteresisUpdate(plaqueGrid, visiblePlaques, p => p.refId);
  visiblePerformers = hysteresisUpdate(performerGrid, visiblePerformers, p => p.id);
  visibleExhibitLights = hysteresisUpdate(exhibitLightGrid, visibleExhibitLights, l => l.id);
  visibleCeilingLights = hysteresisUpdate(ceilingLightGrid, visibleCeilingLights, l => l.id);
  visibleFurniture = hysteresisUpdate(furnitureGrid, visibleFurniture, f => f.id);
}

// Compute initial visible set from spawn
recomputeVisibility(grid.spawn.x, grid.spawn.y);
```

- [ ] **Step 3: Add mount batching drain to the useTask game loop**

The `recomputeVisibility` function produces the full desired visible set immediately. But if 40 new items suddenly appear (e.g., portal teleport), mounting them all at once would cause a multi-second spike. Instead, when the new visible set has items that weren't in the old set, queue them and drain MAX_MOUNTS_PER_FRAME per frame.

Implementation approach: `recomputeVisibility` computes the target set. Compare target vs current. Items to remove: remove immediately (unmount is cheap). Items to add: push to `pendingMounts` queue. Each frame in `useTask`, shift up to 5 from the queue into the `$state` arrays.

```typescript
// In useTask, at the top (runs every frame):
if (pendingMounts.length > 0) {
  const batch = pendingMounts.splice(0, MAX_MOUNTS_PER_FRAME);
  for (const { category, item } of batch) {
    switch (category) {
      case "torch": visibleTorches = [...visibleTorches, item]; break;
      case "plaque": visiblePlaques = [...visiblePlaques, item]; break;
      case "performer": visiblePerformers = [...visiblePerformers, item]; break;
      case "exhibitLight": visibleExhibitLights = [...visibleExhibitLights, item]; break;
      case "ceilingLight": visibleCeilingLights = [...visibleCeilingLights, item]; break;
      case "furniture": visibleFurniture = [...visibleFurniture, item]; break;
    }
  }
}
```

Modify `recomputeVisibility` to compute target sets but only immediately apply removals. New items go to `pendingMounts`:

```typescript
// Inside recomputeVisibility, after computing targetTorches via hysteresisUpdate:
const currentTorchKeys = new Set(visibleTorches.map(t => t.id));
const targetTorchKeys = new Set(targetTorches.map(t => t.id));
// Removals: apply immediately
visibleTorches = visibleTorches.filter(t => targetTorchKeys.has(t.id));
// Additions: queue for batched mount
for (const t of targetTorches) {
  if (!currentTorchKeys.has(t.id)) pendingMounts.push({ category: "torch", item: t });
}
// Repeat for each category...
```

- [ ] **Step 4: Add visibility recheck to the useTask game loop**

Inside the existing `useTask((delta) => { ... })` block, after player position updates and after the pending mount drain, add:

```typescript
// Proximity visibility recheck — runs when player moves 2+ tiles
const currentTX = Math.round(playerPosition.x / TILE_SIZE);
const currentTY = Math.round(playerPosition.z / TILE_SIZE);
const dCheckX = currentTX - lastCheckTX;
const dCheckY = currentTY - lastCheckTY;
if (dCheckX * dCheckX + dCheckY * dCheckY >= 4) {
  recomputeVisibility(currentTX, currentTY);
}
```

- [ ] **Step 5: Replace template {#each} sources**

In the template, replace:
- `{#each torchPositions as torch (torch.id)}` → `{#each visibleTorches as torch (torch.id)}`
- `{#each plaquePlacements as plaque (plaque.refId)}` → `{#each visiblePlaques as plaque (plaque.refId)}`
- `{#each grid.performers as performer (performer.id)}` → `{#each visiblePerformers as performer (performer.id)}`
- `{#each exhibitLightPositions as pos (pos.id)}` → `{#each visibleExhibitLights as pos (pos.id)}`
- `{#each ceilingLightPositions as cLight (cLight.id)}` → `{#each visibleCeilingLights as cLight (cLight.id)}`

- [ ] **Step 6: Remove the 4-stage mountStage system**

Delete:
- The `mountStage` state and `onMount` with `advance()` rAF chain
- All `{#if mountStage >= N}` / `{/if}` wrappers around template sections
- The stage comments

The template should now be flat — all `{#each}` blocks at the same level, gated only by the visible-set arrays.

- [ ] **Step 7: Recompute torchesWithLight from visible set**

The existing `torchesWithLight` (capped at 32 lights) currently filters from `torchPositions`. Change it to derive from `visibleTorches`:

```typescript
// Move this computation to a $derived or recompute inside recomputeVisibility
// Since visibleTorches changes reactively, use $derived:
const torchLightSet = $derived.by(() => {
  const withLight = visibleTorches.length <= MAX_POINT_LIGHTS
    ? visibleTorches
    : visibleTorches.slice(0, MAX_POINT_LIGHTS);
  return new Set(withLight.map(t => `${t.x},${t.z}`));
});
```

Note: the current `torchLightSet` is computed once at init from `torchesWithLight`. It needs to become reactive since the visible set changes.

- [ ] **Step 8: Verify build**

Run: `npm run check 2>&1 | grep Museum3DScene`
Expected: No new errors from this file

- [ ] **Step 9: Commit**

```
feat(museum): wire proximity-based rendering into Museum3DScene
```

---

### Task 4: Refactor MuseumFurniture to accept filtered placements

**Files:**
- Modify: `src/lib/features/museum/components/game/MuseumFurniture.svelte`
- Modify: `src/lib/features/museum/components/game/Museum3DScene.svelte` (usage site)

- [ ] **Step 1: Change MuseumFurniture props from grid to placements array**

```typescript
// MuseumFurniture.svelte — new props
interface Props {
  placements: FurniturePlacement[];
  tileSize: number;
}

interface FurniturePlacement {
  id: string;
  role: string;
  tileX: number;
  tileY: number;
  rotationY: number;
}

let { placements, tileSize }: Props = $props();
```

Update `collectPlacements()` to iterate `placements` instead of `grid.furniture`.

- [ ] **Step 2: Update Museum3DScene usage**

```svelte
<!-- Old -->
<MuseumFurniture {grid} tileSize={TILE_SIZE} />

<!-- New -->
<MuseumFurniture placements={visibleFurniture} tileSize={TILE_SIZE} />
```

- [ ] **Step 3: Verify build**

Run: `npm run check 2>&1 | grep -E "MuseumFurniture|Museum3DScene"`
Expected: No new errors

- [ ] **Step 4: Commit**

```
refactor(museum): MuseumFurniture accepts filtered placements instead of full grid
```

---

### Task 5: Add Three.js resource disposal to heavy components

**Files:**
- Modify: `src/lib/features/museum/components/game/MuseumTorch3D.svelte`
- Modify: `src/lib/features/museum/components/game/MuseumPlaque3D.svelte`

With proximity rendering, components mount and unmount as the player walks. Without disposal, Three.js geometries/materials/textures leak.

- [ ] **Step 1: Add disposal to MuseumTorch3D**

Add `onDestroy` that disposes the flame shader material, volumetric cone material, ember particle geometry/material, and fallback sphere geometry/material. The GLTF model is managed by the loader cache so don't dispose that.

```typescript
import { onDestroy } from "svelte";

onDestroy(() => {
  flameMat?.dispose();
  coneGeo?.dispose();
  coneMat?.dispose();
  emberGeo?.dispose();
  emberMat?.dispose();
  fallbackGeo?.dispose();
  fallbackMat?.dispose();
});
```

Adjust variable names to match the actual names in the component.

- [ ] **Step 2: Add disposal to MuseumPlaque3D**

```typescript
import { onDestroy } from "svelte";

onDestroy(() => {
  plaqueGeo.dispose();
  frameGeo.dispose();
  plaqueMat.dispose();
  frameMat.dispose();
  texture.dispose();
});
```

- [ ] **Step 3: Add disposal to MuseumPerformerStation3D**

Check the component for any geometries or materials created in the script block (e.g., the platform CylinderGeometry and MeshStandardMaterial). Add `onDestroy` to dispose them. Avatar3D and Prop3D handle their own disposal via their existing `onDestroy` handlers.

```typescript
import { onDestroy } from "svelte";

onDestroy(() => {
  platformGeo?.dispose();
  platformMat?.dispose();
});
```

Adjust variable names to match the actual names in the component.

- [ ] **Step 4: Verify build**

Run: `npm run check 2>&1 | grep -E "MuseumTorch3D|MuseumPlaque3D|MuseumPerformerStation3D"`
Expected: No new errors

- [ ] **Step 5: Commit**

```
fix(museum): add Three.js resource disposal to torch, plaque, and performer components
```

---

### Task 6: Performance verification

**Files:** None (testing only)

- [ ] **Step 1: Use Chrome DevTools MCP to measure museum load time**

Same methodology as before:
1. Navigate to Create module
2. Clear sessionStorage (`museum-grid-cache`, `museum-assets-loaded`, etc.)
3. Inject PerformanceObserver for long tasks
4. Click Museum nav
5. Wait 15 seconds
6. Read long task data

- [ ] **Step 2: Compare results**

Expected improvements:
- Max single task: <1 second (down from 6+ seconds)
- Total blocking time: <2 seconds (down from 12 seconds)
- Initial mount: only spawn-area components (~10-20 items)

- [ ] **Step 3: Walk around the museum and verify components mount/unmount**

Navigate through the museum. Components should appear as you approach and disappear as you walk away. No visual pop-in within the fog range (components mount before they become visible through fog).

- [ ] **Step 4: Test portal teleport**

Walk into a portal. Components near the destination should mount within 1-2 frames. No extended freeze.

- [ ] **Step 5: Test editor mode bypass**

Press Tab to enter editor mode. All components should be visible (proximity filtering disabled).

- [ ] **Step 6: Commit cleanup — remove any leftover timing probes**

Check for any `__mark`, `__t0`, `__gridStart`, or `console.log` timing probes left from the optimization session. Remove them.

```
chore(museum): remove optimization timing probes
```
