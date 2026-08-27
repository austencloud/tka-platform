/**
 * GPU Chunk Generator
 *
 * Wrapper that provides a unified interface for chunk generation,
 * automatically choosing GPU or CPU based on availability.
 *
 * Usage:
 * 1. Create instance: new GPUChunkGenerator(config)
 * 2. Initialize: await generator.init()
 * 3. Generate: const result = await generator.generateChunk(...)
 * 4. Cleanup: generator.dispose()
 */

import {
  TerrainComputeGenerator,
  isWebGPUAvailable,
} from "./terrain-compute-generator";
import type {
  GPUChunkResult,
  ChunkGenerateRequest,
} from "./terrain-compute-types";

export interface GPUChunkGeneratorConfig {
  /** World seed for deterministic generation */
  worldSeed: number;
  /** Chunk size in world units */
  chunkSize: number;
  /** Base resolution (vertices per side) */
  resolution: number;
  /** Force CPU mode (for testing) */
  forceCPU?: boolean;
}

/**
 * GPU Chunk Generator
 *
 * Provides chunk generation with automatic GPU/CPU selection.
 */
export class GPUChunkGenerator {
  private computeGenerator: TerrainComputeGenerator | null = null;
  private config: GPUChunkGeneratorConfig;
  private isGPUEnabled = false;
  private initPromise: Promise<boolean> | null = null;

  constructor(config: GPUChunkGeneratorConfig) {
    this.config = config;
  }

  /**
   * Initialize the generator
   * Returns true if GPU is being used, false for CPU
   */
  async init(): Promise<boolean> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<boolean> {
    if (this.config.forceCPU) {
      this.isGPUEnabled = false;
      return false;
    }

    // Check WebGPU availability
    const gpuAvailable = await isWebGPUAvailable();
    if (!gpuAvailable) {
      this.isGPUEnabled = false;
      return false;
    }

    this.computeGenerator = new TerrainComputeGenerator({
      worldSeed: this.config.worldSeed,
      chunkSize: this.config.chunkSize,
      resolution: this.config.resolution,
    });

    const success = await this.computeGenerator.init();
    this.isGPUEnabled = success;

    if (!success) {
      this.computeGenerator.dispose();
      this.computeGenerator = null;
    }

    return this.isGPUEnabled;
  }

  /**
   * Generate terrain for a chunk
   */
  async generateChunk(
    chunkX: number,
    chunkZ: number,
    lod: number
  ): Promise<GPUChunkResult> {
    // Wait for initialization if needed
    if (!this.initPromise) {
      await this.init();
    } else {
      await this.initPromise;
    }

    const request: ChunkGenerateRequest = { chunkX, chunkZ, lod };

    if (this.computeGenerator) {
      return this.computeGenerator.generateChunk(request);
    }

    // CPU fallback is built into TerrainComputeGenerator
    // Create temporary generator for CPU mode
    const tempGenerator = new TerrainComputeGenerator({
      worldSeed: this.config.worldSeed,
      chunkSize: this.config.chunkSize,
      resolution: this.config.resolution,
    });

    const result = await tempGenerator.generateChunk(request);
    tempGenerator.dispose();

    return result;
  }

  /**
   * Check if GPU is being used
   */
  isUsingGPU(): boolean {
    return this.isGPUEnabled;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.computeGenerator?.dispose();
    this.computeGenerator = null;
    this.isGPUEnabled = false;
    this.initPromise = null;
  }
}

export function createGPUChunkGenerator(
  worldSeed: number,
  chunkSize = 32,
  resolution = 33
): GPUChunkGenerator {
  return new GPUChunkGenerator({
    worldSeed,
    chunkSize,
    resolution,
  });
}
