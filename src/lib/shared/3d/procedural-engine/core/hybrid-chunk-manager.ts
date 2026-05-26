/**
 * Hybrid Chunk Manager
 *
 * Enhanced chunk manager that can use GPU compute for terrain generation
 * when available, with automatic fallback to CPU workers.
 *
 * This is a wrapper around the existing ChunkManager that adds GPU support
 * while maintaining full backward compatibility.
 *
 * Usage:
 * - Same API as ChunkManager
 * - Set `useGPU: true` in config to enable GPU terrain generation
 * - Falls back automatically if WebGPU unavailable
 */

import {
  ChunkManager,
  type ChunkManagerConfig,
  type ChunkState,
  type ChunkMeshData,
  type ChunkKey,
} from "./chunk-manager";
import type {
  GPUChunkGenerator} from "../generation/gpu/gpu-chunk-generator";
import {
  createGPUChunkGenerator,
} from "../generation/gpu/gpu-chunk-generator";
import type { VegetationData } from "../workers/chunk-generator.worker";
import type { GPUChunkResult, GPUVegetationData } from "../generation/gpu/terrain-compute-types";

export interface HybridChunkManagerConfig extends ChunkManagerConfig {
  /** Enable GPU terrain generation when available */
  useGPU?: boolean;
  /** Force CPU mode (for testing/debugging) */
  forceCPU?: boolean;
}

/**
 * Hybrid Chunk Manager
 *
 * Extends ChunkManager with GPU compute capability.
 */
export class HybridChunkManager extends ChunkManager {
  private gpuGenerator: GPUChunkGenerator | null = null;
  private useGPUMode = false;
  private gpuInitPromise: Promise<void> | null = null;

  // Performance tracking
  private gpuGeneratedCount = 0;
  private cpuGeneratedCount = 0;
  private gpuTotalTimeMs = 0;
  private cpuTotalTimeMs = 0;

  constructor(
    worldSeed: number,
    config: Partial<HybridChunkManagerConfig> = {}
  ) {
    // Call parent constructor
    super(worldSeed, config);

    // Initialize GPU if requested
    if (config.useGPU && !config.forceCPU) {
      this.initGPU(worldSeed, config);
    }
  }

  private async initGPU(
    worldSeed: number,
    config: Partial<HybridChunkManagerConfig>
  ): Promise<void> {
    if (this.gpuInitPromise) return this.gpuInitPromise;

    this.gpuInitPromise = this.doInitGPU(worldSeed, config);
    return this.gpuInitPromise;
  }

  private async doInitGPU(
    worldSeed: number,
    config: Partial<HybridChunkManagerConfig>
  ): Promise<void> {
    try {
      this.gpuGenerator = createGPUChunkGenerator(
        worldSeed,
        config.chunkSize ?? 32,
        config.resolution ?? 33
      );

      this.useGPUMode = await this.gpuGenerator.init();

      // GPU mode status determined by this.useGPUMode
    } catch (error) {
      console.warn("[HybridChunkManager] GPU init failed:", error);
      this.useGPUMode = false;
    }
  }

  /**
   * Check if GPU mode is active
   */
  isUsingGPU(): boolean {
    return this.useGPUMode;
  }

  /**
   * Wait for GPU initialization to complete
   */
  async waitForGPU(): Promise<boolean> {
    if (this.gpuInitPromise) {
      await this.gpuInitPromise;
    }
    return this.useGPUMode;
  }

  /**
   * Override loadChunk to use GPU generation when available
   */
  protected override loadChunk(key: ChunkKey, state: ChunkState): void {
    // If GPU mode is not enabled or generator not ready, fall back to worker-based loading
    if (!this.useGPUMode || !this.gpuGenerator) {
      const startTime = performance.now();
      super.loadChunk(key, state);
      // Track CPU timing (approximate - actual work is in worker)
      this.cpuGeneratedCount++;
      this.cpuTotalTimeMs += performance.now() - startTime;
      return;
    }

    // GPU path: generate chunk using GPU compute
    state.loadState = "loading";
    this.activeLoads++;

    const [chunkX, , chunkZ] = this.parseChunkKey(key);
    const startTime = performance.now();

    // Generate chunk on GPU
    this.gpuGenerator
      .generateChunk(chunkX, chunkZ, state.lod)
      .then((gpuResult) => {
        // Track GPU timing
        const elapsedMs = performance.now() - startTime;
        this.gpuGeneratedCount++;
        this.gpuTotalTimeMs += elapsedMs;

        // Convert GPUChunkResult to ChunkMeshData
        const meshData = this.convertGPUResult(gpuResult);

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

        // Check memory budget
        this.enforceMemoryBudget();

        this.activeLoads--;
      })
      .catch((error) => {
        console.warn("[HybridChunkManager] GPU generation failed, falling back to worker:", error);
        // Fall back to worker-based generation
        this.activeLoads--;
        this.cpuGeneratedCount++; // Count fallback as CPU
        super.loadChunk(key, state);
      });
  }

  /**
   * Convert GPUChunkResult to ChunkMeshData format
   */
  private convertGPUResult(gpuResult: GPUChunkResult): ChunkMeshData {
    // Map GPU vegetation types to worker vegetation types
    const mapVegetationType = (
      gpuType: "tree" | "bush" | "grass" | "flower" | "rock"
    ): "tree1" | "tree2" | "tree3" | "rock1" | "rock2" | "bush1" | "bush2" | "grass" => {
      switch (gpuType) {
        case "tree":
          return "tree1";
        case "bush":
          return "bush1";
        case "rock":
          return "rock1";
        case "grass":
        case "flower":
          return "grass";
      }
    };

    // Convert GPUVegetationData[] to VegetationData[]
    const vegetation: VegetationData[] = gpuResult.vegetation.map((v: GPUVegetationData) => ({
      type: mapVegetationType(v.type),
      x: v.x,
      y: v.y,
      z: v.z,
      scale: v.scale,
      rotation: v.rotation,
    }));

    return {
      vertices: gpuResult.vertices,
      normals: gpuResult.normals,
      colors: gpuResult.colors,
      indices: gpuResult.indices,
      blendWeights1: gpuResult.blendWeights1,
      blendWeights2: gpuResult.blendWeights2,
      vegetation,
      biome: gpuResult.biome,
      drainage: gpuResult.drainage,
    };
  }

  /**
   * Override dispose to clean up GPU resources
   */
  override dispose(): void {
    super.dispose();
    this.gpuGenerator?.dispose();
    this.gpuGenerator = null;
    this.useGPUMode = false;
  }

  /**
   * Get stats including GPU status
   */
  override getStats(): ReturnType<ChunkManager["getStats"]> & { usingGPU: boolean } {
    const baseStats = super.getStats();
    return {
      ...baseStats,
      usingGPU: this.useGPUMode,
    };
  }

  /**
   * Get detailed stats including GPU performance metrics
   */
  override getDetailedStats(): ReturnType<ChunkManager["getDetailedStats"]> & {
    usingGPU: boolean;
    gpuGeneratedCount: number;
    cpuGeneratedCount: number;
    gpuAverageTimeMs: number;
    cpuAverageTimeMs: number;
    gpuSpeedup: number; // How much faster GPU is vs CPU
  } {
    const baseStats = super.getDetailedStats();

    const gpuAverageTimeMs = this.gpuGeneratedCount > 0
      ? this.gpuTotalTimeMs / this.gpuGeneratedCount
      : 0;
    const cpuAverageTimeMs = this.cpuGeneratedCount > 0
      ? this.cpuTotalTimeMs / this.cpuGeneratedCount
      : 0;
    const gpuSpeedup = gpuAverageTimeMs > 0 && cpuAverageTimeMs > 0
      ? cpuAverageTimeMs / gpuAverageTimeMs
      : 0;

    return {
      ...baseStats,
      usingGPU: this.useGPUMode,
      gpuGeneratedCount: this.gpuGeneratedCount,
      cpuGeneratedCount: this.cpuGeneratedCount,
      gpuAverageTimeMs: Math.round(gpuAverageTimeMs * 100) / 100,
      cpuAverageTimeMs: Math.round(cpuAverageTimeMs * 100) / 100,
      gpuSpeedup: Math.round(gpuSpeedup * 10) / 10,
    };
  }

  /**
   * Reset performance counters (useful for benchmarking)
   */
  resetPerformanceCounters(): void {
    this.gpuGeneratedCount = 0;
    this.cpuGeneratedCount = 0;
    this.gpuTotalTimeMs = 0;
    this.cpuTotalTimeMs = 0;
  }
}

/**
 * Create a hybrid chunk manager with GPU support
 */
export function createHybridChunkManager(
  worldSeed: number,
  config: Partial<HybridChunkManagerConfig> = {}
): HybridChunkManager {
  return new HybridChunkManager(worldSeed, {
    useGPU: true,
    ...config,
  });
}
