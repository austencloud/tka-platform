/**
 * Sequence Difficulty Calculator Contract
 *
 * Calculates the difficulty level of a sequence based on turn values and orientations.
 *
 * Level Logic:
 * - Level 1 (Beginner): Zero turns, only radial orientations (IN/OUT)
 * - Level 2 (Intermediate): Has turns, only radial orientations (IN/OUT)
 * - Level 3 (Advanced): Non-radial orientations (CLOCK/COUNTER) or half-turns or floats
 */

import type { BeatData } from "../../../../../create/shared/domain/models/BeatData";

export interface ISequenceDifficultyCalculator {
  /**
   * Calculate the difficulty level of a sequence based on its content
   * @param beats - Array of beat data containing motion information
   * @returns Numeric difficulty level (1 = beginner, 2 = intermediate, 3 = advanced)
   */
  calculateDifficultyLevel(beats: BeatData[]): number;

  /**
   * Convert numeric level to difficulty string
   * @param level - Numeric level (1-3)
   * @returns Difficulty string ("beginner", "intermediate", "advanced")
   */
  levelToString(level: number): string;
}
