import type { Color, Object3D, Vector3 } from "three";
import { PointLight } from "three";
import type { QualityTierConfig } from "../types";

export interface LightHandle {
  id: number;
}

/**
 * Pooled point-light manager that effects can request lights from.
 * The pool is capped by quality tier so low-end GPUs never exceed
 * the shader-uniform limit that causes a performance cliff.
 *
 * Scene-scoped: instantiate one per 3D scene, not as a DI singleton.
 */
export class DynamicLightManager {
  private parent: Object3D;
  private maxLights: number;
  private pool: PointLight[] = [];
  private claimedLights = new Set<PointLight>();
  private activeHandles = new Map<number, PointLight>();
  private nextId = 0;

  constructor(parent: Object3D, tierConfig: QualityTierConfig) {
    this.parent = parent;
    this.maxLights = tierConfig.maxDynamicLights;

    // Pre-allocate the full pool so no runtime allocations happen
    for (let i = 0; i < this.maxLights; i++) {
      const light = new PointLight(0xffffff, 0, 10);
      // Point-light visibility participates in Three's program signature.
      // Keep the full bounded pool present from scene startup and make an idle
      // slot inert with zero intensity, so the first effect selection never
      // asks every lit material in the scene to compile a new shader variant.
      light.visible = true;
      this.parent.add(light);
      this.pool.push(light);
    }
  }

  requestLight(
    position: Vector3,
    color: Color,
    intensity: number,
    range: number
  ): LightHandle | null {
    if (this.maxLights === 0) return null;

    const light = this.pool.find(
      (candidate) => !this.claimedLights.has(candidate)
    );
    if (!light) return null; // Pool exhausted

    light.position.copy(position);
    light.color.copy(color);
    light.intensity = intensity;
    light.distance = range;
    this.claimedLights.add(light);

    const id = this.nextId++;
    this.activeHandles.set(id, light);
    return { id };
  }

  updateLight(
    handle: LightHandle,
    position: Vector3,
    intensity: number,
    color?: Color,
    range?: number
  ): void {
    const light = this.activeHandles.get(handle.id);
    if (!light) return;

    light.position.copy(position);
    light.intensity = intensity;
    if (color) light.color.copy(color);
    if (range !== undefined) light.distance = range;
  }

  releaseLight(handle: LightHandle): void {
    const light = this.activeHandles.get(handle.id);
    if (!light) return;

    light.intensity = 0;
    light.visible = true;
    this.claimedLights.delete(light);
    this.activeHandles.delete(handle.id);
  }

  releaseAll(): void {
    for (const light of this.activeHandles.values()) {
      light.intensity = 0;
      light.visible = true;
    }
    this.claimedLights.clear();
    this.activeHandles.clear();
  }

  get activeCount(): number {
    return this.activeHandles.size;
  }

  get capacity(): number {
    return this.maxLights;
  }

  dispose(): void {
    for (const light of this.pool) {
      this.parent.remove(light);
      light.dispose();
    }
    this.pool = [];
    this.claimedLights.clear();
    this.activeHandles.clear();
  }
}
