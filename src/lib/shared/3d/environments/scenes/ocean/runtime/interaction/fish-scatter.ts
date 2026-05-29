import { Raycaster, Vector2, Vector3, type Camera } from 'three';

export interface CursorRayState {
  /** Cursor ray origin (camera position) in world space. */
  origin: Vector3;
  /** Normalized cursor ray direction in world space. */
  dir: Vector3;
  /** True while the cursor is over the canvas. */
  active: boolean;
  update(ndcX: number, ndcY: number, camera: Camera): void;
  clear(): void;
}

/**
 * Exposes the cursor's world-space ray for fish scatter. The boid shaders test
 * each fish's perpendicular distance to this ray, so scatter is depth-correct:
 * a fish under the cursor flees no matter how far it sits from the camera. This
 * replaced a plane-intersection origin, which only worked when the camera
 * looked steeply down and went dead at the near-level lab/viewer angles.
 */
export function createFishScatterState(): CursorRayState {
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const origin = new Vector3();
  const dir = new Vector3(0, 0, -1);

  const state: CursorRayState = {
    origin,
    dir,
    active: false,
    update(ndcX, ndcY, camera) {
      ndc.set(ndcX, ndcY);
      raycaster.setFromCamera(ndc, camera);
      origin.copy(raycaster.ray.origin);
      dir.copy(raycaster.ray.direction).normalize();
      state.active = true;
    },
    clear() {
      state.active = false;
    },
  };

  return state;
}
