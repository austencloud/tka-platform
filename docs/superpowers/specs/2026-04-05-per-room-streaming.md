# Per-Room Geometry Streaming

**Date:** 2026-04-05
**Status:** Draft — next session priority
**Scope:** Only load geometry for the current room + adjacent rooms, dispose distant rooms

---

## Problem

The museum loads ALL 16,700 tiles into InstancedMeshes at once. A player standing in one room (1,000-1,700 tiles) forces the GPU to compile shaders and upload textures for rooms they'll never see until they walk through several doors. This causes a multi-second freeze on first load regardless of caching.

### Evidence (from MuseumGeometryScaling tests)

| Rooms | Tiles | Bucketing Time |
|-------|-------|---------------|
| 1 | 1,708 | 0.4ms |
| 3 | 4,842 | 2.6ms |
| 16 (full) | 16,724 | 5.8ms |

JS bucketing is linear and fast. The bottleneck is GPU-side: creating InstancedMesh objects, compiling PBR shaders per unique material, and uploading textures. Loading 3 rooms instead of 16 means ~70% fewer materials to compile and ~70% fewer texture uploads.

---

## Design

### Core Concept

```
Player is in Room A, which has doors to Room B and Room C.

Loaded: [Room A] [Room B] [Room C]
Disposed: all other rooms

Player walks through door into Room B. Room B has doors to A and D.

Loaded: [Room A] [Room B] [Room D]
Disposed: Room C (no longer adjacent)
```

### Room Chunk

Each room produces its own independent set of InstancedMeshes:

```typescript
interface RoomChunk {
  wingId: string;
  floorMeshes: InstancedMesh[];
  wallMeshes: InstancedMesh[];
  ceilingMesh: InstancedMesh | null;
  pedestalMesh: InstancedMesh | null;
  signMesh: InstancedMesh | null;
  torchPositions: TorchPosition[];
  plaquePlacements: PlaquePlacement[];
  performerPositions: { x: number; z: number }[];
  exhibitLightPositions: LightPosition[];
  ceilingLightPositions: LightPosition[];
  roomLight: RoomLight;
}
```

### Corridor Chunks

Corridors connecting rooms are their own chunks. A corridor is loaded when EITHER of its endpoint rooms is loaded. This prevents gaps between rooms.

### Streaming Manager

```typescript
class RoomStreamingManager {
  private loadedChunks = new Map<string, RoomChunk>();
  private roomAdjacency: Map<string, Set<string>>;  // room → set of adjacent room IDs

  /** Called every frame with the player's current room ID */
  update(currentRoomId: string): {
    toLoad: string[];    // room IDs to build geometry for
    toDispose: string[]; // room IDs to remove from scene
  }
}
```

The adjacency map is built once from `MUSEUM_EDGES` (each edge connects two rooms via a door).

### Loading Strategy

1. **Current room**: always loaded, highest priority
2. **Adjacent rooms** (connected by doors): loaded, second priority
3. **Recently left rooms**: keep for 5 seconds (hysteresis), then dispose
4. **Everything else**: not loaded, geometry disposed

### Disposal

When a room chunk is disposed:
- Remove all its InstancedMeshes from the scene graph
- Call `.dispose()` on geometries and materials (frees GPU memory)
- Remove torch/plaque/performer/light components (Svelte unmounts)

### Preloading on Approach

When the player is within N tiles of a door, start loading the room on the other side. This hides the load behind walking time.

---

## Implementation

### Step 1: Refactor `bucketMuseumTiles` to bucket per-room

Currently buckets ALL tiles into global floor/wall maps. Change to produce per-room buckets:

```typescript
function bucketMuseumTilesByRoom(grid: MuseumGrid): Map<string, MuseumGeometryDryRun> {
  // For each wing, filter grid.tiles to only tiles within wing.bounds
  // Corridor tiles: assigned to a special "corridor:from->to" chunk
}
```

The `wingThemeByTile` lookup already maps each tile to a wing. Corridor tiles (outside all wings) need a separate pass.

### Step 2: Refactor `buildMuseumGeometry` to build per-room

```typescript
async function buildRoomChunk(
  grid: MuseumGrid,
  wingId: string,
  buckets: MuseumGeometryDryRun,
): Promise<RoomChunk>
```

Each call builds InstancedMeshes for ONE room. Materials are cached globally (the PBR cache already exists), so shared textures load once.

### Step 3: Create `RoomStreamingManager`

Service that tracks which rooms are loaded based on player position. Returns load/dispose instructions each frame. Museum3DScene calls it in its `useTask` loop.

### Step 4: Update Museum3DScene template

Replace the global `{#each floorMeshes}` with per-room rendering:

```svelte
{#each loadedChunks as chunk (chunk.wingId)}
  {#each chunk.floorMeshes as mesh}
    <T is={mesh} receiveShadow />
  {/each}
  {#each chunk.wallMeshes as mesh}
    <T is={mesh} castShadow receiveShadow />
  {/each}
  <!-- etc -->
{/each}
```

### Step 5: Wire door proximity preloading

When player is within 5 tiles of a door tile, look up which room the door connects to and start building that room's chunk.

---

## What Stays Global

- **Physics grid** — collision needs ALL tiles (player might be in a corridor between rooms). Keep the full tile Map.
- **Fog** — already camera-relative, works fine with streaming
- **Spawn point** — global
- **Grid cache** — sessionStorage cache of the full grid layout (not the meshes)

## What Becomes Per-Room

- Floor/wall/ceiling InstancedMeshes
- Torch components + their PointLights
- Plaque components
- Performer station components
- Exhibit/ceiling lights
- Room ambient fill light (from per-room lighting spec)
- Furniture GLTF models

---

## Performance Budget

| Metric | Current (all rooms) | Streaming (3 rooms) |
|--------|-------------------|-------------------|
| Tiles rendered | 16,724 | ~5,000 |
| InstancedMesh draw calls | ~40 | ~12 |
| PBR materials to compile | ~16 | ~6 |
| Texture uploads | ~48 (3 per material) | ~18 |
| Torch components | ~19 | ~6 |
| Initial load time | 3-6 seconds | <1 second |

---

## Files to Create/Modify

| File | Action |
|---|---|
| `MuseumGeometryBuilder.ts` | Add `bucketMuseumTilesByRoom()`, `buildRoomChunk()` |
| `RoomStreamingManager.ts` | New service — adjacency tracking, load/dispose logic |
| `Museum3DScene.svelte` | Replace global meshes with per-room chunk rendering |
| `MuseumGeometryScaling.test.ts` | Add per-room bucketing benchmarks |

---

## Testing

1. Performance test: measure per-room chunk build time (should be <50ms per room)
2. Walk between rooms: verify geometry appears before player arrives (preloading)
3. Walk in circles: verify GPU memory doesn't grow (disposal works)
4. Fast travel (portal): verify destination room loads immediately
5. Room isolation mode (`?room=vulcan-cave`): should work as before (loads 1 room)
