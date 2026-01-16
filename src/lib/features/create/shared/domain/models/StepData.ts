/**
 * Beat Domain Model - Shared
 *
 * Unified beat data structure that combines pictograph data with beat context.
 * Used across build and animator modules for all beat-related operations.
 *
 * NOTE: BeatData represents actual beats in a sequence (beatNumber >= 1).
 * For start positions, use StartPositionData instead.
 */
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

export interface BeatData extends PictographData {
  // Type discriminator for TypeScript type guards (optional during migration)
  readonly isBeat?: true;

  // Beat context properties
  readonly beatNumber: number; // Should be >= 1 (beat 0 is deprecated, use StartPositionData)
  readonly duration: number;
  readonly blueReversal: boolean;
  readonly redReversal: boolean;
  readonly isBlank: boolean;
  readonly isSelected?: boolean;
}
