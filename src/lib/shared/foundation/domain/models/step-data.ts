/**
 * Beat Domain Model - Shared
 *
 * Unified step data structure that combines pictograph data with beat context.
 * Used across build and animator modules for all beat-related operations.
 *
 * NOTE: StepData represents actual steps in a sequence (stepNumber >= 1).
 * For start positions, use StartPositionData instead.
 */
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

export interface StepData extends PictographData {
  // Type discriminator for TypeScript type guards (optional during migration)
  readonly isStep?: true;

  // Beat context properties
  readonly stepNumber: number; // Should be >= 1 (beat 0 is deprecated, use StartPositionData)
  readonly duration: number;
  readonly blueReversal: boolean;
  readonly redReversal: boolean;
  readonly isBlank: boolean;
  readonly isSelected?: boolean;
}
