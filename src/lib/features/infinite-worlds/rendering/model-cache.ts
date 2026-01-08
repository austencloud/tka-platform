/**
 * GLTF Model Cache
 *
 * Loads and caches GLTF/GLB models for instanced rendering.
 * Models are loaded once and their geometries extracted for use with InstancedMesh.
 */

import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  BufferGeometry,
  Mesh,
  MeshStandardMaterial,
  type Material,
  Group,
} from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ============================================================================
// TYPES
// ============================================================================

export interface CachedModel {
  geometry: BufferGeometry;
  material: Material;
}

export interface ModelDefinition {
  path: string;
  scale?: number;
  yOffset?: number;
}

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

export const FOREST_MODELS: Record<string, ModelDefinition> = {
  tree1: { path: "/models/forest/Tree_1_A_Color1.gltf", scale: 2.5, yOffset: 0 },
  tree2: { path: "/models/forest/Tree_2_A_Color1.gltf", scale: 2.5, yOffset: 0 },
  tree3: { path: "/models/forest/Tree_3_A_Color1.gltf", scale: 2.5, yOffset: 0 },
  rock1: { path: "/models/forest/Rock_1_A_Color1.gltf", scale: 1.5, yOffset: 0 },
  rock2: { path: "/models/forest/Rock_1_B_Color1.gltf", scale: 1.5, yOffset: 0 },
  bush1: { path: "/models/forest/Bush_1_A_Color1.gltf", scale: 1.2, yOffset: 0 },
  bush2: { path: "/models/forest/Bush_2_A_Color1.gltf", scale: 1.2, yOffset: 0 },
};

// ============================================================================
// MODEL CACHE
// ============================================================================

export class ModelCache {
  private loader: GLTFLoader;
  private cache: Map<string, CachedModel> = new Map();
  private loading: Map<string, Promise<CachedModel>> = new Map();

  constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * Preload all forest models
   */
  async preloadForestModels(): Promise<void> {
    const promises = Object.entries(FOREST_MODELS).map(([key, def]) =>
      this.loadModel(key, def)
    );
    await Promise.all(promises);
    console.log("[ModelCache] Forest models preloaded");
  }

  /**
   * Load a model and cache its geometry
   */
  async loadModel(key: string, definition: ModelDefinition): Promise<CachedModel> {
    // Return cached if available
    const cached = this.cache.get(key);
    if (cached) return cached;

    // Return pending load if in progress
    const pending = this.loading.get(key);
    if (pending) return pending;

    // Start loading
    const loadPromise = this.loadGLTF(definition);
    this.loading.set(key, loadPromise);

    try {
      const model = await loadPromise;
      this.cache.set(key, model);
      this.loading.delete(key);
      return model;
    } catch (error) {
      this.loading.delete(key);
      console.error(`[ModelCache] Failed to load ${key}:`, error);
      throw error;
    }
  }

  /**
   * Load GLTF and extract merged geometry
   */
  private async loadGLTF(definition: ModelDefinition): Promise<CachedModel> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        definition.path,
        (gltf: GLTF) => {
          const model = this.extractModel(gltf, definition);
          resolve(model);
        },
        undefined,
        (error) => reject(error)
      );
    });
  }

  /**
   * Extract geometry and material from GLTF scene
   */
  private extractModel(gltf: GLTF, definition: ModelDefinition): CachedModel {
    const geometries: BufferGeometry[] = [];
    let material: Material = new MeshStandardMaterial({
      color: 0x4a7c3f,
      flatShading: true,
    });

    const scale = definition.scale ?? 1;
    const yOffset = definition.yOffset ?? 0;

    gltf.scene.traverse((child) => {
      if (child instanceof Mesh) {
        const geom = child.geometry.clone();

        // Apply scale and offset
        geom.scale(scale, scale, scale);
        geom.translate(0, yOffset * scale, 0);

        // Apply any transforms from the mesh
        if (child.matrixWorld) {
          child.updateWorldMatrix(true, false);
          // Don't apply world matrix since we handle transforms via instancing
        }

        geometries.push(geom);

        // Use the first material we find
        if (child.material && !(material instanceof MeshStandardMaterial && material.color.getHex() !== 0x4a7c3f)) {
          material = Array.isArray(child.material) ? child.material[0]! : child.material;
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
      // Fallback - empty geometry
      geometry = new BufferGeometry();
    }

    return { geometry, material };
  }

  /**
   * Get a cached model
   */
  getModel(key: string): CachedModel | undefined {
    return this.cache.get(key);
  }

  /**
   * Get a random tree model key
   */
  getRandomTreeKey(rng: () => number): string {
    const treeKeys = ["tree1", "tree2", "tree3"];
    return treeKeys[Math.floor(rng() * treeKeys.length)]!;
  }

  /**
   * Get a random rock model key
   */
  getRandomRockKey(rng: () => number): string {
    const rockKeys = ["rock1", "rock2"];
    return rockKeys[Math.floor(rng() * rockKeys.length)]!;
  }

  /**
   * Get a random bush model key
   */
  getRandomBushKey(rng: () => number): string {
    const bushKeys = ["bush1", "bush2"];
    return bushKeys[Math.floor(rng() * bushKeys.length)]!;
  }

  /**
   * Dispose all cached models
   */
  dispose(): void {
    for (const model of this.cache.values()) {
      model.geometry.dispose();
      if (model.material instanceof MeshStandardMaterial) {
        model.material.dispose();
      }
    }
    this.cache.clear();
  }
}
