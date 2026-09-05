import type { WorkerRendererProgressPhase } from "../domain/worker-renderer-protocol";

export const WORKER_PROGRESS_MIN_INTERVAL_MS = 50;

export interface WorkerProgressSample {
  phase: WorkerRendererProgressPhase;
  fraction: number;
}

export interface WorkerProgressReporter {
  (phase: WorkerRendererProgressPhase, fraction: number): void;
  cancel(): void;
}

/**
 * Keep high-cardinality loader and shader target progress off the application
 * thread. Phase boundaries are always delivered; intermediate samples are
 * limited to 20 Hz, which is already faster than the visible progress UI can
 * communicate while a scene is preparing.
 */
export function createWorkerProgressReporter(
  emit: (sample: WorkerProgressSample) => void,
  now: () => number = () => performance.now(),
  schedule: (callback: () => void, delayMs: number) => unknown = (
    callback,
    delayMs
  ) => setTimeout(callback, delayMs),
  cancelSchedule: (handle: unknown) => void = (handle) =>
    clearTimeout(handle as ReturnType<typeof setTimeout>)
): WorkerProgressReporter {
  let previousPhase: WorkerRendererProgressPhase | null = null;
  let previousAt = Number.NEGATIVE_INFINITY;
  let pending: WorkerProgressSample | null = null;
  let timer: unknown = null;

  const clearPending = () => {
    if (timer !== null) cancelSchedule(timer);
    timer = null;
    pending = null;
  };

  const emitSample = (sample: WorkerProgressSample) => {
    previousPhase = sample.phase;
    previousAt = now();
    emit(sample);
  };

  const reporter = ((phase, fraction) => {
    const clamped = Math.max(0, Math.min(1, fraction));
    const timestamp = now();
    const boundary = phase !== previousPhase || clamped === 0 || clamped === 1;
    if (boundary) {
      clearPending();
      emitSample({ phase, fraction: clamped });
      return;
    }

    const elapsed = timestamp - previousAt;
    if (elapsed >= WORKER_PROGRESS_MIN_INTERVAL_MS) {
      clearPending();
      emitSample({ phase, fraction: clamped });
      return;
    }

    pending = { phase, fraction: clamped };
    if (timer !== null) return;
    timer = schedule(() => {
      timer = null;
      const latest = pending;
      pending = null;
      if (latest) emitSample(latest);
    }, WORKER_PROGRESS_MIN_INTERVAL_MS - elapsed);
  }) as WorkerProgressReporter;

  reporter.cancel = clearPending;
  return reporter;
}
