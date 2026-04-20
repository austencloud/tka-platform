/**
 * LOOP Parameter Provider Interface
 *
 * Provides all parameter calculation and configuration services for LOOP (Linked Orbital Offset Pattern) generation.
 */

import type {
  DifficultyLevel,
  PropContinuity,
  RotationDirections,
  TurnAllocation,
} from "../../domain/models/generate-models";

export interface ILOOPParameterProvider {
  /**
   * Get the inverted letter for a given letter
   * @param letter - The input letter
   * @returns The inverted letter
   * @throws Error if no inverted mapping exists for the letter
   */
  getInvertedLetter(letter: string): string;

  /**
   * Convert DifficultyLevel enum to numeric value (1-3)
   * @param level - The difficulty level enum
   * @returns Numeric level value (1 for beginner, 2 for intermediate, 3 for advanced)
   */
  difficultyToNumber(level: DifficultyLevel): number;

  /**
   * Convert numeric value to DifficultyLevel enum
   * @param level - Numeric level value (1-3)
   * @returns The corresponding DifficultyLevel enum value
   */
  numberToDifficulty(level: number): DifficultyLevel;

  /**
   * Determine rotation directions for blue and red props based on prop continuity
   * @param propContinuity - Continuous or random prop continuity
   * @returns Rotation directions for blue and red props
   */
  determineRotationDirections(
    propContinuity?: PropContinuity
  ): RotationDirections;

  /**
   * Get allowed turn intensity values for UI display
   * Determines which intensity values should be available based on difficulty level
   * @param level - The difficulty level
   * @returns Array of allowed turn intensity values (empty for Beginner, filtered for other levels)
   */
  getAllowedTurnsForLevel(level: DifficultyLevel): number[];

  /**
   * Allocate turns for blue and red props during sequence generation
   * @param wordLength - Number of steps in the sequence
   * @param level - Difficulty level (1-3)
   * @param maxTurnIntensity - Maximum turn intensity allowed
   * @param options - Optional allocation constraints (e.g. period-4 parity
   *                  for non-rotated LOOPs at L3+)
   * @returns Turn allocations for blue and red props
   */
  allocateTurns(
    wordLength: number,
    level: number,
    maxTurnIntensity: number,
    options?: { enforcePeriod4Parity?: boolean }
  ): TurnAllocation;
}
