/**
 * Variation Explorer Interface
 *
 * Enumerates all valid sequence variations for a word using generator pattern.
 * Yields sequences one at a time for memory efficiency.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * A single sequence variation with metadata about the branch choices made
 */
export interface SequenceVariation {
  /** The generated sequence */
  sequence: SequenceData;
  /** Index of choice made at each decision point (for debugging/analysis) */
  branchPath: number[];
}

/**
 * Options for variation exploration
 */
export interface ExplorationOptions {
  /** Grid mode for the sequence */
  gridMode: GridMode;
  /** Maximum number of variations to generate before stopping */
  maxVariations?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Service that explores all valid sequence variations for a word.
 * Uses AsyncGenerator for lazy evaluation - sequences are yielded one at a time.
 */
export interface IVariationExplorer {
  /**
   * Explore all valid sequence variations for the given letters.
   * Yields sequences one at a time for memory efficiency.
   *
   * @param letters - Expanded letter sequence (including bridge letters)
   * @param options - Exploration options
   * @yields SequenceVariation for each valid combination
   */
  exploreVariations(
    letters: Letter[],
    options: ExplorationOptions
  ): AsyncGenerator<SequenceVariation, void, unknown>;

  /**
   * Estimate the total number of variations without generating them.
   * Useful for progress UI.
   *
   * @param letters - Expanded letter sequence
   * @param gridMode - Grid mode for the sequence
   * @returns Estimated variation count (may be approximate for large trees)
   */
  estimateVariationCount(
    letters: Letter[],
    gridMode: GridMode
  ): Promise<number>;
}
