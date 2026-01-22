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

// Plain chunk entity (no ECS dependency)
export interface ChunkEntity {
  chunk: {
    chunkX: number;
    chunkY: number;
    chunkZ: number;
    lod: number;
    seed: number;
    generated: boolean;
    lastAccessTime: number;
  };
  mesh?: {
    object3D: import("three").Object3D;
    visible: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
  };
}

function createChunkEntity(
  chunkX: number,
  chunkY: number,
  chunkZ: number,
  seed: number
): ChunkEntity {
  return {
    chunk: {
      chunkX,
      chunkY,
      chunkZ,
      lod: 0,
      seed,
      generated: false,
      lastAccessTime: Date.now(),
    },
  };
}
import { Octree } from "../spatial/octree";
import type {
  ChunkResultMessage,
  GenerateChunkMessage,
  VegetationData,
  LoadRealZoneMessage,
  ClearRealZoneMessage,
  RealZoneLoadedMessage,
  SetStageZoneMessage,
  ClearStageZoneMessage,
  SetSpawnClearingMessage,
  ClearSpawnClearingMessage,
  NeighborLODs,
} from "../workers/chunk-generator.worker";
import type { CampgroundConfig } from "./realm-config";
import {
  type RealTerrainZone,
  type ImportedTerrainData,
  createRealTerrainZone,
  serializeZoneForWorker,
} from "../generation/real-terrain-zone";

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
  entity: ChunkEntity;
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
  /** Blend weights for terrain splatting (grass, rock, dirt) */
  blendWeights1: Float32Array;
  /** Blend weights for terrain splatting (sand, snow, unused) */
  blendWeights2: Float32Array;
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

  // Reactive re-stitching: chunks that need regeneration when neighbors load
  private chunksNeedingRestitch: Set<ChunkKey> = new Set();

  // Real terrain zone
  private realTerrainZone: RealTerrainZone | null = null;

  // Stage zone (flat performance area)
  private stageZone: {
    center: { x: number; z: number };
    radius: number;
    blendWidth: number;
  } | null = null;

  // Spawn clearing (grassy meadow with campground)
  private spawnClearingConfig: {
    center: { x: number; z: number };
    radius: number;
    blendWidth: number;
    waterLevel: number;
    campground: CampgroundConfig;
  } | null = null;

  // Callbacks
  public onChunkLoaded?: (chunkKey: ChunkKey, state: ChunkState) => void;
  public onChunkUnloaded?: (chunkKey: ChunkKey) => void;
  public onRealZoneLoaded?: (zoneName: string) => void;

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

      worker.onmessage = (event: MessageEvent<ChunkResultMessage | RealZoneLoadedMessage>) => {
        const msg = event.data;
        if (msg.type === "chunk-result") {
          this.handleWorkerResult(msg);
        } else if (msg.type === "real-zone-loaded") {
          // Logging disabled
          this.onRealZoneLoaded?.(msg.name);
        }
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
        blendWeights1: result.blendWeights1,
        blendWeights2: result.blendWeights2,
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

          // Calculate LOD based on distance
          // T-junction stitching is implemented in the worker to handle
          // different LOD levels at chunk boundaries seamlessly.
          let lod = lodDistances.length;
          for (let i = 0; i < lodDistances.length; i++) {
            if (distance < lodDistances[i]!) {
              lod = i;
              break;
            }
          }

          chunkPriorities.set(key, { distance, lod });
        }
      }
    }

    // Enforce max 1 LOD difference between adjacent chunks
    // This is the single most important fix - makes T-junction stitching reliable
    this.enforceMaxLODDifference(chunkPriorities);

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

    // DISABLED: Reactive re-stitching was causing infinite cascade loops
    // When chunk A loads, it notifies neighbors B, C, D... to restitch.
    // When B restitches (reloads), it notifies ITS neighbors including A.
    // This creates an infinite loop that overwhelms the system.
    //
    // The T-junction stitching with skirts should handle seams adequately
    // without needing to regenerate entire chunks when neighbors load.
    //
    // TODO: If re-enabling, add a "generation" counter to prevent cascades:
    // - Only restitch if neighbor loaded in a LATER generation than our last stitch
    // - Track which neighbors we've already stitched against
    //
    // if (this.chunksNeedingRestitch.size > 0) {
    //   for (const key of this.chunksNeedingRestitch) {
    //     const state = this.chunks.get(key);
    //     if (state?.loadState === 'loaded') {
    //       state.loadState = 'pending';
    //       state.meshData = null;
    //       this.loadQueue.unshift(key); // High priority
    //     }
    //   }
    //   this.chunksNeedingRestitch.clear();
    // }
    this.chunksNeedingRestitch.clear(); // Just clear without processing

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

  /**
   * Enforce max 1 LOD difference between adjacent chunks.
   * This is the industry-standard constraint that makes T-junction stitching reliable.
   * Uses iterative constraint propagation until stable.
   */
  private enforceMaxLODDifference(
    chunkPriorities: Map<ChunkKey, { distance: number; lod: number }>
  ): void {
    const MAX_LOD_DIFF = 1;
    let changed = true;
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (changed && iterations < MAX_ITERATIONS) {
      changed = false;
      iterations++;

      for (const [key, data] of chunkPriorities) {
        const [cx, , cz] = this.parseChunkKey(key);

        // Check all 8 neighbors (including diagonals)
        const neighbors: [number, number][] = [
          [1, 0], [-1, 0], [0, 1], [0, -1], // cardinal
          [1, 1], [-1, 1], [1, -1], [-1, -1], // diagonal
        ];

        for (const [dx, dz] of neighbors) {
          const neighborKey = this.chunkKey(cx + dx, 0, cz + dz);
          const neighborData = chunkPriorities.get(neighborKey);
          if (!neighborData) continue;

          // If neighbor LOD is too different, adjust it
          if (neighborData.lod > data.lod + MAX_LOD_DIFF) {
            neighborData.lod = data.lod + MAX_LOD_DIFF;
            changed = true;
          }
          if (data.lod > neighborData.lod + MAX_LOD_DIFF) {
            data.lod = neighborData.lod + MAX_LOD_DIFF;
            changed = true;
          }
        }
      }
    }

    // Removed verbose logging - this was firing constantly and contributing to system overload
    // if (iterations > 1) {
    //   console.log(`[ChunkManager] LOD constraint: converged in ${iterations} iterations`);
    // }
  }

  /**
   * Get the LOD of a neighbor chunk (-1 if not loaded or pending)
   */
  private getNeighborLOD(chunkX: number, chunkZ: number): number {
    const key = this.chunkKey(chunkX, 0, chunkZ);
    const neighbor = this.chunks.get(key);
    // Return -1 if neighbor doesn't exist or isn't loaded/loading
    // For loading chunks, use their intended LOD
    if (!neighbor) return -1;
    if (neighbor.loadState === "unloading") return -1;
    return neighbor.lod;
  }

  /**
   * Get neighbor LODs for T-junction stitching (includes diagonals for corner coordination)
   */
  private getNeighborLODs(chunkX: number, chunkZ: number): NeighborLODs {
    return {
      north: this.getNeighborLOD(chunkX, chunkZ + 1), // +Z direction
      south: this.getNeighborLOD(chunkX, chunkZ - 1), // -Z direction
      east: this.getNeighborLOD(chunkX + 1, chunkZ),  // +X direction
      west: this.getNeighborLOD(chunkX - 1, chunkZ),  // -X direction
      northEast: this.getNeighborLOD(chunkX + 1, chunkZ + 1),
      northWest: this.getNeighborLOD(chunkX - 1, chunkZ + 1),
      southEast: this.getNeighborLOD(chunkX + 1, chunkZ - 1),
      southWest: this.getNeighborLOD(chunkX - 1, chunkZ - 1),
    };
  }

  /**
   * Notify all 8 neighbors that this chunk has loaded.
   * Neighbors that were generated with neighborLOD=-1 (no neighbor) now need
   * to re-stitch their edges to match this chunk's LOD.
   */
  private notifyNeighborsOfLoad(chunkX: number, chunkZ: number): void {
    const neighbors: [number, number][] = [
      [1, 0], [-1, 0], [0, 1], [0, -1], // cardinal
      [1, 1], [-1, 1], [1, -1], [-1, -1], // diagonal
    ];

    for (const [dx, dz] of neighbors) {
      const key = this.chunkKey(chunkX + dx, 0, chunkZ + dz);
      const state = this.chunks.get(key);
      // Only mark for restitch if already loaded (not loading or pending)
      if (state?.loadState === 'loaded') {
        this.chunksNeedingRestitch.add(key);
      }
    }
  }

  private loadChunk(key: ChunkKey, state: ChunkState): void {
    state.loadState = "loading";
    this.activeLoads++;

    const [chunkX, chunkY, chunkZ] = this.parseChunkKey(key);
    const requestId = this.nextRequestId++;

    // Get neighbor LODs for T-junction stitching
    const neighborLODs = this.getNeighborLODs(chunkX, chunkZ);

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
      neighborLODs,
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

      // Notify neighbors they may need re-stitching (reactive re-stitch system)
      this.notifyNeighborsOfLoad(chunkX, chunkZ);

      // Notify callback
      this.onChunkLoaded?.(key, state);
    });

    worker.postMessage(message);
  }

  private unloadChunk(key: ChunkKey, state: ChunkState): void {
    state.loadState = "unloading";

    // Entity is just a plain object now - no ECS cleanup needed

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

  // ==========================================================================
  // REAL TERRAIN ZONES
  // ==========================================================================

  /**
   * Load a real terrain zone from imported data
   * This distributes the zone data to all workers
   */
  loadRealTerrainZone(data: ImportedTerrainData): void {
    // Create zone from imported data
    this.realTerrainZone = createRealTerrainZone(data);

    // Logging disabled - was contributing to console spam

    // Serialize for workers
    const serialized = serializeZoneForWorker(this.realTerrainZone);

    // Send to all workers
    const message: LoadRealZoneMessage = {
      type: "load-real-zone",
      zone: serialized,
    };

    for (const worker of this.workers) {
      // Need to clone the heights array for each worker since transferable can only be sent once
      const clonedMessage: LoadRealZoneMessage = {
        type: "load-real-zone",
        zone: {
          ...serialized,
          heights: new Float32Array(serialized.heights),
        },
      };
      worker.postMessage(clonedMessage);
    }

    // Regenerate affected chunks
    this.regenerateChunksInZone();
  }

  /**
   * Load a real terrain zone from a JSON file
   */
  async loadRealTerrainZoneFromFile(file: File): Promise<void> {
    const text = await file.text();
    const data = JSON.parse(text) as ImportedTerrainData;
    this.loadRealTerrainZone(data);
  }

  /**
   * Clear the real terrain zone
   */
  clearRealTerrainZone(): void {
    if (!this.realTerrainZone) return;

    // Logging disabled
    this.realTerrainZone = null;

    // Notify workers
    const message: ClearRealZoneMessage = {
      type: "clear-real-zone",
    };

    for (const worker of this.workers) {
      worker.postMessage(message);
    }

    // Regenerate all loaded chunks
    this.regenerateAllChunks();
  }

  /**
   * Check if a real terrain zone is loaded
   */
  hasRealTerrainZone(): boolean {
    return this.realTerrainZone !== null;
  }

  /**
   * Get the loaded real terrain zone name
   */
  getRealTerrainZoneName(): string | null {
    return this.realTerrainZone?.name ?? null;
  }

  /**
   * Regenerate chunks that overlap with the real terrain zone
   */
  private regenerateChunksInZone(): void {
    if (!this.realTerrainZone) return;

    const { chunkSize } = this.config;
    const zone = this.realTerrainZone;

    // Find chunks that intersect the zone
    const chunksToRegenerate: ChunkKey[] = [];

    for (const [key, state] of this.chunks) {
      if (state.loadState !== "loaded") continue;

      const [chunkX, , chunkZ] = this.parseChunkKey(key);
      const chunkMinX = chunkX * chunkSize;
      const chunkMaxX = (chunkX + 1) * chunkSize;
      const chunkMinZ = chunkZ * chunkSize;
      const chunkMaxZ = (chunkZ + 1) * chunkSize;

      // Check if chunk overlaps zone bounds (with margin for blending)
      const margin = 50;
      if (
        chunkMaxX >= zone.bounds.minX - margin &&
        chunkMinX <= zone.bounds.maxX + margin &&
        chunkMaxZ >= zone.bounds.minZ - margin &&
        chunkMinZ <= zone.bounds.maxZ + margin
      ) {
        chunksToRegenerate.push(key);
      }
    }

    // Logging disabled

    // Unload and re-queue these chunks
    for (const key of chunksToRegenerate) {
      const state = this.chunks.get(key);
      if (state) {
        state.loadState = "pending";
        state.meshData = null;
        this.loadQueue.push(key);
      }
    }

    this.processQueue();
  }

  /**
   * Regenerate all loaded chunks (used when clearing zone)
   */
  private regenerateAllChunks(): void {
    const chunksToRegenerate = Array.from(this.chunks.keys());

    for (const key of chunksToRegenerate) {
      const state = this.chunks.get(key);
      if (state && state.loadState === "loaded") {
        state.loadState = "pending";
        state.meshData = null;
        this.loadQueue.push(key);
      }
    }

    this.processQueue();
  }

  // ==========================================================================
  // STAGE ZONE
  // ==========================================================================

  /**
   * Set a stage zone - a flat circular area for performances
   * Terrain within radius is flattened, with smooth blending to surrounding terrain
   */
  setStageZone(center: { x: number; z: number }, radius: number, blendWidth: number): void {
    this.stageZone = { center, radius, blendWidth };

    // Logging disabled

    const message: SetStageZoneMessage = {
      type: "set-stage-zone",
      center,
      radius,
      blendWidth,
    };

    // Send to all workers
    for (const worker of this.workers) {
      worker.postMessage(message);
    }

    // Regenerate affected chunks
    this.regenerateChunksInStageZone(center, radius + blendWidth);
  }

  /**
   * Clear the stage zone
   */
  clearStageZone(): void {
    if (!this.stageZone) return;

    const prevZone = this.stageZone;
    this.stageZone = null;

    // Logging disabled

    const message: ClearStageZoneMessage = {
      type: "clear-stage-zone",
    };

    // Send to all workers
    for (const worker of this.workers) {
      worker.postMessage(message);
    }

    // Regenerate previously affected chunks
    this.regenerateChunksInStageZone(prevZone.center, prevZone.radius + prevZone.blendWidth);
  }

  /**
   * Check if a stage zone is set
   */
  hasStageZone(): boolean {
    return this.stageZone !== null;
  }

  /**
   * Regenerate chunks that overlap with the stage zone
   */
  private regenerateChunksInStageZone(center: { x: number; z: number }, totalRadius: number): void {
    const { chunkSize } = this.config;

    // Find chunks that intersect the stage zone area
    const chunksToRegenerate: ChunkKey[] = [];

    for (const [key, state] of this.chunks) {
      if (state.loadState !== "loaded") continue;

      const [chunkX, , chunkZ] = this.parseChunkKey(key);
      const chunkCenterX = (chunkX + 0.5) * chunkSize;
      const chunkCenterZ = (chunkZ + 0.5) * chunkSize;

      // Check if chunk center is within total radius + chunk diagonal
      const dx = chunkCenterX - center.x;
      const dz = chunkCenterZ - center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const chunkDiagonal = chunkSize * Math.SQRT2;

      if (dist < totalRadius + chunkDiagonal) {
        chunksToRegenerate.push(key);
      }
    }

    // Logging disabled

    // Unload and re-queue these chunks
    for (const key of chunksToRegenerate) {
      const state = this.chunks.get(key);
      if (state) {
        state.loadState = "pending";
        state.meshData = null;
        this.loadQueue.push(key);
      }
    }

    this.processQueue();
  }

  // ==========================================================================
  // SPAWN CLEARING
  // ==========================================================================

  /**
   * Set a spawn clearing - a grassy meadow above water level with campground
   * This creates a safe, natural spawn point that blends into procedural forest
   */
  setSpawnClearing(
    center: { x: number; z: number },
    radius: number,
    blendWidth: number,
    waterLevel: number,
    campground: CampgroundConfig
  ): void {
    this.spawnClearingConfig = { center, radius, blendWidth, waterLevel, campground };

    // Logging disabled

    const message: SetSpawnClearingMessage = {
      type: "set-spawn-clearing",
      center,
      radius,
      blendWidth,
      waterLevel,
      campground,
    };

    // Send to all workers
    for (const worker of this.workers) {
      worker.postMessage(message);
    }

    // Regenerate affected chunks
    this.regenerateChunksInSpawnClearing(center, radius + blendWidth);
  }

  /**
   * Clear the spawn clearing
   */
  clearSpawnClearing(): void {
    if (!this.spawnClearingConfig) return;

    const prevConfig = this.spawnClearingConfig;
    this.spawnClearingConfig = null;

    // Logging disabled

    const message: ClearSpawnClearingMessage = {
      type: "clear-spawn-clearing",
    };

    // Send to all workers
    for (const worker of this.workers) {
      worker.postMessage(message);
    }

    // Regenerate previously affected chunks
    this.regenerateChunksInSpawnClearing(prevConfig.center, prevConfig.radius + prevConfig.blendWidth);
  }

  /**
   * Check if a spawn clearing is set
   */
  hasSpawnClearing(): boolean {
    return this.spawnClearingConfig !== null;
  }

  /**
   * Get the spawn clearing config (for campground object placement)
   */
  getSpawnClearingConfig(): typeof this.spawnClearingConfig {
    return this.spawnClearingConfig;
  }

  /**
   * Regenerate chunks that overlap with the spawn clearing
   */
  private regenerateChunksInSpawnClearing(center: { x: number; z: number }, totalRadius: number): void {
    const { chunkSize } = this.config;

    // Find chunks that intersect the spawn clearing area
    const chunksToRegenerate: ChunkKey[] = [];

    for (const [key, state] of this.chunks) {
      if (state.loadState !== "loaded") continue;

      const [chunkX, , chunkZ] = this.parseChunkKey(key);
      const chunkCenterX = (chunkX + 0.5) * chunkSize;
      const chunkCenterZ = (chunkZ + 0.5) * chunkSize;

      // Check if chunk center is within total radius + chunk diagonal
      const dx = chunkCenterX - center.x;
      const dz = chunkCenterZ - center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const chunkDiagonal = chunkSize * Math.SQRT2;

      if (dist < totalRadius + chunkDiagonal) {
        chunksToRegenerate.push(key);
      }
    }

    // Logging disabled

    // Unload and re-queue these chunks
    for (const key of chunksToRegenerate) {
      const state = this.chunks.get(key);
      if (state) {
        state.loadState = "pending";
        state.meshData = null;
        this.loadQueue.push(key);
      }
    }

    this.processQueue();
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

    // Clear chunks (plain objects, no ECS cleanup needed)
    this.chunks.clear();

    // Clear octree
    this.octree.dispose();

    // Clear queues
    this.loadQueue = [];
    this.pendingCallbacks.clear();
  }
}
