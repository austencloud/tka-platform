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
import type { Group } from "three";
import type { MuseumModelDefinition, MuseumModelRole } from "./types";

// ── Role-to-model mapping ──
// These are the 5 proof-of-concept models chosen from the 140-model
// Kenney Furniture Kit (CC0). Scale and yOffset are tuned for the
// museum's world space where 1 unit = 1 meter.
//
// Kenney models use 1 unit ≈ 1 meter natively. The museum world also
// uses 1 unit = 1 meter (TILE_SIZE = 0.5 means each tile is 0.5m).
// So scale ≈ 1.0 gives correct real-world proportions against 4.5m
// walls and 1.6m eye height.

const MODEL_BASE = "/assets/museum/models/furniture";

// Scale factors computed from actual GLB bounding box measurements:
// bench.glb native: 0.40 x 0.47 x 0.20m → target ~0.5m tall = scale 1.1
// tableCoffee.glb native: 0.66 x 0.23 x 0.40m → target ~0.7m tall = scale 3.0
// bookcaseClosedWide.glb native: 0.80 x 0.79 x 0.25m → target ~1.8m tall = scale 2.3
// lampRoundFloor.glb native: 0.15 x 0.86 x 0.18m → target ~1.6m tall = scale 1.9
// pottedPlant.glb native: 0.21 x 0.54 x 0.24m → target ~0.8m tall = scale 1.5

const ROLE_DEFINITIONS: Record<MuseumModelRole, MuseumModelDefinition> = {
  bench: {
    // Native 0.47m tall → 2.5x = 1.18m (seat height, correct for bench)
    path: `${MODEL_BASE}/bench.glb`,
    scale: 2.5,
    yOffset: 0,
  },
  pedestal: {
    // Native 0.23m tall → 3.5x = 0.8m (waist-height display surface)
    path: `${MODEL_BASE}/tableCoffee.glb`,
    scale: 3.5,
    yOffset: 0,
  },
  bookshelf: {
    // Native 0.79m tall → 2.5x = 1.98m (head-height bookshelf)
    path: `${MODEL_BASE}/bookcaseClosedWide.glb`,
    scale: 2.5,
    yOffset: 0,
  },
  lamp: {
    // Native 0.86m tall → 2.0x = 1.72m (standing lamp)
    path: `${MODEL_BASE}/lampRoundFloor.glb`,
    scale: 2.0,
    yOffset: 0,
  },
  plant: {
    // Native 0.54m tall → 2.0x = 1.08m (potted plant)
    path: `${MODEL_BASE}/pottedPlant.glb`,
    scale: 2.0,
    yOffset: 0,
  },
};

export class MuseumModelLoader {
  private loader = new GLTFLoader();

  /** Resolved model templates - load once, clone many times. */
  private cache = new Map<string, Group>();

  /** In-flight loads - prevents duplicate fetches for the same path. */
  private pending = new Map<string, Promise<Group>>();

  // ── Public API ──

  async load(role: MuseumModelRole): Promise<Group> {
    const def = ROLE_DEFINITIONS[role];
    return this.loadByPath(def.path, def.scale, def.yOffset);
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
    const roles = Object.keys(ROLE_DEFINITIONS) as MuseumModelRole[];
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

  private async fetchAndPrepare(
    path: string,
    scale: number,
    yOffset: number,
  ): Promise<Group> {
    const gltf = await this.loader.loadAsync(path);
    const scene = gltf.scene;

    // Apply scale and vertical offset to the root group so
    // callers only need to set position.x / position.z.
    scene.scale.setScalar(scale);
    scene.position.y = yOffset;

    return scene;
  }
}
