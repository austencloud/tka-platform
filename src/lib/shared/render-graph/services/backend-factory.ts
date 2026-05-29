/**
 * Backend factory.
 *
 * Returns the best backend available for the current environment.
 * Phase 0: WebGL2 only. Phase 4 adds WebGPU preferred. Canvas2D
 * legacy is reserved for the Phase 5 escape hatch and not wired yet.
 */

import type { RenderBackend, BackendKind } from "../domain/backend";
import { WebGL2Backend } from "./web-gl2-backend";
import { WebGPUBackend } from "./web-gpu-backend";

export interface BackendFactoryOptions {
  /** Force a particular backend for tests or side-by-side comparisons. */
  preferred?: BackendKind;
}

export async function createBackend(
  canvas: HTMLCanvasElement,
  options: BackendFactoryOptions = {},
): Promise<RenderBackend> {
  const preferred = options.preferred;

  if (preferred === "webgl2" || preferred === undefined) {
    const backend = new WebGL2Backend();
    await backend.initialize(canvas);
    return backend;
  }

  if (preferred === "webgpu") {
    if (!(await isWebGPUAvailable())) {
      throw new Error("BackendFactory: WebGPU requested but not available");
    }
    const backend = new WebGPUBackend();
    await backend.initialize(canvas);
    return backend;
  }

  if (preferred === "canvas2d-legacy") {
    throw new Error("BackendFactory: Canvas2DLegacyBackend is deferred to Phase 5");
  }

  throw new Error(`BackendFactory: unknown preferred backend "${String(preferred)}"`);
}

/** Probe WebGPU support. Useful for UI affordances (“WebGPU available”). */
export async function isWebGPUAvailable(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) return false;
  try {
    const adapter = await (navigator as Navigator & {
      gpu: { requestAdapter(): Promise<unknown> };
    }).gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/** Probe WebGL2 support without allocating resources. */
export function isWebGL2Available(): boolean {
  if (typeof document === "undefined") return false;
  const probe = document.createElement("canvas");
  const gl = probe.getContext("webgl2");
  const ok = gl !== null;
  // Best-effort release - browsers GC quickly but this is explicit.
  if (gl) {
    const loseExt = gl.getExtension("WEBGL_lose_context");
    loseExt?.loseContext();
  }
  return ok;
}
