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

interface RenderableObject extends Object3D {
  material?: unknown;
}

function collectCompileTargets(root: Object3D): Object3D[] {
  const targets: Object3D[] = [];
  root.traverse((object) => {
    const material = (object as RenderableObject).material;
    if (material) targets.push(object);
  });
  return targets;
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

  const targets = collectCompileTargets(scene);
  let warned = false;

  const compile = async (object: Object3D): Promise<void> => {
    const wasVisible = object.visible;
    try {
      // Inactive effects keep their preallocated mesh hidden. Compile each
      // material target as a temporary root so visibility cannot exclude its
      // shader from the pre-reveal pass; restore the live state immediately.
      object.visible = true;
      await renderer.compileAsync(object, camera, scene as Scene);
    } catch (error) {
      // A failed compile must never hold the curtain — the object simply pays
      // its link cost on first render, as it did before this warmup existed.
      if (!warned) {
        warned = true;
        console.warn("[scene-boot] shader warmup failed:", error);
      }
    } finally {
      object.visible = wasVisible;
    }
  };

  if (targets.length === 0) {
    await compile(scene);
    onProgress?.(1);
    return;
  }

  for (let index = 0; index < targets.length; index += 1) {
    if (signal?.aborted) return;
    await compile(targets[index]!);
    onProgress?.((index + 1) / targets.length);
  }
}
