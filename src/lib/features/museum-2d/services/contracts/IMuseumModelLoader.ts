/**
 * IMuseumModelLoader
 *
 * Loads and caches GLTF/GLB models for the museum 3D scene.
 * Each model is loaded once, cloned on subsequent requests.
 */

import type { Group } from "three";

/** Metadata for a museum furniture model. */
export interface MuseumModelDefinition {
  /** Asset path relative to the static root, e.g. "/assets/museum/models/furniture/bench.glb" */
  path: string;
  /** Uniform scale factor applied to the loaded model. */
  scale: number;
  /** Vertical offset so the model sits on the floor correctly. */
  yOffset: number;
}

/** Maps semantic roles to specific model files and transforms. */
export type MuseumModelRole =
  | "bench"
  | "pedestal"
  | "bookshelf"
  | "lamp"
  | "plant";

export interface IMuseumModelLoader {
  /**
   * Load a model by its semantic role. Returns a cloned Group
   * ready to be inserted into the scene.
   */
  load(role: MuseumModelRole): Promise<Group>;

  /**
   * Load a model from an arbitrary path (for one-offs or custom placements).
   */
  loadByPath(path: string, scale?: number, yOffset?: number): Promise<Group>;

  /** Preload all role-mapped models so first placement is instant. */
  preloadAll(): Promise<void>;

  /** Dispose all cached geometry and materials. */
  dispose(): void;
}
