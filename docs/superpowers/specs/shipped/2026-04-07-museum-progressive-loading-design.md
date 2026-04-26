# Museum Progressive Loading: Hybrid Bubble + Warm Cache

**Date:** 2026-04-07
**Status:** Approved (brainstorming complete)

---

## Problem

The museum currently builds ALL 16 rooms upfront behind a loading overlay. This means:
- 2-4 second initial load (geometry + shader compilation)
- Memory holds all room geometry simultaneously
- Avatar GLTF parsing causes 200ms main-thread hitches (staggered over 18s)
- Doesn't scale: at 10x (160 rooms), upfront build would take 20-40 seconds

The goal: the player spawns in the lobby and walks around immediately. No loading screen, no jank, no pop-in. Everything loads around them in tiers they never notice.

---

## Design Decisions (from brainstorming)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Entry experience | Spawn in lobby, fully realized, walk immediately | No loading screens, no progressive quality ramp |
| Room streaming | Current + adjacent rooms only | Player moves one room at a time through corridors |
| 2D overhead view | Demote to admin/debug tool | Conflicts with progressive loading (needs all rooms visible). 3rd person is THE player view |
| Edge case handling | Corridors as primary buffer + fog wall failsafe | Corridors provide natural loading time. Fog wall catches heavy-asset rooms. Scales to 160+ rooms |
| Avatar lifecycle | Spawn in current + adjacent rooms, despawn beyond | "Living museum" feel through doorways without paying for 80+ avatars |
| Web Workers | Geometry building AND GLTF parsing off main thread | Main thread does one thing: render frames. Everything else happens elsewhere |
| Room teardown | Tear down geometry, keep room descriptors in cache | Backtracking rebuilds from cached descriptors (fast). Memory stays bounded. 95% savings |

---

## Architecture

### 1. Room Lifecycle Manager

Central coordinator that tracks player position and manages room states.

**Room States:**
- **Active** — geometry in scene, avatars spawned, lights on. Applied to current room + adjacent rooms.
- **Cached** — 3D meshes removed from scene, GPU resources disposed. Room descriptor (tile layout, material assignments, fixture positions, plaque data) retained in memory. Kilobytes per room.
- **Unvisited** — no data. Requires full build from room graph data.

**State Transitions:**
```
Unvisited --[player approaches via corridor]--> Active (full build in worker)
Active --[player moves 3+ rooms away, after 5s hysteresis]--> Cached (dispose geometry, keep descriptor)
Cached --[player approaches again]--> Active (fast rebuild from descriptor in worker)
```

**Trigger Point:** Room transitions fire when the player crosses a corridor midpoint, not when they reach the doorway. This maximizes lead time — the corridor walk IS the loading buffer.

**Integration with existing `RoomStreamingManager`:** The current class already has adjacency tracking, hysteresis timers, and load/dispose sets. It will be extended (not replaced) with:
- Room state tracking (active/cached/unvisited)
- Descriptor cache storage
- Priority queue for build requests (current room > adjacent > prefetch)

### 2. Geometry Worker Pipeline

A dedicated Web Worker that handles all CPU-heavy geometry work off the main thread.

**What moves to the worker:**
- Tile bucket processing (currently in `MuseumGeometryBuilder.buildRoomChunk`)
- `BatchedMesh` creation (geometry + material setup)
- PBR texture loading coordination
- Room descriptor serialization/deserialization

**What stays on main thread:**
- `scene.add()` / `scene.remove()` (Three.js scene graph is main-thread only)
- `renderer.compile()` for shader precompilation
- Player position tracking and room transition detection
- Svelte component mounting (torches, plaques, performers)

**Message protocol:**
```typescript
// Main -> Worker
type WorkerRequest =
  | { type: "build-room"; roomId: string; buckets: TileBucketData; wing: WingRegion }
  | { type: "rebuild-from-cache"; roomId: string; descriptor: RoomDescriptor }
  | { type: "cancel"; roomId: string }

// Worker -> Main
type WorkerResponse =
  | { type: "room-built"; roomId: string; transferables: ArrayBuffer[]; descriptor: RoomDescriptor }
  | { type: "progress"; roomId: string; phase: string }
```

**Transferable objects:** Geometry `ArrayBuffer`s are transferred (zero-copy) from worker to main thread. The main thread wraps them in `BufferGeometry` and adds to scene. This avoids serialization overhead for large meshes.

**Priority queue:** The worker processes requests in priority order:
1. Current room (if not yet built)
2. Adjacent rooms (by distance from player)
3. Prefetch (rooms 2 hops away, lowest priority)

Cancelled requests (player moved away) are dropped from the queue.

### 3. Avatar Worker Pipeline

Separate from geometry because avatar loading is a distinct pipeline (GLTF files, not procedural geometry).

**Current problem:** `GLTFLoader.parse()` is synchronous and blocks the main thread for ~200ms per avatar. The current 2-second stagger spreads this across 16 seconds but still causes micro-hitches.

**Solution:** Three.js `GLTFLoader` supports loading in a Web Worker via `DRACOLoader` worker and manual `ArrayBuffer` transfer. The flow:

1. `fetch()` the `.glb` file (already preloaded in browser cache by `preloadVillageAvatarModels`)
2. Send the `ArrayBuffer` to the worker
3. Worker parses GLTF, extracts geometry buffers
4. Transfer parsed geometry back to main thread
5. Main thread creates `SkinnedMesh` and adds to scene (must be main thread for animation system)

**Lifecycle:** Avatars spawn when their room becomes Active, despawn (dispose geometry + materials) when it transitions to Cached. The village simulation (`VillageState`) continues ticking in the background regardless — only the visual representation is affected.

### 4. Room Descriptor Cache

When a room transitions from Active to Cached, we save a `RoomDescriptor` — a lightweight intermediate representation that captures everything needed to rebuild the room without re-running the full pipeline.

```typescript
interface RoomDescriptor {
  roomId: string;
  // Pre-computed tile buckets (skip tile processing on rebuild)
  tileBuckets: SerializedTileBuckets;
  // Fixture positions (torches, plaques, lights)
  fixtures: {
    torches: TorchPosition[];
    plaques: PlaquePlacement[];
    exhibitLights: LightPosition[];
    ceilingLights: LightPosition[];
    sunlights: LightPosition[];
  };
  // Avatar assignments (which models at which positions)
  avatarSlots: AvatarSlot[];
  // Material references (cache keys, not actual materials)
  materialKeys: string[];
}
```

**Size:** ~2-5 KB per room (JSON-serializable). At 160 rooms: ~800 KB total. Negligible.

**Rebuild from descriptor:** The worker skips tile processing and material selection, goes straight to mesh generation from pre-computed buckets. Rebuild time: ~50ms (vs ~200ms for full build). Combined with corridor buffer, this is invisible.

### 5. Fog Wall Failsafe

A subtle atmospheric barrier that prevents the player from entering a room whose geometry isn't ready yet. This is the safety net for edge cases (heavy room, slow device, player moving fast).

**Implementation:**
- A translucent dark fog plane placed at the corridor entrance to any non-Active room
- Fades in/out with a 0.3s transition
- Blocks player movement (collision) while active
- Dissolves automatically when the room finishes building
- Themed to match the museum's atmosphere (dark mist, not a hard wall)

**When it appears:**
- Only if the player reaches a corridor exit before the target room finishes building
- In practice, almost never — corridors take 2-3 seconds to walk, room builds take <1 second
- More likely on first load (cold cache) or very heavy rooms

### 6. Initial Load Sequence

The critical path from "player clicks Museum" to "player is walking around":

```
T=0ms     MuseumModule mounts
T=0ms     Grid data loaded (room graph, edges — already in JS bundle, no network)
T=0ms     Worker spawned, sent lobby room + adjacent rooms to build
T=0ms     Brief fade-from-black (lobby room building in worker)
T=~200ms  Lobby room geometry transferred from worker
T=~200ms  scene.add() lobby meshes + renderer.compile() for lobby shaders only
T=~400ms  Fade-in complete, player can move. Lobby is fully realized.
T=~400ms  Worker starts building adjacent rooms (background)
T=~1-2s   Adjacent rooms ready. Player hasn't left lobby yet.
T=~2-5s   Lobby avatars loaded via avatar worker (if any)
T=ongoing Worker builds rooms ahead of player as they explore
```

**Key difference from current:** Instead of building 16 rooms behind a 3-second overlay, we build 1 room in ~200ms and let the player in. The other 15 rooms build in background while they're exploring the first one.

### 7. 2D View Demotion

The 2D overhead editor view (`Museum2DEditor.svelte`) becomes an admin-only tool:

- Remove from the normal tab bar / mode switcher
- Accessible via URL param (`?mode=edit`) or a debug key combo
- No impact on the progressive loading system — it can render room outlines from the grid data (which is always in memory) without needing 3D geometry
- Keeps working for development but doesn't constrain the player experience

### 8. Shader Precompilation Strategy

Currently `renderer.compile(scene, camera)` compiles ALL shaders at once (300-500ms). With progressive loading, this changes:

- **Lobby load:** Compile only lobby room's shaders (~30-50ms). Player sees zero stutter.
- **Adjacent rooms:** Compile their shaders in the background after lobby is interactive. Use `requestIdleCallback` to spread compilation across idle frames.
- **On room entry:** If a room's shaders weren't pre-compiled (edge case), they compile on the frame the room enters the frustum. With the fog wall failsafe, this overlap is minimal.

### 9. Svelte Component Lifecycle

Torches, plaques, performers, furniture are currently mounted as Svelte components. With progressive loading:

- **Mount:** When a room transitions to Active, mount its Svelte fixture components
- **Unmount:** When a room transitions to Cached, destroy its Svelte fixture components (dispose Three.js objects)
- **Data source:** Fixture positions come from the room's geometry chunk (already computed), stored in the descriptor cache for fast remount

This means the existing staggered mounting system (`visibleTorches`, `visiblePlaques`, etc.) becomes per-room instead of global. Each room's fixtures mount independently.

---

## Files Affected

### New Files
| File | Purpose |
|------|---------|
| `services/implementations/RoomLifecycleManager.ts` | Central coordinator: room states, transitions, priority queue |
| `services/contracts/IRoomLifecycleManager.ts` | Interface for above |
| `workers/geometry-worker.ts` | Web Worker for room geometry building |
| `workers/avatar-worker.ts` | Web Worker for GLTF avatar parsing |
| `domain/room-descriptor.ts` | `RoomDescriptor` type + serialization helpers |
| `components/game/FogWall3D.svelte` | Atmospheric barrier component |

### Modified Files
| File | Change |
|------|--------|
| `MuseumModule.svelte` | Remove upfront loading overlay logic. Add brief fade-from-black. Remove 2D mode from default UI. |
| `Museum3DScene.svelte` | Replace upfront `buildRoomChunk` loop with worker-driven progressive loading. Room fixture mounting becomes per-room lifecycle. Remove `renderer.compile(scene, camera)` global call. |
| `RoomStreamingManager.ts` | Extend with room state tracking (active/cached/unvisited), descriptor cache, build priority. Or replaced by new `RoomLifecycleManager` that composes it. |
| `MuseumGeometryBuilder.ts` | Extract geometry building logic into worker-compatible pure functions. Main thread retains `scene.add()` orchestration only. |
| `MuseumVillageManager.ts` | Avatar spawn/despawn tied to room Active state, not global progressive mount. |
| `MuseumVillageEmbed.svelte` | Remove 2-second stagger timer. Avatars mount/unmount based on room lifecycle events. |
| `DimensionFlipProof.svelte` | Remove 2D flip logic if 2D view is demoted. Or keep but gate behind admin flag. |

---

## Performance Budget

| Metric | Target | Current |
|--------|--------|---------|
| Time to interactive (lobby walkable) | <500ms | 2-4 seconds |
| Main thread frame budget during loading | <16ms per frame (60fps) | 200-400ms hitches |
| Memory at 16 rooms | ~5 rooms of geometry + 16 descriptors | All 16 rooms |
| Memory at 160 rooms | ~5 rooms of geometry + 160 descriptors (~800KB) | N/A (would OOM) |
| Room transition (pre-built adjacent) | 0ms (already in scene) | 0ms (already built) |
| Room transition (from cache) | <100ms (worker rebuild) | N/A |
| Room transition (first visit) | <300ms (full worker build) | N/A |
| Avatar mount hitch | 0ms (worker-parsed) | 200ms per avatar |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Three.js `BatchedMesh` can't be created in worker | Architecture change needed | Geometry buffers transfer; mesh instantiation stays on main thread. Test this first. |
| `renderer.compile()` per-room causes micro-stutter | Visible frame drops | Compile during corridor walk (player not looking at new room yet). Use `requestIdleCallback`. |
| Fog wall visible on slow devices | Breaks immersion | Make fog wall atmospheric and thematic. Log occurrences to tune lookahead distance. |
| Worker overhead for small rooms | Unnecessary complexity | Skip worker for rooms under a tile threshold — build inline with `requestIdleCallback` chunks. |
| Avatar worker doesn't fully eliminate main-thread cost | `SkinnedMesh` creation still on main thread | Main-thread cost is ~10ms (mesh creation), not 200ms (parsing). Acceptable. |

---

## What This Does NOT Change

- Grid building pipeline (rooms, corridors, walls) — same logic, just runs in worker
- Room content data (museum-room-graph.ts, museum-room-content.ts) — untouched
- Village simulation logic — continues ticking regardless of visual state
- Editor mode — still works, just not a default player-facing view
- Showroom / 3rd-person test modes — unaffected
