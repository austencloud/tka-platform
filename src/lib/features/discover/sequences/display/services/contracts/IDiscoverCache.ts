/**
 * Service for caching gallery sequences
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface IDiscoverCache {
  /**
   * Get cached sequences if available
   */
  getCached(): SequenceData[] | null;

  /**
   * Cache sequences
   */
  setCached(sequences: SequenceData[]): void;

  /**
   * Clear the cache
   */
  clearCache(): void;
}
