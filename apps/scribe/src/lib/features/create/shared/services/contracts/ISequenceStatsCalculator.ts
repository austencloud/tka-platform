/**
 * Sequence Statistics Service Interface
 *
 * Pure calculation functions for sequence statistics and analysis.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface ISequenceStatsCalculator {
  /**
   * Generate word from beat letters
   */
  generateSequenceWord(sequence: SequenceData): string;

  /**
   * Calculate total duration of sequence
   */
  calculateSequenceDuration(sequence: SequenceData): number;

  /**
   * Get comprehensive sequence statistics
   */
  getSequenceStatistics(sequence: SequenceData): {
    totalSteps: number;
    filledSteps: number;
    emptySteps: number;
    duration: number;
  };

  /**
   * Count steps with reversals
   */
  countReversals(sequence: SequenceData): {
    blueReversals: number;
    redReversals: number;
    totalReversals: number;
  };

  /**
   * Get average beat duration
   */
  getAverageBeatDuration(sequence: SequenceData): number;
}
