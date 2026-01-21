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
          console.log(`[ChunkManager] Worker loaded real zone: ${msg.name}`);
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
          // Now that we have proper clipmap-style vertex morphing in the shader,
          // we can use proper LOD levels without visible seams.
          // The GPU morphs vertices smoothly between LOD levels.
          let lod = 0;
          for (let i = 0; i < lodDistances.length; i++) {
            if (distance > lodDistances[i]!) {
              lod = i + 1;
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

    console.log(`[ChunkManager] Loading real terrain zone: ${this.realTerrainZone.name}`);
    console.log(`[ChunkManager] Boundary points: ${this.realTerrainZone.boundary.length}`);
    console.log(`[ChunkManager] Heightmap: ${this.realTerrainZone.heightmap.width}x${this.realTerrainZone.heightmap.height}`);

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

    console.log(`[ChunkManager] Clearing real terrain zone: ${this.realTerrainZone.name}`);
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

    console.log(`[ChunkManager] Regenerating ${chunksToRegenerate.length} chunks in zone`);

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

    console.log(`[ChunkManager] Setting stage zone: center=(${center.x}, ${center.z}), radius=${radius}m, blend=${blendWidth}m`);

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

    console.log(`[ChunkManager] Clearing stage zone`);

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

    console.log(`[ChunkManager] Regenerating ${chunksToRegenerate.length} chunks in stage zone`);

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

    console.log(`[ChunkManager] Setting spawn clearing: center=(${center.x}, ${center.z}), radius=${radius}m, blend=${blendWidth}m, waterLevel=${waterLevel}`);

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

    console.log(`[ChunkManager] Clearing spawn clearing`);

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

    console.log(`[ChunkManager] Regenerating ${chunksToRegenerate.length} chunks in spawn clearing`);

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
