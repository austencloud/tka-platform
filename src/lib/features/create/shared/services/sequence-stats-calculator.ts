/**
 * Sequence Statistics Service
 *
 * Pure calculation functions for sequence statistics and analysis.
 * All functions are pure - no side effects, just computations.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/letter";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

/**
 * Interface describing the shape of the sequence stats calculator module.
 * Consumers that previously held a class instance can use this type.
 */
export interface SequenceStatsCalculator {
  generateSequenceWord: (sequence: SequenceData) => string;
  calculateSequenceDuration: (sequence: SequenceData) => number;
  getSequenceStatistics: (sequence: SequenceData) => { totalSteps: number; filledSteps: number; emptySteps: number; duration: number };
  countReversals: (sequence: SequenceData) => { blueReversals: number; redReversals: number; totalReversals: number };
  getAverageBeatDuration: (sequence: SequenceData) => number;
}

/**
 * Generate word from beat letters
 */
export function generateSequenceWord(sequence: SequenceData): string {
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
export function calculateSequenceDuration(sequence: SequenceData): number {
  return sequence.steps.reduce((total, step) => total + step.duration, 0);
}

/**
 * Get comprehensive sequence statistics
 */
export function getSequenceStatistics(sequence: SequenceData): {
  totalSteps: number;
  filledSteps: number;
  emptySteps: number;
  duration: number;
} {
  const totalSteps = sequence.steps.length;
  const blankSteps = sequence.steps.filter((step) => step.isBlank).length;
  const filledSteps = totalSteps - blankSteps;
  const totalDuration = calculateSequenceDuration(sequence);

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
export function countReversals(sequence: SequenceData): {
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

export function getAverageBeatDuration(sequence: SequenceData): number {
  if (sequence.steps.length === 0) return 0;
  return calculateSequenceDuration(sequence) / sequence.steps.length;
}
