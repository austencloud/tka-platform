import type { IVideoExportOrchestrator } from "$lib/shared/compose/domain/video-export-types";

let instance: IVideoExportOrchestrator | null = null;
let factory: (() => IVideoExportOrchestrator) | null = null;

/**
 * Register the factory that creates VideoExportOrchestrator.
 * Called once from features/compose at app startup to avoid a reverse import
 * (shared/ must not import from features/).
 */
export function registerVideoExportOrchestratorFactory(
  fn: () => IVideoExportOrchestrator
): void {
  factory = fn;
}

export function getVideoExportOrchestrator(): IVideoExportOrchestrator {
  const orchestrator = tryGetVideoExportOrchestrator();
  if (!orchestrator) {
    throw new Error(
      "VideoExportOrchestrator factory not registered. " +
      "Ensure registerVideoExportOrchestratorFactory() is called at app startup."
    );
  }
  return orchestrator;
}

/**
 * Non-throwing variant for callers that can degrade gracefully when the
 * deferred registration hasn't run yet (it loads via requestIdleCallback).
 */
export function tryGetVideoExportOrchestrator(): IVideoExportOrchestrator | null {
  if (!instance && factory) {
    instance = factory();
  }
  return instance;
}
