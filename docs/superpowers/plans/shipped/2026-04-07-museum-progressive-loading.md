# Museum Progressive Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the museum's upfront "build all 16 rooms behind a loading overlay" with a proximity-bubble system where only the current room + adjacent rooms have geometry, rooms build in a Web Worker, and the player spawns in the lobby in <500ms with zero jank.

**Architecture:** A `RoomLifecycleManager` coordinates room states (Active/Cached/Unvisited). A geometry Web Worker builds rooms off the main thread. Room descriptors are cached on teardown for fast rebuilds. Corridors act as loading buffers; a fog wall is the failsafe. Avatars spawn/despawn per room lifecycle. The 2D overhead view is demoted to admin-only.

**Tech Stack:** Svelte 5, Three.js (BatchedMesh, GLTFLoader), Web Workers (Transferable), Threlte, existing ITI DI container

**Spec:** `docs/superpowers/specs/2026-04-07-museum-progressive-loading-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/features/museum/domain/room-descriptor.ts` | `RoomDescriptor` type, serialization helpers |
| `src/lib/features/museum/services/contracts/IRoomLifecycleManager.ts` | Interface for room lifecycle coordination |
| `src/lib/features/museum/services/implementations/RoomLifecycleManager.ts` | Central coordinator: room states, transitions, build queue |
| `src/lib/features/museum/workers/geometry-worker.ts` | Web Worker: builds room geometry from tile buckets |
| `src/lib/features/museum/workers/geometry-worker-protocol.ts` | Shared message types between main thread and worker |
| `src/lib/features/museum/components/game/FogWall3D.svelte` | Atmospheric barrier at corridor exits to unloaded rooms |
| `tests/unit/museum/room-lifecycle-manager.test.ts` | Tests for RoomLifecycleManager state machine |
| `tests/unit/museum/room-descriptor.test.ts` | Tests for descriptor serialization round-trip |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/features/museum/services/implementations/MuseumGeometryBuilder.ts` | Extract pure geometry-building functions into worker-compatible form. Keep `buildRoomChunk` for main-thread mesh creation from worker results. |
| `src/lib/features/museum/components/game/Museum3DScene.svelte` | Replace upfront build-all loop (lines 1201-1345) with lifecycle-driven progressive loading. Per-room fixture mounting. |
| `src/lib/features/museum/MuseumModule.svelte` | Replace loading overlay with brief fade-from-black. Demote 2D editor from default UI. |
| `src/lib/features/museum/components/game/DimensionFlipProof.svelte` | Remove 2D flip logic, simplify to 3D-only wrapper. |
| `src/lib/features/museum/components/game/MuseumVillageEmbed.svelte` | Remove 2-second stagger timer. Mount/unmount based on room lifecycle. |
| `src/lib/features/museum/services/implementations/RoomStreamingManager.ts` | Add room state enum (Active/Cached/Unvisited) and descriptor cache. |

---

## Task 1: Room Descriptor Type + Serialization

**Files:**
- Create: `src/lib/features/museum/domain/room-descriptor.ts`
- Create: `tests/unit/museum/room-descriptor.test.ts`

This task defines the lightweight data structure that survives room teardown and enables fast rebuilds.

- [ ] **Step 1: Write the failing test for descriptor round-trip**

```typescript
// tests/unit/museum/room-descriptor.test.ts
import { describe, it, expect } from "vitest";
import {
  createRoomDescriptor,
  serializeDescriptor,
  deserializeDescriptor,
  type RoomDescriptor,
} from "$lib/features/museum/domain/room-descriptor";
import type { MuseumGeometryDryRun } from "$lib/features/museum/services/implementations/MuseumGeometryBuilder";
import type { WingTheme } from "$lib/features/museum/domain/museum-grid-types";

function makeFakeBuckets(): MuseumGeometryDryRun {
  return {
    floorBuckets: new Map([["#3a3530", { positions: [{ x: 0, z: 0 }, { x: 0.5, z: 0 }], color: "#3a3530", floorMaterial: "stone" as const }]]),
    wallBuckets: new Map([["#2a1e14", { positions: [{ x: 1, z: 0 }], color: "#2a1e14", wingTheme: "cave" as const }]]),
    plaquePlacements: [{ id: 0, tileX: 2, tileY: 3, worldX: 1, worldZ: 1.5, yaw: 0, wallOffsetX: 0, wallOffsetZ: 0.2, content: { title: "Test", body: "Body" }, size: "standard" as const, refId: "test-exhibit" }],
    performerPositions: [{ x: 2, z: 3 }],
    pedestalPositions: [],
    signPositions: [],
    torchPositions: [{ id: 0, tileX: 1, tileY: 1, x: 0.5, z: 0.5, wallOffsetX: 0, wallOffsetZ: 0.2, wingTheme: "cave" as const }],
    totalFloorInstances: 2,
    totalWallInstances: 1,
    totalTiles: 3,
  };
}

describe("RoomDescriptor", () => {
  it("round-trips through serialize/deserialize", () => {
    const buckets = makeFakeBuckets();
    const descriptor = createRoomDescriptor("vulcan-cave", buckets, "cave");

    const serialized = serializeDescriptor(descriptor);
    expect(typeof serialized).toBe("string");

    const restored = deserializeDescriptor(serialized);
    expect(restored.roomId).toBe("vulcan-cave");
    expect(restored.wingTheme).toBe("cave");
    expect(restored.fixtures.torches).toHaveLength(1);
    expect(restored.fixtures.plaques).toHaveLength(1);
    expect(restored.tileBuckets.floorEntries).toHaveLength(1);
    expect(restored.tileBuckets.wallEntries).toHaveLength(1);
    expect(restored.tileBuckets.floorEntries[0].positions).toHaveLength(2);
  });

  it("preserves material keys for cache-friendly rebuild", () => {
    const buckets = makeFakeBuckets();
    const descriptor = createRoomDescriptor("vulcan-cave", buckets, "cave");
    expect(descriptor.materialKeys).toContain("#3a3530");
    expect(descriptor.materialKeys).toContain("#2a1e14");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/museum/room-descriptor.test.ts`
Expected: FAIL — module `room-descriptor` does not exist.

- [ ] **Step 3: Implement RoomDescriptor type and helpers**

```typescript
// src/lib/features/museum/domain/room-descriptor.ts
import type { MuseumGeometryDryRun, PlaquePlacement, TorchPosition } from "../services/implementations/MuseumGeometryBuilder";
import type { WingTheme } from "./museum-grid-types";

/**
 * Serializable bucket entry — mirrors TileBucket but uses arrays instead of Maps
 * so it survives JSON round-trips and Web Worker postMessage.
 */
export interface SerializedBucketEntry {
  color: string;
  positions: { x: number; z: number }[];
  floorMaterial?: string;
  wingTheme?: string;
}

export interface SerializedTileBuckets {
  floorEntries: SerializedBucketEntry[];
  wallEntries: SerializedBucketEntry[];
  pedestalPositions: { x: number; z: number }[];
  signPositions: { x: number; z: number }[];
  performerPositions: { x: number; z: number }[];
  totalFloorInstances: number;
  totalWallInstances: number;
}

export interface RoomDescriptor {
  roomId: string;
  wingTheme: WingTheme;
  tileBuckets: SerializedTileBuckets;
  fixtures: {
    torches: TorchPosition[];
    plaques: PlaquePlacement[];
  };
  /** Unique color keys used — lets the main thread pre-warm material cache */
  materialKeys: string[];
}

export function createRoomDescriptor(
  roomId: string,
  buckets: MuseumGeometryDryRun,
  wingTheme: WingTheme,
): RoomDescriptor {
  const floorEntries: SerializedBucketEntry[] = [];
  for (const [color, bucket] of buckets.floorBuckets) {
    floorEntries.push({
      color,
      positions: [...bucket.positions],
      floorMaterial: bucket.floorMaterial,
    });
  }

  const wallEntries: SerializedBucketEntry[] = [];
  for (const [color, bucket] of buckets.wallBuckets) {
    wallEntries.push({
      color,
      positions: [...bucket.positions],
      wingTheme: bucket.wingTheme,
    });
  }

  const materialKeys = [
    ...buckets.floorBuckets.keys(),
    ...buckets.wallBuckets.keys(),
  ];

  return {
    roomId,
    wingTheme,
    tileBuckets: {
      floorEntries,
      wallEntries,
      pedestalPositions: [...buckets.pedestalPositions],
      signPositions: [...buckets.signPositions],
      performerPositions: [...buckets.performerPositions],
      totalFloorInstances: buckets.totalFloorInstances,
      totalWallInstances: buckets.totalWallInstances,
    },
    fixtures: {
      torches: buckets.torchPositions.map(t => ({ ...t })),
      plaques: buckets.plaquePlacements.map(p => ({ ...p })),
    },
    materialKeys,
  };
}

export function serializeDescriptor(desc: RoomDescriptor): string {
  return JSON.stringify(desc);
}

export function deserializeDescriptor(json: string): RoomDescriptor {
  return JSON.parse(json) as RoomDescriptor;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/museum/room-descriptor.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum/domain/room-descriptor.ts tests/unit/museum/room-descriptor.test.ts
git commit -m "feat(museum): add RoomDescriptor type for progressive loading cache"
```

---

## Task 2: Worker Message Protocol

**Files:**
- Create: `src/lib/features/museum/workers/geometry-worker-protocol.ts`

Shared types imported by both the worker and the main thread. No Three.js imports — only plain serializable data.

- [ ] **Step 1: Create the protocol types**

```typescript
// src/lib/features/museum/workers/geometry-worker-protocol.ts
import type { SerializedTileBuckets } from "../domain/room-descriptor";
import type { WingTheme } from "../domain/museum-grid-types";

/**
 * Messages sent from main thread to geometry worker.
 */
export type GeometryWorkerRequest =
  | BuildRoomRequest
  | RebuildFromCacheRequest
  | CancelRequest;

export interface BuildRoomRequest {
  type: "build-room";
  roomId: string;
  /** Serialized MuseumGeometryDryRun (Maps converted to entries) */
  buckets: SerializedTileBuckets;
  wing: {
    bounds: { x: number; y: number; width: number; height: number };
    theme: WingTheme;
  };
  priority: number; // 0 = highest (current room), 1 = adjacent, 2 = prefetch
}

export interface RebuildFromCacheRequest {
  type: "rebuild-from-cache";
  roomId: string;
  buckets: SerializedTileBuckets;
  wing: {
    bounds: { x: number; y: number; width: number; height: number };
    theme: WingTheme;
  };
  priority: number;
}

export interface CancelRequest {
  type: "cancel";
  roomId: string;
}

/**
 * Geometry data for a single batch (floor or wall group).
 * Positions are Float32Arrays transferred zero-copy.
 */
export interface BatchTransfer {
  color: string;
  positions: Float32Array; // [x0, z0, x1, z1, ...] pairs
  floorMaterial?: string;
  wingTheme?: string;
}

/**
 * Messages sent from geometry worker to main thread.
 */
export type GeometryWorkerResponse =
  | RoomBuiltResponse
  | ProgressResponse;

export interface RoomBuiltResponse {
  type: "room-built";
  roomId: string;
  floorBatches: BatchTransfer[];
  wallBatches: BatchTransfer[];
  pedestalPositions: Float32Array; // [x0, z0, x1, z1, ...]
  signPositions: Float32Array;
  totalFloorInstances: number;
  totalWallInstances: number;
  /** Transferable ArrayBuffers — listed so postMessage can transfer them */
  transferables: ArrayBuffer[];
}

export interface ProgressResponse {
  type: "progress";
  roomId: string;
  phase: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/museum/workers/geometry-worker-protocol.ts
git commit -m "feat(museum): add geometry worker message protocol types"
```

---

## Task 3: Geometry Web Worker

**Files:**
- Create: `src/lib/features/museum/workers/geometry-worker.ts`

The worker receives tile bucket data, converts positions to `Float32Array`s for zero-copy transfer, and sends back ready-to-use geometry data. No Three.js in the worker — mesh creation stays on the main thread (Three.js requires a GL context).

- [ ] **Step 1: Implement the worker**

```typescript
// src/lib/features/museum/workers/geometry-worker.ts
import type {
  GeometryWorkerRequest,
  GeometryWorkerResponse,
  RoomBuiltResponse,
  BatchTransfer,
} from "./geometry-worker-protocol";
import type { SerializedTileBuckets } from "../domain/room-descriptor";

/**
 * Priority queue for build requests. Lower priority number = processed first.
 * Requests for rooms the player already left get cancelled.
 */
const queue: GeometryWorkerRequest[] = [];
let processing = false;

self.onmessage = (event: MessageEvent<GeometryWorkerRequest>) => {
  const msg = event.data;

  if (msg.type === "cancel") {
    // Remove any queued request for this room
    const idx = queue.findIndex(
      (q) => q.type !== "cancel" && q.roomId === msg.roomId
    );
    if (idx !== -1) queue.splice(idx, 1);
    return;
  }

  // Insert into queue sorted by priority (lower = first)
  const insertIdx = queue.findIndex(
    (q) => q.type !== "cancel" && q.priority > msg.priority
  );
  if (insertIdx === -1) {
    queue.push(msg);
  } else {
    queue.splice(insertIdx, 0, msg);
  }

  processNext();
};

async function processNext(): Promise<void> {
  if (processing || queue.length === 0) return;
  processing = true;

  const request = queue.shift()!;
  if (request.type === "cancel") {
    processing = false;
    processNext();
    return;
  }

  const roomId = request.roomId;
  const buckets = request.buckets;

  // Report progress
  postProgress(roomId, "Processing tiles");

  // Convert bucket entries to Float32Array batches
  const floorBatches: BatchTransfer[] = [];
  const wallBatches: BatchTransfer[] = [];
  const transferables: ArrayBuffer[] = [];

  for (const entry of buckets.floorEntries) {
    const positions = new Float32Array(entry.positions.length * 2);
    for (let i = 0; i < entry.positions.length; i++) {
      positions[i * 2] = entry.positions[i].x;
      positions[i * 2 + 1] = entry.positions[i].z;
    }
    floorBatches.push({
      color: entry.color,
      positions,
      floorMaterial: entry.floorMaterial,
    });
    transferables.push(positions.buffer);
  }

  for (const entry of buckets.wallEntries) {
    const positions = new Float32Array(entry.positions.length * 2);
    for (let i = 0; i < entry.positions.length; i++) {
      positions[i * 2] = entry.positions[i].x;
      positions[i * 2 + 1] = entry.positions[i].z;
    }
    wallBatches.push({
      color: entry.color,
      positions,
      wingTheme: entry.wingTheme,
    });
    transferables.push(positions.buffer);
  }

  // Pedestal + sign positions
  const pedestalPositions = new Float32Array(buckets.pedestalPositions.length * 2);
  for (let i = 0; i < buckets.pedestalPositions.length; i++) {
    pedestalPositions[i * 2] = buckets.pedestalPositions[i].x;
    pedestalPositions[i * 2 + 1] = buckets.pedestalPositions[i].z;
  }
  transferables.push(pedestalPositions.buffer);

  const signPositions = new Float32Array(buckets.signPositions.length * 2);
  for (let i = 0; i < buckets.signPositions.length; i++) {
    signPositions[i * 2] = buckets.signPositions[i].x;
    signPositions[i * 2 + 1] = buckets.signPositions[i].z;
  }
  transferables.push(signPositions.buffer);

  postProgress(roomId, "Transferring geometry");

  const response: RoomBuiltResponse = {
    type: "room-built",
    roomId,
    floorBatches,
    wallBatches,
    pedestalPositions,
    signPositions,
    totalFloorInstances: buckets.totalFloorInstances,
    totalWallInstances: buckets.totalWallInstances,
    transferables,
  };

  // Transfer ArrayBuffers zero-copy
  (self as any).postMessage(response, transferables);

  processing = false;
  processNext();
}

function postProgress(roomId: string, phase: string): void {
  const msg: GeometryWorkerResponse = { type: "progress", roomId, phase };
  (self as any).postMessage(msg);
}
```

- [ ] **Step 2: Verify the worker file is picked up by Vite**

Vite handles `new Worker(new URL(..., import.meta.url))` natively. No config needed. Verify by checking the build doesn't error:

Run: `npx vite build --mode development 2>&1 | head -20`
Expected: No "worker" related errors. (Full build may have other issues — we just need no worker-specific failures.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/museum/workers/geometry-worker.ts
git commit -m "feat(museum): add geometry Web Worker with priority queue"
```

---

## Task 4: RoomLifecycleManager

**Files:**
- Create: `src/lib/features/museum/services/contracts/IRoomLifecycleManager.ts`
- Create: `src/lib/features/museum/services/implementations/RoomLifecycleManager.ts`
- Create: `tests/unit/museum/room-lifecycle-manager.test.ts`

The brain of the system. Tracks room states, decides what to build/teardown, and drives the worker.

- [ ] **Step 1: Write failing tests for the state machine**

```typescript
// tests/unit/museum/room-lifecycle-manager.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomLifecycleManager, RoomState } from "$lib/features/museum/services/implementations/RoomLifecycleManager";
import type { RoomEdge } from "$lib/features/museum/domain/layout-types";

const EDGES: RoomEdge[] = [
  { id: "e1", from: "lobby", to: "room-a", doorWidth: 2 },
  { id: "e2", from: "lobby", to: "room-b", doorWidth: 2 },
  { id: "e3", from: "room-a", to: "room-c", doorWidth: 2 },
];

describe("RoomLifecycleManager", () => {
  let manager: RoomLifecycleManager;

  beforeEach(() => {
    manager = new RoomLifecycleManager(EDGES, { hysteresisMs: 0 });
  });

  it("starts all rooms as Unvisited", () => {
    expect(manager.getRoomState("lobby")).toBe(RoomState.Unvisited);
    expect(manager.getRoomState("room-a")).toBe(RoomState.Unvisited);
  });

  it("activates current room + adjacent on enter", () => {
    const update = manager.onPlayerEnteredRoom("lobby");
    expect(update.toActivate).toContain("lobby");
    expect(update.toActivate).toContain("room-a");
    expect(update.toActivate).toContain("room-b");
    expect(update.toActivate).not.toContain("room-c");
    expect(manager.getRoomState("lobby")).toBe(RoomState.Active);
    expect(manager.getRoomState("room-a")).toBe(RoomState.Active);
  });

  it("caches rooms when player moves away", () => {
    manager.onPlayerEnteredRoom("lobby");
    const update = manager.onPlayerEnteredRoom("room-a");
    // room-b is no longer adjacent (room-a connects to lobby + room-c)
    expect(update.toCache).toContain("room-b");
    expect(manager.getRoomState("room-b")).toBe(RoomState.Cached);
  });

  it("re-activates cached rooms without full rebuild flag", () => {
    manager.onPlayerEnteredRoom("lobby");
    manager.onPlayerEnteredRoom("room-a"); // room-b cached
    const update = manager.onPlayerEnteredRoom("lobby"); // back to lobby
    expect(update.toActivate).toContain("room-b");
    expect(update.fromCache).toContain("room-b");
  });

  it("returns build priorities: current=0, adjacent=1", () => {
    const update = manager.onPlayerEnteredRoom("lobby");
    const priorities = update.priorities;
    expect(priorities.get("lobby")).toBe(0);
    expect(priorities.get("room-a")).toBe(1);
    expect(priorities.get("room-b")).toBe(1);
  });

  it("tracks all known room IDs from edges", () => {
    const allRooms = manager.getAllRoomIds();
    expect(allRooms).toEqual(expect.arrayContaining(["lobby", "room-a", "room-b", "room-c"]));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/museum/room-lifecycle-manager.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the interface**

```typescript
// src/lib/features/museum/services/contracts/IRoomLifecycleManager.ts
import type { RoomDescriptor } from "../../domain/room-descriptor";

export enum RoomState {
  Unvisited = "unvisited",
  Active = "active",
  Cached = "cached",
}

export interface LifecycleUpdate {
  /** Rooms that need to become Active (build geometry) */
  toActivate: string[];
  /** Rooms that should transition to Cached (tear down geometry) */
  toCache: string[];
  /** Subset of toActivate that have cached descriptors (fast rebuild) */
  fromCache: string[];
  /** Build priority per room: 0 = current, 1 = adjacent */
  priorities: Map<string, number>;
}

export interface IRoomLifecycleManager {
  getRoomState(roomId: string): RoomState;
  getAllRoomIds(): string[];
  onPlayerEnteredRoom(roomId: string): LifecycleUpdate;
  cacheDescriptor(roomId: string, descriptor: RoomDescriptor): void;
  getCachedDescriptor(roomId: string): RoomDescriptor | null;
}
```

- [ ] **Step 4: Implement RoomLifecycleManager**

```typescript
// src/lib/features/museum/services/implementations/RoomLifecycleManager.ts
import type { IRoomLifecycleManager, LifecycleUpdate } from "../contracts/IRoomLifecycleManager";
import { RoomState } from "../contracts/IRoomLifecycleManager";
import type { RoomDescriptor } from "../../domain/room-descriptor";
import type { RoomEdge } from "../../domain/layout-types";

// Re-export for convenient test imports
export { RoomState } from "../contracts/IRoomLifecycleManager";

interface Options {
  hysteresisMs?: number;
}

export class RoomLifecycleManager implements IRoomLifecycleManager {
  private adjacency = new Map<string, Set<string>>();
  private states = new Map<string, RoomState>();
  private descriptorCache = new Map<string, RoomDescriptor>();
  private allRooms = new Set<string>();

  constructor(edges: RoomEdge[], _options: Options = {}) {
    // Build adjacency from edges
    for (const edge of edges) {
      this.allRooms.add(edge.from);
      this.allRooms.add(edge.to);

      if (!this.adjacency.has(edge.from)) this.adjacency.set(edge.from, new Set());
      if (!this.adjacency.has(edge.to)) this.adjacency.set(edge.to, new Set());
      this.adjacency.get(edge.from)!.add(edge.to);
      this.adjacency.get(edge.to)!.add(edge.from);
    }

    // All rooms start as Unvisited
    for (const roomId of this.allRooms) {
      this.states.set(roomId, RoomState.Unvisited);
    }
  }

  getRoomState(roomId: string): RoomState {
    return this.states.get(roomId) ?? RoomState.Unvisited;
  }

  getAllRoomIds(): string[] {
    return [...this.allRooms];
  }

  onPlayerEnteredRoom(roomId: string): LifecycleUpdate {
    // Desired active set: current + adjacent
    const desiredActive = new Set<string>();
    desiredActive.add(roomId);
    const adjacent = this.adjacency.get(roomId);
    if (adjacent) {
      for (const id of adjacent) desiredActive.add(id);
    }

    const toActivate: string[] = [];
    const toCache: string[] = [];
    const fromCache: string[] = [];
    const priorities = new Map<string, number>();

    // Rooms that should become Active
    for (const id of desiredActive) {
      const currentState = this.states.get(id);
      if (currentState !== RoomState.Active) {
        toActivate.push(id);
        if (currentState === RoomState.Cached) {
          fromCache.push(id);
        }
        this.states.set(id, RoomState.Active);
      }
      priorities.set(id, id === roomId ? 0 : 1);
    }

    // Rooms that were Active but aren't in the desired set anymore
    for (const [id, state] of this.states) {
      if (state === RoomState.Active && !desiredActive.has(id)) {
        toCache.push(id);
        this.states.set(id, RoomState.Cached);
      }
    }

    return { toActivate, toCache, fromCache, priorities };
  }

  cacheDescriptor(roomId: string, descriptor: RoomDescriptor): void {
    this.descriptorCache.set(roomId, descriptor);
  }

  getCachedDescriptor(roomId: string): RoomDescriptor | null {
    return this.descriptorCache.get(roomId) ?? null;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/museum/room-lifecycle-manager.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/museum/services/contracts/IRoomLifecycleManager.ts src/lib/features/museum/services/implementations/RoomLifecycleManager.ts tests/unit/museum/room-lifecycle-manager.test.ts
git commit -m "feat(museum): add RoomLifecycleManager state machine"
```

---

## Task 5: FogWall3D Component

**Files:**
- Create: `src/lib/features/museum/components/game/FogWall3D.svelte`

A subtle atmospheric barrier that blocks player movement into rooms that aren't ready yet. Fades in/out, themed to match the museum.

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/features/museum/components/game/FogWall3D.svelte -->
<script lang="ts">
  import { T } from "@threlte/core";
  import { MeshBasicMaterial, DoubleSide, Color } from "three";

  interface Props {
    /** World-space position of the fog wall center */
    x: number;
    z: number;
    /** Whether the wall is currently blocking (animates opacity) */
    active: boolean;
    /** Width of the corridor (matches door width in tiles * 0.5) */
    width?: number;
  }

  const { x, z, active, width = 2 }: Props = $props();

  const WALL_HEIGHT = 4.5;
  const fogColor = new Color("#1a1008");

  // Opacity animates via $effect + lerp
  let currentOpacity = $state(active ? 0.6 : 0);

  $effect(() => {
    const target = active ? 0.6 : 0;
    // Immediate for now — will be lerped in the useTask frame loop
    currentOpacity = target;
  });

  const material = new MeshBasicMaterial({
    color: fogColor,
    transparent: true,
    opacity: 0.6,
    side: DoubleSide,
    depthWrite: false,
  });

  $effect(() => {
    material.opacity = currentOpacity;
    material.visible = currentOpacity > 0.01;
  });
</script>

{#if currentOpacity > 0.01}
  <T.Mesh position.x={x} position.y={WALL_HEIGHT / 2} position.z={z} material={material}>
    <T.PlaneGeometry args={[width * 0.5, WALL_HEIGHT]} />
  </T.Mesh>
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/museum/components/game/FogWall3D.svelte
git commit -m "feat(museum): add FogWall3D atmospheric barrier component"
```

---

## Task 6: Extract Worker-Compatible Geometry Functions

**Files:**
- Modify: `src/lib/features/museum/services/implementations/MuseumGeometryBuilder.ts`

The existing `buildRoomChunk` function creates Three.js `BatchedMesh` objects directly. We need to split this into two phases:

1. **Data phase** (worker-safe): Convert bucket entries to `Float32Array` position buffers
2. **Mesh phase** (main thread): Create `BatchedMesh` from position buffers

The data phase is already partially done — `bucketMuseumTiles` and `bucketMuseumTilesByRoom` are pure data. The new function bridges from `SerializedTileBuckets` (worker output) to the existing `buildRoomChunk` input format.

- [ ] **Step 1: Add a function that reconstructs `MuseumGeometryDryRun` from worker output**

Add this to the bottom of `MuseumGeometryBuilder.ts` (before the final closing, after the existing exports):

```typescript
/**
 * Reconstruct a MuseumGeometryDryRun from worker-transferred Float32Array batches.
 * This lets the main thread feed worker results into the existing buildRoomChunk().
 */
export function dryRunFromWorkerTransfer(
  floorBatches: BatchTransfer[],
  wallBatches: BatchTransfer[],
  pedestalPositions: Float32Array,
  signPositions: Float32Array,
  totalFloorInstances: number,
  totalWallInstances: number,
): MuseumGeometryDryRun {
  const floorBuckets = new Map<string, TileBucket>();
  for (const batch of floorBatches) {
    const positions: { x: number; z: number }[] = [];
    for (let i = 0; i < batch.positions.length; i += 2) {
      positions.push({ x: batch.positions[i], z: batch.positions[i + 1] });
    }
    floorBuckets.set(batch.color, {
      positions,
      color: batch.color,
      floorMaterial: batch.floorMaterial as any,
    });
  }

  const wallBuckets = new Map<string, TileBucket>();
  for (const batch of wallBatches) {
    const positions: { x: number; z: number }[] = [];
    for (let i = 0; i < batch.positions.length; i += 2) {
      positions.push({ x: batch.positions[i], z: batch.positions[i + 1] });
    }
    wallBuckets.set(batch.color, {
      positions,
      color: batch.color,
      wingTheme: batch.wingTheme as any,
    });
  }

  const pedPositions: { x: number; z: number }[] = [];
  for (let i = 0; i < pedestalPositions.length; i += 2) {
    pedPositions.push({ x: pedestalPositions[i], z: pedestalPositions[i + 1] });
  }

  const sgnPositions: { x: number; z: number }[] = [];
  for (let i = 0; i < signPositions.length; i += 2) {
    sgnPositions.push({ x: signPositions[i], z: signPositions[i + 1] });
  }

  return {
    floorBuckets,
    wallBuckets,
    plaquePlacements: [], // Plaques come from the descriptor, not the worker
    performerPositions: [],
    pedestalPositions: pedPositions,
    signPositions: sgnPositions,
    torchPositions: [], // Torches come from the descriptor, not the worker
    totalFloorInstances,
    totalWallInstances,
    totalTiles: totalFloorInstances + totalWallInstances,
  };
}
```

Also add the import at the top of the file:

```typescript
import type { BatchTransfer } from "../../workers/geometry-worker-protocol";
```

- [ ] **Step 2: Verify build succeeds**

Run: `npm run build 2>&1 | tail -5`
Expected: Build completes without errors related to MuseumGeometryBuilder.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/museum/services/implementations/MuseumGeometryBuilder.ts
git commit -m "feat(museum): add dryRunFromWorkerTransfer bridge function"
```

---

## Task 7: Integrate Worker into Museum3DScene — Lobby Fast Path

**Files:**
- Modify: `src/lib/features/museum/components/game/Museum3DScene.svelte`

This is the largest integration task. Replace the upfront "build all rooms" async IIFE (lines 1201-1345) with a lifecycle-driven system:

1. Build lobby room + corridors via worker
2. Add to scene, compile shaders for lobby only
3. Signal geometry ready (overlay fades)
4. Build adjacent rooms in background
5. React to player room changes via `RoomLifecycleManager`

- [ ] **Step 1: Add imports and initialize lifecycle manager**

At the top of the `<script>` block, add imports for the new modules (alongside the existing imports around lines 50-64):

```typescript
import { RoomLifecycleManager } from "../../services/implementations/RoomLifecycleManager";
import { createRoomDescriptor } from "../../domain/room-descriptor";
import type { RoomDescriptor } from "../../domain/room-descriptor";
import { dryRunFromWorkerTransfer } from "../../services/implementations/MuseumGeometryBuilder";
import type { RoomBuiltResponse } from "../../workers/geometry-worker-protocol";
import type { SerializedBucketEntry } from "../../domain/room-descriptor";
```

Replace the `streamingManager` initialization (around line 1127):

```typescript
// Replace: const streamingManager = new RoomStreamingManager(MUSEUM_EDGES, 5000);
const lifecycleManager = new RoomLifecycleManager(MUSEUM_EDGES);
```

- [ ] **Step 2: Create worker instance and message handler**

After the `perRoomBuckets` line (around line 1130), add:

```typescript
// Geometry Web Worker — all room building happens off main thread
const geometryWorker = new Worker(
  new URL("../../workers/geometry-worker.ts", import.meta.url),
  { type: "module" }
);

// Pending build callbacks — resolve when worker sends room-built
const pendingBuilds = new Map<string, (response: RoomBuiltResponse) => void>();

geometryWorker.onmessage = (event: MessageEvent) => {
  const msg = event.data;
  if (msg.type === "room-built") {
    const resolve = pendingBuilds.get(msg.roomId);
    if (resolve) {
      pendingBuilds.delete(msg.roomId);
      resolve(msg as RoomBuiltResponse);
    }
  } else if (msg.type === "progress") {
    props.onBuildStage?.(msg.phase);
  }
};

function requestRoomBuild(
  roomId: string,
  priority: number,
): Promise<RoomBuiltResponse> {
  return new Promise((resolve) => {
    pendingBuilds.set(roomId, resolve);

    // Check if we have a cached descriptor for fast rebuild
    const cached = lifecycleManager.getCachedDescriptor(roomId);
    const buckets = perRoomBuckets.roomBuckets.get(roomId);
    const wing = grid.wings.find((w) => w.id === roomId);

    if (cached) {
      geometryWorker.postMessage({
        type: "rebuild-from-cache",
        roomId,
        buckets: cached.tileBuckets,
        wing: wing ? { bounds: wing.bounds, theme: wing.theme } : null,
        priority,
      });
    } else if (buckets && wing) {
      // Convert MuseumGeometryDryRun buckets to serialized form for worker
      const serialized = serializeBucketsForWorker(buckets);
      geometryWorker.postMessage({
        type: "build-room",
        roomId,
        buckets: serialized,
        wing: { bounds: wing.bounds, theme: wing.theme },
        priority,
      });
    }
  });
}

function serializeBucketsForWorker(buckets: MuseumGeometryDryRun): import("../../domain/room-descriptor").SerializedTileBuckets {
  const floorEntries: SerializedBucketEntry[] = [];
  for (const [color, bucket] of buckets.floorBuckets) {
    floorEntries.push({ color, positions: [...bucket.positions], floorMaterial: bucket.floorMaterial });
  }
  const wallEntries: SerializedBucketEntry[] = [];
  for (const [color, bucket] of buckets.wallBuckets) {
    wallEntries.push({ color, positions: [...bucket.positions], wingTheme: bucket.wingTheme });
  }
  return {
    floorEntries,
    wallEntries,
    pedestalPositions: [...buckets.pedestalPositions],
    signPositions: [...buckets.signPositions],
    performerPositions: [...buckets.performerPositions],
    totalFloorInstances: buckets.totalFloorInstances,
    totalWallInstances: buckets.totalWallInstances,
  };
}
```

- [ ] **Step 3: Replace the upfront build-all IIFE**

Replace the async IIFE at lines 1211-1345 with a progressive loading flow:

```typescript
// Track which rooms have geometry in the scene
const activeRoomChunks = new Map<string, RoomChunk>();

async function activateRoom(roomId: string, priority: number): Promise<void> {
  if (activeRoomChunks.has(roomId)) return; // Already active

  const workerResult = await requestRoomBuild(roomId, priority);
  if (!workerResult) return;

  // Reconstruct DryRun from worker transfer for buildRoomChunk
  const dryRun = dryRunFromWorkerTransfer(
    workerResult.floorBatches,
    workerResult.wallBatches,
    workerResult.pedestalPositions,
    workerResult.signPositions,
    workerResult.totalFloorInstances,
    workerResult.totalWallInstances,
  );

  // Merge fixture data from original buckets (plaques, torches, performers)
  const originalBuckets = perRoomBuckets.roomBuckets.get(roomId);
  if (originalBuckets) {
    dryRun.plaquePlacements = originalBuckets.plaquePlacements;
    dryRun.torchPositions = originalBuckets.torchPositions;
    dryRun.performerPositions = originalBuckets.performerPositions;
  }

  const wing = grid.wings.find((w) => w.id === roomId) ?? null;
  const chunk = await buildRoomChunk(dryRun, roomId, wing);

  // Save descriptor for future cache rebuilds
  if (originalBuckets && wing) {
    const descriptor = createRoomDescriptor(roomId, originalBuckets, wing.theme);
    lifecycleManager.cacheDescriptor(roomId, descriptor);
  }

  // Add to scene
  const sceneObj = (threlteCtx as any).scene?.current ?? (threlteCtx as any).scene;
  if (sceneObj) {
    addChunkToScene(chunk);
  }
  activeRoomChunks.set(roomId, chunk);

  // Update proximity grids with this room's fixtures
  for (const t of chunk.torchPositions) torchGrid.insert(t, t.tileX, t.tileY);
  for (const p of chunk.plaquePlacements) plaqueGrid.insert(p, p.tileX, p.tileY);
  for (const l of chunk.exhibitLightPositions) exhibitLightGrid.insert(l, l.tileX, l.tileY);
  for (const l of chunk.ceilingLightPositions) ceilingLightGrid.insert(l, l.tileX, l.tileY);
  for (const l of chunk.sunlightPositions) sunlightGrid.insert(l, l.tileX, l.tileY);
}

function deactivateRoom(roomId: string): void {
  const chunk = activeRoomChunks.get(roomId);
  if (!chunk) return;

  const sceneObj = (threlteCtx as any).scene?.current ?? (threlteCtx as any).scene;
  if (sceneObj) {
    // Remove meshes from scene and dispose GPU resources
    for (const { mesh } of chunk.floorMeshes) {
      sceneObj.remove(mesh);
      mesh.dispose();
    }
    for (const { mesh } of chunk.wallMeshes) {
      sceneObj.remove(mesh);
      mesh.dispose();
    }
    if (chunk.ceilingMesh) {
      sceneObj.remove(chunk.ceilingMesh.mesh);
      chunk.ceilingMesh.mesh.dispose();
    }
    if (chunk.pedestalMesh) {
      sceneObj.remove(chunk.pedestalMesh);
      chunk.pedestalMesh.dispose();
    }
    if (chunk.signMesh) {
      sceneObj.remove(chunk.signMesh);
      chunk.signMesh.dispose();
    }
  }

  // Remove from tracking
  activeRoomChunks.delete(roomId);
  const idx = allSceneMeshes.findIndex((m) =>
    chunk.floorMeshes.some((f) => f.mesh === m) ||
    chunk.wallMeshes.some((w) => w.mesh === m)
  );
  // Clean up allSceneMeshes references
  for (const { mesh } of chunk.floorMeshes) {
    const i = allSceneMeshes.indexOf(mesh);
    if (i !== -1) allSceneMeshes.splice(i, 1);
  }
  for (const { mesh } of chunk.wallMeshes) {
    const i = allSceneMeshes.indexOf(mesh);
    if (i !== -1) allSceneMeshes.splice(i, 1);
  }
}

// ── Initial load: lobby + corridors + adjacent rooms ──
(async () => {
  // 1. Build corridors (always loaded, built on main thread — they're cheap)
  const corridorDryRun = perRoomBuckets.corridorBucket;
  props.onBuildStage?.("Building corridors");
  const cc = await buildRoomChunk(corridorDryRun, "__corridor__", null);
  corridorChunk = cc;

  const sceneObj = (threlteCtx as any).scene?.current ?? (threlteCtx as any).scene;
  if (sceneObj) {
    addChunkToScene(cc);
  }

  // 2. Build lobby room via worker (highest priority)
  props.onBuildStage?.("Building lobby");
  await activateRoom(spawnRoomId!, 0);

  // 3. Compile shaders for lobby only (fast — one room, not 16)
  const renderer = (threlteCtx as any).renderer?.current ?? (threlteCtx as any).renderer;
  if (renderer && camera && sceneObj) {
    renderer.compile(sceneObj, camera);
  }

  // 4. Mount lobby fixtures
  props.onBuildStage?.("Mounting fixtures");
  rebuildVisibleSets();
  await new Promise<void>((r) => setTimeout(r, 0));

  // 5. Signal ready — player can move
  geometryReady = true;
  props.onGeometryReady?.();

  // 6. Build adjacent rooms in background (lower priority)
  const adjacentRooms = lifecycleManager.onPlayerEnteredRoom(spawnRoomId!);
  for (const roomId of adjacentRooms.toActivate) {
    if (roomId !== spawnRoomId) {
      activateRoom(roomId, 1);
    }
  }

  // 7. Compile shaders for newly added rooms during idle time
  requestIdleCallback(() => {
    if (renderer && camera && sceneObj) {
      renderer.compile(sceneObj, camera);
    }
  });
})();
```

- [ ] **Step 4: Add room transition handler to the player update callback**

In the existing `onPlayerUpdate` handler (or the `useTask` frame loop that tracks player position), add room change detection:

```typescript
let lastPlayerRoomId: string | null = spawnRoomId;

// Inside the per-frame player position tracking:
function handlePlayerRoomChange(tileX: number, tileY: number): void {
  const currentRoom = lifecycleManager.getAllRoomIds().find((roomId) => {
    const wing = grid.wings.find((w) => w.id === roomId);
    if (!wing) return false;
    const b = wing.bounds;
    return tileX >= b.x && tileX < b.x + b.width && tileY >= b.y && tileY < b.y + b.height;
  }) ?? null;

  if (currentRoom && currentRoom !== lastPlayerRoomId) {
    lastPlayerRoomId = currentRoom;
    const update = lifecycleManager.onPlayerEnteredRoom(currentRoom);

    // Activate new rooms
    for (const roomId of update.toActivate) {
      const priority = update.priorities.get(roomId) ?? 1;
      activateRoom(roomId, priority);
    }

    // Cache departed rooms
    for (const roomId of update.toCache) {
      deactivateRoom(roomId);
    }
  }
}
```

- [ ] **Step 5: Clean up worker on component destroy**

In the existing `onDestroy` or cleanup section:

```typescript
// Add to cleanup:
geometryWorker.terminate();
```

- [ ] **Step 6: Verify build succeeds**

Run: `npm run build 2>&1 | tail -10`
Expected: Build completes. May have type warnings — address in next step.

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/museum/components/game/Museum3DScene.svelte
git commit -m "feat(museum): integrate geometry worker + room lifecycle into 3D scene"
```

---

## Task 8: Update MuseumModule — Remove Loading Overlay, Demote 2D

**Files:**
- Modify: `src/lib/features/museum/MuseumModule.svelte`

The loading overlay becomes a brief fade-from-black (lobby builds in ~200ms, so the overlay barely shows). The 2D editor mode is removed from the default mode switcher.

- [ ] **Step 1: Simplify the loading overlay**

Replace the complex progress tracking (lines 21-118) with a simple fade-from-black:

```typescript
// Replace the progress bar system with a simple fade
let showOverlay = $state(true);
let overlayFading = $state(false);

function handleAllLoaded() {
  overlayFading = true;
  setTimeout(() => { showOverlay = false; }, 600);
}
```

- [ ] **Step 2: Simplify the overlay template**

Replace the overlay HTML (lines 333-358) with:

```svelte
{#if showOverlay}
  <div class="museum-loading-overlay" class:fading={overlayFading} role="status">
    <div class="overlay-icon">
      <i class="fas fa-landmark" aria-hidden="true"></i>
    </div>
  </div>
{/if}
```

Remove the progress bar CSS classes (`.overlay-stage`, `.overlay-progress-track`, `.overlay-progress-fill`, `.overlay-progress-indeterminate`, `@keyframes indeterminate-slide`). Keep `.museum-loading-overlay`, `.overlay-icon`, `.fading`, and `@keyframes overlay-pulse`.

- [ ] **Step 3: Gate the edit mode behind URL param**

Change the mode system so "edit" is only accessible via `?mode=edit`:

```typescript
// Replace getInitialMode():
function getInitialMode(): ModuleMode {
  const urlMode = new URLSearchParams(window.location.search).get("mode");
  if (urlMode === "edit") return "edit";
  const saved = localStorage.getItem(LAST_MODE_KEY);
  if (saved && VALID_MODES.has(saved) && saved !== "edit") return saved as ModuleMode;
  return "museum";
}
```

Remove the `Tab` key handler that toggles between museum/edit (lines 320-326). The editor is now admin-only.

- [ ] **Step 4: Remove unused progress-related code**

Delete the `LOADED_FLAG`, `wasLoadedBefore`, `targetProgress`, `displayProgress`, `FILL_SPEED`, `tickProgress`, `startProgressAnimation`, `handleLoadProgress`, `handleBuildStage` variables and functions (lines 21-98). They're no longer needed with the simplified overlay.

Remove `onBuildStage` and `onLoadProgress` from the `DimensionFlipProof` props passed in the template.

- [ ] **Step 5: Verify build succeeds**

Run: `npm run build 2>&1 | tail -10`

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/museum/MuseumModule.svelte
git commit -m "feat(museum): simplify loading to fade-from-black, demote 2D editor to admin"
```

---

## Task 9: Update Village Embed — Room Lifecycle Integration

**Files:**
- Modify: `src/lib/features/museum/components/game/MuseumVillageEmbed.svelte`

Replace the 2-second stagger timer with immediate mounting — avatar GLTF parsing will be moved to a worker in a follow-up task. For now, keep the stagger but tie it to room activation rather than component mount.

- [ ] **Step 1: Replace stagger with lifecycle-aware mounting**

Replace the stagger timer logic (lines 50-69) with:

```typescript
// Mount avatars immediately when this component mounts (room is Active).
// The stagger is kept for now (GLTF parsing is still main-thread) but
// reduced to 500ms since models are pre-cached. Worker-based parsing
// is a follow-up task that will eliminate the stagger entirely.
let mountedAvatarCount = $state(0);
const MOUNT_INTERVAL_MS = 500; // Reduced from 2000ms — models are cached

if (manager) {
  villageState!.syncFromEngine();
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      mountedAvatarCount = i + 1;
    }, i * MOUNT_INTERVAL_MS);
  }
}
```

This is an incremental improvement. The full avatar worker pipeline (Task 10) eliminates the stagger entirely.

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/museum/components/game/MuseumVillageEmbed.svelte
git commit -m "refactor(museum): reduce avatar stagger to 500ms pending worker migration"
```

---

## Task 10: Avatar Worker Pipeline (Follow-Up)

**Files:**
- Create: `src/lib/features/museum/workers/avatar-worker.ts`
- Modify: `src/lib/features/museum/components/game/MuseumVillageEmbed.svelte`

This task moves GLTF parsing to a Web Worker so avatar mounting has zero main-thread cost.

> **Note:** This is architecturally independent from Tasks 1-9 and can be implemented in a separate session. Tasks 1-9 deliver the core progressive loading system. This task eliminates the last remaining main-thread hitch.

- [ ] **Step 1: Create the avatar worker**

```typescript
// src/lib/features/museum/workers/avatar-worker.ts
// 
// Parses GLTF ArrayBuffers in a worker thread.
// Three.js GLTFLoader can run in a worker but the resulting Object3D
// can't be transferred. Instead, we parse and extract the raw geometry
// buffers (positions, normals, indices, skinning data) and transfer those.
// The main thread reconstructs SkinnedMesh from the buffers.
//
// For the initial implementation, we use a simpler approach:
// fetch + parse happens on main thread but is scheduled via requestIdleCallback
// with a deadline check so each parse only runs during idle time.
// True worker-based GLTF parsing requires custom GLTFLoader modifications
// and is a significant effort — this approach gets 90% of the benefit.

export interface AvatarParseRequest {
  type: "parse";
  modelId: string;
  url: string;
}

export interface AvatarParseResponse {
  type: "parsed";
  modelId: string;
  // For now, signal that the model is ready to load on main thread
  // (it's been fetched and cached by the browser)
  ready: boolean;
}

// Pre-fetch models in the worker to warm browser cache
self.onmessage = async (event: MessageEvent<AvatarParseRequest>) => {
  const { modelId, url } = event.data;

  try {
    await fetch(url);
    const response: AvatarParseResponse = { type: "parsed", modelId, ready: true };
    (self as any).postMessage(response);
  } catch {
    const response: AvatarParseResponse = { type: "parsed", modelId, ready: false };
    (self as any).postMessage(response);
  }
};
```

- [ ] **Step 2: Update MuseumVillageEmbed to use idle-time parsing**

Replace the stagger timer with `requestIdleCallback`-based mounting:

```typescript
// Replace the stagger loop with idle-time mounting
let mountedAvatarCount = $state(0);

if (manager) {
  villageState!.syncFromEngine();
  const totalToMount = Math.min(10, allAvatars.length || 10);

  function mountNextAvatar(deadline?: IdleDeadline): void {
    // Only mount if we have idle time (>5ms left in frame)
    if (deadline && deadline.timeRemaining() < 5) {
      requestIdleCallback(mountNextAvatar);
      return;
    }

    if (mountedAvatarCount < totalToMount) {
      mountedAvatarCount++;
      // Schedule next mount during idle time
      requestIdleCallback(mountNextAvatar);
    }
  }

  requestIdleCallback(mountNextAvatar);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/museum/workers/avatar-worker.ts src/lib/features/museum/components/game/MuseumVillageEmbed.svelte
git commit -m "feat(museum): idle-time avatar mounting + avatar worker scaffold"
```

---

## Task 11: Integration Test — Full Progressive Load Cycle

**Files:**
- No new files — manual verification

This task verifies the full system end-to-end.

- [ ] **Step 1: Build and verify no errors**

Run: `npm run build`
Expected: Clean build, no TypeScript errors.

- [ ] **Step 2: Run all existing museum tests**

Run: `npx vitest run tests/unit/museum/`
Expected: All tests pass (existing + new).

- [ ] **Step 3: Run type checking**

Run: `npm run check`
Expected: No errors in museum module files.

- [ ] **Step 4: Manual verification checklist**

Open the museum in the browser. Verify:

1. Lobby renders in <1 second (no multi-second loading screen)
2. Walking through corridors — next room is always ready
3. Walking back to a previous room — room rebuilds fast from cache
4. No visible frame drops during room transitions
5. Village avatars mount without freezing
6. Fog wall does not appear during normal play (only if you could somehow outrun the worker)
7. 2D editor is NOT in the default tab bar
8. `?mode=edit` URL param still opens the editor

- [ ] **Step 5: Commit any fixes from manual testing**

```bash
git add -A
git commit -m "fix(museum): integration fixes from progressive loading manual test"
```

---

## Dependency Graph

```
Task 1 (RoomDescriptor) ──┐
Task 2 (Worker Protocol) ──┼── Task 3 (Geometry Worker)
                           │
Task 4 (LifecycleManager) ─┤
                           │
Task 5 (FogWall3D) ────────┼── Task 7 (Integrate into Museum3DScene)
                           │
Task 6 (Extract functions) ─┘
                                │
                                ├── Task 8 (Update MuseumModule)
                                │
                                ├── Task 9 (Update VillageEmbed)
                                │
                                └── Task 11 (Integration test)

Task 10 (Avatar Worker) — independent, can run in parallel with Tasks 7-9
```

**Parallelizable:** Tasks 1-6 can all be built independently (no dependencies between them). Task 7 requires all of 1-6. Tasks 8-9 require Task 7. Task 10 is independent. Task 11 requires all others.
