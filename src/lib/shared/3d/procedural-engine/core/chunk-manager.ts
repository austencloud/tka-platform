import { Octree } from "../spatial/octree";
import type {
  ChunkResultMessage,
  GenerateChunkMessage,
  RealZoneLoadedMessage,
} from "../workers/chunk-worker-messages";
import { DEFAULT_EROSION_CONFIG } from "../generation/gpu/terrain-compute-types";
import type { CampgroundConfig } from "./world-config";
import type { ImportedTerrainData } from "../generation/real-terrain-zone";
import {
  type ChunkManagerConfig,
  type ChunkState,
  type ChunkMeshData,
  type ChunkKey,
  createChunkEntity,
} from "./chunk-types";
import { ChunkZoneManager } from "./chunk-zone-manager";

export type { ChunkEntity, ChunkManagerConfig, ChunkState, ChunkMeshData, ChunkKey } from "./chunk-types";

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

  protected totalMemoryBytes = 0;

  private zoneManager: ChunkZoneManager;

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
      resolution: config.resolution ?? 33,
    };

    this.octree = new Octree({
      worldSize: 2000,
      maxDepth: 6,
      maxEntitiesPerNode: 8,
    });

    this.initWorkers();

    this.zoneManager = new ChunkZoneManager({
      workers: this.workers,
      chunks: this.chunks,
      config: this.config,
      loadQueue: this.loadQueue,
      processQueue: () => this.processQueue(),
      parseChunkKey: (key) => this.parseChunkKey(key),
      onRealZoneLoaded: (name) => this.onRealZoneLoaded?.(name),
    });
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
      const worker = new Worker(
        new URL("../workers/chunk-generator.worker.ts", import.meta.url),
        { type: "module" }
      );

      worker.onmessage = (event: MessageEvent<ChunkResultMessage | RealZoneLoadedMessage>) => {
        const msg = event.data;
        if (msg.type === "chunk-result") {
          this.handleWorkerResult(msg);
        } else if (msg.type === "real-zone-loaded") {
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

    this.processQueue();
  }

  // ==========================================================================
  // CHUNK LOADING
  // ==========================================================================

  private cameraDirection: { x: number; z: number } | null = null;

  update(cameraX: number, cameraY: number, cameraZ: number): void {
    this.updateInternal(cameraX, cameraY, cameraZ, null);
  }

  updateWithDirection(
    cameraX: number,
    cameraY: number,
    cameraZ: number,
    dirX: number,
    dirZ: number
  ): void {
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
    if (len > 0.001) {
      this.cameraDirection = { x: dirX / len, z: dirZ / len };
    } else {
      this.cameraDirection = null;
    }
    this.updateInternal(cameraX, cameraY, cameraZ, this.cameraDirection);
  }

  private updateInternal(
    cameraX: number,
    cameraY: number,
    cameraZ: number,
    direction: { x: number; z: number } | null
  ): void {
    const { chunkSize, viewDistance, lodDistances } = this.config;

    const radius = Math.ceil(viewDistance / chunkSize);
    const camChunkX = Math.floor(cameraX / chunkSize);
    const camChunkZ = Math.floor(cameraZ / chunkSize);

    const neededChunks = new Set<ChunkKey>();
    const chunkPriorities = new Map<ChunkKey, { distance: number; lod: number }>();

    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const chunkX = camChunkX + dx;
        const chunkZ = camChunkZ + dz;
        const key = this.chunkKey(chunkX, 0, chunkZ);

        const centerX = (chunkX + 0.5) * chunkSize;
        const centerZ = (chunkZ + 0.5) * chunkSize;
        const actualDistance = Math.sqrt(
          (cameraX - centerX) ** 2 + (cameraZ - centerZ) ** 2
        );

        if (actualDistance <= viewDistance) {
          neededChunks.add(key);

          let lod = lodDistances.length;
          for (let i = 0; i < lodDistances.length; i++) {
            if (actualDistance < lodDistances[i]!) {
              lod = i;
              break;
            }
          }

          let priorityDistance = actualDistance;

          if (direction && actualDistance > 0.001) {
            const toChunkX = centerX - cameraX;
            const toChunkZ = centerZ - cameraZ;
            const toChunkLen = Math.sqrt(toChunkX * toChunkX + toChunkZ * toChunkZ);
            const dot = (toChunkX * direction.x + toChunkZ * direction.z) / toChunkLen;
            const directionBoost = Math.max(0, dot) * 0.5;
            priorityDistance = actualDistance * (1 - directionBoost);
          }

          chunkPriorities.set(key, { distance: priorityDistance, lod });
        }
      }
    }

    this.enforceMaxLODDifference(chunkPriorities);

    for (const [key, state] of this.chunks) {
      if (!neededChunks.has(key)) {
        this.unloadChunk(key, state);
      }
    }

    for (const key of neededChunks) {
      const priority = chunkPriorities.get(key)!;
      const existing = this.chunks.get(key);

      if (!existing) {
        this.queueChunkLoad(key, priority.lod, priority.distance);
      } else if (existing.lod !== priority.lod && existing.loadState === "loaded") {
        existing.lod = priority.lod;
        existing.priority = priority.distance;
      } else {
        existing.priority = priority.distance;
        existing.lastAccessTime = Date.now();
      }
    }

    this.loadQueue.sort((a, b) => {
      const stateA = this.chunks.get(a);
      const stateB = this.chunks.get(b);
      return (stateA?.priority ?? 0) - (stateB?.priority ?? 0);
    });

    this.processQueue();
  }

  private queueChunkLoad(key: ChunkKey, lod: number, distance: number): void {
    const [chunkX, chunkY, chunkZ] = this.parseChunkKey(key);

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

      if (state?.loadState !== "pending") continue;

      this.loadChunk(key, state);
    }
  }

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

        const neighbors: [number, number][] = [
          [1, 0], [-1, 0], [0, 1], [0, -1],
          [1, 1], [-1, 1], [1, -1], [-1, -1],
        ];

        for (const [dx, dz] of neighbors) {
          const neighborKey = this.chunkKey(cx + dx, 0, cz + dz);
          const neighborData = chunkPriorities.get(neighborKey);
          if (!neighborData) continue;

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
      erosion: { ...DEFAULT_EROSION_CONFIG, enabled: false },
    };

    if (this.workers.length === 0) {
      console.error("[ChunkManager] No workers available");
      return;
    }
    const worker = this.workers[this.nextWorkerId % this.workers.length]!;
    this.nextWorkerId++;

    this.pendingCallbacks.set(requestId, (meshData) => {
      state.meshData = meshData;
      state.loadState = "loaded";

      state.memoryBytes = this.calculateChunkMemory(meshData);
      this.totalMemoryBytes += state.memoryBytes;

      const worldX = chunkX * this.config.chunkSize + this.config.chunkSize / 2;
      const worldZ = chunkZ * this.config.chunkSize + this.config.chunkSize / 2;
      this.octree.insert(chunkX * 1000000 + chunkZ, { x: worldX, y: 0, z: worldZ });

      this.onChunkLoaded?.(key, state);
      this.enforceMemoryBudget();
    });

    worker.postMessage(message);
  }

  private unloadChunk(key: ChunkKey, state: ChunkState): void {
    state.loadState = "unloading";
    this.totalMemoryBytes -= state.memoryBytes;

    const [chunkX, , chunkZ] = this.parseChunkKey(key);
    this.octree.remove(chunkX * 1000000 + chunkZ);

    this.chunks.delete(key);
    this.onChunkUnloaded?.(key);
  }

  // ==========================================================================
  // MEMORY MANAGEMENT
  // ==========================================================================

  protected calculateChunkMemory(meshData: ChunkMeshData): number {
    let bytes = 0;
    bytes += meshData.vertices.byteLength;
    bytes += meshData.normals.byteLength;
    bytes += meshData.colors.byteLength;
    bytes += meshData.blendWeights1.byteLength;
    bytes += meshData.blendWeights2.byteLength;
    bytes += meshData.indices.byteLength;
    bytes += meshData.vegetation.length * 100;
    return bytes;
  }

  protected enforceMemoryBudget(): void {
    const budgetBytes = this.config.memoryBudgetMB * 1024 * 1024;

    if (this.totalMemoryBytes <= budgetBytes) return;

    const candidates: Array<{ key: ChunkKey; state: ChunkState }> = [];

    for (const [key, state] of this.chunks) {
      if (state.loadState !== "loaded") continue;
      candidates.push({ key, state });
    }

    candidates.sort((a, b) => a.state.lastAccessTime - b.state.lastAccessTime);

    for (const { key, state } of candidates) {
      if (this.totalMemoryBytes <= budgetBytes) break;
      this.unloadChunk(key, state);
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

  getChunkAt(worldX: number, worldZ: number): ChunkState | null {
    const chunkX = Math.floor(worldX / this.config.chunkSize);
    const chunkZ = Math.floor(worldZ / this.config.chunkSize);
    return this.chunks.get(this.chunkKey(chunkX, 0, chunkZ)) ?? null;
  }

  getHeightAt(worldX: number, worldZ: number): number | null {
    const chunk = this.getChunkAt(worldX, worldZ);
    if (!chunk?.meshData) return null;

    const { chunkSize, resolution } = this.config;
    const { vertices } = chunk.meshData;

    const chunkX = Math.floor(worldX / chunkSize);
    const chunkZ = Math.floor(worldZ / chunkSize);
    const originX = Math.round(chunkX * chunkSize);
    const originZ = Math.round(chunkZ * chunkSize);

    const localX = worldX - originX;
    const localZ = worldZ - originZ;

    const step = chunkSize / (resolution - 1);
    const gridX = localX / step;
    const gridZ = localZ / step;

    const x0 = Math.max(0, Math.min(resolution - 2, Math.floor(gridX)));
    const z0 = Math.max(0, Math.min(resolution - 2, Math.floor(gridZ)));
    const x1 = x0 + 1;
    const z1 = z0 + 1;

    const fx = gridX - x0;
    const fz = gridZ - z0;

    const getHeight = (gx: number, gz: number): number => {
      const idx = (gz * resolution + gx) * 3 + 1;
      return vertices[idx] ?? 0;
    };

    const h00 = getHeight(x0, z0);
    const h10 = getHeight(x1, z0);
    const h01 = getHeight(x0, z1);
    const h11 = getHeight(x1, z1);

    const height =
      (1 - fx) * (1 - fz) * h00 +
      fx * (1 - fz) * h10 +
      (1 - fx) * fz * h01 +
      fx * fz * h11;

    return height;
  }

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

  getDetailedStats(): {
    loadedChunks: number;
    pendingChunks: number;
    loadingChunks: number;
    chunksPerLOD: Record<number, number>;
    memoryUsedMB: number;
    memoryBudgetMB: number;
    memoryPressure: number;
    totalTriangles: number;
    totalVertices: number;
    averageChunkTriangles: number;
    queueLength: number;
    activeLoads: number;
    maxConcurrentLoads: number;
    loadUtilization: number;
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
          chunksPerLOD[state.lod] = (chunksPerLOD[state.lod] ?? 0) + 1;
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
  // ZONE MANAGEMENT (delegated)
  // ==========================================================================

  loadRealTerrainZone(data: ImportedTerrainData): void {
    this.zoneManager.loadRealTerrainZone(data);
  }

  async loadRealTerrainZoneFromFile(file: File): Promise<void> {
    return this.zoneManager.loadRealTerrainZoneFromFile(file);
  }

  clearRealTerrainZone(): void {
    this.zoneManager.clearRealTerrainZone();
  }

  hasRealTerrainZone(): boolean {
    return this.zoneManager.hasRealTerrainZone();
  }

  getRealTerrainZoneName(): string | null {
    return this.zoneManager.getRealTerrainZoneName();
  }

  setStageZone(center: { x: number; z: number }, radius: number, blendWidth: number): void {
    this.zoneManager.setStageZone(center, radius, blendWidth);
  }

  clearStageZone(): void {
    this.zoneManager.clearStageZone();
  }

  hasStageZone(): boolean {
    return this.zoneManager.hasStageZone();
  }

  setSpawnClearing(
    center: { x: number; z: number },
    radius: number,
    blendWidth: number,
    waterLevel: number,
    campground: CampgroundConfig,
  ): void {
    this.zoneManager.setSpawnClearing(center, radius, blendWidth, waterLevel, campground);
  }

  clearSpawnClearing(): void {
    this.zoneManager.clearSpawnClearing();
  }

  hasSpawnClearing(): boolean {
    return this.zoneManager.hasSpawnClearing();
  }

  getSpawnClearingConfig() {
    return this.zoneManager.getSpawnClearingConfig();
  }

  // ==========================================================================
  // DISPOSE
  // ==========================================================================

  dispose(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.chunks.clear();
    this.octree.dispose();
    this.loadQueue = [];
    this.pendingCallbacks.clear();
  }
}
