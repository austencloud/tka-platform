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
} from "../workers/chunk-generator.worker";
import type { DrainageData } from "../generation/gpu/terrain-compute-types";
import { DEFAULT_EROSION_CONFIG } from "../generation/gpu/terrain-compute-types";
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
  /** Estimated memory usage in bytes */
  memoryBytes: number;
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
  /** Drainage data for water placement (optional) */
  drainage?: DrainageData;
}

/**
 * Chunk key for map lookup
 */
export type ChunkKey = string;

// ============================================================================
// CHUNK MANAGER
// ============================================================================

export class ChunkManager {
  protected config: ChunkManagerConfig;
  protected worldSeed: number;
  protected chunks: Map<ChunkKey, ChunkState> = new Map();
  protected loadQueue: ChunkKey[] = [];
  protected activeLoads = 0;
  protected workers: Worker[] = [];
  protected nextWorkerId = 0;
  protected pendingCallbacks: Map<number, (result: ChunkMeshData) => void> = new Map();
  protected nextRequestId = 0;
  protected octree: Octree;

  // Total memory used by loaded chunks (bytes)
  protected totalMemoryBytes = 0;

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
        drainage: result.drainage,
      });
    }

    // Process next in queue
    this.processQueue();
  }

  // ==========================================================================
  // CHUNK LOADING
  // ==========================================================================

  /**
   * Camera direction for direction-aware chunk loading prioritization.
   * Set via updateWithDirection() for predictive loading.
   */
  private cameraDirection: { x: number; z: number } | null = null;

  /**
   * Update chunks based on camera position.
   * Call updateWithDirection() instead for direction-aware prioritization.
   */
  update(cameraX: number, cameraY: number, cameraZ: number): void {
    this.updateInternal(cameraX, cameraY, cameraZ, null);
  }

  /**
   * Update chunks with direction-aware prioritization.
   * Chunks in the camera's forward direction will be prioritized for loading.
   *
   * @param cameraX - Camera X position
   * @param cameraY - Camera Y position
   * @param cameraZ - Camera Z position
   * @param dirX - Camera forward direction X component (should be normalized)
   * @param dirZ - Camera forward direction Z component (should be normalized)
   */
  updateWithDirection(
    cameraX: number,
    cameraY: number,
    cameraZ: number,
    dirX: number,
    dirZ: number
  ): void {
    // Normalize direction
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
    if (len > 0.001) {
      this.cameraDirection = { x: dirX / len, z: dirZ / len };
    } else {
      this.cameraDirection = null;
    }
    this.updateInternal(cameraX, cameraY, cameraZ, this.cameraDirection);
  }

  /**
   * Internal update implementation with optional direction prioritization.
   */
  private updateInternal(
    cameraX: number,
    cameraY: number,
    cameraZ: number,
    direction: { x: number; z: number } | null
  ): void {
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
        const actualDistance = Math.sqrt(
          (cameraX - centerX) ** 2 + (cameraZ - centerZ) ** 2
        );

        if (actualDistance <= viewDistance) {
          neededChunks.add(key);

          // Calculate LOD based on actual distance
          // Skirts (vertical mesh extensions) hide any gaps between LOD levels
          let lod = lodDistances.length;
          for (let i = 0; i < lodDistances.length; i++) {
            if (actualDistance < lodDistances[i]!) {
              lod = i;
              break;
            }
          }

          // Calculate prioritized distance (for queue ordering)
          // Chunks in the camera's forward direction get a priority boost
          let priorityDistance = actualDistance;

          if (direction && actualDistance > 0.001) {
            // Vector from camera to chunk center
            const toChunkX = centerX - cameraX;
            const toChunkZ = centerZ - cameraZ;

            // Dot product with camera direction (both normalized)
            const toChunkLen = Math.sqrt(toChunkX * toChunkX + toChunkZ * toChunkZ);
            const dot = (toChunkX * direction.x + toChunkZ * direction.z) / toChunkLen;

            // dot = 1 means chunk is directly ahead, -1 means behind
            // Reduce priority distance for chunks ahead (making them load first)
            // Factor of 0.5 means chunks ahead are treated as 50% closer for loading priority
            const directionBoost = Math.max(0, dot) * 0.5;
            priorityDistance = actualDistance * (1 - directionBoost);
          }

          chunkPriorities.set(key, { distance: priorityDistance, lod });
        }
      }
    }

    // Enforce max 1 LOD difference between adjacent chunks
    // This prevents jarring visual transitions even though skirts hide gaps
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
      memoryBytes: 0,
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
   * This prevents jarring visual transitions at chunk boundaries.
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

  protected loadChunk(key: ChunkKey, state: ChunkState): void {
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
      // Erosion disabled: per-chunk erosion creates seams at edges because
      // the simulation runs independently per chunk. Would need overlapping
      // regions or a global pass to maintain seamless edges.
      erosion: { ...DEFAULT_EROSION_CONFIG, enabled: false },
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

      // Calculate and track memory usage
      state.memoryBytes = this.calculateChunkMemory(meshData);
      this.totalMemoryBytes += state.memoryBytes;

      // Update octree
      const worldX = chunkX * this.config.chunkSize + this.config.chunkSize / 2;
      const worldZ = chunkZ * this.config.chunkSize + this.config.chunkSize / 2;
      this.octree.insert(chunkX * 1000000 + chunkZ, { x: worldX, y: 0, z: worldZ });

      // Notify callback
      this.onChunkLoaded?.(key, state);

      // Check memory budget and evict if needed
      this.enforceMemoryBudget();
    });

    worker.postMessage(message);
  }

  private unloadChunk(key: ChunkKey, state: ChunkState): void {
    state.loadState = "unloading";

    // Track memory release
    this.totalMemoryBytes -= state.memoryBytes;

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
  // MEMORY MANAGEMENT
  // ==========================================================================

  /**
   * Calculate the memory footprint of a chunk's mesh data in bytes.
   * Includes all typed arrays (vertices, normals, colors, indices, blend weights).
   */
  protected calculateChunkMemory(meshData: ChunkMeshData): number {
    let bytes = 0;

    // Float32Arrays: 4 bytes per element
    bytes += meshData.vertices.byteLength;
    bytes += meshData.normals.byteLength;
    bytes += meshData.colors.byteLength;
    bytes += meshData.blendWeights1.byteLength;
    bytes += meshData.blendWeights2.byteLength;

    // Uint32Array: 4 bytes per element
    bytes += meshData.indices.byteLength;

    // Vegetation data: estimate ~100 bytes per item (object overhead + properties)
    bytes += meshData.vegetation.length * 100;

    return bytes;
  }

  /**
   * Enforce the memory budget by evicting least-recently-used chunks.
   * Only evicts chunks that are outside the current view distance.
   */
  protected enforceMemoryBudget(): void {
    const budgetBytes = this.config.memoryBudgetMB * 1024 * 1024;

    // If under budget, nothing to do
    if (this.totalMemoryBytes <= budgetBytes) return;

    // Collect candidates for eviction (loaded chunks sorted by last access time)
    const candidates: Array<{ key: ChunkKey; state: ChunkState }> = [];

    for (const [key, state] of this.chunks) {
      // Only consider loaded chunks for eviction
      if (state.loadState !== "loaded") continue;

      candidates.push({ key, state });
    }

    // Sort by last access time (oldest first = LRU)
    candidates.sort((a, b) => a.state.lastAccessTime - b.state.lastAccessTime);

    // Evict until under budget
    let evicted = 0;
    for (const { key, state } of candidates) {
      if (this.totalMemoryBytes <= budgetBytes) break;

      // Evict this chunk
      this.unloadChunk(key, state);
      evicted++;
    }

    if (evicted > 0) {
      const usedMB = (this.totalMemoryBytes / 1024 / 1024).toFixed(1);
      const budgetMB = this.config.memoryBudgetMB;
      console.log(`[ChunkManager] Evicted ${evicted} chunks for memory (${usedMB}MB / ${budgetMB}MB)`);
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private chunkKey(x: number, y: number, z: number): ChunkKey {
    return `${x},${y},${z}`;
  }

  protected parseChunkKey(key: ChunkKey): [number, number, number] {
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
   * Get terrain height at world position using bilinear interpolation
   * from the chunk's vertex grid.
   *
   * @param worldX - World X coordinate
   * @param worldZ - World Z coordinate
   * @returns Interpolated height, or null if chunk not loaded
   */
  getHeightAt(worldX: number, worldZ: number): number | null {
    const chunk = this.getChunkAt(worldX, worldZ);
    if (!chunk?.meshData) return null;

    const { chunkSize, resolution } = this.config;
    const { vertices } = chunk.meshData;

    // Calculate chunk origin - use Math.round for consistency with worker
    const chunkX = Math.floor(worldX / chunkSize);
    const chunkZ = Math.floor(worldZ / chunkSize);
    const originX = Math.round(chunkX * chunkSize);
    const originZ = Math.round(chunkZ * chunkSize);

    // Local position within chunk (0 to chunkSize)
    const localX = worldX - originX;
    const localZ = worldZ - originZ;

    // The mesh has skirt vertices appended after the main grid.
    // Main grid is resolution × resolution vertices.
    // We need to sample from the main grid only.
    //
    // Vertex layout in the mesh:
    // - Main grid: resolution × resolution vertices (indices 0 to resolution²-1)
    // - Skirts: 4 × resolution vertices (appended after)
    //
    // Grid spacing (step between vertices)
    const step = chunkSize / (resolution - 1);

    // Find grid cell containing this point
    const gridX = localX / step;
    const gridZ = localZ / step;

    // Integer grid indices (clamped to valid range)
    const x0 = Math.max(0, Math.min(resolution - 2, Math.floor(gridX)));
    const z0 = Math.max(0, Math.min(resolution - 2, Math.floor(gridZ)));
    const x1 = x0 + 1;
    const z1 = z0 + 1;

    // Fractional position within cell (0 to 1)
    const fx = gridX - x0;
    const fz = gridZ - z0;

    // Get heights at the four corners of the cell
    // Vertex index = z * resolution + x, height is at offset +1 (x, y, z layout)
    const getHeight = (gx: number, gz: number): number => {
      const idx = (gz * resolution + gx) * 3 + 1;
      return vertices[idx] ?? 0;
    };

    const h00 = getHeight(x0, z0); // Bottom-left
    const h10 = getHeight(x1, z0); // Bottom-right
    const h01 = getHeight(x0, z1); // Top-left
    const h11 = getHeight(x1, z1); // Top-right

    // Bilinear interpolation
    // h = (1-fx)(1-fz)h00 + fx(1-fz)h10 + (1-fx)fz*h01 + fx*fz*h11
    const height =
      (1 - fx) * (1 - fz) * h00 +
      fx * (1 - fz) * h10 +
      (1 - fx) * fz * h01 +
      fx * fz * h11;

    return height;
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
    memoryUsedMB: number;
    memoryBudgetMB: number;
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
      memoryUsedMB: Math.round(this.totalMemoryBytes / 1024 / 1024 * 10) / 10,
      memoryBudgetMB: this.config.memoryBudgetMB,
    };
  }

  /**
   * Get detailed performance statistics for profiling
   */
  getDetailedStats(): {
    // Basic stats
    loadedChunks: number;
    pendingChunks: number;
    loadingChunks: number;

    // Per-LOD breakdown
    chunksPerLOD: Record<number, number>;

    // Memory
    memoryUsedMB: number;
    memoryBudgetMB: number;
    memoryPressure: number; // 0-1, where 1 = at budget

    // Performance
    totalTriangles: number;
    totalVertices: number;
    averageChunkTriangles: number;

    // Queue health
    queueLength: number;
    activeLoads: number;
    maxConcurrentLoads: number;
    loadUtilization: number; // 0-1, where 1 = fully utilized
  } {
    let loaded = 0;
    let pending = 0;
    let loading = 0;
    let totalTriangles = 0;
    let totalVertices = 0;
    const chunksPerLOD: Record<number, number> = {};

    for (const state of this.chunks.values()) {
      switch (state.loadState) {
        case "loaded":
          loaded++;
          // Track LOD distribution
          chunksPerLOD[state.lod] = (chunksPerLOD[state.lod] ?? 0) + 1;
          // Estimate triangles and vertices from mesh data
          if (state.meshData) {
            totalVertices += state.meshData.vertices.length / 3;
            totalTriangles += state.meshData.indices.length / 3;
          }
          break;
        case "pending": pending++; break;
        case "loading": loading++; break;
      }
    }

    const memoryUsedMB = this.totalMemoryBytes / 1024 / 1024;
    const memoryPressure = Math.min(1, memoryUsedMB / this.config.memoryBudgetMB);
    const loadUtilization = this.config.maxConcurrentLoads > 0
      ? this.activeLoads / this.config.maxConcurrentLoads
      : 0;

    return {
      loadedChunks: loaded,
      pendingChunks: pending,
      loadingChunks: loading,
      chunksPerLOD,
      memoryUsedMB: Math.round(memoryUsedMB * 10) / 10,
      memoryBudgetMB: this.config.memoryBudgetMB,
      memoryPressure: Math.round(memoryPressure * 100) / 100,
      totalTriangles,
      totalVertices,
      averageChunkTriangles: loaded > 0 ? Math.round(totalTriangles / loaded) : 0,
      queueLength: this.loadQueue.length,
      activeLoads: this.activeLoads,
      maxConcurrentLoads: this.config.maxConcurrentLoads,
      loadUtilization: Math.round(loadUtilization * 100) / 100,
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
      const chunkMinX = Math.round(chunkX * chunkSize);
      const chunkMaxX = Math.round((chunkX + 1) * chunkSize);
      const chunkMinZ = Math.round(chunkZ * chunkSize);
      const chunkMaxZ = Math.round((chunkZ + 1) * chunkSize);

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
