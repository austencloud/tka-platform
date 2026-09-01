interface DisjointTimerQueryExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

export interface WebGlGpuTimer {
  readonly supported: boolean;
  begin(): boolean;
  end(): void;
  collect(): number[];
  dispose(): void;
}

const MAX_PENDING_QUERIES = 8;

/**
 * Samples GPU elapsed time without synchronously stalling the render loop.
 * Results are collected only after the browser marks each query available.
 */
export function createWebGlGpuTimer(
  context: WebGLRenderingContext | WebGL2RenderingContext
): WebGlGpuTimer {
  const gl = context as WebGL2RenderingContext;
  const extension = context.getExtension(
    "EXT_disjoint_timer_query_webgl2"
  ) as DisjointTimerQueryExtension | null;
  const supported = Boolean(extension && typeof gl.createQuery === "function");
  const pending: WebGLQuery[] = [];
  let active: WebGLQuery | null = null;
  let disabled = false;

  function deletePending(): void {
    if (!supported) return;
    if (active) gl.deleteQuery(active);
    active = null;
    for (const query of pending) gl.deleteQuery(query);
    pending.length = 0;
  }

  return {
    get supported() {
      return supported && !disabled;
    },
    begin() {
      if (
        !supported ||
        disabled ||
        active ||
        pending.length >= MAX_PENDING_QUERIES
      ) {
        return false;
      }
      try {
        const query = gl.createQuery();
        if (!query) return false;
        gl.beginQuery(extension!.TIME_ELAPSED_EXT, query);
        active = query;
        return true;
      } catch {
        disabled = true;
        deletePending();
        return false;
      }
    },
    end() {
      if (!supported || disabled || !active) return;
      try {
        gl.endQuery(extension!.TIME_ELAPSED_EXT);
        pending.push(active);
        active = null;
      } catch {
        disabled = true;
        deletePending();
      }
    },
    collect() {
      if (!supported || disabled) return [];
      try {
        if (gl.getParameter(extension!.GPU_DISJOINT_EXT)) {
          deletePending();
          return [];
        }

        const elapsedMs: number[] = [];
        while (pending.length > 0) {
          const query = pending[0]!;
          if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
          const elapsedNanoseconds = Number(
            gl.getQueryParameter(query, gl.QUERY_RESULT)
          );
          pending.shift();
          gl.deleteQuery(query);
          if (Number.isFinite(elapsedNanoseconds) && elapsedNanoseconds > 0) {
            elapsedMs.push(elapsedNanoseconds / 1_000_000);
          }
        }
        return elapsedMs;
      } catch {
        disabled = true;
        deletePending();
        return [];
      }
    },
    dispose() {
      deletePending();
      disabled = true;
    },
  };
}
