import type { ThrelteContext } from "@threlte/core";
import type { Camera, Object3D, WebGLRenderer } from "three";

/**
 * Threlte returns `camera` wrapped in a CurrentWritable (read `.current`) while
 * `scene` and `renderer` come back as plain objects — and the repo's local type
 * augmentation still describes the older wrapped shape for all three. Unwrap
 * defensively so a version bump in either direction cannot silently hand the
 * warmup an undefined renderer and skip compilation without anyone noticing.
 *
 * The museum keeps its own copy at
 * `features/museum/components/resolve-threlte-scene.ts`; it is out of scope for
 * this module and consumes nothing from here.
 */
type MaybeCurrent<T> = T | { current: T };

function unwrap<T>(value: MaybeCurrent<T> | undefined): T | null {
  if (value == null) return null;
  if (typeof value === "object" && "current" in (value as object)) {
    return (value as { current: T }).current ?? null;
  }
  return value as T;
}

export interface ThrelteHandles {
  renderer: WebGLRenderer;
  scene: Object3D;
  camera: Camera;
}

export function resolveThrelteHandles(
  ctx: ThrelteContext | null | undefined
): ThrelteHandles | null {
  if (!ctx) return null;
  const renderer = unwrap<WebGLRenderer>(
    ctx.renderer as MaybeCurrent<WebGLRenderer>
  );
  const scene = unwrap<Object3D>(ctx.scene as unknown as MaybeCurrent<Object3D>);
  const camera = unwrap<Camera>(ctx.camera as unknown as MaybeCurrent<Camera>);
  if (!renderer?.domElement || !scene || !camera?.isCamera) return null;
  return { renderer, scene, camera };
}
