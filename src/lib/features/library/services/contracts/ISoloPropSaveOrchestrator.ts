import type { SoloPropData } from "$lib/shared/foundation/domain/models/SoloPropData";

export interface ISoloPropSaveOrchestrator {
  /**
   * Save a solo prop to the user's repository with original provenance.
   * Also extracts and saves the embedded hand path as a separate artifact.
   *
   * @param data - The fully formed solo prop data
   * @param name - Optional display name for the artifact
   */
  save(data: SoloPropData, name?: string): Promise<void>;
}
