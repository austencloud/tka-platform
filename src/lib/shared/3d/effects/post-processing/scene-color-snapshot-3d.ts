import type { ColorSpace, Texture, WebGLRenderer } from "three";

export const SCENE_COLOR_SNAPSHOT_SCALE_3D = 1 / 16;
export const SCENE_COLOR_SNAPSHOT_TTL_FRAMES_3D = 3;

export interface SceneColorSnapshot3D {
  texture: Texture;
  depthTexture: Texture | null;
  colorSpace: ColorSpace;
}

const snapshots = new WeakMap<WebGLRenderer, SceneColorSnapshot3D>();
const demandFrames = new WeakMap<WebGLRenderer, number>();

/**
 * Bubble film asks for the next resolved frame from inside its draw. A short
 * tail keeps refraction warm across the last pop without copying the scene
 * indefinitely after the effect disappears.
 */
export function requestSceneColorSnapshot3D(renderer: WebGLRenderer): void {
  demandFrames.set(renderer, SCENE_COLOR_SNAPSHOT_TTL_FRAMES_3D);
}

export function consumeSceneColorSnapshotDemand3D(
  renderer: WebGLRenderer
): boolean {
  const remainingFrames = demandFrames.get(renderer) ?? 0;
  if (remainingFrames <= 0) return false;
  if (remainingFrames === 1) demandFrames.delete(renderer);
  else demandFrames.set(renderer, remainingFrames - 1);
  return true;
}

/**
 * Publishes the compositor's low-resolution resolved scene color. Bubble film
 * reads the previous completed frame, avoiding feedback with the render target
 * currently being written and avoiding a full-resolution framebuffer copy.
 */
export function publishSceneColorSnapshot3D(
  renderer: WebGLRenderer,
  snapshot: SceneColorSnapshot3D
): void {
  snapshots.set(renderer, snapshot);
}

export function getSceneColorSnapshot3D(
  renderer: WebGLRenderer
): SceneColorSnapshot3D | null {
  return snapshots.get(renderer) ?? null;
}

export function clearSceneColorSnapshot3D(renderer: WebGLRenderer): void {
  snapshots.delete(renderer);
  demandFrames.delete(renderer);
}
