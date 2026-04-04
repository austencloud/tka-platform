# Proximity-Based Rendering for Museum 3D Scene

**Date**: 2026-04-04
**Status**: Design

## Problem

Museum3DScene mounts all heavy components (torches, plaques, performers, furniture, lights) at once, blocking the main thread for 6-12 seconds. The player can only see ~15m in any direction due to fog and FOV. Most components are invisible at any given moment.

## Solution

Mount only components within a radius of the player. Use a spatial grid index for O(1) lookups as the museum grows.

## Constants

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Cell size | 8x8 tiles (4x4m) | Balance between granularity and cell count |
| Mount radius | 30 tiles (15m) | Covers densest fog visibility (cave: ~15m) |
| Unmount radius | 40 tiles (20m) | 10-tile hysteresis prevents flicker at boundary |
| Update trigger | Player moves 2+ tiles (Euclidean) from last check | Avoids recomputation while standing still |
| Max mounts per frame | 5 | Prevents mount spikes when teleporting or crossing zone boundaries |

## Architecture

### ProximityGrid (new service)

Path: `src/lib/features/museum/services/contracts/IProximityGrid.ts` + `services/implementations/ProximityGrid.ts`

A plain TypeScript class (not Svelte-reactive). Built once from the grid data during Museum3DScene init.

```typescript
interface IProximityGrid<T> {
  insert(item: T, tileX: number, tileY: number): void;
  queryRadius(centerX: number, centerY: number, radius: number): T[];
}
```

Internally stores items in a `Map<string, T[]>` keyed by cell coordinate (`Math.floor(tileX / cellSize), Math.floor(tileY / cellSize)`).

`queryRadius` iterates the axis-aligned bounding box of cells that the circle could touch (cell range: `floor((center - radius) / cellSize)` to `floor((center + radius) / cellSize)`). No exact circle intersection — the bounding box overestimates by ~21% area which is acceptable for this use case. With 8x8 cells and a 30-tile radius, that's ~16 cells checked per query regardless of total object count.

### Hysteresis Algorithm

The visibility recomputation is a union operation, not a simple replacement:

```
newFromQuery = queryRadius(playerTX, playerTY, MOUNT_RADIUS)
survivingOld = filter(currentVisible, item => dist(item, player) <= UNMOUNT_RADIUS)
newVisible = union(newFromQuery, survivingOld)  // deduplicate by key
```

Items enter the visible set at 30 tiles and stay until they exceed 40 tiles. This prevents mount/unmount thrashing at the boundary.

### Mount Batching

When the visible set changes, new mounts are capped at MAX_MOUNTS_PER_FRAME (5). If more items enter the visible set simultaneously (e.g., after a portal teleport), they queue and mount across subsequent frames. This prevents the exact main-thread spike the proximity system is designed to avoid.

Implementation: maintain a `pendingMounts` queue. Each frame, shift up to 5 items from the queue into the `$state` array. Unmounts happen immediately (removing a component is cheap).

### Stable Keys

All items need a stable unique key for Svelte's keyed `{#each}` diffing:

- **Torches**: Assign incrementing numeric ID during bucket loop (position strings could collide if two torches share a tile)
- **Plaques**: Already keyed by `refId`
- **Performers**: Already keyed by `id`
- **Furniture**: Assign incrementing numeric ID during bucket loop
- **Exhibit lights**: Assign incrementing numeric ID
- **Ceiling lights**: Assign incrementing numeric ID

### Integration into Museum3DScene

**Init phase** (script block):
- Build one `ProximityGrid` per component type
- Insert items as they're bucketed during the existing tile loop
- Compute initial visible set from spawn position

**Reactive state**:
- `lastCheckTX`, `lastCheckTY`: last position where visibility was recomputed
- `visibleTorches`, `visiblePlaques`, etc.: `$state` arrays of currently visible items
- `pendingMounts`: queue of items waiting to be mounted (batched at 5/frame)

**Update logic** (inside existing `useTask` game loop):
- Each frame, if `pendingMounts` is non-empty, shift up to 5 items into their respective `$state` arrays
- Compare current player tile to `lastCheckT*`
- If Euclidean distance squared >= 4 (i.e., 2+ tiles), run the hysteresis algorithm and update visible sets + pending queue

**Template**:
- Replace `{#each torchPositions as torch}` with `{#each visibleTorches as torch (torch.id)}`
- Same for plaques, performers, exhibit lights, ceiling lights
- Remove the 4-stage `mountStage` system entirely

### MuseumFurniture Refactoring

`MuseumFurniture` currently receives the entire grid and iterates furniture internally. To proximity-filter furniture:
- Pass `visibleFurniture` as a prop instead of the full grid
- MuseumFurniture iterates the filtered array instead of `grid.furniture`
- Minimal change — just swap the data source

### What is NOT proximity-filtered

- **Instanced meshes** (floors, walls, ceilings, pedestals, signs): One draw call per bucket via InstancedMesh
- **Ambient/directional/hemisphere lights**: Scene-wide
- **Post-processing**: Scene-wide
- **Portals**: Fixed pair, always needed for teleport detection
- **Mirrors**: Max 2, not worth the complexity

### Torch Light Budget

The existing 32-light cap for torch PointLights applies WITHIN the visible set. When computing `torchesWithLight`, filter from `visibleTorches` instead of `torchPositions`. Since the visible set is ~10-20 torches, most visible torches will have lights (better visual quality near the player).

### Three.js Resource Cleanup

When components unmount (leave visible set), their Three.js resources must be disposed. Check that MuseumTorch3D, MuseumPlaque3D, and MuseumPerformerStation3D have `onDestroy` handlers that dispose geometries, materials, and textures. Add disposal if missing.

## Performance Impact

**Before**: All ~100+ heavy components mount synchronously. 6-12 seconds blocking.

**After**: Only ~10-20 components mount initially (those near spawn), batched at 5/frame. As player walks, 2-5 components mount/unmount per recheck. No frame exceeds ~200ms of mount work.

**Scaling**: Grid cell lookup is O(cells_in_radius) which is constant (~16 cells). Museum can grow to 1000+ objects with no degradation.

## Files Changed

| File | Change |
|------|--------|
| `services/contracts/IProximityGrid.ts` (new) | Generic spatial grid interface |
| `services/implementations/ProximityGrid.ts` (new) | Spatial grid implementation |
| `Museum3DScene.svelte` | Add grids, visible-set recomputation in useTask, replace {#each} sources, remove mountStage, add stable keys |
| `MuseumFurniture.svelte` | Accept filtered furniture array prop instead of full grid |

## Edge Cases

- **Spawn**: Only components near spawn mount initially. Primary performance win.
- **Portal teleport**: Position jumps. Next frame triggers recheck. Mount batching prevents spike.
- **Editor mode**: Disable proximity filtering when `museum3dEditorState.editorActive` is true (mount everything).
- **Top-down camera**: Disable proximity filtering (same as editor). Top-down is dev-only.
