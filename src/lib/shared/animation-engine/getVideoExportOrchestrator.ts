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
  if (!instance) {
    if (!factory) {
      throw new Error(
        "VideoExportOrchestrator factory not registered. " +
        "Ensure registerVideoExportOrchestratorFactory() is called at app startup."
      );
    }
    instance = factory();
  }
  return instance;
}
