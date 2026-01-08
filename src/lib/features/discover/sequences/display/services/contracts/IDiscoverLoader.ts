/**
 * Service for loading gallery sequences from various sources
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface IDiscoverLoader {
  /**
   * Load all sequence metadata from the sequence index
   * (lightweight - no beat data, optimized for gallery display)
   */
  loadSequenceMetadata(): Promise<SequenceData[]>;

  /**
   * Lazy-load full sequence data including beats
   * Called only when user opens a specific sequence
   * This prevents the N+1 query problem during initial gallery load
   */
  loadFullSequenceData(sequenceName: string): Promise<SequenceData | null>;
}
