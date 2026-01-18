/**
 * Variation Explorer Implementation
 *
 * Enumerates all valid sequence variations for a word using AsyncGenerator pattern.
 * Yields sequences one at a time for memory efficiency.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { IStepConverter } from "$lib/features/create/generate/shared/services/contracts/IStepConverter";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  IVariationExplorer,
  SequenceVariation,
  ExplorationOptions,
} from "../contracts/IVariationExplorer";
import type { ILetterTransitionGraph } from "../contracts/ILetterTransitionGraph";
import type { VariationConstraints } from "../../domain/models/spell-models";
import { DifficultyLevel } from "$lib/features/create/generate/shared/domain/models/generate-models";
import { recalculateAllOrientations } from "$lib/features/create/shared/services/implementations/sequence-transforms/orientation-propagation";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/** Default maximum variations (Infinity = no limit, user can cancel) */
const DEFAULT_MAX_VARIATIONS = Infinity;

export class VariationExplorer implements IVariationExplorer {
  constructor(
    private transitionGraph: ILetterTransitionGraph,
    private letterQueryHandler: ILetterQueryHandler,
    private stepConverter: IStepConverter,
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
    const { gridMode, signal, constraints } = options;
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
        signal,
        constraints
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
    signal?: AbortSignal,
    constraints?: VariationConstraints
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
      signal,
      constraints
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
    steps: StepData[],
    allPictographs: PictographData[],
    gridMode: GridMode,
    branchPath: number[],
    signal?: AbortSignal,
    constraints?: VariationConstraints
  ): AsyncGenerator<SequenceVariation, void, unknown> {
    // Check for cancellation
    if (signal?.aborted) return;

    // CONSTRAINT: Early termination if target step count reached
    if (constraints?.targetStepCount && letterIndex >= constraints.targetStepCount) {
      // Reached target depth, yield the sequence
      const sequence = this.buildSequenceData(
        lastPictograph,
        steps,
        gridMode
      );

      // Final validation before yielding
      if (this.meetsConstraints(sequence, constraints)) {
        yield {
          sequence,
          branchPath: [...branchPath],
        };
      }
      return;
    }

    // Base case: all letters processed, yield the complete sequence
    if (letterIndex >= letters.length) {
      const sequence = this.buildSequenceData(
        lastPictograph, // The original start position is the first in the chain
        steps,
        gridMode
      );

      // Final validation before yielding
      if (!constraints || this.meetsConstraints(sequence, constraints)) {
        yield {
          sequence,
          branchPath: [...branchPath],
        };
      }
      return;
    }

    const letter = letters[letterIndex]!;
    const requiredStartPosition = lastPictograph.endPosition;

    // Get all valid pictograph options for this letter
    let options = allPictographs.filter(
      (p) => p.letter === letter && p.startPosition === requiredStartPosition
    );

    // CONSTRAINT: Filter by motion type if specified
    if (constraints?.motionTypeFilter) {
      options = this.filterByMotionType(options, constraints.motionTypeFilter);
    }

    if (options.length === 0) {
      // No valid options - this path is a dead end
      return;
    }

    // Explore each option
    for (let optIdx = 0; optIdx < options.length; optIdx++) {
      if (signal?.aborted) return;

      const option = options[optIdx]!;
      const beat = this.stepConverter.convertToStep(
        option,
        letterIndex + 1,
        gridMode
      );

      // Recurse with this choice
      for await (const result of this.exploreLetterSequence(
        letters,
        letterIndex + 1,
        option,
        [...steps, beat],
        allPictographs,
        gridMode,
        [...branchPath, optIdx],
        signal,
        constraints
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
   * Build the final SequenceData object from steps.
   */
  private buildSequenceData(
    startPosition: PictographData,
    steps: StepData[],
    gridMode: GridMode
  ): SequenceData {
    const startPositionData = this.stepConverter.convertToStartPosition(
      startPosition,
      gridMode
    );

    const word = steps.map((b) => b.letter || "").join("");

    let sequence: SequenceData = {
      id: crypto.randomUUID(),
      name: word,
      word,
      steps,
      startPosition: startPositionData,
      startingPosition: startPositionData, // Legacy field
      gridMode,
      // propType removed - prop type is viewer preference, not sequence data
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

  /**
   * Filter pictographs by motion type constraint.
   * 'dash' = only dash motions, 'no-dash' = exclude dash motions
   */
  private filterByMotionType(
    pictographs: PictographData[],
    filter: "dash" | "no-dash"
  ): PictographData[] {
    return pictographs.filter((p) => {
      const hasDash = this.hasDashMotion(p);
      return filter === "dash" ? hasDash : !hasDash;
    });
  }

  /**
   * Check if a pictograph contains dash motion type.
   */
  private hasDashMotion(pictograph: PictographData): boolean {
    const blueMotion = pictograph.motions.blue;
    const redMotion = pictograph.motions.red;

    return (
      blueMotion?.motionType === MotionType.DASH ||
      redMotion?.motionType === MotionType.DASH
    );
  }

  /**
   * Check if a complete sequence meets all constraints.
   * Final validation before yielding a variation.
   */
  private meetsConstraints(
    sequence: SequenceData,
    constraints: VariationConstraints
  ): boolean {
    // Step count constraint
    if (
      constraints.targetStepCount !== null &&
      sequence.steps.length !== constraints.targetStepCount
    ) {
      return false;
    }

    // Reversal constraint (basic check - can be enhanced)
    if (constraints.maxReversals !== null) {
      const reversalCount = this.countReversals(sequence);
      if (reversalCount > constraints.maxReversals) {
        return false;
      }
    }

    // Circular requirement
    if (constraints.requiresCircular && !sequence.isCircular) {
      return false;
    }

    return true;
  }

  /**
   * Count reversals in a sequence (basic implementation).
   * This is a simplified check - the full reversal detection happens later.
   */
  private countReversals(sequence: SequenceData): number {
    let count = 0;

    for (const step of sequence.steps) {
      if (step.blueReversal) count++;
      if (step.redReversal) count++;
    }

    return count;
  }
}
