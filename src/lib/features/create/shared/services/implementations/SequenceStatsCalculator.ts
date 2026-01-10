/**
 * Sequence Statistics Service
 *
 * Pure calculation functions for sequence statistics and analysis.
 * All functions are pure - no side effects, just computations.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ISequenceStatsCalculator } from "../contracts/ISequenceStatsCalculator";

export class SequenceStatsCalculator implements ISequenceStatsCalculator {
  /**
   * Generate word from beat letters
   */
  generateSequenceWord(sequence: SequenceData): string {
    const letters = sequence.beats
      .filter((beat) => !!beat.letter)
      .map((beat) => beat.letter)
      .filter((letter): letter is Letter => letter !== undefined)
      .join("");

    return letters || "";
  }

  /**
   * Calculate total duration of sequence
   */
  calculateSequenceDuration(sequence: SequenceData): number {
    return sequence.beats.reduce((total, beat) => total + beat.duration, 0);
  }

  /**
   * Get comprehensive sequence statistics
   */
  getSequenceStatistics(sequence: SequenceData): {
    totalBeats: number;
    filledBeats: number;
    emptyBeats: number;
    duration: number;
  } {
    const totalBeats = sequence.beats.length;
    const blankBeats = sequence.beats.filter((beat) => beat.isBlank).length;
    const filledBeats = totalBeats - blankBeats;
    const totalDuration = this.calculateSequenceDuration(sequence);

    return {
      totalBeats,
      filledBeats,
      emptyBeats: blankBeats,
      duration: totalDuration,
    };
  }

  /**
   * Count beats with reversals
   */
  countReversals(sequence: SequenceData): {
    blueReversals: number;
    redReversals: number;
    totalReversals: number;
  } {
    const blueReversals = sequence.beats.filter(
      (beat) => beat.blueReversal
    ).length;
    const redReversals = sequence.beats.filter(
      (beat) => beat.redReversal
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
    if (sequence.beats.length === 0) return 0;
    return this.calculateSequenceDuration(sequence) / sequence.beats.length;
  }
}
