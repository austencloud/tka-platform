/**
 * Model Registry Interface
 *
 * Manages loading and caching of vegetation GLB models.
 * Models are loaded from the manifest and organized by category.
 */

import type { BufferGeometry, Material } from "three";
import type { VegetationCategory, ManifestBiome } from "../../domain/vegetation-categories";

/**
 * Cached model data ready for instancing
 */
export interface CachedModel {
  /** Merged geometry from the GLB */
  geometry: BufferGeometry;
  /** Material(s) from the GLB */
  material: Material;
  /** Base scale to apply (from model metadata) */
  baseScale: number;
  /** Y offset to apply (for grounding) */
  yOffset: number;
}

/**
 * Model metadata from the manifest
 */
export interface ModelInfo {
  /** Model identifier (filename without extension) */
  id: string;
  /** Category this model belongs to */
  category: VegetationCategory;
  /** Biomes this model can appear in */
  biomes: ManifestBiome[];
  /** Full path to the GLB file */
  path: string;
}

/**
 * Model registry for vegetation models
 */
export interface IModelRegistry {
  /**
   * Initialize the registry by loading the manifest
   * Must be called before using other methods
   */
  initialize(): Promise<void>;

  /**
   * Check if the registry is initialized
   */
  isInitialized(): boolean;

  /**
   * Get all models in a category
   */
  getModelsInCategory(category: VegetationCategory): ModelInfo[];

  /**
   * Get models that match both category and biome
   */
  getModelsForBiome(category: VegetationCategory, biome: ManifestBiome): ModelInfo[];

  /**
   * Get a random model from a category using the provided RNG
   */
  getRandomModel(category: VegetationCategory, rng: () => number): ModelInfo | undefined;

  /**
   * Get a random model that matches both category and biome
   */
  getRandomModelForBiome(
    category: VegetationCategory,
    biome: ManifestBiome,
    rng: () => number
  ): ModelInfo | undefined;

  /**
   * Load and cache a model's geometry
   * Returns cached version if already loaded
   */
  loadModel(modelId: string): Promise<CachedModel | undefined>;

  /**
   * Preload all models in a category
   */
  preloadCategory(category: VegetationCategory): Promise<void>;

  /**
   * Get a cached model (returns undefined if not yet loaded)
   */
  getCachedModel(modelId: string): CachedModel | undefined;

  /**
   * Get total number of models registered
   */
  getTotalModelCount(): number;

  /**
   * Get count of models in a specific category
   */
  getCategoryCount(category: VegetationCategory): number;

  /**
   * Dispose all cached models and free memory
   */
  dispose(): void;
}
