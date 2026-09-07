import type { WorkerSceneEffectsSnapshot } from "../domain/worker-renderer-protocol";

/**
 * Combine scene-global effects with performer effects derived inside the
 * worker. Neither side may replace the other: both are final renderer inputs
 * owned by different parts of the scene.
 */
export function mergeWorkerSceneEffects(
  external: WorkerSceneEffectsSnapshot,
  performer: WorkerSceneEffectsSnapshot | null
): WorkerSceneEffectsSnapshot {
  if (!performer) return external;
  return {
    playing: external.playing || performer.playing,
    sources: [...external.sources, ...performer.sources],
    imperative: [
      ...(external.imperative ?? []),
      ...(performer.imperative ?? []),
    ],
  };
}
