/**
 * Biome-Vegetation Rules Configuration
 *
 * Maps biomes to allowed vegetation categories with spawn weights and density.
 * This replaces the hardcoded VEGETATION_RULES with a category-based system.
 */

import type { VegetationCategory, ManifestBiome } from "../domain/vegetation-categories";
import { CATEGORY_SPACING, CATEGORY_SCALE_RANGES } from "../domain/vegetation-categories";
import { BiomeType } from "../../generation/biome-system";


/**
 * Configuration for a vegetation category within a biome
 */
export interface CategorySpawnRule {
  /** The vegetation category */
  category: VegetationCategory;
  /** Spawn weight relative to other categories (0-1) */
  weight: number;
  /** Base density (0-1). Higher = more common */
  density: number;
  /** Minimum slope (0 = flat, 1 = vertical) */
  minSlope: number;
  /** Maximum slope (0 = flat, 1 = vertical) */
  maxSlope: number;
  /** Minimum terrain height */
  minHeight: number;
  /** Maximum terrain height */
  maxHeight: number;
  /** Clustering factor (0 = even distribution, 1 = highly clustered) */
  clustering: number;
  /** Priority for placement (higher = placed first) */
  priority: number;
}

/**
 * Biome vegetation configuration
 */
export interface BiomeVegetationConfig {
  /** Overall vegetation density multiplier for this biome */
  densityMultiplier: number;
  /** Category rules for this biome */
  categories: CategorySpawnRule[];
}


/**
 * Vegetation rules mapped by BiomeType
 */
export const BIOME_VEGETATION_RULES: Record<BiomeType, BiomeVegetationConfig> = {
  [BiomeType.Ocean]: {
    densityMultiplier: 0,
    categories: [],
  },

  [BiomeType.Beach]: {
    densityMultiplier: 0.1,
    categories: [
      { category: "rock", weight: 0.5, density: 0.1, minSlope: 0, maxSlope: 0.3, minHeight: -8, maxHeight: 5, clustering: 0.4, priority: 70 },
      { category: "grass", weight: 0.3, density: 0.15, minSlope: 0, maxSlope: 0.2, minHeight: -5, maxHeight: 5, clustering: 0.5, priority: 20 },
      { category: "log", weight: 0.2, density: 0.02, minSlope: 0, maxSlope: 0.2, minHeight: -5, maxHeight: 3, clustering: 0.3, priority: 60 },
    ],
  },
  [BiomeType.RockyShore]: {
    densityMultiplier: 0.15,
    categories: [
      { category: "rock", weight: 0.9, density: 0.4, minSlope: 0, maxSlope: 0.8, minHeight: -10, maxHeight: 10, clustering: 0.6, priority: 70 },
      { category: "log", weight: 0.1, density: 0.02, minSlope: 0, maxSlope: 0.3, minHeight: -5, maxHeight: 5, clustering: 0.2, priority: 60 },
    ],
  },

  [BiomeType.Desert]: {
    densityMultiplier: 0.08,
    categories: [
      { category: "cactus", weight: 0.4, density: 0.15, minSlope: 0, maxSlope: 0.3, minHeight: -5, maxHeight: 30, clustering: 0.1, priority: 90 },
      { category: "rock", weight: 0.5, density: 0.25, minSlope: 0, maxSlope: 0.8, minHeight: -10, maxHeight: 50, clustering: 0.5, priority: 70 },
      { category: "palm", weight: 0.1, density: 0.02, minSlope: 0, maxSlope: 0.2, minHeight: -8, maxHeight: 10, clustering: 0.9, priority: 100 }, // Oasis
    ],
  },
  [BiomeType.Savanna]: {
    densityMultiplier: 0.25,
    categories: [
      { category: "tree", weight: 0.3, density: 0.15, minSlope: 0, maxSlope: 0.4, minHeight: -5, maxHeight: 30, clustering: 0.4, priority: 100 },
      { category: "grass", weight: 0.4, density: 0.5, minSlope: 0, maxSlope: 0.4, minHeight: -5, maxHeight: 30, clustering: 0.4, priority: 20 },
      { category: "rock", weight: 0.2, density: 0.15, minSlope: 0, maxSlope: 0.7, minHeight: -5, maxHeight: 40, clustering: 0.5, priority: 70 },
      { category: "bush", weight: 0.1, density: 0.1, minSlope: 0, maxSlope: 0.5, minHeight: -5, maxHeight: 30, clustering: 0.5, priority: 80 },
    ],
  },
  [BiomeType.TropicalForest]: {
    densityMultiplier: 0.9,
    categories: [
      { category: "tree", weight: 0.25, density: 0.6, minSlope: 0, maxSlope: 0.5, minHeight: -5, maxHeight: 35, clustering: 0.3, priority: 100 },
      { category: "palm", weight: 0.2, density: 0.4, minSlope: 0, maxSlope: 0.4, minHeight: -8, maxHeight: 25, clustering: 0.4, priority: 100 },
      { category: "bush", weight: 0.2, density: 0.5, minSlope: 0, maxSlope: 0.5, minHeight: -5, maxHeight: 30, clustering: 0.5, priority: 80 },
      { category: "flower", weight: 0.15, density: 0.3, minSlope: 0, maxSlope: 0.4, minHeight: -5, maxHeight: 25, clustering: 0.7, priority: 30 },
      { category: "mushroom", weight: 0.1, density: 0.2, minSlope: 0, maxSlope: 0.4, minHeight: -5, maxHeight: 20, clustering: 0.8, priority: 40 },
      { category: "log", weight: 0.1, density: 0.08, minSlope: 0, maxSlope: 0.3, minHeight: -5, maxHeight: 25, clustering: 0.3, priority: 60 },
    ],
  },

  [BiomeType.Grassland]: {
    densityMultiplier: 0.5,
    categories: [
      { category: "grass", weight: 0.5, density: 0.8, minSlope: 0, maxSlope: 0.5, minHeight: -5, maxHeight: 35, clustering: 0.4, priority: 20 },
      { category: "flower", weight: 0.25, density: 0.3, minSlope: 0, maxSlope: 0.4, minHeight: -5, maxHeight: 30, clustering: 0.7, priority: 30 },
      { category: "rock", weight: 0.15, density: 0.1, minSlope: 0, maxSlope: 0.6, minHeight: -5, maxHeight: 40, clustering: 0.5, priority: 70 },
      { category: "bush", weight: 0.1, density: 0.15, minSlope: 0, maxSlope: 0.5, minHeight: -5, maxHeight: 30, clustering: 0.4, priority: 80 },
    ],
  },
  [BiomeType.TemperateForest]: {
    densityMultiplier: 0.7,
    categories: [
      { category: "tree", weight: 0.35, density: 0.6, minSlope: 0, maxSlope: 0.4, minHeight: -5, maxHeight: 35, clustering: 0.3, priority: 100 },
      { category: "bush", weight: 0.2, density: 0.4, minSlope: 0, maxSlope: 0.5, minHeight: -5, maxHeight: 35, clustering: 0.4, priority: 80 },
      { category: "grass", weight: 0.15, density: 0.3, minSlope: 0, maxSlope: 0.4, minHeight: -5, maxHeight: 30, clustering: 0.5, priority: 20 },
      { category: "flower", weight: 0.1, density: 0.2, minSlope: 0, maxSlope: 0.4, minHeight: -5, maxHeight: 25, clustering: 0.7, priority: 30 },
      { category: "mushroom", weight: 0.1, density: 0.25, minSlope: 0, maxSlope: 0.4, minHeight: -5, maxHeight: 20, clustering: 0.9, priority: 40 },
      { category: "rock", weight: 0.05, density: 0.1, minSlope: 0, maxSlope: 0.7, minHeight: -5, maxHeight: 40, clustering: 0.4, priority: 70 },
      { category: "log", weight: 0.05, density: 0.08, minSlope: 0, maxSlope: 0.3, minHeight: -5, maxHeight: 30, clustering: 0.3, priority: 60 },
    ],
  },
  [BiomeType.Wetland]: {
    densityMultiplier: 0.6,
    categories: [
      { category: "grass", weight: 0.4, density: 0.7, minSlope: 0, maxSlope: 0.3, minHeight: -10, maxHeight: 15, clustering: 0.4, priority: 20 },
      { category: "flower", weight: 0.25, density: 0.3, minSlope: 0, maxSlope: 0.3, minHeight: -8, maxHeight: 15, clustering: 0.6, priority: 30 },
      { category: "bush", weight: 0.2, density: 0.3, minSlope: 0, maxSlope: 0.4, minHeight: -5, maxHeight: 15, clustering: 0.5, priority: 80 },
      { category: "mushroom", weight: 0.1, density: 0.3, minSlope: 0, maxSlope: 0.3, minHeight: -5, maxHeight: 10, clustering: 0.8, priority: 40 },
      { category: "log", weight: 0.05, density: 0.1, minSlope: 0, maxSlope: 0.2, minHeight: -8, maxHeight: 10, clustering: 0.4, priority: 60 },
    ],
  },

  [BiomeType.Taiga]: {
    densityMultiplier: 0.55,
    categories: [
      { category: "pine", weight: 0.45, density: 0.6, minSlope: 0, maxSlope: 0.5, minHeight: 10, maxHeight: 45, clustering: 0.2, priority: 100 },
      { category: "rock", weight: 0.25, density: 0.2, minSlope: 0, maxSlope: 0.8, minHeight: 5, maxHeight: 50, clustering: 0.5, priority: 70 },
      { category: "bush", weight: 0.15, density: 0.2, minSlope: 0, maxSlope: 0.5, minHeight: 5, maxHeight: 40, clustering: 0.4, priority: 80 },
      { category: "grass", weight: 0.1, density: 0.15, minSlope: 0, maxSlope: 0.4, minHeight: 5, maxHeight: 35, clustering: 0.4, priority: 20 },
      { category: "log", weight: 0.05, density: 0.05, minSlope: 0, maxSlope: 0.3, minHeight: 5, maxHeight: 40, clustering: 0.3, priority: 60 },
    ],
  },
  [BiomeType.Tundra]: {
    densityMultiplier: 0.15,
    categories: [
      { category: "rock", weight: 0.5, density: 0.25, minSlope: 0, maxSlope: 0.9, minHeight: 0, maxHeight: 50, clustering: 0.6, priority: 70 },
      { category: "grass", weight: 0.3, density: 0.15, minSlope: 0, maxSlope: 0.4, minHeight: 0, maxHeight: 40, clustering: 0.5, priority: 20 },
      { category: "bush", weight: 0.2, density: 0.08, minSlope: 0, maxSlope: 0.5, minHeight: 0, maxHeight: 35, clustering: 0.4, priority: 80 },
    ],
  },

  [BiomeType.Mountain]: {
    densityMultiplier: 0.2,
    categories: [
      { category: "rock", weight: 0.6, density: 0.4, minSlope: 0, maxSlope: 0.95, minHeight: 20, maxHeight: 60, clustering: 0.6, priority: 70 },
      { category: "pine", weight: 0.25, density: 0.15, minSlope: 0, maxSlope: 0.5, minHeight: 25, maxHeight: 45, clustering: 0.3, priority: 100 },
      { category: "grass", weight: 0.1, density: 0.1, minSlope: 0, maxSlope: 0.5, minHeight: 20, maxHeight: 40, clustering: 0.4, priority: 20 },
      { category: "flower", weight: 0.05, density: 0.05, minSlope: 0, maxSlope: 0.4, minHeight: 25, maxHeight: 40, clustering: 0.6, priority: 30 },
    ],
  },
  [BiomeType.SnowyMountain]: {
    densityMultiplier: 0.08,
    categories: [
      { category: "rock", weight: 0.9, density: 0.3, minSlope: 0, maxSlope: 0.95, minHeight: 35, maxHeight: 70, clustering: 0.7, priority: 70 },
      { category: "pine", weight: 0.1, density: 0.03, minSlope: 0, maxSlope: 0.4, minHeight: 35, maxHeight: 50, clustering: 0.5, priority: 100 },
    ],
  },
  [BiomeType.AlpineMeadow]: {
    densityMultiplier: 0.35,
    categories: [
      { category: "grass", weight: 0.4, density: 0.4, minSlope: 0, maxSlope: 0.5, minHeight: 30, maxHeight: 50, clustering: 0.4, priority: 20 },
      { category: "flower", weight: 0.3, density: 0.3, minSlope: 0, maxSlope: 0.4, minHeight: 30, maxHeight: 45, clustering: 0.6, priority: 30 },
      { category: "rock", weight: 0.25, density: 0.2, minSlope: 0, maxSlope: 0.8, minHeight: 30, maxHeight: 55, clustering: 0.5, priority: 70 },
      { category: "bush", weight: 0.05, density: 0.1, minSlope: 0, maxSlope: 0.5, minHeight: 30, maxHeight: 45, clustering: 0.4, priority: 80 },
    ],
  },
};


export function getBiomeVegetationConfig(biome: BiomeType): BiomeVegetationConfig {
  return BIOME_VEGETATION_RULES[biome];
}

/**
 * Get applicable category rules for a biome, sorted by priority (descending)
 */
export function getCategoryRulesForBiome(biome: BiomeType): CategorySpawnRule[] {
  const config = BIOME_VEGETATION_RULES[biome];
  return [...config.categories].sort((a, b) => b.priority - a.priority);
}

/**
 * Convert BiomeType to ManifestBiome for model lookup
 */
export function biomeTypeToManifestBiome(biome: BiomeType): ManifestBiome {
  switch (biome) {
    case BiomeType.Ocean:
      return "plains"; // Fallback, no vegetation anyway

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

export function getCategorySpacing(category: VegetationCategory): number {
  return CATEGORY_SPACING[category];
}

export function getCategoryScaleRange(category: VegetationCategory): [number, number] {
  return CATEGORY_SCALE_RANGES[category];
}
