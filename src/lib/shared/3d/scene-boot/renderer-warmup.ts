import type { Camera, Object3D, Scene, WebGLRenderer } from "three";
import { collectUniqueCompileTargets } from "./renderer-program-targets";

export interface WarmupHandles {
  renderer: WebGLRenderer;
  scene: Object3D;
  camera: Camera;
}

export interface WarmupOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

const COMPILE_DISPATCH_SLICE_MS = 50;

function yieldToMainThread(): Promise<void> {
  const scheduler = (
    globalThis as typeof globalThis & {
      scheduler?: { yield?: () => Promise<void> };
    }
  ).scheduler;
  if (scheduler?.yield) return scheduler.yield();

  return new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(null);
  });
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

  const targets = collectUniqueCompileTargets(scene);
  if (targets.length === 0) targets.push(scene);
  let warned = false;
  let settled = 0;

  const reportFailure = (error: unknown) => {
    if (warned) return;
    warned = true;
    console.warn("[scene-boot] shader warmup failed:", error);
  };

  // compileAsync does its traversal and program creation synchronously, then
  // returns a promise that polls KHR_parallel_shader_compile until the driver
  // reports the programs linked. Awaiting each target in turn therefore paid
  // every driver link end to end, plus a 10ms poll tick per program, while the
  // GPU sat idle between them. Dispatching them together keeps the synchronous
  // half in the same order and lets the link waits overlap, so the warm-up
  // costs roughly the slowest single program instead of the sum of all of them.
  const pending: Array<Promise<void> | null> = [];
  let sliceStartedAt = performance.now();
  for (const target of targets) {
    if (signal?.aborted) {
      pending.push(null);
      continue;
    }
    // A representative object is a temporary compile root, so invisible
    // ancestors do not exclude it. Equivalent materials share one program
    // signature and never repeat this relatively expensive traversal. The flag
    // is restored as soon as compileAsync returns because the traversal it
    // depends on has already happened by then — only the polling is deferred.
    const wasVisible = target.visible;
    target.visible = true;
    try {
      pending.push(renderer.compileAsync(target, camera, scene as Scene));
    } catch (error) {
      reportFailure(error);
      pending.push(null);
    } finally {
      target.visible = wasVisible;
    }

    // Program creation is synchronous even when the driver links in parallel.
    // Large environments can accumulate seconds of those calls into one task,
    // making every control feel dead. Keep the fast path contiguous, but hand
    // the browser a turn once that task has consumed a visible frame budget.
    // The link promises remain pending, so this does not serialize the GPU.
    if (
      performance.now() - sliceStartedAt >= COMPILE_DISPATCH_SLICE_MS &&
      pending.length < targets.length
    ) {
      await yieldToMainThread();
      sliceStartedAt = performance.now();
    }
  }

  await Promise.all(
    pending.map(async (promise) => {
      try {
        await promise;
      } catch (error) {
        reportFailure(error);
      } finally {
        settled += 1;
        onProgress?.(settled / pending.length);
      }
    })
  );
}
