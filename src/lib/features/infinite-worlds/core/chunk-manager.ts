/**
 * Chunk Manager
 *
 * Manages chunk loading, unloading, and LOD transitions.
 * Coordinates between ECS, spatial octree, and worker pool.
 *
 * Features:
 * - Streaming chunks based on camera position
 * - Priority-based loading (closer chunks first)
 * - Memory budget management
 * - Seamless LOD transitions
 */

import {
  world,
  withChunk,
  createChunkEntity,
  type Entity,
} from "./ecs-world";
import { Octree } from "../spatial/octree";
import type { ChunkResultMessage, GenerateChunkMessage, VegetationData } from "../workers/chunk-generator.worker";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Chunk manager configuration
 */
export interface ChunkManagerConfig {
  chunkSize: number; // Size of each chunk in world units
  viewDistance: number; // How far to load chunks
  lodDistances: number[]; // Distance thresholds for LOD levels
  maxConcurrentLoads: number; // Max chunks loading at once
  memoryBudgetMB: number; // Max memory for chunks
  resolution: number; // Base vertex resolution per chunk
}

/**
 * Chunk state
 */
export interface ChunkState {
  entity: Entity;
  meshData: ChunkMeshData | null;
  loadState: "pending" | "loading" | "loaded" | "unloading";
  priority: number;
  lod: number;
  lastAccessTime: number;
}

/**
 * Chunk mesh data (from worker)
 */
export interface ChunkMeshData {
  vertices: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  vegetation: VegetationData[];
  biome: string;
}

/**
 * Chunk key for map lookup
 */
type ChunkKey = string;

// ============================================================================
// CHUNK MANAGER
// ============================================================================

export class ChunkManager {
  private config: ChunkManagerConfig;
  private worldSeed: number;
  private chunks: Map<ChunkKey, ChunkState> = new Map();
  private loadQueue: ChunkKey[] = [];
  private activeLoads = 0;
  private workers: Worker[] = [];
  private nextWorkerId = 0;
  private pendingCallbacks: Map<number, (result: ChunkMeshData) => void> = new Map();
  private nextRequestId = 0;
  private octree: Octree;

  // Callbacks
  public onChunkLoaded?: (chunkKey: ChunkKey, state: ChunkState) => void;
  public onChunkUnloaded?: (chunkKey: ChunkKey) => void;

  constructor(worldSeed: number, config: Partial<ChunkManagerConfig> = {}) {
    this.worldSeed = worldSeed;
    this.config = {
      chunkSize: config.chunkSize ?? 32,
      viewDistance: config.viewDistance ?? 256,
      lodDistances: config.lodDistances ?? [32, 64, 128, 256],
      maxConcurrentLoads: config.maxConcurrentLoads ?? 4,
      memoryBudgetMB: config.memoryBudgetMB ?? 256,
      resolution: config.resolution ?? 33, // 33x33 = nice power-of-2 + 1 for edges
    };

    this.octree = new Octree({
      worldSize: 2000,
      maxDepth: 6,
      maxEntitiesPerNode: 8,
    });

    // Create worker pool
    this.initWorkers();
  }

  // ==========================================================================
  // WORKER POOL
  // ==========================================================================

  private initWorkers(): void {
    const workerCount = Math.min(
      this.config.maxConcurrentLoads,
      navigator.hardwareConcurrency ?? 4
    );

    for (let i = 0; i < workerCount; i++) {
      // Using Vite worker import syntax
      const worker = new Worker(
        new URL("../workers/chunk-generator.worker.ts", import.meta.url),
        { type: "module" }
      );

      worker.onmessage = (event: MessageEvent<ChunkResultMessage>) => {
        this.handleWorkerResult(event.data);
      };

      worker.onerror = (error) => {
        console.error("[ChunkManager] Worker error:", error);
      };

      this.workers.push(worker);
    }
  }

  private handleWorkerResult(result: ChunkResultMessage): void {
    this.activeLoads--;

    const callback = this.pendingCallbacks.get(result.id);
    if (callback) {
      this.pendingCallbacks.delete(result.id);
      callback({
        vertices: result.vertices,
        normals: result.normals,
        colors: result.colors,
        indices: result.indices,
        vegetation: result.vegetation,
        biome: result.biome,
      });
    }

    // Process next in queue
    this.processQueue();
  }

  // ==========================================================================
  // CHUNK LOADING
  // ==========================================================================

  /**
   * Update chunks based on camera position
   */
  update(cameraX: number, cameraY: number, cameraZ: number): void {
    const { chunkSize, viewDistance, lodDistances } = this.config;

    // Calculate which chunks should be visible
    const radius = Math.ceil(viewDistance / chunkSize);
    const camChunkX = Math.floor(cameraX / chunkSize);
    const camChunkZ = Math.floor(cameraZ / chunkSize);

    const neededChunks = new Set<ChunkKey>();
    const chunkPriorities = new Map<ChunkKey, { distance: number; lod: number }>();

    // Determine needed chunks and their LOD
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const chunkX = camChunkX + dx;
        const chunkZ = camChunkZ + dz;
        const key = this.chunkKey(chunkX, 0, chunkZ);

        // Calculate distance to chunk center
        const centerX = (chunkX + 0.5) * chunkSize;
        const centerZ = (chunkZ + 0.5) * chunkSize;
        const distance = Math.sqrt(
          (cameraX - centerX) ** 2 + (cameraZ - centerZ) ** 2
        );

        if (distance <= viewDistance) {
          neededChunks.add(key);

          // Determine LOD based on distance
          let lod = lodDistances.length;
          for (let i = 0; i < lodDistances.length; i++) {
            const threshold = lodDistances[i];
            if (threshold !== undefined && distance < threshold) {
              lod = i;
              break;
            }
          }

          chunkPriorities.set(key, { distance, lod });
        }
      }
    }

    // Unload chunks that are no longer needed
    for (const [key, state] of this.chunks) {
      if (!neededChunks.has(key)) {
        this.unloadChunk(key, state);
      }
    }

    // Load new chunks or update LOD
    for (const key of neededChunks) {
      const priority = chunkPriorities.get(key)!;
      const existing = this.chunks.get(key);

      if (!existing) {
        // New chunk - add to load queue
        this.queueChunkLoad(key, priority.lod, priority.distance);
      } else if (existing.lod !== priority.lod && existing.loadState === "loaded") {
        // LOD changed - reload with new LOD
        existing.lod = priority.lod;
        existing.priority = priority.distance;
        // TODO: Implement smooth LOD transition
      } else {
        // Update priority and access time
        existing.priority = priority.distance;
        existing.lastAccessTime = Date.now();
      }
    }

    // Sort load queue by priority (closest first)
    this.loadQueue.sort((a, b) => {
      const stateA = this.chunks.get(a);
      const stateB = this.chunks.get(b);
      return (stateA?.priority ?? 0) - (stateB?.priority ?? 0);
    });

    // Process the queue
    this.processQueue();
  }

  private queueChunkLoad(key: ChunkKey, lod: number, distance: number): void {
    const [chunkX, chunkY, chunkZ] = this.parseChunkKey(key);

    // Create entity
    const entity = createChunkEntity(chunkX, chunkY, chunkZ, this.worldSeed);

    const state: ChunkState = {
      entity,
      meshData: null,
      loadState: "pending",
      priority: distance,
      lod,
      lastAccessTime: Date.now(),
    };

    this.chunks.set(key, state);
    this.loadQueue.push(key);
  }

  private processQueue(): void {
    while (
      this.activeLoads < this.config.maxConcurrentLoads &&
      this.loadQueue.length > 0
    ) {
      const key = this.loadQueue.shift()!;
      const state = this.chunks.get(key);

      if (!state || state.loadState !== "pending") continue;

      this.loadChunk(key, state);
    }
  }

  private loadChunk(key: ChunkKey, state: ChunkState): void {
    state.loadState = "loading";
    this.activeLoads++;

    const [chunkX, chunkY, chunkZ] = this.parseChunkKey(key);
    const requestId = this.nextRequestId++;

    const message: GenerateChunkMessage = {
      type: "generate-chunk",
      id: requestId,
      chunkX,
      chunkY,
      chunkZ,
      worldSeed: this.worldSeed,
      chunkSize: this.config.chunkSize,
      resolution: this.config.resolution,
      lod: state.lod,
    };

    // Round-robin worker selection
    if (this.workers.length === 0) {
      console.error("[ChunkManager] No workers available");
      return;
    }
    const worker = this.workers[this.nextWorkerId % this.workers.length]!;
    this.nextWorkerId++;

    this.pendingCallbacks.set(requestId, (meshData) => {
      state.meshData = meshData;
      state.loadState = "loaded";

      // Update octree
      const worldX = chunkX * this.config.chunkSize + this.config.chunkSize / 2;
      const worldZ = chunkZ * this.config.chunkSize + this.config.chunkSize / 2;
      this.octree.insert(chunkX * 1000000 + chunkZ, { x: worldX, y: 0, z: worldZ });

      // Notify callback
      this.onChunkLoaded?.(key, state);
    });

    worker.postMessage(message);
  }

  private unloadChunk(key: ChunkKey, state: ChunkState): void {
    state.loadState = "unloading";

    // Remove from ECS
    if (state.entity) {
      world.remove(state.entity);
    }

    // Remove from octree
    const [chunkX, , chunkZ] = this.parseChunkKey(key);
    this.octree.remove(chunkX * 1000000 + chunkZ);

    // Clean up
    this.chunks.delete(key);

    // Notify callback
    this.onChunkUnloaded?.(key);
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private chunkKey(x: number, y: number, z: number): ChunkKey {
    return `${x},${y},${z}`;
  }

  private parseChunkKey(key: ChunkKey): [number, number, number] {
    const parts = key.split(",").map(Number);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  }

  /**
   * Get chunk at world position
   */
  getChunkAt(worldX: number, worldZ: number): ChunkState | null {
    const chunkX = Math.floor(worldX / this.config.chunkSize);
    const chunkZ = Math.floor(worldZ / this.config.chunkSize);
    return this.chunks.get(this.chunkKey(chunkX, 0, chunkZ)) ?? null;
  }

  /**
   * Get terrain height at world position
   */
  getHeightAt(worldX: number, worldZ: number): number | null {
    const chunk = this.getChunkAt(worldX, worldZ);
    if (!chunk?.meshData) return null;

    // Interpolate height from chunk vertices
    const localX = worldX - Math.floor(worldX / this.config.chunkSize) * this.config.chunkSize;
    const localZ = worldZ - Math.floor(worldZ / this.config.chunkSize) * this.config.chunkSize;

    // TODO: Implement bilinear interpolation from chunk vertices
    return null; // Placeholder
  }

  /**
   * Get loading statistics
   */
  getStats(): {
    loadedChunks: number;
    pendingChunks: number;
    loadingChunks: number;
    queueLength: number;
    activeLoads: number;
  } {
    let loaded = 0;
    let pending = 0;
    let loading = 0;

    for (const state of this.chunks.values()) {
      switch (state.loadState) {
        case "loaded": loaded++; break;
        case "pending": pending++; break;
        case "loading": loading++; break;
      }
    }

    return {
      loadedChunks: loaded,
      pendingChunks: pending,
      loadingChunks: loading,
      queueLength: this.loadQueue.length,
      activeLoads: this.activeLoads,
    };
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    // Terminate workers
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];

    // Clear chunks
    for (const [key, state] of this.chunks) {
      if (state.entity) {
        world.remove(state.entity);
      }
    }
    this.chunks.clear();

    // Clear octree
    this.octree.dispose();

    // Clear queues
    this.loadQueue = [];
    this.pendingCallbacks.clear();
  }
}
