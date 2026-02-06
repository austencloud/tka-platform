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
  /** Erosion simulation parameters (optional - off by default) */
  erosion?: ErosionConfig;
  /** Drainage-based water parameters (optional - off by default) */
  drainage?: DrainageConfig;
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

/**
 * Erosion simulation configuration
 *
 * Erosion creates more natural-looking terrain by simulating how water
 * flows across the landscape and carves features over time. This produces:
 * - V-shaped river valleys
 * - Realistic drainage networks
 * - Natural mountain ridges and peaks
 *
 * The algorithm uses hydraulic erosion with thermal weathering:
 * 1. Calculate drainage area at each point (how much terrain flows through)
 * 2. Apply erosion proportional to drainage (more water = more erosion)
 * 3. Optional uplift simulates tectonic forces
 */
export interface ErosionConfig {
  /** Enable erosion simulation (default: false for performance) */
  enabled: boolean;
  /** Number of simulation iterations (10-100, more = more realistic but slower) */
  iterations: number;
  /** How much water erodes terrain per iteration (0.01-0.5) */
  erosionStrength: number;
  /** Tectonic uplift per iteration - terrain rises while water flows (0-0.1) */
  upliftRate: number;
  /** Sediment deposition rate - eroded material settles in flat areas (0-0.5) */
  depositionRate: number;
  /** Minimum slope for erosion to occur (prevents flat areas from eroding) */
  minSlope: number;
  /** Rain amount per iteration - more rain = faster erosion */
  rainAmount: number;
  /** Evaporation rate - water disappears over time */
  evaporationRate: number;
}

/**
 * Drainage-based water configuration
 *
 * Water placement is computed from terrain topology rather than a flat plane:
 * 1. Calculate flow direction at each vertex (D8 algorithm - 8 possible directions)
 * 2. Accumulate drainage area (count upstream cells that flow through each point)
 * 3. Points with high drainage + low elevation become water
 *
 * This creates realistic lake shapes that follow terrain contours and can
 * form natural-looking rivers through drainage networks.
 */
export interface DrainageConfig {
  /** Enable drainage-based water (false = simple flat plane) */
  enabled: boolean;
  /** Minimum drainage area threshold for water (0-1, higher = less water) */
  drainageThreshold: number;
  /** Height tolerance above ocean level for water placement */
  heightTolerance: number;
  /** Smooth transitions at water edges */
  edgeSmoothing: boolean;
  /** River width scale factor (higher = wider rivers) */
  riverWidthScale: number;
  /** Minimum pool size to form a lake (prevents isolated single-cell "puddles") */
  minPoolSize: number;
}

/** Vegetation instance data for GPU path */
export interface GPUVegetationData {
  type: "tree" | "bush" | "grass" | "flower" | "rock";
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
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
  /** Blend weights for terrain splatting (grass, rock, dirt) - per vertex */
  blendWeights1: Float32Array;
  /** Blend weights for terrain splatting (sand, snow, unused) - per vertex */
  blendWeights2: Float32Array;
  /** Vegetation instances */
  vegetation: GPUVegetationData[];
  /** Biome at chunk center */
  biome: string;
  /** Whether this was generated on GPU (false = fallback to CPU) */
  usedGPU: boolean;
  /** Drainage data for water placement (optional) */
  drainage?: DrainageData;
}

/**
 * Per-chunk drainage data for realistic water placement
 */
export interface DrainageData {
  /** Drainage accumulation per vertex (how much water flows through each point) */
  drainageAccumulation: Float32Array;
  /** Flow direction per vertex (0-7 for 8 cardinal/diagonal directions, 255 = sink) */
  flowDirection: Uint8Array;
  /** Water mask per vertex (0 = land, 1 = water, fractional for edges) */
  waterMask: Float32Array;
  /** Water level at each vertex (for depth-based shading) */
  waterDepth: Float32Array;
  /** Bounding box of water areas in this chunk (for culling) */
  waterBounds: {
    minX: number;
    minZ: number;
    maxX: number;
    maxZ: number;
    hasWater: boolean;
  };
}

export interface ChunkGenerateRequest {
  chunkX: number;
  chunkZ: number;
  lod: number;
}

/**
 * Default erosion configuration (disabled)
 * Enable for more realistic terrain at the cost of generation time.
 */
export const DEFAULT_EROSION_CONFIG: ErosionConfig = {
  enabled: true,
  iterations: 30,
  erosionStrength: 0.1,
  upliftRate: 0.01,
  depositionRate: 0.3,
  minSlope: 0.01,
  rainAmount: 1.0,
  evaporationRate: 0.5,
};

/**
 * Default drainage configuration (disabled)
 * Enable for realistic lake/river water that follows terrain contours.
 */
export const DEFAULT_DRAINAGE_CONFIG: DrainageConfig = {
  enabled: false,
  drainageThreshold: 0.15, // Higher = requires more upstream area to form water
  heightTolerance: 5, // How far above ocean level water can pool
  edgeSmoothing: true,
  riverWidthScale: 1.5,
  minPoolSize: 4, // Minimum connected water cells to form a lake
};

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
  erosion: DEFAULT_EROSION_CONFIG,
  drainage: DEFAULT_DRAINAGE_CONFIG,
};
