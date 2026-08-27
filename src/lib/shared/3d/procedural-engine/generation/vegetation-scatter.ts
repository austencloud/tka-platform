/**
 * Vegetation Scatter System
 *
 * ScatterMeshes-style vegetation placement with:
 * - Deterministic, seeded placement
 * - Terrain-aware distribution (slope, height, moisture)
 * - Biome-specific vegetation rules
 * - Poisson disk sampling for natural distribution
 * - Configurable density per vegetation type
 *
 * Inspired by THREE.Terrain's ScatterMeshes pattern.
 *
 * Supports two systems:
 * 1. Legacy: Uses VegetationType union and VegetationBiomeType
 * 2. Category: Uses VegetationCategory and BiomeType (329 models)
 */

import { hashCoordinates, mulberry32 } from "./seed-generator";
import { BiomeType } from "./biome-system";
import type { VegetationCategory } from "../vegetation/domain/vegetation-categories";
import { getCategorySpacing, getCategoryScaleRange } from "../vegetation/domain/vegetation-categories";
import { getBiomeVegetationConfig, getCategoryRulesForBiome } from "../vegetation/config/biome-vegetation-rules";

/**
 * Biome type for vegetation placement (uses legacy string format)
 */
export type VegetationBiomeType = "plains" | "forest" | "mountains" | "desert" | "ocean";


/**
 * All available vegetation types in the realm
 */
export type VegetationType =
  | "tree1" | "tree2" | "tree3"  // Deciduous trees
  | "pine1" | "pine2"            // Coniferous trees
  | "palm1"                      // Palm trees (desert oasis, beach)
  | "deadTree"                   // Dead/bare trees
  | "bush1" | "bush2"            // Bushes
  | "fern"                       // Forest floor fern
  | "cactus1" | "cactus2"        // Desert cacti
  | "rock1" | "rock2" | "rock3"  // Rocks (count as vegetation for placement)
  | "grass"                      // Grass tufts
  | "flower1" | "flower2"        // Wildflowers
  | "mushroom"                   // Forest mushrooms
  | "log";                       // Fallen logs

/**
 * Vegetation instance data returned by the scatter system
 */
export interface VegetationInstance {
  type: VegetationType;
  x: number;  // Local X within chunk
  y: number;  // World height at position
  z: number;  // Local Z within chunk
  rotation: number;  // Y-axis rotation in radians
  scale: number;     // Uniform scale factor
}


/**
 * Configuration for a single vegetation type's placement rules
 */
export interface VegetationRule {
  type: VegetationType;
  /** Which biomes this vegetation can appear in */
  biomes: VegetationBiomeType[];
  /** Base density (0-1). Higher = more common */
  density: number;
  /** Minimum slope (0 = flat only, 1 = vertical) */
  minSlope: number;
  /** Maximum slope (0 = flat only, 1 = vertical) */
  maxSlope: number;
  /** Minimum terrain height for placement */
  minHeight: number;
  /** Maximum terrain height for placement */
  maxHeight: number;
  /** Minimum distance between instances of this type */
  minSpacing: number;
  /** Scale range [min, max] */
  scaleRange: [number, number];
  /** Priority for placement (higher = placed first, can block others) */
  priority: number;
  /** Whether to cluster (groups of items) or spread evenly */
  clustering: number;  // 0 = even, 1 = highly clustered
}

/**
 * Default vegetation rules - defines how each type is placed
 */
export const VEGETATION_RULES: VegetationRule[] = [
  // === TREES (High priority, large spacing) ===
  {
    type: "tree1",
    biomes: ["forest", "plains"],
    density: 0.6,
    minSlope: 0,
    maxSlope: 0.4,  // No trees on steep slopes
    minHeight: -5,
    maxHeight: 35,
    minSpacing: 4,
    scaleRange: [0.7, 1.2],
    priority: 100,
    clustering: 0.3,
  },
  {
    type: "tree2",
    biomes: ["forest", "plains"],
    density: 0.5,
    minSlope: 0,
    maxSlope: 0.4,
    minHeight: -5,
    maxHeight: 35,
    minSpacing: 4,
    scaleRange: [0.8, 1.3],
    priority: 100,
    clustering: 0.3,
  },
  {
    type: "tree3",
    biomes: ["forest"],
    density: 0.4,
    minSlope: 0,
    maxSlope: 0.35,
    minHeight: 0,
    maxHeight: 30,
    minSpacing: 5,
    scaleRange: [0.9, 1.4],
    priority: 100,
    clustering: 0.4,
  },
  {
    type: "pine1",
    biomes: ["mountains", "forest"],
    density: 0.5,
    minSlope: 0,
    maxSlope: 0.5,
    minHeight: 20,
    maxHeight: 45,
    minSpacing: 3,
    scaleRange: [0.6, 1.1],
    priority: 100,
    clustering: 0.2,
  },
  {
    type: "pine2",
    biomes: ["mountains"],
    density: 0.4,
    minSlope: 0,
    maxSlope: 0.5,
    minHeight: 25,
    maxHeight: 50,
    minSpacing: 3,
    scaleRange: [0.5, 1.0],
    priority: 100,
    clustering: 0.2,
  },
  {
    type: "palm1",
    biomes: ["desert"],
    density: 0.05,  // Very sparse - oasis only
    minSlope: 0,
    maxSlope: 0.2,
    minHeight: -8,
    maxHeight: 10,
    minSpacing: 8,
    scaleRange: [0.8, 1.2],
    priority: 100,
    clustering: 0.8,  // Highly clustered at oases
  },
  {
    type: "deadTree",
    biomes: ["desert", "mountains"],
    density: 0.1,
    minSlope: 0,
    maxSlope: 0.6,
    minHeight: -5,
    maxHeight: 45,
    minSpacing: 10,
    scaleRange: [0.5, 0.9],
    priority: 90,
    clustering: 0.1,
  },

  // === BUSHES (Medium priority) ===
  {
    type: "bush1",
    biomes: ["forest", "plains"],
    density: 0.5,
    minSlope: 0,
    maxSlope: 0.5,
    minHeight: -5,
    maxHeight: 35,
    minSpacing: 2,
    scaleRange: [0.5, 0.9],
    priority: 80,
    clustering: 0.4,
  },
  {
    type: "bush2",
    biomes: ["forest", "plains", "mountains"],
    density: 0.4,
    minSlope: 0,
    maxSlope: 0.6,
    minHeight: -5,
    maxHeight: 40,
    minSpacing: 2,
    scaleRange: [0.4, 0.8],
    priority: 80,
    clustering: 0.3,
  },
  {
    type: "fern",
    biomes: ["forest"],
    density: 0.7,
    minSlope: 0,
    maxSlope: 0.4,
    minHeight: -5,
    maxHeight: 25,
    minSpacing: 1,
    scaleRange: [0.4, 0.8],
    priority: 50,
    clustering: 0.6,
  },

  // === CACTI (Desert only) ===
  {
    type: "cactus1",
    biomes: ["desert"],
    density: 0.2,
    minSlope: 0,
    maxSlope: 0.3,
    minHeight: -5,
    maxHeight: 30,
    minSpacing: 5,
    scaleRange: [0.6, 1.2],
    priority: 90,
    clustering: 0.1,
  },
  {
    type: "cactus2",
    biomes: ["desert"],
    density: 0.15,
    minSlope: 0,
    maxSlope: 0.3,
    minHeight: -5,
    maxHeight: 30,
    minSpacing: 6,
    scaleRange: [0.8, 1.5],
    priority: 90,
    clustering: 0.1,
  },

  // === ROCKS (All biomes, varies by type) ===
  {
    type: "rock1",
    biomes: ["mountains", "desert", "plains", "forest"],
    density: 0.3,
    minSlope: 0,
    maxSlope: 0.9,  // Rocks can be on steep slopes
    minHeight: -10,
    maxHeight: 60,
    minSpacing: 2,
    scaleRange: [0.4, 1.5],
    priority: 70,
    clustering: 0.5,
  },
  {
    type: "rock2",
    biomes: ["mountains", "desert"],
    density: 0.25,
    minSlope: 0.1,  // Prefer some slope
    maxSlope: 0.95,
    minHeight: 10,
    maxHeight: 60,
    minSpacing: 3,
    scaleRange: [0.6, 2.0],
    priority: 70,
    clustering: 0.6,
  },
  {
    type: "rock3",
    biomes: ["mountains"],
    density: 0.2,
    minSlope: 0.2,
    maxSlope: 1.0,
    minHeight: 25,
    maxHeight: 70,
    minSpacing: 4,
    scaleRange: [0.8, 2.5],
    priority: 70,
    clustering: 0.7,
  },

  // === GROUND COVER (Low priority, high density) ===
  {
    type: "grass",
    biomes: ["plains", "forest"],
    density: 0.8,
    minSlope: 0,
    maxSlope: 0.5,
    minHeight: -5,
    maxHeight: 35,
    minSpacing: 0.5,
    scaleRange: [0.3, 0.7],
    priority: 20,
    clustering: 0.5,
  },
  {
    type: "flower1",
    biomes: ["plains", "forest"],
    density: 0.3,
    minSlope: 0,
    maxSlope: 0.4,
    minHeight: -5,
    maxHeight: 30,
    minSpacing: 1,
    scaleRange: [0.3, 0.6],
    priority: 30,
    clustering: 0.7,
  },
  {
    type: "flower2",
    biomes: ["plains"],
    density: 0.2,
    minSlope: 0,
    maxSlope: 0.3,
    minHeight: -5,
    maxHeight: 25,
    minSpacing: 1,
    scaleRange: [0.3, 0.5],
    priority: 30,
    clustering: 0.8,
  },
  {
    type: "mushroom",
    biomes: ["forest"],
    density: 0.25,
    minSlope: 0,
    maxSlope: 0.4,
    minHeight: -5,
    maxHeight: 20,
    minSpacing: 1.5,
    scaleRange: [0.3, 0.6],
    priority: 40,
    clustering: 0.9,  // Mushrooms cluster heavily
  },
  {
    type: "log",
    biomes: ["forest"],
    density: 0.1,
    minSlope: 0,
    maxSlope: 0.3,
    minHeight: -5,
    maxHeight: 30,
    minSpacing: 6,
    scaleRange: [0.6, 1.0],
    priority: 60,
    clustering: 0.2,
  },
];

/**
 * Get rules applicable to a specific biome, sorted by priority (descending)
 */
export function getRulesForBiome(biome: VegetationBiomeType): VegetationRule[] {
  return VEGETATION_RULES
    .filter(rule => rule.biomes.includes(biome))
    .sort((a, b) => b.priority - a.priority);
}


/**
 * Poisson disk sample point with metadata
 */
interface PoissonSample {
  x: number;
  z: number;
  type: VegetationType;
  scale: number;
  rotation: number;
}

/**
 * Spatial hash grid for collision detection
 */
class SpatialHash {
  private cells: Map<string, PoissonSample[]> = new Map();
  private cellSize: number;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  private getKey(x: number, z: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx},${cz}`;
  }

  insert(sample: PoissonSample): void {
    const key = this.getKey(sample.x, sample.z);
    const cell = this.cells.get(key);
    if (cell) {
      cell.push(sample);
    } else {
      this.cells.set(key, [sample]);
    }
  }

  /**
   * Check if a point is valid (not too close to existing samples)
   */
  isValid(x: number, z: number, minDistance: number): boolean {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);

    // Check neighboring cells
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const key = `${cx + dx},${cz + dz}`;
        const cell = this.cells.get(key);
        if (!cell) continue;

        for (const sample of cell) {
          const distSq = (x - sample.x) ** 2 + (z - sample.z) ** 2;
          if (distSq < minDistance * minDistance) {
            return false;
          }
        }
      }
    }
    return true;
  }
}

// ============================================================================
// VEGETATION SCATTER GENERATOR
// ============================================================================

/**
 * Terrain data needed for vegetation placement
 */
export interface TerrainSample {
  height: number;
  slope: number;  // 0 = flat, 1 = vertical
  biome: VegetationBiomeType;
  /** Water mask value (0 = no water, 1 = fully submerged) */
  waterMask?: number;
  /** New biome type for category-based system */
  biomeType?: BiomeType;
}

/**
 * Configuration for vegetation generation
 */
export interface VegetationScatterConfig {
  /** World seed for deterministic generation */
  worldSeed: number;
  /** Chunk size in world units */
  chunkSize: number;
  /** LOD level (0 = full detail, higher = less vegetation) */
  lod: number;
  /** Global density multiplier (0.5 = half density) */
  densityMultiplier?: number;
  /** Exclude zone center (for spawn clearing, etc.) */
  excludeZone?: {
    centerX: number;
    centerZ: number;
    radius: number;
  };
  /** Use the new category-based system (329 models) instead of legacy VegetationType */
  useCategorySystem?: boolean;
}

/**
 * Generate vegetation instances for a chunk using ScatterMeshes-style algorithm
 *
 * @param chunkX - Chunk X coordinate
 * @param chunkZ - Chunk Z coordinate
 * @param config - Generation configuration
 * @param sampleTerrain - Function to sample terrain at a world position
 * @returns Array of vegetation instances
 */
export function generateVegetationScatter(
  chunkX: number,
  chunkZ: number,
  config: VegetationScatterConfig,
  sampleTerrain: (worldX: number, worldZ: number) => TerrainSample
): VegetationInstance[] {
  const { worldSeed, chunkSize, lod, densityMultiplier = 1.0, excludeZone } = config;

  const instances: VegetationInstance[] = [];

  // Calculate world origin
  const originX = chunkX * chunkSize;
  const originZ = chunkZ * chunkSize;

  // Create deterministic RNG for this chunk
  const chunkSeed = hashCoordinates(worldSeed, chunkX, 0, chunkZ);
  const rng = mulberry32(chunkSeed);

  // LOD-based detail reduction
  // LOD 0-1: Full vegetation
  // LOD 2: Trees and large bushes only
  // LOD 3: Large trees only
  // LOD 4+: No vegetation
  if (lod >= 4) return instances;

  const lodMultiplier = lod === 0 ? 1.0 : lod === 1 ? 0.8 : lod === 2 ? 0.3 : 0.1;
  const minPriority = lod === 0 ? 0 : lod === 1 ? 20 : lod === 2 ? 70 : 90;

  // Spatial hash for collision detection (cell size based on smallest spacing)
  const spatialHash = new SpatialHash(2);

  // Sample terrain at chunk center to determine primary biome
  const centerSample = sampleTerrain(originX + chunkSize / 2, originZ + chunkSize / 2);
  const primaryBiome = centerSample.biome;

  // Get applicable rules for this biome
  const rules = getRulesForBiome(primaryBiome)
    .filter(rule => rule.priority >= minPriority);

  // Generate samples using a grid-based Poisson disk approach
  // Grid cells are sized to respect minimum spacing requirements
  const gridStep = 2;  // Base grid step

  for (let gz = 0; gz < chunkSize; gz += gridStep) {
    for (let gx = 0; gx < chunkSize; gx += gridStep) {
      // World position with jitter
      const jitterX = (rng() - 0.5) * gridStep * 0.8;
      const jitterZ = (rng() - 0.5) * gridStep * 0.8;
      const localX = gx + jitterX;
      const localZ = gz + jitterZ;
      const worldX = originX + localX;
      const worldZ = originZ + localZ;

      // Check exclude zone
      if (excludeZone) {
        const dx = worldX - excludeZone.centerX;
        const dz = worldZ - excludeZone.centerZ;
        if (dx * dx + dz * dz < excludeZone.radius * excludeZone.radius) {
          continue;
        }
      }

      // Sample terrain at this position
      const terrain = sampleTerrain(worldX, worldZ);

      // Skip ocean, underwater areas, and water-covered areas
      if (terrain.biome === "ocean" || terrain.height < -10) {
        continue;
      }

      // Skip areas with water (drainage-based water system)
      // waterMask > 0.3 means significant water coverage
      if (terrain.waterMask !== undefined && terrain.waterMask > 0.3) {
        continue;
      }

      // Try each applicable rule (sorted by priority)
      for (const rule of rules) {
        // Check if this rule applies to the local biome
        if (!rule.biomes.includes(terrain.biome)) continue;

        // Check height constraints
        if (terrain.height < rule.minHeight || terrain.height > rule.maxHeight) continue;

        // Check slope constraints
        if (terrain.slope < rule.minSlope || terrain.slope > rule.maxSlope) continue;

        // Calculate effective density with clustering
        const clusterNoise = getClusterNoise(worldSeed, worldX, worldZ, rule.clustering);
        const effectiveDensity = rule.density * densityMultiplier * lodMultiplier * clusterNoise;

        // Random check against density
        if (rng() > effectiveDensity) continue;

        // Check spacing against already placed vegetation
        if (!spatialHash.isValid(localX, localZ, rule.minSpacing)) continue;

        // Calculate scale and rotation
        const [minScale, maxScale] = rule.scaleRange;
        const scale = minScale + rng() * (maxScale - minScale);
        const rotation = rng() * Math.PI * 2;

        // Create instance
        const instance: VegetationInstance = {
          type: rule.type,
          x: localX,
          y: terrain.height,
          z: localZ,
          scale,
          rotation,
        };

        instances.push(instance);

        // Register in spatial hash
        spatialHash.insert({
          x: localX,
          z: localZ,
          type: rule.type,
          scale,
          rotation,
        });

        // Only one vegetation per grid cell (highest priority wins)
        break;
      }
    }
  }

  return instances;
}

/**
 * Calculate clustering noise value for a position
 * Returns 0-2 where values > 1 increase density and < 1 decrease it
 */
function getClusterNoise(seed: number, worldX: number, worldZ: number, clusterAmount: number): number {
  if (clusterAmount <= 0) return 1.0;

  // Use hash-based noise for clustering
  const cx = Math.floor(worldX / 10);
  const cz = Math.floor(worldZ / 10);
  const hash = hashCoordinates(seed + 0xDEAD, cx, 0, cz);
  const rng = mulberry32(hash);
  const noise = rng();

  // Interpolate between uniform (1.0) and clustered (0-2)
  const clustered = noise < 0.5 ? noise * 4 : 0;  // Creates empty spots
  return 1.0 + clusterAmount * (clustered - 1.0);
}

// ============================================================================
// CATEGORY-BASED SCATTER SYSTEM (NEW)
// ============================================================================

/**
 * Category-based vegetation instance data
 * Used by the new 329-model system
 */
export interface CategoryVegetationInstance {
  category: VegetationCategory;
  x: number;  // Local X within chunk
  y: number;  // World height at position
  z: number;  // Local Z within chunk
  rotation: number;  // Y-axis rotation in radians
  scale: number;     // Uniform scale factor
  biome: BiomeType;  // Biome at this position (for model selection)
}

/**
 * Spatial hash for category-based collision detection
 */
class CategorySpatialHash {
  private cells: Map<string, CategoryVegetationInstance[]> = new Map();
  private cellSize: number;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  private getKey(x: number, z: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx},${cz}`;
  }

  insert(sample: CategoryVegetationInstance): void {
    const key = this.getKey(sample.x, sample.z);
    const cell = this.cells.get(key);
    if (cell) {
      cell.push(sample);
    } else {
      this.cells.set(key, [sample]);
    }
  }

  isValid(x: number, z: number, minDistance: number): boolean {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);

    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const key = `${cx + dx},${cz + dz}`;
        const cell = this.cells.get(key);
        if (!cell) continue;

        for (const sample of cell) {
          const distSq = (x - sample.x) ** 2 + (z - sample.z) ** 2;
          if (distSq < minDistance * minDistance) {
            return false;
          }
        }
      }
    }
    return true;
  }
}

/**
 * Generate category-based vegetation instances for a chunk
 * Uses the new 329-model system with BiomeType and VegetationCategory
 *
 * @param chunkX - Chunk X coordinate
 * @param chunkZ - Chunk Z coordinate
 * @param config - Generation configuration
 * @param sampleTerrain - Function to sample terrain at a world position
 * @returns Array of category vegetation instances
 */
export function generateCategoryScatter(
  chunkX: number,
  chunkZ: number,
  config: VegetationScatterConfig,
  sampleTerrain: (worldX: number, worldZ: number) => TerrainSample
): CategoryVegetationInstance[] {
  const { worldSeed, chunkSize, lod, densityMultiplier = 1.0, excludeZone } = config;

  const instances: CategoryVegetationInstance[] = [];

  // Calculate world origin
  const originX = chunkX * chunkSize;
  const originZ = chunkZ * chunkSize;

  // Create deterministic RNG for this chunk
  const chunkSeed = hashCoordinates(worldSeed, chunkX, 0, chunkZ);
  const rng = mulberry32(chunkSeed);

  // LOD-based detail reduction
  if (lod >= 4) return instances;

  const lodMultiplier = lod === 0 ? 1.0 : lod === 1 ? 0.8 : lod === 2 ? 0.3 : 0.1;
  const minPriority = lod === 0 ? 0 : lod === 1 ? 20 : lod === 2 ? 70 : 90;

  // Spatial hash for collision detection
  const spatialHash = new CategorySpatialHash(2);

  // Sample terrain at chunk center to determine primary biome
  const centerSample = sampleTerrain(originX + chunkSize / 2, originZ + chunkSize / 2);
  const primaryBiome = centerSample.biomeType ?? BiomeType.Grassland;

  // Get biome vegetation config
  const biomeConfig = getBiomeVegetationConfig(primaryBiome);

  // Skip if biome has no vegetation
  if (biomeConfig.densityMultiplier === 0 || biomeConfig.categories.length === 0) {
    return instances;
  }

  // Get applicable category rules, filtered by priority
  const rules = getCategoryRulesForBiome(primaryBiome)
    .filter(rule => rule.priority >= minPriority);

  // Grid-based Poisson disk sampling
  const gridStep = 2;

  for (let gz = 0; gz < chunkSize; gz += gridStep) {
    for (let gx = 0; gx < chunkSize; gx += gridStep) {
      // World position with jitter
      const jitterX = (rng() - 0.5) * gridStep * 0.8;
      const jitterZ = (rng() - 0.5) * gridStep * 0.8;
      const localX = gx + jitterX;
      const localZ = gz + jitterZ;
      const worldX = originX + localX;
      const worldZ = originZ + localZ;

      // Check exclude zone
      if (excludeZone) {
        const dx = worldX - excludeZone.centerX;
        const dz = worldZ - excludeZone.centerZ;
        if (dx * dx + dz * dz < excludeZone.radius * excludeZone.radius) {
          continue;
        }
      }

      // Sample terrain at this position
      const terrain = sampleTerrain(worldX, worldZ);

      // Get local biome (use sampled biomeType or fall back to center biome)
      const localBiome = terrain.biomeType ?? primaryBiome;

      // Skip water biomes
      if (localBiome === BiomeType.Ocean) {
        continue;
      }

      // Skip underwater areas
      if (terrain.height < -10) {
        continue;
      }

      // Skip areas with water coverage
      if (terrain.waterMask !== undefined && terrain.waterMask > 0.3) {
        continue;
      }

      // Try each applicable category rule
      for (const rule of rules) {
        // Check height constraints
        if (terrain.height < rule.minHeight || terrain.height > rule.maxHeight) continue;

        // Check slope constraints
        if (terrain.slope < rule.minSlope || terrain.slope > rule.maxSlope) continue;

        // Get category-specific spacing
        const categorySpacing = getCategorySpacing(rule.category);

        // Calculate effective density
        const clusterNoise = getClusterNoise(worldSeed, worldX, worldZ, rule.clustering);
        const effectiveDensity = rule.density *
          rule.weight *
          biomeConfig.densityMultiplier *
          densityMultiplier *
          lodMultiplier *
          clusterNoise;

        // Random check against density
        if (rng() > effectiveDensity) continue;

        // Check spacing against already placed vegetation
        if (!spatialHash.isValid(localX, localZ, categorySpacing)) continue;

        // Get category-specific scale range
        const [minScale, maxScale] = getCategoryScaleRange(rule.category);
        const scale = minScale + rng() * (maxScale - minScale);
        const rotation = rng() * Math.PI * 2;

        // Create instance
        const instance: CategoryVegetationInstance = {
          category: rule.category,
          x: localX,
          y: terrain.height,
          z: localZ,
          scale,
          rotation,
          biome: localBiome,
        };

        instances.push(instance);

        // Register in spatial hash
        spatialHash.insert(instance);

        // Only one vegetation per grid cell
        break;
      }
    }
  }

  return instances;
}

/**
 * Convert BiomeType to legacy VegetationBiomeType for backward compatibility
 */
export function biomeTypeToLegacy(biome: BiomeType): VegetationBiomeType {
  switch (biome) {
    case BiomeType.Ocean:
      return "ocean";

    case BiomeType.Desert:
    case BiomeType.Beach:
    case BiomeType.RockyShore:
    case BiomeType.Savanna:
      return "desert";

    case BiomeType.TropicalForest:
    case BiomeType.TemperateForest:
    case BiomeType.Taiga:
    case BiomeType.Wetland:
      return "forest";

    case BiomeType.Mountain:
    case BiomeType.SnowyMountain:
    case BiomeType.AlpineMeadow:
      return "mountains";

    case BiomeType.Grassland:
    case BiomeType.Tundra:
    default:
      return "plains";
  }
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Legacy vegetation types used by the existing system
 */
export type LegacyVegetationType =
  | "tree1" | "tree2" | "tree3"
  | "rock1" | "rock2"
  | "bush1" | "bush2"
  | "grass";

/**
 * Convert new vegetation instances to legacy format
 * Used for backwards compatibility with existing rendering code
 */
export function toLegacyFormat(instances: VegetationInstance[]): {
  type: LegacyVegetationType;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
}[] {
  return instances
    .filter(inst => isLegacyType(inst.type))
    .map(inst => ({
      type: inst.type as LegacyVegetationType,
      x: inst.x,
      y: inst.y,
      z: inst.z,
      rotation: inst.rotation,
      scale: inst.scale,
    }));
}

function isLegacyType(type: VegetationType): type is LegacyVegetationType {
  return [
    "tree1", "tree2", "tree3",
    "rock1", "rock2",
    "bush1", "bush2",
    "grass"
  ].includes(type);
}
