/**
 * MuseumGeometryStreamer
 *
 * Manages progressive room loading via a Web Worker. Handles:
 * - Worker message routing (pending build promises)
 * - Serializing tile buckets for worker transfer
 * - BFS distance computation from spawn for build prioritization
 * - Initial load orchestration (corridors → lobby → remaining rooms)
 * - Runtime streaming (activate rooms as the player moves)
 *
 * All Svelte reactive state stays in the component. This class is pure TS
 * with no framework dependencies.
 */

import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { MuseumGrid } from "../domain/museum-grid-types";
import type { RoomEdge } from "../domain/layout-types";
import type {
  RoomChunk,
} from "./museum-geometry-builder";
import {
  bucketMuseumTilesByRoom,
  buildRoomChunk,
  dryRunFromWorkerTransfer,
} from "./museum-geometry-builder";
import type { MuseumGeometryDryRun } from "./museum-geometry-builder";
import type { RoomBuiltResponse } from "../workers/geometry-worker-protocol";
import type { SerializedBucketEntry } from "../domain/room-descriptor";
import { RoomLifecycleManager } from "./room-lifecycle-manager";

// ── Types ──

export interface PerRoomBuckets {
  corridorBucket: MuseumGeometryDryRun;
  roomBuckets: Map<string, MuseumGeometryDryRun>;
}

interface PendingBuild {
  resolve: (response: RoomBuiltResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// A room build that gets no worker reply within this window is treated as a
// failure rather than an infinite hang (which freezes the loading overlay).
const BUILD_TIMEOUT_MS = 10_000;

export interface StreamerCallbacks {
  addChunkToScene(chunk: RoomChunk): void;
  onBuildStage?(stage: string): void;
  onGeometryReady?(): void;
  getCamera(): PerspectiveCamera | undefined;
  getScene(): Scene | undefined;
  getRenderer(): WebGLRenderer | undefined;
}

export class MuseumGeometryStreamer {
  readonly perRoomBuckets: PerRoomBuckets;
  readonly lifecycleManager: RoomLifecycleManager;
  readonly activeRoomChunks = new Map<string, RoomChunk>();

  corridorChunk: RoomChunk | null = null;
  geometryReady = false;
  lastPlayerRoomId: string | null = null;
  currentPlayerRoomId: string | null = null;

  // ── Worker state ──
  private readonly worker: Worker;
  private readonly pendingBuilds = new Map<string, PendingBuild>();
  private firstRoomActivated = false;

  // References
  private readonly grid: MuseumGrid;
  private readonly edges: RoomEdge[];
  private readonly TILE_SIZE: number;
  private readonly spawnRoomId: string | null;

  constructor(
    grid: MuseumGrid,
    edges: RoomEdge[],
    tileSize: number,
  ) {
    this.grid = grid;
    this.edges = edges;
    this.TILE_SIZE = tileSize;

    this.perRoomBuckets = bucketMuseumTilesByRoom(grid);
    this.lifecycleManager = new RoomLifecycleManager(edges);
    this.spawnRoomId = this.getRoomAtTile(grid.spawn.x, grid.spawn.y);

    this.worker = new Worker(
      new URL("../workers/geometry-worker.ts", import.meta.url),
      { type: "module" },
    );

    this.worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "room-built") {
        const pending = this.pendingBuilds.get(msg.roomId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingBuilds.delete(msg.roomId);
          pending.resolve(msg as RoomBuiltResponse);
        }
      }
    };

    // A worker that fails to boot (broken module import, OOM) would otherwise
    // leave every pending build promise hanging forever - the loading overlay
    // sticks on "Building lobby" with no error. Surface it and reject pending
    // builds so the await chain unwinds and the scene can reveal what loaded.
    this.worker.onerror = (event) => {
      this.failAllPending(new Error(`Geometry worker crashed: ${event.message || "unknown error"}`));
    };
    this.worker.onmessageerror = () => {
      this.failAllPending(new Error("Geometry worker message deserialization failed"));
    };
  }

  private failAllPending(error: Error): void {
    console.error("[MuseumGeometryStreamer]", error);
    for (const pending of this.pendingBuilds.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pendingBuilds.clear();
  }

  dispose(): void {
    // Reject (quietly) any in-flight builds so awaiting callers unwind on teardown.
    for (const pending of this.pendingBuilds.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Streamer disposed"));
    }
    this.pendingBuilds.clear();
    this.worker.terminate();
  }

  // ── Room detection ──

  getRoomAtTile(tileX: number, tileY: number): string | null {
    for (const wing of this.grid.wings) {
      const b = wing.bounds;
      if (tileX >= b.x && tileX < b.x + b.width && tileY >= b.y && tileY < b.y + b.height) {
        return wing.id;
      }
    }
    return null;
  }

  // ── Worker communication ──

  private serializeBucketsForWorker(buckets: MuseumGeometryDryRun) {
    const floorEntries: SerializedBucketEntry[] = [];
    for (const [, bucket] of buckets.floorBuckets) {
      floorEntries.push({
        color: bucket.color,
        positions: [...bucket.positions],
        floorMaterial: bucket.floorMaterial,
      });
    }
    const wallEntries: SerializedBucketEntry[] = [];
    for (const [, bucket] of buckets.wallBuckets) {
      wallEntries.push({
        color: bucket.color,
        positions: [...bucket.positions],
        wingTheme: bucket.wingTheme,
      });
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

  private requestRoomBuild(roomId: string, priority: number): Promise<RoomBuiltResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingBuilds.delete(roomId)) {
          reject(new Error(`Geometry worker timed out building "${roomId}" (no reply in ${BUILD_TIMEOUT_MS}ms)`));
        }
      }, BUILD_TIMEOUT_MS);
      this.pendingBuilds.set(roomId, { resolve, reject, timer });

      const cached = this.lifecycleManager.getCachedDescriptor(roomId);
      const buckets = this.perRoomBuckets.roomBuckets.get(roomId);
      const wing = this.grid.wings.find((w) => w.id === roomId);

      if (cached && wing) {
        this.worker.postMessage({
          type: "rebuild-from-cache",
          roomId,
          buckets: cached.tileBuckets,
          wing: { bounds: wing.bounds, theme: wing.theme },
          priority,
        });
      } else if (buckets && wing) {
        this.worker.postMessage({
          type: "build-room",
          roomId,
          buckets: this.serializeBucketsForWorker(buckets),
          wing: { bounds: wing.bounds, theme: wing.theme },
          priority,
        });
      } else {
        // No bucket/wing data - posting nothing would hang the promise forever.
        clearTimeout(timer);
        this.pendingBuilds.delete(roomId);
        reject(new Error(`No geometry data for room "${roomId}" (missing buckets or wing)`));
      }
    });
  }

  // ── Room activation ──

  async activateRoom(
    roomId: string,
    priority: number,
    callbacks: StreamerCallbacks,
    onChunkReady?: (chunk: RoomChunk) => void,
  ): Promise<void> {
    if (this.activeRoomChunks.has(roomId)) return;

    const workerResult = await this.requestRoomBuild(roomId, priority);

    const dryRun = dryRunFromWorkerTransfer(
      workerResult.floorBatches,
      workerResult.wallBatches,
      workerResult.pedestalPositions,
      workerResult.signPositions,
      workerResult.totalFloorInstances,
      workerResult.totalWallInstances,
    );

    // Merge fixture data from original buckets
    const originalBuckets = this.perRoomBuckets.roomBuckets.get(roomId);
    if (originalBuckets) {
      dryRun.plaquePlacements = originalBuckets.plaquePlacements;
      dryRun.torchPositions = originalBuckets.torchPositions;
      dryRun.performerPositions = originalBuckets.performerPositions;
    }

    const wing = this.grid.wings.find((w) => w.id === roomId) ?? null;
    const chunk = await buildRoomChunk(dryRun, roomId, wing);

    callbacks.addChunkToScene(chunk);
    this.activeRoomChunks.set(roomId, chunk);

    if (!this.firstRoomActivated) {
      this.firstRoomActivated = true;
      void import("$lib/shared/analytics/boot-profiler").then(({ bootProfiler }) =>
        bootProfiler.signalReady("museum"),
      );
    }

    onChunkReady?.(chunk);
  }

  // ── BFS distance computation ──

  computeDistancesFromSpawn(spawn: string | null, allRoomIds: string[]): Map<string, number> {
    const dist = new Map<string, number>();
    if (!spawn) {
      for (const id of allRoomIds) dist.set(id, 99);
      return dist;
    }
    const adj = new Map<string, Set<string>>();
    for (const e of this.edges) {
      if (!adj.has(e.from)) adj.set(e.from, new Set());
      if (!adj.has(e.to)) adj.set(e.to, new Set());
      adj.get(e.from)!.add(e.to);
      adj.get(e.to)!.add(e.from);
    }
    const queue = [spawn];
    dist.set(spawn, 0);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const d = dist.get(current)!;
      for (const neighbor of adj.get(current) ?? []) {
        if (!dist.has(neighbor)) {
          dist.set(neighbor, d + 1);
          queue.push(neighbor);
        }
      }
    }
    for (const id of allRoomIds) {
      if (!dist.has(id)) dist.set(id, 99);
    }
    return dist;
  }

  // ── Initial load orchestration ──

  async runInitialLoad(callbacks: StreamerCallbacks): Promise<void> {
    // 1. Build corridors on main thread
    callbacks.onBuildStage?.("Building corridors");
    const corridorDryRun = this.perRoomBuckets.corridorBucket;
    const cc = await buildRoomChunk(corridorDryRun, "__corridor__", null);
    this.corridorChunk = cc;

    const sceneObj = callbacks.getScene();
    if (sceneObj) callbacks.addChunkToScene(cc);

    // 2. Build lobby via worker
    callbacks.onBuildStage?.("Building lobby");
    if (this.spawnRoomId) {
      this.lastPlayerRoomId = this.spawnRoomId;
      await this.activateRoom(this.spawnRoomId, 0, callbacks);
    }

    // 3. Compile shaders for lobby only
    const renderer = callbacks.getRenderer();
    const camera = callbacks.getCamera();
    if (renderer && camera && sceneObj) {
      renderer.compile(sceneObj, camera);
    }

    // 4. Signal ready
    this.geometryReady = true;

    // 5. Build all remaining rooms progressively
    const allRoomIds = [...this.perRoomBuckets.roomBuckets.keys()];
    const distances = this.computeDistancesFromSpawn(this.spawnRoomId, allRoomIds);
    const sortedRooms = allRoomIds
      .filter((id) => id !== this.spawnRoomId)
      .sort((a, b) => (distances.get(a) ?? 99) - (distances.get(b) ?? 99));

    for (const roomId of sortedRooms) {
      const dist = distances.get(roomId) ?? 99;
      // fire-and-forget; swallow per-room failures so one bad room doesn't
      // surface as an unhandled rejection (the room just stays unbuilt).
      this.activateRoom(roomId, dist, callbacks).catch((err) => {
        console.warn(`[MuseumGeometryStreamer] room "${roomId}" failed to stream:`, err);
      });
    }

    // 6. Compile shaders for newly added rooms during idle time
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => {
        const r2 = callbacks.getRenderer();
        const s2 = callbacks.getScene();
        const c2 = callbacks.getCamera();
        if (r2 && c2 && s2) r2.compile(s2, c2);
      });
    }
  }

  // ── Runtime streaming ──

  updateStreaming(playerTX: number, playerTZ: number, fpsActive: boolean): void {
    if (!this.geometryReady) return;
    if (!fpsActive) return;

    let detectedRoomId: string | null = null;
    for (const wing of this.grid.wings) {
      const b = wing.bounds;
      if (playerTX >= b.x && playerTX < b.x + b.width && playerTZ >= b.y && playerTZ < b.y + b.height) {
        detectedRoomId = wing.id;
        break;
      }
    }
    this.currentPlayerRoomId = detectedRoomId;

    if (detectedRoomId && detectedRoomId !== this.lastPlayerRoomId) {
      this.lastPlayerRoomId = detectedRoomId;
    }
  }

  getSpawnRoomId(): string | null {
    return this.spawnRoomId;
  }
}
