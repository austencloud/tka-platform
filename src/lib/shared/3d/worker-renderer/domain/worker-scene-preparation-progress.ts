import type { WorkerRendererProgressPhase } from "./worker-renderer-protocol";

export interface WorkerScenePreparationProgress {
  assetProgress: number;
  warmupProgress: number;
}

interface PhaseRange {
  start: number;
  end: number;
}

const ASSET_PHASE_RANGES: Readonly<
  Partial<Record<WorkerRendererProgressPhase, PhaseRange>>
> = {
  renderer: { start: 0, end: 0.08 },
  assets: { start: 0.08, end: 0.75 },
  construct: { start: 0.75, end: 0.86 },
  performer: { start: 0.86, end: 1 },
};

const WARMUP_PHASE_RANGES: Readonly<
  Partial<Record<WorkerRendererProgressPhase, PhaseRange>>
> = {
  compile: { start: 0, end: 0.45 },
  prime: { start: 0.45, end: 0.75 },
  finalize: { start: 0.75, end: 0.85 },
  preflight: { start: 0.85, end: 0.95 },
  "first-frame": { start: 0.95, end: 1 },
};

function clampFraction(fraction: number): number {
  return Math.max(0, Math.min(1, fraction));
}

function interpolate(range: PhaseRange, fraction: number): number {
  return range.start + (range.end - range.start) * clampFraction(fraction);
}

/**
 * Translate the worker's per-phase 0..1 counters into the two monotonic
 * progress channels owned by the scene-loading curtain.
 *
 * The worker deliberately restarts its fraction for every phase. Passing that
 * value through directly made the tiny renderer phase claim that every asset
 * was ready, then left warm-up at zero forever. These ranges preserve each
 * phase's place in the actual pipeline while leaving the scene feature state
 * responsible for enforcing monotonic updates.
 */
export function resolveWorkerScenePreparationProgress(
  phase: string | null,
  fraction: number
): WorkerScenePreparationProgress {
  if (phase === "handoff") {
    return { assetProgress: 1, warmupProgress: 1 };
  }

  const assetRange = ASSET_PHASE_RANGES[phase as WorkerRendererProgressPhase];
  if (assetRange) {
    return {
      assetProgress: interpolate(assetRange, fraction),
      warmupProgress: 0,
    };
  }

  const warmupRange = WARMUP_PHASE_RANGES[phase as WorkerRendererProgressPhase];
  if (warmupRange) {
    return {
      assetProgress: 1,
      warmupProgress: interpolate(warmupRange, fraction),
    };
  }

  return { assetProgress: 0, warmupProgress: 0 };
}
