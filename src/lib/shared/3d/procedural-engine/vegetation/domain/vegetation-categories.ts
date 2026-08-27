/**
 * Vegetation Category Types
 *
 * Defines the category-based model system for vegetation.
 * Categories map to the 12 model folders in static/models/vegetation/
 */


/**
 * All vegetation model categories from the manifest
 * These correspond to subdirectories in static/models/vegetation/
 */
export type VegetationCategory =
  | "tree"      // Deciduous trees (33 models)
  | "pine"      // Coniferous trees (26 models)
  | "palm"      // Palm trees (6 models)
  | "rock"      // Rocks and cliffs (131 models)
  | "bush"      // Bushes (6 models)
  | "grass"     // Grass tufts (8 models)
  | "flower"    // Flowers (9 models)
  | "mushroom"  // Mushrooms (6 models)
  | "log"       // Logs and stumps (11 models)
  | "cactus"    // Cacti (2 models)
  | "misc";     // Bridges, fences, crops, tents, etc. (91 models)

/**
 * All categories as a const array for iteration
 */
export const ALL_CATEGORIES: VegetationCategory[] = [
  "tree", "pine", "palm", "rock", "bush", "grass",
  "flower", "mushroom", "log", "cactus", "misc"
];

/**
 * Categories that should be rendered as auto-scattered vegetation
 * (vs. misc items that are more for world-building / placement)
 */
export const SCATTER_CATEGORIES: VegetationCategory[] = [
  "tree", "pine", "palm", "rock", "bush", "grass",
  "flower", "mushroom", "log", "cactus"
];

/**
 * Biome types used in the manifest
 */
export type ManifestBiome = "plains" | "forest" | "mountains" | "desert";


/**
 * Single model entry from manifest.json
 */
export interface ManifestModel {
  /** Model name (filename without extension) */
  name: string;
  /** Category folder */
  category: VegetationCategory;
  /** Biomes this model can appear in */
  biomes: ManifestBiome[];
  /** Relative path within /models/vegetation/ */
  path: string;
}

/**
 * The full manifest.json structure
 */
export interface VegetationManifest {
  generatedAt: string;
  totalModels: number;
  models: ManifestModel[];
}


/**
 * Default scale ranges by category
 * [minScale, maxScale]
 */
export const CATEGORY_SCALE_RANGES: Record<VegetationCategory, [number, number]> = {
  tree: [0.8, 1.3],      // Varied tree sizes
  pine: [0.6, 1.1],      // Pines are generally uniform
  palm: [0.8, 1.2],      // Palm size variety
  rock: [0.4, 2.0],      // Rocks vary a lot
  bush: [0.5, 0.9],      // Bushes are small
  grass: [0.3, 0.7],     // Grass tufts
  flower: [0.3, 0.6],    // Flowers are small
  mushroom: [0.3, 0.6],  // Mushrooms are small
  log: [0.6, 1.0],       // Logs have some variety
  cactus: [0.6, 1.2],    // Cacti vary
  misc: [1.0, 1.0],      // Misc items use natural scale
};

/**
 * Default minimum spacing by category (in world units)
 */
export const CATEGORY_SPACING: Record<VegetationCategory, number> = {
  tree: 4,       // Trees need space
  pine: 3,       // Pines can be denser
  palm: 8,       // Palms are sparse
  rock: 2,       // Rocks can cluster
  bush: 2,       // Bushes fill gaps
  grass: 0.5,    // Grass is dense
  flower: 1,     // Flowers cluster
  mushroom: 1.5, // Mushrooms cluster
  log: 6,        // Logs are rare
  cactus: 5,     // Cacti are spread out
  misc: 10,      // Misc items are sparse
};

/**
 * Y offset applied to models (for grounding)
 */
export const CATEGORY_Y_OFFSET: Record<VegetationCategory, number> = {
  tree: 0,
  pine: 0,
  palm: 0,
  rock: -0.1,    // Rocks sink into ground slightly
  bush: 0,
  grass: 0,
  flower: 0,
  mushroom: 0,
  log: -0.1,     // Logs sink in
  cactus: 0,
  misc: 0,
};


export function getCategorySpacing(category: VegetationCategory): number {
  return CATEGORY_SPACING[category];
}

export function getCategoryScaleRange(category: VegetationCategory): [number, number] {
  return CATEGORY_SCALE_RANGES[category];
}


/**
 * Check if a string is a valid VegetationCategory
 */
export function isVegetationCategory(value: string): value is VegetationCategory {
  return ALL_CATEGORIES.includes(value as VegetationCategory);
}

/**
 * Check if a string is a valid ManifestBiome
 */
export function isManifestBiome(value: string): value is ManifestBiome {
  return ["plains", "forest", "mountains", "desert"].includes(value);
}
