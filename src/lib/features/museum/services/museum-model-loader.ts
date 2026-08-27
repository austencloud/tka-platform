/**
 * MuseumModelLoader
 *
 * Loads CC0 Kenney Furniture Kit GLB models for the museum 3D scene.
 * Uses Three.js GLTFLoader directly (not Threlte hooks) so it can be
 * called from imperative code, not just Svelte component init.
 *
 * Each unique path is loaded once and cached. Subsequent requests
 * return a deep clone so each placement gets independent transforms.
 */

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Box3, Color, Vector3, type Group, type Material, type Mesh } from "three";
import type { MuseumFurnitureRole } from "../domain/museum-grid-types";
import {
  getFurnitureObjectByRole,
  MUSEUM_FURNITURE_OBJECTS,
} from "../domain/placeable-object-registry";

export class MuseumModelLoader {
  private loader = new GLTFLoader();

  /** Resolved model templates - load once, clone many times. */
  private cache = new Map<string, Group>();

  /** In-flight loads - prevents duplicate fetches for the same path. */
  private pending = new Map<string, Promise<Group>>();


  async load(role: MuseumFurnitureRole, tintLift = 0): Promise<Group> {
    const def = getFurnitureObjectByRole(role);
    if (!def) {
      throw new Error(`No 3D furniture model is registered for role "${role}"`);
    }
    const model = await this.loadByPath(
      def.modelPath,
      def.scale,
      def.mountHeight
    );
    if (def.materialTint) {
      this.tintMaterials(model, def.materialTint, tintLift);
    }
    return model;
  }

  async loadByPath(
    path: string,
    scale = 1,
    yOffset = 0,
  ): Promise<Group> {
    const cacheKey = `${path}|${scale}|${yOffset}`;

    // Fast path: already cached.
    const cached = this.cache.get(cacheKey);
    if (cached) return cached.clone();

    // Deduplicate in-flight requests.
    let promise = this.pending.get(cacheKey);
    if (!promise) {
      promise = this.fetchAndPrepare(path, scale, yOffset);
      this.pending.set(cacheKey, promise);
    }

    const template = await promise;
    this.cache.set(cacheKey, template);
    this.pending.delete(cacheKey);

    return template.clone();
  }

  async preloadAll(): Promise<void> {
    const roles = MUSEUM_FURNITURE_OBJECTS.map((object) => object.furnitureRole);
    await Promise.all(roles.map((role) => this.load(role)));
  }

  dispose(): void {
    for (const group of this.cache.values()) {
      group.traverse((child) => {
        const mesh = child as { geometry?: { dispose(): void }; material?: { dispose(): void } | { dispose(): void }[] };
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      });
    }
    this.cache.clear();
    this.pending.clear();
  }

  // ── Internals ──

  private tintMaterials(group: Group, tint: string, tintLift: number): void {
    const normalizedLift = Math.max(0, Math.min(1, tintLift));
    const tintColor = new Color(tint);
    const readableTint = tintColor
      .clone()
      .multiplyScalar(1 + normalizedLift * 1.4);
    group.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const source = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      const tinted = source.map((material: Material) => {
        const clone = material.clone() as Material & {
          color?: Color;
          roughness?: number;
        };
        clone.color?.multiply(tintColor);
        // Unlit Kenney materials ignore scene lights, so lobby presentation can
        // recover their authored hue at a readable midtone.
        clone.color?.lerp(readableTint, normalizedLift);
        if (clone.roughness !== undefined) clone.roughness = 0.82;
        return clone;
      });
      mesh.material = Array.isArray(mesh.material) ? tinted : tinted[0]!;
    });
  }

  private async fetchAndPrepare(
    path: string,
    scale: number,
    yOffset: number,
  ): Promise<Group> {
    const gltf = await this.loader.loadAsync(path);
    const scene = gltf.scene;

    // Normalize each asset around its semantic placement point. Kenney GLBs use
    // inconsistent corner-based origins, which otherwise offsets the rendered
    // object from the authored tile and its collision footprint.
    scene.scale.setScalar(scale);
    scene.updateWorldMatrix(true, true);
    const bounds = new Box3().setFromObject(scene, true);
    const center = bounds.getCenter(new Vector3());
    scene.position.set(-center.x, yOffset - bounds.min.y, -center.z);
    scene.updateWorldMatrix(true, true);

    return scene;
  }
}
