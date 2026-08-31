import type { Camera, Object3D, Scene, WebGLRenderer } from "three";

export interface WarmupHandles {
  renderer: WebGLRenderer;
  scene: Object3D;
  camera: Camera;
}

export interface WarmupOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Links every shader program the scene needs while the loading curtain is still
 * opaque. Without this the first frames after the reveal pay program linking on
 * the main thread, which is exactly the hitch the viewer looks like it has.
 *
 * Only SceneShaderWarmup calls this — one owner for pre-reveal GPU warmup.
 */
export async function warmupRenderer(
  handles: WarmupHandles,
  opts: WarmupOptions = {}
): Promise<void> {
  const { renderer, scene, camera } = handles;
  const { onProgress, signal } = opts;

  if (typeof renderer?.compileAsync !== "function") {
    // Older drivers/renderers without async compile fall through to the
    // caller's paint-settle frames, which warm the same paths more slowly.
    onProgress?.(1);
    return;
  }

  if (signal?.aborted) return;

  // Three skips descendants of an invisible group during compilation. Expose
  // the complete mounted scene just for one batched traversal, then restore
  // every live flag. One compile call lets Three deduplicate shader programs;
  // compiling hundreds of effect meshes separately made warmup itself slow.
  const hiddenObjects: Object3D[] = [];
  scene.traverse((object) => {
    if (!object.visible) {
      hiddenObjects.push(object);
      object.visible = true;
    }
  });

  try {
    await renderer.compileAsync(scene, camera, scene as Scene);
  } catch (error) {
    // A failed compile must never hold the curtain — the scene simply pays its
    // link cost on first render, as it did before this warmup existed.
    console.warn("[scene-boot] shader warmup failed:", error);
  } finally {
    for (const object of hiddenObjects) object.visible = false;
  }
  onProgress?.(1);
}
