import type {
  LoadRealZoneMessage,
  ClearRealZoneMessage,
  SetStageZoneMessage,
  ClearStageZoneMessage,
  SetSpawnClearingMessage,
  ClearSpawnClearingMessage,
} from "../workers/chunk-worker-messages";
import type { CampgroundConfig } from "./world-config";
import {
  type RealTerrainZone,
  type ImportedTerrainData,
  createRealTerrainZone,
  serializeZoneForWorker,
} from "../generation/real-terrain-zone";
import type { ChunkKey, ChunkState } from "./chunk-types";

export interface ZoneManagerDeps {
  workers: Worker[];
  chunks: Map<ChunkKey, ChunkState>;
  config: { chunkSize: number };
  loadQueue: ChunkKey[];
  processQueue: () => void;
  parseChunkKey: (key: ChunkKey) => [number, number, number];
  onRealZoneLoaded?: (zoneName: string) => void;
}

export class ChunkZoneManager {
  private realTerrainZone: RealTerrainZone | null = null;
  private stageZone: {
    center: { x: number; z: number };
    radius: number;
    blendWidth: number;
  } | null = null;
  private spawnClearingConfig: {
    center: { x: number; z: number };
    radius: number;
    blendWidth: number;
    waterLevel: number;
    campground: CampgroundConfig;
  } | null = null;

  constructor(private deps: ZoneManagerDeps) {}


  loadRealTerrainZone(data: ImportedTerrainData): void {
    this.realTerrainZone = createRealTerrainZone(data);

    const serialized = serializeZoneForWorker(this.realTerrainZone);

    const message: LoadRealZoneMessage = { // eslint-disable-line @typescript-eslint/no-unused-vars
      type: "load-real-zone",
      zone: serialized,
    };

    for (const worker of this.deps.workers) {
      const clonedMessage: LoadRealZoneMessage = {
        type: "load-real-zone",
        zone: {
          ...serialized,
          heights: new Float32Array(serialized.heights),
        },
      };
      worker.postMessage(clonedMessage);
    }

    this.regenerateChunksInZone();
  }

  async loadRealTerrainZoneFromFile(file: File): Promise<void> {
    const text = await file.text();
    const data = JSON.parse(text) as ImportedTerrainData;
    this.loadRealTerrainZone(data);
  }

  clearRealTerrainZone(): void {
    if (!this.realTerrainZone) return;

    this.realTerrainZone = null;

    const message: ClearRealZoneMessage = { type: "clear-real-zone" };
    for (const worker of this.deps.workers) {
      worker.postMessage(message);
    }

    this.regenerateAllChunks();
  }

  hasRealTerrainZone(): boolean {
    return this.realTerrainZone !== null;
  }

  getRealTerrainZoneName(): string | null {
    return this.realTerrainZone?.name ?? null;
  }

  private regenerateChunksInZone(): void {
    if (!this.realTerrainZone) return;

    const { chunkSize } = this.deps.config;
    const zone = this.realTerrainZone;
    const chunksToRegenerate: ChunkKey[] = [];

    for (const [key, state] of this.deps.chunks) {
      if (state.loadState !== "loaded") continue;

      const [chunkX, , chunkZ] = this.deps.parseChunkKey(key);
      const chunkMinX = Math.round(chunkX * chunkSize);
      const chunkMaxX = Math.round((chunkX + 1) * chunkSize);
      const chunkMinZ = Math.round(chunkZ * chunkSize);
      const chunkMaxZ = Math.round((chunkZ + 1) * chunkSize);

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

    for (const key of chunksToRegenerate) {
      const state = this.deps.chunks.get(key);
      if (state) {
        state.loadState = "pending";
        state.meshData = null;
        this.deps.loadQueue.push(key);
      }
    }

    this.deps.processQueue();
  }

  private regenerateAllChunks(): void {
    const chunksToRegenerate = Array.from(this.deps.chunks.keys());

    for (const key of chunksToRegenerate) {
      const state = this.deps.chunks.get(key);
      if (state?.loadState === "loaded") {
        state.loadState = "pending";
        state.meshData = null;
        this.deps.loadQueue.push(key);
      }
    }

    this.deps.processQueue();
  }


  setStageZone(center: { x: number; z: number }, radius: number, blendWidth: number): void {
    this.stageZone = { center, radius, blendWidth };

    const message: SetStageZoneMessage = {
      type: "set-stage-zone",
      center,
      radius,
      blendWidth,
    };

    for (const worker of this.deps.workers) {
      worker.postMessage(message);
    }

    this.regenerateChunksInRadius(center, radius + blendWidth);
  }

  clearStageZone(): void {
    if (!this.stageZone) return;

    const prevZone = this.stageZone;
    this.stageZone = null;

    const message: ClearStageZoneMessage = { type: "clear-stage-zone" };
    for (const worker of this.deps.workers) {
      worker.postMessage(message);
    }

    this.regenerateChunksInRadius(prevZone.center, prevZone.radius + prevZone.blendWidth);
  }

  hasStageZone(): boolean {
    return this.stageZone !== null;
  }


  setSpawnClearing(
    center: { x: number; z: number },
    radius: number,
    blendWidth: number,
    waterLevel: number,
    campground: CampgroundConfig,
  ): void {
    this.spawnClearingConfig = { center, radius, blendWidth, waterLevel, campground };

    const message: SetSpawnClearingMessage = {
      type: "set-spawn-clearing",
      center,
      radius,
      blendWidth,
      waterLevel,
      campground,
    };

    for (const worker of this.deps.workers) {
      worker.postMessage(message);
    }

    this.regenerateChunksInRadius(center, radius + blendWidth);
  }

  clearSpawnClearing(): void {
    if (!this.spawnClearingConfig) return;

    const prevConfig = this.spawnClearingConfig;
    this.spawnClearingConfig = null;

    const message: ClearSpawnClearingMessage = { type: "clear-spawn-clearing" };
    for (const worker of this.deps.workers) {
      worker.postMessage(message);
    }

    this.regenerateChunksInRadius(prevConfig.center, prevConfig.radius + prevConfig.blendWidth);
  }

  hasSpawnClearing(): boolean {
    return this.spawnClearingConfig !== null;
  }

  getSpawnClearingConfig() {
    return this.spawnClearingConfig;
  }


  private regenerateChunksInRadius(center: { x: number; z: number }, totalRadius: number): void {
    const { chunkSize } = this.deps.config;
    const chunksToRegenerate: ChunkKey[] = [];

    for (const [key, state] of this.deps.chunks) {
      if (state.loadState !== "loaded") continue;

      const [chunkX, , chunkZ] = this.deps.parseChunkKey(key);
      const chunkCenterX = (chunkX + 0.5) * chunkSize;
      const chunkCenterZ = (chunkZ + 0.5) * chunkSize;

      const dx = chunkCenterX - center.x;
      const dz = chunkCenterZ - center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const chunkDiagonal = chunkSize * Math.SQRT2;

      if (dist < totalRadius + chunkDiagonal) {
        chunksToRegenerate.push(key);
      }
    }

    for (const key of chunksToRegenerate) {
      const state = this.deps.chunks.get(key);
      if (state) {
        state.loadState = "pending";
        state.meshData = null;
        this.deps.loadQueue.push(key);
      }
    }

    this.deps.processQueue();
  }
}
