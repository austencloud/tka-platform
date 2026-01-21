/**
 * Terrain GPU Compute Types
 *
 * Type definitions for GPU-accelerated terrain generation.
 */

export interface TerrainComputeConfig {
  /** Size of each chunk in world units */
  chunkSize: number;
  /** Vertices per side at base resolution */
  resolution: number;
  /** World seed for deterministic generation */
  worldSeed: number;
  /** Noise parameters */
  noise: NoiseConfig;
  /** Biome parameters */
  biome: BiomeConfig;
}

export interface NoiseConfig {
  /** Base terrain scale */
  baseScale: number;
  /** Mountain scale (lower = larger mountains) */
  mountainScale: number;
  /** Number of FBM octaves */
  octaves: number;
  /** Lacunarity (frequency multiplier per octave) */
  lacunarity: number;
  /** Persistence (amplitude multiplier per octave) */
  persistence: number;
  /** Height multiplier */
  heightScale: number;
}

export interface BiomeConfig {
  /** Temperature noise scale */
  temperatureScale: number;
  /** Moisture noise scale */
  moistureScale: number;
  /** Ocean threshold (heights below this are ocean) */
  oceanLevel: number;
  /** Mountain threshold (heights above this are mountains) */
  mountainLevel: number;
}

export interface GPUChunkResult {
  /** Vertex positions (x, y, z per vertex) */
  vertices: Float32Array;
  /** Vertex normals (nx, ny, nz per vertex) */
  normals: Float32Array;
  /** Vertex colors (r, g, b per vertex) */
  colors: Float32Array;
  /** Triangle indices */
  indices: Uint32Array;
  /** Biome at chunk center */
  biome: string;
  /** Whether this was generated on GPU (false = fallback to CPU) */
  usedGPU: boolean;
}

export interface ChunkGenerateRequest {
  chunkX: number;
  chunkZ: number;
  lod: number;
}

/**
 * Default terrain compute configuration
 */
export const DEFAULT_TERRAIN_CONFIG: TerrainComputeConfig = {
  chunkSize: 32,
  resolution: 33,
  worldSeed: 12345,
  noise: {
    baseScale: 0.01,
    mountainScale: 0.005,
    octaves: 6,
    lacunarity: 2.0,
    persistence: 0.5,
    heightScale: 50,
  },
  biome: {
    temperatureScale: 0.002,
    moistureScale: 0.003,
    oceanLevel: -10,
    mountainLevel: 40,
  },
};
