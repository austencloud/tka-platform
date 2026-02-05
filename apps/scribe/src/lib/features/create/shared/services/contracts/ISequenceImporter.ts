/**
 * Sequence Import Service Contract
 *
 * Service for importing sequences from various sources (PNG metadata, etc.)
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface ISequenceImporter {
  /**
   * Import sequence from PNG metadata
   * @param id - Sequence identifier
   * @returns Promise resolving to sequence data or null if not found
   */
  importFromPNG(id: string): Promise<SequenceData | null>;
}
