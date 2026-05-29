/**
 * Bridge Finder Implementation
 *
 * Finds bridge letters that can connect a sequence to a loopable position.
 * Analyzes pictograph candidates and determines available LOOP patterns.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  GridPosition} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { CircularizationOption } from "./sequence-extender";
import type { OrientationAlignment } from "./orientation-alignment-calculator";

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";
import type { PositionAnalyzer } from "../../construct/option-picker/services/position-analyzer";
import type { LOOPValidator } from "./loop-validator";
import type { SequenceAnalyzer } from "./sequence-analyzer";
type OrientationAlignmentCalculator = {
  calculateOrientationAlignment: (sequence: SequenceData, bridgePictograph: PictographData) => OrientationAlignment | null;
  calculateResultingLength: (currentLength: number, rotationRelation: "exact" | "half" | "quarter" | null, repetitionsNeeded?: 1 | 2 | 4) => number;
};
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import {
  LOOPType,
  Period,
} from "$lib/shared/foundation/domain/models/generation/circular-models";
import {
  HALVED_LOOPS,
  QUARTERED_LOOPS,
} from "$lib/shared/foundation/domain/models/generation/circular-position-maps";
import type { LOOPOption } from "./loop-validator";

export class BridgeFinder {
  constructor(
    private letterQueryHandler: ILetterQueryHandler,
    private positionAnalyzer: PositionAnalyzer,
    private loopValidator: LOOPValidator,
    private sequenceAnalyzer: SequenceAnalyzer,
    private orientationCalculator: OrientationAlignmentCalculator
  ) {}

  /**
   * Get circularization options for a sequence that isn't directly loopable.
   */
  async getCircularizationOptions(
    sequence: SequenceData
  ): Promise<CircularizationOption[]> {
    const startPosition = this.sequenceAnalyzer.getStartPosition(sequence);
    const endPosition = this.sequenceAnalyzer.getCurrentEndPosition(sequence);

    if (!startPosition || !endPosition) {
      return [];
    }

    // Get position groups
    const startGroup = this.positionAnalyzer.getEndPositionGroup(startPosition);
    const endGroup = this.positionAnalyzer.getEndPositionGroup(endPosition);

    // If already in same group, no bridge needed (use regular extension)
    if (!startGroup || !endGroup || startGroup === endGroup) {
      return [];
    }

    const gridMode = sequence.gridMode || GridMode.DIAMOND;

    // Get all pictographs
    const allPictographs =
      await this.letterQueryHandler.getAllPictographVariations(gridMode);

    // Find pictographs that:
    // 1. Start at the sequence's current end position
    // 2. End at a position in the start group
    const bridgeCandidates = allPictographs.filter((p) => {
      if (p.startPosition !== endPosition) return false;
      const pEndGroup = this.positionAnalyzer.getEndPositionGroup(
        p.endPosition as GridPosition
      );
      return pEndGroup === startGroup;
    });

    if (bridgeCandidates.length === 0) {
      return [];
    }

    // Group candidates by letter and ending position
    const uniqueBridges = this.groupByLetterAndPosition(bridgeCandidates);

    // For each unique bridge, analyze available LOOPs
    return this.analyzeBridgeCandidates(
      sequence,
      uniqueBridges,
      startPosition,
      endPosition,
      /* excludeRewound */ true
    );
  }

  /**
   * Get all extension options that would bring the sequence to a loopable position.
   */
  async getAllExtensionOptions(
    sequence: SequenceData
  ): Promise<CircularizationOption[]> {
    const startPosition = this.sequenceAnalyzer.getStartPosition(sequence);
    const endPosition = this.sequenceAnalyzer.getCurrentEndPosition(sequence);

    if (!startPosition || !endPosition) {
      return [];
    }

    // Extract the position GROUP from start position (alpha, beta, gamma)
    const startGroup = this.positionAnalyzer.getEndPositionGroup(startPosition);
    if (!startGroup) {
      return [];
    }

    const gridMode = sequence.gridMode || GridMode.DIAMOND;

    // Get all pictographs
    const allPictographs =
      await this.letterQueryHandler.getAllPictographVariations(gridMode);

    // Find pictographs that:
    // 1. Start at the sequence's current end position
    // 2. End in the SAME position group as the sequence start (for loopability)
    const extensionCandidates = allPictographs.filter((p) => {
      if (p.startPosition !== endPosition) return false;
      const endGroup = this.positionAnalyzer.getEndPositionGroup(
        p.endPosition as GridPosition
      );
      return endGroup === startGroup;
    });

    if (extensionCandidates.length === 0) {
      return [];
    }

    // Group candidates by letter and ending position
    const uniqueExtensions = this.groupByLetterAndPosition(extensionCandidates);

    // For each unique extension, analyze available LOOPs (include REWOUND)
    return this.analyzeBridgeCandidates(
      sequence,
      uniqueExtensions,
      startPosition,
      endPosition,
      /* excludeRewound */ false
    );
  }

  /**
   * Group pictograph candidates by letter and ending position to avoid duplicates.
   */
  private groupByLetterAndPosition(
    candidates: PictographData[]
  ): Map<
    string,
    { letter: Letter; endPosition: string; pictographData: PictographData }
  > {
    const uniqueMap = new Map<
      string,
      { letter: Letter; endPosition: string; pictographData: PictographData }
    >();

    for (const variation of candidates) {
      const key = `${variation.letter}|${variation.endPosition}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          letter: variation.letter as Letter,
          endPosition: variation.endPosition || "",
          pictographData: variation,
        });
      }
    }

    return uniqueMap;
  }

  /**
   * Analyze available LOOPs for a position pair (inline version of SequenceExtender.analyzeSequence).
   * Avoids circular dependency by using loopValidator directly.
   */
  private getAvailableLOOPs(
    startPosition: GridPosition,
    newEndPosition: GridPosition
  ): {
    available: LOOPOption[];
    period: Period;
  } {
    const positionPair = `${startPosition},${newEndPosition}`;
    const isHalvedValid = HALVED_LOOPS.has(positionPair);
    const isQuarteredValid = QUARTERED_LOOPS.has(positionPair);
    const isAlreadyComplete = newEndPosition === startPosition;

    let period = Period.HALVED;
    if (isQuarteredValid) {
      period = Period.QUARTERED;
    }

    // Get LOOP options from validator
    const { available } = this.loopValidator.getLOOPOptionsForPositionPair(
      startPosition,
      newEndPosition,
      period
    );

    // If it's already complete or has valid LOOP position, return available options
    if (isAlreadyComplete || isHalvedValid || isQuarteredValid) {
      return { available, period };
    }

    return { available: [], period };
  }

  /**
   * Analyze bridge candidates and create CircularizationOption objects.
   */
  private analyzeBridgeCandidates(
    sequence: SequenceData,
    uniqueBridges: Map<
      string,
      { letter: Letter; endPosition: string; pictographData: PictographData }
    >,
    startPosition: GridPosition,
    _currentEndPosition: GridPosition,
    excludeRewound: boolean
  ): CircularizationOption[] {
    const options: CircularizationOption[] = [];

    for (const [_, bridge] of uniqueBridges) {
      // Get available LOOPs for the new position pair (start → bridge end)
      const { available } = this.getAvailableLOOPs(
        startPosition,
        bridge.endPosition as GridPosition
      );

      let availableLOOPs = available;

      if (excludeRewound) {
        availableLOOPs = availableLOOPs.filter(
          (opt) => opt.loopType !== LOOPType.STRICT_REWOUND
        );
      }

      if (availableLOOPs.length > 0) {
        // Calculate rotation relationship and orientation alignment
        const rotationRelation = this.positionAnalyzer.getRotationRelation(
          startPosition,
          bridge.endPosition as GridPosition
        );

        const currentLength = sequence.steps?.length || 0;

        let orientationAlignment: OrientationAlignment | undefined;
        let repetitionsNeeded: 1 | 2 | 4 = 1;

        if (rotationRelation === "exact") {
          orientationAlignment =
            this.orientationCalculator.calculateOrientationAlignment(
              sequence,
              bridge.pictographData
            ) || undefined;
          repetitionsNeeded = orientationAlignment?.repetitionsNeeded || 1;
        }

        const resultingLength =
          this.orientationCalculator.calculateResultingLength(
            currentLength,
            rotationRelation,
            repetitionsNeeded
          );

        options.push({
          bridgeLetters: [bridge.letter],
          endPosition: bridge.endPosition,
          availableLOOPs: availableLOOPs,
          description: excludeRewound
            ? `Add "${bridge.letter}" to end at ${bridge.endPosition}`
            : `Add "${bridge.letter}" → ${bridge.endPosition}`,
          pictographData: bridge.pictographData,
          rotationRelation: rotationRelation || undefined,
          orientationAlignment,
          currentLength,
          resultingLength,
        });
      }
    }

    return options;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler";
import { positionAnalyzer } from "$lib/features/create/construct/option-picker/services/position-analyzer";
import { loopValidator } from "./loop-validator";
import { sequenceAnalyzer } from "./sequence-analyzer";
import * as orientationAlignmentCalculatorModule from "./orientation-alignment-calculator";
const orientationAlignmentCalculator: OrientationAlignmentCalculator = {
  calculateOrientationAlignment: orientationAlignmentCalculatorModule.calculateOrientationAlignment,
  calculateResultingLength: orientationAlignmentCalculatorModule.calculateResultingLength,
};

export const bridgeFinder = new BridgeFinder(
  letterQueryHandler,
  positionAnalyzer,
  loopValidator,
  sequenceAnalyzer,
  orientationAlignmentCalculator
);
