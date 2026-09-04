import type { Camera, Object3D, Scene, WebGLRenderer } from "three";
import { collectUniqueCompileTargets } from "../../scene-boot/renderer-program-targets";
import type { WorkerRendererProgramMetric } from "../domain/worker-renderer-protocol";

export interface WorkerRendererWarmupHandles {
  renderer: Pick<WebGLRenderer, "compileAsync" | "render">;
  scene: Object3D;
  camera: Camera;
}

export interface WorkerRendererWarmupOptions {
  onProgress?: (fraction: number) => void;
  yieldBetween?: () => Promise<void>;
  shouldStop?: () => boolean;
}

/**
 * Prepares one program at a time and gives the visible renderer a frame between
 * programs. A second WebGL context can otherwise submit the whole replacement
 * scene as one driver burst and visibly pause the scene the user is still
 * watching, even though both renderers live in workers.
 */
export async function warmWorkerRenderer(
  handles: WorkerRendererWarmupHandles,
  options: WorkerRendererWarmupOptions = {}
): Promise<readonly WorkerRendererProgramMetric[]> {
  const { renderer, scene, camera } = handles;
  const targets = collectUniqueCompileTargets(scene);
  if (targets.length === 0) targets.push(scene);
  const metrics: WorkerRendererProgramMetric[] = [];

  for (let index = 0; index < targets.length; index += 1) {
    if (options.shouldStop?.()) break;
    const target = targets[index]!;
    const material = (
      target as Object3D & {
        material?: { type?: string } | Array<{ type?: string }>;
      }
    ).material;
    const materialLabel = Array.isArray(material)
      ? material.map((value) => value.type ?? "Material").join("+")
      : material?.type;
    const startedAt = performance.now();
    const wasVisible = target.visible;
    target.visible = true;
    try {
      await renderer.compileAsync(target, camera, scene as Scene);
    } finally {
      target.visible = wasVisible;
    }
    metrics.push({
      label: target.name || materialLabel || target.type,
      durationMs: performance.now() - startedAt,
    });
    options.onProgress?.((index + 1) / targets.length);
    if (index + 1 < targets.length) await options.yieldBetween?.();
  }

  return metrics;
}

/**
 * Forces first-use geometry and texture uploads in small, separately scheduled
 * draws. The canvas is still hidden, so users see the old complete scene while
 * the replacement pays these costs instead of one large first-frame burst.
 */
export async function primeWorkerRenderer(
  handles: WorkerRendererWarmupHandles,
  options: WorkerRendererWarmupOptions = {}
): Promise<number> {
  const { renderer, scene, camera } = handles;
  const renderables: Object3D[] = [];
  scene.traverseVisible((object) => {
    if ((object as Object3D & { material?: unknown }).material) {
      renderables.push(object);
    }
  });
  if (renderables.length === 0) return 0;

  const renderableSet = new Set(renderables);
  for (const object of renderables) object.visible = false;

  try {
    for (let index = 0; index < renderables.length; index += 1) {
      if (options.shouldStop?.()) break;
      const target = renderables[index]!;
      const revealed: Object3D[] = [];
      for (
        let cursor: Object3D | null = target;
        cursor;
        cursor = cursor.parent
      ) {
        if (renderableSet.has(cursor)) {
          cursor.visible = true;
          revealed.push(cursor);
        }
      }

      renderer.render(scene, camera);
      for (const object of revealed) object.visible = false;
      options.onProgress?.((index + 1) / renderables.length);
      if (index + 1 < renderables.length) await options.yieldBetween?.();
    }
  } finally {
    for (const object of renderables) object.visible = true;
  }

  return renderables.length;
}
