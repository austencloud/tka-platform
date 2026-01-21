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
} from "./chunk-manager";
import {
  GPUChunkGenerator,
  createGPUChunkGenerator,
} from "../generation/gpu/gpu-chunk-generator";
import type { VegetationData } from "../workers/chunk-generator.worker";

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

      if (this.useGPUMode) {
        console.log("[HybridChunkManager] GPU mode enabled");
      } else {
        console.log("[HybridChunkManager] GPU unavailable, using workers");
      }
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
