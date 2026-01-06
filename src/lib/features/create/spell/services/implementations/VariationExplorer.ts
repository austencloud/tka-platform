/**
 * Variation Explorer Implementation
 *
 * Enumerates all valid sequence variations for a word using AsyncGenerator pattern.
 * Yields sequences one at a time for memory efficiency.
 */

import { inject, injectable } from "inversify";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { TYPES } from "$lib/shared/inversify/types";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { IBeatConverter } from "$lib/features/create/generate/shared/services/contracts/IBeatConverter";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  IVariationExplorer,
  SequenceVariation,
  ExplorationOptions,
} from "../contracts/IVariationExplorer";
import type { ILetterTransitionGraph } from "../contracts/ILetterTransitionGraph";
import { DifficultyLevel } from "$lib/features/create/generate/shared/domain/models/generate-models";
import { SPELL_TYPES } from "./spell-types";
import { recalculateAllOrientations } from "$lib/features/create/shared/services/implementations/sequence-transforms/orientation-propagation";

/** Default maximum variations (Infinity = no limit, user can cancel) */
const DEFAULT_MAX_VARIATIONS = Infinity;

@injectable()
export class VariationExplorer implements IVariationExplorer {
  constructor(
    @inject(SPELL_TYPES.ILetterTransitionGraph)
    private transitionGraph: ILetterTransitionGraph,
    @inject(TYPES.ILetterQueryHandler)
    private letterQueryHandler: ILetterQueryHandler,
    @inject(TYPES.IBeatConverter)
    private beatConverter: IBeatConverter,
    @inject(TYPES.IOrientationCalculator)
    private orientationCalculator: IOrientationCalculator
  ) {}

  /**
   * Explore all valid sequence variations for the given letters.
   * Uses AsyncGenerator for lazy evaluation - sequences are yielded one at a time.
   */
  async *exploreVariations(
    letters: Letter[],
    options: ExplorationOptions
  ): AsyncGenerator<SequenceVariation, void, unknown> {
    if (letters.length === 0) return;

    const maxVariations = options.maxVariations ?? DEFAULT_MAX_VARIATIONS;
    const { gridMode, signal } = options;
    let yieldedCount = 0;

    // Ensure transition graph is initialized
    if (!this.transitionGraph.isInitialized()) {
      await this.transitionGraph.initialize();
    }

    // Get all pictograph variations upfront (cached by letterQueryHandler)
    const allPictographs =
      await this.letterQueryHandler.getAllPictographVariations(gridMode);

    // Get the first letter to determine valid start positions
    const firstLetter = letters[0]!;
    const startGroup = this.transitionGraph.getStartPositionGroup(firstLetter);
    if (!startGroup) return;

    // Find all valid start positions for the first letter
    const startPositions = this.getValidStartPositions(
      allPictographs,
      startGroup
    );

    if (startPositions.length === 0) return;

    // Explore from each start position
    for (let startIdx = 0; startIdx < startPositions.length; startIdx++) {
      // Check for cancellation
      if (signal?.aborted) return;
      if (yieldedCount >= maxVariations) return;

      const startPosition = startPositions[startIdx]!;

      // Use recursive generator to explore all paths from this start
      for await (const variation of this.exploreFromStart(
        letters,
        startPosition,
        allPictographs,
        gridMode,
        [startIdx],
        signal
      )) {
        yield variation;
        yieldedCount++;

        if (yieldedCount >= maxVariations) return;
      }
    }
  }

  /**
   * Estimate the total number of variations without generating them.
   */
  async estimateVariationCount(
    letters: Letter[],
    gridMode: GridMode
  ): Promise<number> {
    if (letters.length === 0) return 0;

    // Ensure transition graph is initialized
    if (!this.transitionGraph.isInitialized()) {
      await this.transitionGraph.initialize();
    }

    const allPictographs =
      await this.letterQueryHandler.getAllPictographVariations(gridMode);

    const firstLetter = letters[0]!;
    const startGroup = this.transitionGraph.getStartPositionGroup(firstLetter);
    if (!startGroup) return 0;

    const startPositions = this.getValidStartPositions(
      allPictographs,
      startGroup
    );

    if (startPositions.length === 0) return 0;

    // For estimation, we multiply options at each branch point
    // This is approximate because later choices depend on earlier ones
    let totalEstimate = 0;

    for (const startPosition of startPositions) {
      const pathEstimate = this.estimatePathsFromStart(
        letters,
        startPosition,
        allPictographs
      );
      totalEstimate += pathEstimate;

      // Cap the estimate to prevent overflow
      if (totalEstimate > 100000) {
        return 100000; // Return "100000+" as the estimate
      }
    }

    return totalEstimate;
  }

  /**
   * Get all valid start positions for a given position group.
   * Start positions are static pictographs where startPosition === endPosition.
   */
  private getValidStartPositions(
    allPictographs: PictographData[],
    startGroup: string
  ): PictographData[] {
    return allPictographs.filter((p) => {
      const endPos = p.endPosition || "";
      const endGroup = this.positionToGroup(endPos);
      return endGroup === startGroup && this.isStaticPictograph(p);
    });
  }

  /**
   * Recursive generator that explores all paths from a given start position.
   */
  private async *exploreFromStart(
    letters: Letter[],
    startPosition: PictographData,
    allPictographs: PictographData[],
    gridMode: GridMode,
    branchPath: number[],
    signal?: AbortSignal
  ): AsyncGenerator<SequenceVariation, void, unknown> {
    // Build the sequence by exploring all pictograph choices at each letter
    for await (const result of this.exploreLetterSequence(
      letters,
      0,
      startPosition,
      [],
      allPictographs,
      gridMode,
      branchPath,
      signal
    )) {
      yield result;
    }
  }

  /**
   * Recursive generator that explores all pictograph choices for each letter.
   */
  private async *exploreLetterSequence(
    letters: Letter[],
    letterIndex: number,
    lastPictograph: PictographData,
    beats: BeatData[],
    allPictographs: PictographData[],
    gridMode: GridMode,
    branchPath: number[],
    signal?: AbortSignal
  ): AsyncGenerator<SequenceVariation, void, unknown> {
    // Check for cancellation
    if (signal?.aborted) return;

    // Base case: all letters processed, yield the complete sequence
    if (letterIndex >= letters.length) {
      const sequence = this.buildSequenceData(
        lastPictograph, // The original start position is the first in the chain
        beats,
        gridMode
      );

      yield {
        sequence,
        branchPath: [...branchPath],
      };
      return;
    }

    const letter = letters[letterIndex]!;
    const requiredStartPosition = lastPictograph.endPosition;

    // Get all valid pictograph options for this letter
    const options = allPictographs.filter(
      (p) => p.letter === letter && p.startPosition === requiredStartPosition
    );

    if (options.length === 0) {
      // No valid options - this path is a dead end
      return;
    }

    // Explore each option
    for (let optIdx = 0; optIdx < options.length; optIdx++) {
      if (signal?.aborted) return;

      const option = options[optIdx]!;
      const beat = this.beatConverter.convertToBeat(
        option,
        letterIndex + 1,
        gridMode
      );

      // Recurse with this choice
      for await (const result of this.exploreLetterSequence(
        letters,
        letterIndex + 1,
        option,
        [...beats, beat],
        allPictographs,
        gridMode,
        [...branchPath, optIdx],
        signal
      )) {
        yield result;
      }
    }
  }

  /**
   * Estimate paths from a given start position (for estimateVariationCount).
   */
  private estimatePathsFromStart(
    letters: Letter[],
    startPosition: PictographData,
    allPictographs: PictographData[]
  ): number {
    let estimate = 1;
    let currentEndPosition = startPosition.endPosition;

    for (const letter of letters) {
      const options = allPictographs.filter(
        (p) => p.letter === letter && p.startPosition === currentEndPosition
      );

      if (options.length === 0) {
        return 0; // Dead end
      }

      estimate *= options.length;

      // For estimation, we pick the first option to continue
      // This underestimates because different options lead to different end positions
      currentEndPosition = options[0]!.endPosition;
    }

    return estimate;
  }

  /**
   * Build the final SequenceData object from beats.
   */
  private buildSequenceData(
    startPosition: PictographData,
    beats: BeatData[],
    gridMode: GridMode
  ): SequenceData {
    const startPositionData = this.beatConverter.convertToStartPosition(
      startPosition,
      gridMode
    );

    const word = beats.map((b) => b.letter || "").join("");

    let sequence: SequenceData = {
      id: crypto.randomUUID(),
      name: word,
      word,
      beats,
      startPosition: startPositionData,
      startingPositionBeat: startPositionData, // Legacy field
      gridMode,
      propType: PropType.STAFF,
      difficultyLevel: DifficultyLevel.INTERMEDIATE,
      isCircular: false,
      isFavorite: false,
      thumbnails: [],
      tags: ["generated", "spell", "variation"],
      metadata: {
        createdAt: new Date().toISOString(),
        source: "spell-variation",
      },
    };

    // Recalculate orientations to ensure chain integrity
    sequence = recalculateAllOrientations(sequence, this.orientationCalculator);

    return sequence;
  }

  /**
   * Convert a position string to its group (alpha, beta, gamma).
   */
  private positionToGroup(position: string): string | null {
    if (!position) return null;
    if (position.startsWith("alpha")) return "alpha";
    if (position.startsWith("beta")) return "beta";
    if (position.startsWith("gamma")) return "gamma";
    return null;
  }

  /**
   * Check if a pictograph is a static start position (startPosition === endPosition).
   */
  private isStaticPictograph(pictograph: PictographData): boolean {
    return pictograph.startPosition === pictograph.endPosition;
  }
}
