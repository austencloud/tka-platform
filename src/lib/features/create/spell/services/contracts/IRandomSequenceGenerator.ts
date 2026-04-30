/**
 * Random Sequence Generator Interface
 *
 * Generates a single random valid sequence using constraint-based random walks.
 * Much faster than exhaustive exploration - returns first valid sequence found.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { VariationConstraints } from "../../domain/models/spell-models";
import type { ConstraintSet } from "$lib/shared/sequence-engine/constraints/types";
import type { LetterSource } from "../../domain/models/spell-models";
import type { DifficultyLevel } from "$lib/features/create/generate/shared/domain/models/generate-models";

export interface RandomSequenceGenerationOptions {
  /** Grid mode to use */
  gridMode: GridMode;
  /** Optional constraints to respect during generation */
  constraints?: VariationConstraints;
  /** Optional soft constraint set for scoring variations (smooth, natural, choppy) */
  constraintSet?: ConstraintSet;
  /** Optional abort signal to cancel generation */
  signal?: AbortSignal;
  /** Max attempts before giving up (default: 100) */
  maxAttempts?: number;
  /** Optional letter sources from parsing (tracks which letters are bridges) */
  letterSources?: LetterSource[];
  /** Difficulty level - filters variations by max turn count */
  level?: DifficultyLevel;
  /** Turn intensity bias (0.0-2.0) - biases weighted selection toward higher or lower turns */
  turnIntensity?: number;
}

export interface IRandomSequenceGenerator {
  /**
   * Generate a single random valid sequence for the given letters.
   *
   * Algorithm:
   * 1. Pick random valid start position (Type 6 static letter)
   * 2. For each letter, randomly pick a variation that:
   *    - Matches grid mode
   *    - Respects constraints (motion type, reversals, etc.)
   *    - Has valid orientation continuity from previous beat
   * 3. Backtrack if no valid options found
   * 4. Apply LOOP extension if makeCircular constraint is true
   * 5. Return first complete valid sequence
   *
   * @param letters - Expanded letters (including bridge letters)
   * @param options - Generation options (gridMode, constraints, signal)
   * @returns Promise resolving to SequenceData or null if no valid sequence found
   */
  generateRandomSequence(
    letters: Letter[],
    options: RandomSequenceGenerationOptions
  ): Promise<SequenceData | null>;
}
