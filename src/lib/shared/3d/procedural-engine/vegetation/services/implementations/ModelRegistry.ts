/**
 * Model Registry Implementation
 *
 * Loads the vegetation manifest and provides access to 329 CC0 models.
 * Models are organized by category and filtered by biome at runtime.
 */

import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  BufferGeometry,
  Mesh,
  MeshStandardMaterial,
  type Material,
} from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface CachedModel {
  geometry: BufferGeometry;
  material: Material;
  baseScale: number;
  yOffset: number;
}

export interface ModelInfo {
  id: string;
  category: VegetationCategory;
  biomes: ManifestBiome[];
  path: string;
}
import type {
  VegetationCategory,
  ManifestBiome,
  VegetationManifest,
} from "../../domain/vegetation-categories";
import {
  CATEGORY_SCALE_RANGES,
  CATEGORY_Y_OFFSET,
  isVegetationCategory,
} from "../../domain/vegetation-categories";

// ============================================================================
// CONSTANTS
// ============================================================================

const MANIFEST_PATH = "/models/vegetation/manifest.json";
const MODEL_BASE_PATH = "/models/vegetation/";

// ============================================================================
// MODEL REGISTRY
// ============================================================================

export class ModelRegistry {
  private loader: GLTFLoader;
  private manifest: VegetationManifest | null = null;
  private modelsByCategory: Map<VegetationCategory, ModelInfo[]> = new Map();
  private modelCache: Map<string, CachedModel> = new Map();
  private loadingPromises: Map<string, Promise<CachedModel | undefined>> = new Map();
  private initialized = false;

  constructor() {
    this.loader = new GLTFLoader();
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const response = await fetch(MANIFEST_PATH);
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.status}`);
      }
      this.manifest = await response.json();

      // Index models by category
      this.indexModels();
      this.initialized = true;
    } catch (error) {
      console.error("[ModelRegistry] Failed to initialize:", error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private indexModels(): void {
    if (!this.manifest) return;

    // Clear existing index
    this.modelsByCategory.clear();

    for (const model of this.manifest.models) {
      // Validate category
      if (!isVegetationCategory(model.category)) {
        console.warn(`[ModelRegistry] Unknown category: ${model.category}`);
        continue;
      }

      const info: ModelInfo = {
        id: model.name,
        category: model.category,
        biomes: model.biomes as ManifestBiome[],
        path: MODEL_BASE_PATH + model.path,
      };

      const existing = this.modelsByCategory.get(model.category);
      if (existing) {
        existing.push(info);
      } else {
        this.modelsByCategory.set(model.category, [info]);
      }
    }
  }

  // ==========================================================================
  // MODEL LOOKUP
  // ==========================================================================

  getModelsInCategory(category: VegetationCategory): ModelInfo[] {
    return this.modelsByCategory.get(category) ?? [];
  }

  getModelsForBiome(category: VegetationCategory, biome: ManifestBiome): ModelInfo[] {
    const categoryModels = this.modelsByCategory.get(category) ?? [];
    return categoryModels.filter(m => m.biomes.includes(biome));
  }

  getRandomModel(category: VegetationCategory, rng: () => number): ModelInfo | undefined {
    const models = this.getModelsInCategory(category);
    if (models.length === 0) return undefined;
    return models[Math.floor(rng() * models.length)];
  }

  getRandomModelForBiome(
    category: VegetationCategory,
    biome: ManifestBiome,
    rng: () => number
  ): ModelInfo | undefined {
    const models = this.getModelsForBiome(category, biome);
    if (models.length === 0) {
      // Fallback to any model in category if none match biome
      return this.getRandomModel(category, rng);
    }
    return models[Math.floor(rng() * models.length)];
  }

  // ==========================================================================
  // MODEL LOADING
  // ==========================================================================

  async loadModel(modelId: string): Promise<CachedModel | undefined> {
    // Return cached if available
    const cached = this.modelCache.get(modelId);
    if (cached) return cached;

    // Return existing promise if loading
    const existing = this.loadingPromises.get(modelId);
    if (existing) return existing;

    // Find model info
    const info = this.findModelById(modelId);
    if (!info) {
      console.warn(`[ModelRegistry] Model not found: ${modelId}`);
      return undefined;
    }

    // Start loading
    const loadPromise = this.loadGLB(info);
    this.loadingPromises.set(modelId, loadPromise);

    try {
      const result = await loadPromise;
      if (result) {
        this.modelCache.set(modelId, result);
      }
      return result;
    } finally {
      this.loadingPromises.delete(modelId);
    }
  }

  async preloadCategory(category: VegetationCategory): Promise<void> {
    const models = this.getModelsInCategory(category);
    const promises = models.map(m => this.loadModel(m.id));
    await Promise.all(promises);
  }

  getCachedModel(modelId: string): CachedModel | undefined {
    return this.modelCache.get(modelId);
  }

  private findModelById(modelId: string): ModelInfo | undefined {
    for (const models of this.modelsByCategory.values()) {
      const found = models.find(m => m.id === modelId);
      if (found) return found;
    }
    return undefined;
  }

  private async loadGLB(info: ModelInfo): Promise<CachedModel | undefined> {
    return new Promise((resolve, _reject) => {
      this.loader.load(
        info.path,
        (gltf: GLTF) => {
          try {
            const model = this.extractModel(gltf, info);
            resolve(model);
          } catch (error) {
            console.error(`[ModelRegistry] Failed to extract model ${info.id}:`, error);
            resolve(undefined);
          }
        },
        undefined,
        (error) => {
          console.error(`[ModelRegistry] Failed to load ${info.path}:`, error);
          resolve(undefined); // Don't reject - just return undefined
        }
      );
    });
  }

  private extractModel(gltf: GLTF, info: ModelInfo): CachedModel {
    const geometries: BufferGeometry[] = [];
    let material: Material = new MeshStandardMaterial({
      color: 0x808080,
      flatShading: true,
    });

    // Get category-specific settings
    const [minScale, maxScale] = CATEGORY_SCALE_RANGES[info.category];
    const baseScale = (minScale + maxScale) / 2; // Use midpoint as base
    const yOffset = CATEGORY_Y_OFFSET[info.category];

    gltf.scene.traverse((child) => {
      if (child instanceof Mesh) {
        const geom = child.geometry.clone();

        // Don't apply scale here - let instancing handle it
        geometries.push(geom);

        // Use the first material we find
        if (child.material) {
          const meshMaterial = Array.isArray(child.material)
            ? child.material[0]
            : child.material;
          if (meshMaterial) {
            material = meshMaterial.clone();
          }
        }
      }
    });

    // Merge all geometries
    let geometry: BufferGeometry;
    if (geometries.length > 1) {
      const merged = BufferGeometryUtils.mergeGeometries(geometries);
      geometry = merged ?? geometries[0]!;
    } else if (geometries.length === 1) {
      geometry = geometries[0]!;
    } else {
      // Fallback - empty geometry (shouldn't happen)
      geometry = new BufferGeometry();
    }

    return {
      geometry,
      material,
      baseScale,
      yOffset,
    };
  }

  // ==========================================================================
  // STATS
  // ==========================================================================

  getTotalModelCount(): number {
    return this.manifest?.totalModels ?? 0;
  }

  getCategoryCount(category: VegetationCategory): number {
    return this.modelsByCategory.get(category)?.length ?? 0;
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  dispose(): void {
    for (const model of this.modelCache.values()) {
      model.geometry.dispose();
      if (model.material instanceof MeshStandardMaterial) {
        model.material.dispose();
      }
    }
    this.modelCache.clear();
    this.modelsByCategory.clear();
    this.manifest = null;
    this.initialized = false;
  }
}
