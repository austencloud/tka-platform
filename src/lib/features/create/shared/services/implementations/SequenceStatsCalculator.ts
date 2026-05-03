/**
 * Sequence Statistics Service
 *
 * Pure calculation functions for sequence statistics and analysis.
 * All functions are pure - no side effects, just computations.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export class SequenceStatsCalculator {
  /**
   * Generate word from beat letters
   */
  generateSequenceWord(sequence: SequenceData): string {
    const letters = sequence.steps
      .filter((step) => !!step.letter)
      .map((step) => step.letter)
      .filter((letter): letter is Letter => letter !== undefined)
      .join("");

    return letters || "";
  }

  /**
   * Calculate total duration of sequence
   */
  calculateSequenceDuration(sequence: SequenceData): number {
    return sequence.steps.reduce((total, step) => total + step.duration, 0);
  }

  /**
   * Get comprehensive sequence statistics
   */
  getSequenceStatistics(sequence: SequenceData): {
    totalSteps: number;
    filledSteps: number;
    emptySteps: number;
    duration: number;
  } {
    const totalSteps = sequence.steps.length;
    const blankSteps = sequence.steps.filter((step) => step.isBlank).length;
    const filledSteps = totalSteps - blankSteps;
    const totalDuration = this.calculateSequenceDuration(sequence);

    return {
      totalSteps,
      filledSteps,
      emptySteps: blankSteps,
      duration: totalDuration,
    };
  }

  /**
   * Count steps with reversals
   */
  countReversals(sequence: SequenceData): {
    blueReversals: number;
    redReversals: number;
    totalReversals: number;
  } {
    const blueReversals = sequence.steps.filter(
      (step) => step.blueReversal
    ).length;
    const redReversals = sequence.steps.filter(
      (step) => step.redReversal
    ).length;

    return {
      blueReversals,
      redReversals,
      totalReversals: blueReversals + redReversals,
    };
  }

  /**
   * Get average beat duration
   */
  getAverageBeatDuration(sequence: SequenceData): number {
    if (sequence.steps.length === 0) return 0;
    return this.calculateSequenceDuration(sequence) / sequence.steps.length;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const sequenceStatsCalculator = new SequenceStatsCalculator();
