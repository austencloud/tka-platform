/**
 * LOOP Parameter Provider
 *
 * Provides all parameter calculation and configuration services for LOOP (Linked Orbital Offset Pattern) generation.
 * Consolidates inverted letter mapping, rotation direction determination, and turn intensity allocation.
 *
 * Replaces:
 * - InvertedLetterService
 * - RotationDirectionService
 * - TurnIntensityLevelService
 * - TurnIntensityManagerService
 */

import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { getInvertedLetter } from "../../circular/domain/constants/strict-loop-position-maps";
import type {
  RotationDirections,
  TurnAllocation,
} from "../domain/models/generate-models";
import {
  DifficultyLevel,
  PropContinuity,
} from "../domain/models/generate-models";
import type { pictographFilter as PictographFilterSingleton } from "./pictograph-filter";
type PictographFilter = typeof PictographFilterSingleton;

export class LOOPParameterProvider {
  constructor(private PictographFilter: PictographFilter) {}

  // ============================================================================
  // INVERTED LETTER OPERATIONS
  // ============================================================================

  /**
   * Get the inverted letter for a given letter
   * @param letter - The input letter
   * @returns The inverted letter
   * @throws Error if no inverted mapping exists for the letter
   */
  getInvertedLetter(letter: string): string {
    return getInvertedLetter(letter);
  }

  // ============================================================================
  // LEVEL CONVERSION OPERATIONS
  // ============================================================================

  /**
   * Convert DifficultyLevel enum to numeric value
   */
  difficultyToNumber(level: DifficultyLevel): number {
    switch (level) {
      case DifficultyLevel.BEGINNER:
        return 1;
      case DifficultyLevel.INTERMEDIATE:
        return 2;
      case DifficultyLevel.ADVANCED:
        return 3;
      case DifficultyLevel.SKEWED:
        return 4;
      default:
        return 2;
    }
  }

  /**
   * Convert numeric value to DifficultyLevel enum
   */
  numberToDifficulty(level: number): DifficultyLevel {
    switch (level) {
      case 1:
        return DifficultyLevel.BEGINNER;
      case 2:
        return DifficultyLevel.INTERMEDIATE;
      case 3:
        return DifficultyLevel.ADVANCED;
      case 4:
        return DifficultyLevel.SKEWED;
      default:
        return DifficultyLevel.INTERMEDIATE;
    }
  }

  // ============================================================================
  // ROTATION DIRECTION OPERATIONS
  // ============================================================================

  /**
   * Determine rotation directions for blue and red props based on prop continuity
   * @param propContinuity - Continuous or random prop continuity
   * @returns Rotation directions for blue and red props
   */
  determineRotationDirections(
    propContinuity?: PropContinuity
  ): RotationDirections {
    if (propContinuity === PropContinuity.CONTINUOUS) {
      return {
        blueRotationDirection: this.PictographFilter.selectRandom([
          RotationDirection.CLOCKWISE,
          RotationDirection.COUNTER_CLOCKWISE,
        ]),
        redRotationDirection: this.PictographFilter.selectRandom([
          RotationDirection.CLOCKWISE,
          RotationDirection.COUNTER_CLOCKWISE,
        ]),
      };
    }

    return { blueRotationDirection: "", redRotationDirection: "" };
  }

  // ============================================================================
  // TURN INTENSITY OPERATIONS
  // ============================================================================

  /**
   * Get allowed turn intensity values for UI display
   * Determines which intensity values should be available based on difficulty level
   * @param level - The difficulty level
   * @returns Array of allowed turn intensity values (empty for Beginner, filtered for other levels)
   */
  getAllowedTurnsForLevel(level: DifficultyLevel): number[] {
    switch (level) {
      case DifficultyLevel.BEGINNER:
        return []; // No turns for level 1
      case DifficultyLevel.INTERMEDIATE:
        return [1.0, 2.0, 3.0]; // Whole numbers for level 2
      case DifficultyLevel.ADVANCED:
        return [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]; // All values for level 3 (excluding 0 and "fl" for UI)
      default:
        return [1.0, 2.0, 3.0];
    }
  }

  /**
   * Allocate turns for blue and red props during sequence generation
   * Direct port from legacy TurnIntensityManager.allocate_turns_for_blue_and_red()
   *
   * @param wordLength - Number of steps in the sequence
   * @param level - Difficulty level (1-3)
   * @param maxTurnIntensity - Maximum turn intensity allowed
   * @returns Turn allocations for blue and red props
   */
  allocateTurns(
    wordLength: number,
    level: number,
    maxTurnIntensity: number,
    options?: { enforcePeriod4Parity?: boolean }
  ): TurnAllocation {
    let possibleTurns: (number | "fl")[];

    // Exact logic from legacy
    if (level === 2) {
      possibleTurns = [0, 1, 2, 3];
    } else if (level === 3) {
      possibleTurns = [0, 0.5, 1, 1.5, 2, 2.5, 3, "fl"];
    } else {
      possibleTurns = [0];
    }

    const validTurns = possibleTurns.filter((t) => {
      if (t === "fl") return true;
      return typeof t === "number" && t <= maxTurnIntensity;
    });
    const turnsPool = validTurns.length > 0 ? validTurns : [0];

    const enforceParity = options?.enforcePeriod4Parity === true;
    const hasHalfTurns = turnsPool.some(
      (t) => t !== "fl" && typeof t === "number" && (t * 2) % 2 !== 0
    );
    const hasWholeTurns = turnsPool.some(
      (t) => t !== "fl" && typeof t === "number" && (t * 2) % 2 === 0
    );
    const canEnforce = enforceParity && hasHalfTurns && hasWholeTurns;

    const blue = this.allocateSingleHand(wordLength, turnsPool, canEnforce);
    const red = this.allocateSingleHand(wordLength, turnsPool, canEnforce);

    return { blue, red };
  }

  private allocateSingleHand(
    wordLength: number,
    turnsPool: (number | "fl")[],
    enforcePeriod4Parity: boolean
  ): (number | "fl")[] {
    const result: (number | "fl")[] = [];
    const beatsToPreallocate = enforcePeriod4Parity ? wordLength - 1 : wordLength;

    for (let i = 0; i < beatsToPreallocate; i++) {
      result.push(this.randomChoice(turnsPool));
    }

    if (!enforcePeriod4Parity) return result;

    let runningTotal = 0;
    for (const t of result) {
      runningTotal = (runningTotal + this.wheelQuarters(t)) % 4;
    }

    const targetContribution = (1 - runningTotal + 4) % 4;
    const matching = turnsPool.filter(
      (t) => t !== "fl" && this.wheelQuarters(t) === targetContribution
    );

    result.push(
      matching.length > 0
        ? this.randomChoice(matching)
        : this.randomChoice(turnsPool)
    );
    return result;
  }

  private wheelQuarters(turn: number | "fl"): number {
    if (turn === "fl") return 0;
    return Math.round(turn * 2) % 4;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private randomChoice<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error("Cannot choose from empty array");
    }
    return array[Math.floor(Math.random() * array.length)]!;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { pictographFilter } from "./pictograph-filter";

export const loopParameterProvider = new LOOPParameterProvider(pictographFilter);
