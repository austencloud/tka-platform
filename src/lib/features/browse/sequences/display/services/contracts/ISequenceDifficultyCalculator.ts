/**
 * Sequence Difficulty Calculator Contract
 *
 * Calculates the difficulty level of a sequence based on turn values and orientations.
 *
 * Level Logic:
 * - Level 1: Base Motions
 * - Level 2: Whole Turns
 * - Level 3: Half Turns, Floats
 */

import type { StepData } from "../../../../../create/shared/domain/models/StepData";

export type DifficultyTrigger = "none" | "turns" | "nonRadial";

export interface DifficultyAnalysis {
  readonly level: 1 | 2 | 3;
  readonly trigger: DifficultyTrigger;
}

export interface ISequenceDifficultyCalculator {
  /**
   * Calculate the difficulty level of a sequence based on its content
   * @param steps - Array of beat data containing motion information
   * @returns Numeric difficulty level (1 = beginner, 2 = intermediate, 3 = advanced)
   */
  calculateDifficultyLevel(steps: StepData[]): number;

  /**
   * Analyze the sequence and return both the level and the feature that triggered it.
   * Used by UI surfaces that explain *why* a sequence is at a given level.
   */
  analyzeDifficulty(steps: StepData[]): DifficultyAnalysis;

  /**
   * Convert numeric level to difficulty string
   * @param level - Numeric level (1-3)
   * @returns Difficulty string ("beginner", "intermediate", "advanced")
   */
  levelToString(level: number): string;
}
