import type { HandPathData } from "$lib/shared/foundation/domain/models/HandPathData";

export interface IHandPathSaveOrchestrator {
  /**
   * Save a hand path to the user's repository with original provenance.
   * "Original" means the user created it directly (e.g. in the hand path builder),
   * not extracted from an existing full sequence.
   *
   * @param data - The fully formed hand path data
   * @param name - Optional display name for the artifact
   */
  save(data: HandPathData, name?: string): Promise<void>;
}
