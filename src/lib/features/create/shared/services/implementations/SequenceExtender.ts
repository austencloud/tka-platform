/**
 * Sequence Extender Implementation
 *
 * Detects when a sequence is in an extendable state and generates extension beats
 * using the LOOP (Linked Orbital Offset Pattern) executor infrastructure.
 */

import type { BeatData } from "../../domain/models/BeatData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type {
  ISequenceExtender,
  ExtensionAnalysis,
  ExtensionOptions,
  ExtensionType,
  CircularizationOption,
} from "../contracts/ISequenceExtender";
import type { ILOOPExecutorSelector } from "$lib/features/create/generate/circular/services/contracts/ILOOPExecutorSelector";
import type { IReversalDetector } from "../contracts/IReversalDetector";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { IBeatConverter } from "$lib/features/create/generate/shared/services/contracts/IBeatConverter";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import type { ILOOPValidator } from "../contracts/ILOOPValidator";
import type { ISequenceAnalyzer } from "../contracts/ISequenceAnalyzer";
import type { IBridgeFinder } from "../contracts/IBridgeFinder";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { recalculateAllOrientations } from "./sequence-transforms/orientation-propagation";
import {
  HALVED_LOOPS,
  QUARTERED_LOOPS,
} from "$lib/features/create/generate/circular/domain/constants/circular-position-maps";
import type {
  LOOPType} from "$lib/features/create/generate/circular/domain/models/circular-models";
import {
  SliceSize,
} from "$lib/features/create/generate/circular/domain/models/circular-models";

export class SequenceExtender implements ISequenceExtender {
  constructor(
    private loopExecutorSelector: ILOOPExecutorSelector,
    private reversalDetector: IReversalDetector,
    private letterQueryHandler: ILetterQueryHandler,
    private beatConverter: IBeatConverter,
    private orientationCalculator: IOrientationCalculator,
    private loopValidator: ILOOPValidator,
    private sequenceAnalyzer: ISequenceAnalyzer,
    private bridgeFinder: IBridgeFinder
  ) {}

  /**
   * Analyze a sequence to determine if it can be extended
   */
  analyzeSequence(sequence: SequenceData): ExtensionAnalysis {
    // Get start position from sequence
    const startPosition = this.sequenceAnalyzer.getStartPosition(sequence);
    if (!startPosition) {
      return {
        canExtend: false,
        extensionType: "not_extendable",
        startPosition: null,
        currentEndPosition: null,
        availableLOOPOptions: [],
        unavailableLOOPOptions: [],
        description: "No start position defined",
      };
    }

    // Get current end position from the last beat
    const currentEndPosition =
      this.sequenceAnalyzer.getCurrentEndPosition(sequence);
    if (!currentEndPosition) {
      return {
        canExtend: false,
        extensionType: "not_extendable",
        startPosition,
        currentEndPosition: null,
        availableLOOPOptions: [],
        unavailableLOOPOptions: [],
        description: "No beats in sequence",
      };
    }

    // Check position relationships
    const positionPair = `${startPosition},${currentEndPosition}`;
    const isHalvedValid = HALVED_LOOPS.has(positionPair);
    const isQuarteredValid = QUARTERED_LOOPS.has(positionPair);
    const isAlreadyComplete = currentEndPosition === startPosition;

    // Determine extension type
    let extensionType: ExtensionType = "not_extendable";
    let sliceSize = SliceSize.HALVED;

    if (isAlreadyComplete) {
      extensionType = "already_complete";
    } else if (isHalvedValid) {
      extensionType = "half_rotation";
    } else if (isQuarteredValid) {
      extensionType = "quarter_rotation";
      sliceSize = SliceSize.QUARTERED;
    }

    // Get LOOP options filtered by validity for this position pair
    const { available, unavailable } =
      this.loopValidator.getLOOPOptionsForPositionPair(
        startPosition,
        currentEndPosition,
        sliceSize
      );

    // Can extend if any LOOP options are available
    const canExtend = available.length > 0;

    if (!canExtend) {
      return {
        canExtend: false,
        extensionType: "not_extendable",
        startPosition,
        currentEndPosition,
        availableLOOPOptions: [],
        unavailableLOOPOptions: unavailable,
        description: "No extension patterns available for this position pair",
      };
    }

    let description = "";
    if (isAlreadyComplete) {
      description = `Sequence is complete - ${available.length} LOOP patterns available to extend`;
    } else if (isHalvedValid) {
      description = `${available.length} patterns available (180° rotation)`;
    } else if (isQuarteredValid) {
      description = `${available.length} patterns available (90° rotation)`;
    }

    return {
      canExtend: true,
      extensionType,
      startPosition,
      currentEndPosition,
      availableLOOPOptions: available,
      unavailableLOOPOptions: unavailable,
      description,
    };
  }

  /**
   * Generate beats to extend a sequence back to its starting position
   */
  async generateExtensionBeats(
    sequence: SequenceData,
    options: ExtensionOptions
  ): Promise<BeatData[]> {
    const analysis = this.analyzeSequence(sequence);

    if (!analysis.canExtend) {
      throw new Error(`Cannot extend: ${analysis.description}`);
    }

    const { loopType } = options;
    const sliceSize =
      analysis.extensionType === "quarter_rotation"
        ? SliceSize.QUARTERED
        : SliceSize.HALVED;

    // Get the executor for the selected LOOP type
    const executor = this.loopExecutorSelector.getExecutor(loopType);

    // Convert sequence to BeatData array for the executor
    const sequenceBeats =
      this.sequenceAnalyzer.convertSequenceToBeats(sequence);

    if (sequenceBeats.length === 0) {
      throw new Error("No beats in sequence to extend");
    }

    // IMPORTANT: Save original length BEFORE executing, since executor modifies array in place
    const originalLength = sequenceBeats.length;

    // Execute the LOOP transformation (modifies sequenceBeats in place)
    const completedBeats = executor.executeLOOP(sequenceBeats, sliceSize);

    // Return only the new beats (after the original sequence)
    const newBeats = completedBeats.slice(originalLength);

    return newBeats;
  }

  /**
   * Extend a sequence by appending the generated extension beats
   */
  async extendSequence(
    sequence: SequenceData,
    options: ExtensionOptions
  ): Promise<SequenceData> {
    const extensionBeats = await this.generateExtensionBeats(sequence, options);

    if (extensionBeats.length === 0) {
      return sequence;
    }

    // Renumber the extension beats to continue from the existing sequence
    const existingBeatCount = sequence.beats?.length || 0;
    const renumberedBeats = extensionBeats.map((beat, index) => ({
      ...beat,
      beatNumber: existingBeatCount + index + 1,
    }));

    // Combine existing beats with extension beats
    const newBeats = [...(sequence.beats || []), ...renumberedBeats];

    const extendedSequence: SequenceData = {
      ...sequence,
      beats: newBeats,
      isCircular: true,
      loopType: options.loopType,
    };

    // Process reversals for the extended sequence
    // This detects rotation direction changes between consecutive beats
    return this.reversalDetector.processReversals(extendedSequence);
  }

  // ============ Bridge Letter Methods ============

  /**
   * Get circularization options for a sequence that isn't directly loopable.
   * Delegates to BridgeFinder.
   */
  async getCircularizationOptions(
    sequence: SequenceData
  ): Promise<CircularizationOption[]> {
    return this.bridgeFinder.getCircularizationOptions(sequence);
  }

  /**
   * Get extension options that would bring the sequence to a loopable position.
   * Delegates to BridgeFinder.
   */
  async getAllExtensionOptions(
    sequence: SequenceData
  ): Promise<CircularizationOption[]> {
    return this.bridgeFinder.getAllExtensionOptions(sequence);
  }

  /**
   * Append just a bridge beat to a sequence (without applying LOOP).
   * Used when user selects a bridge pictograph and wants to see it in the sequence
   * before choosing which LOOP to apply.
   *
   * @param sequence The sequence to append to
   * @param bridgeLetter The bridge letter to append
   * @param pictographData Optional specific pictograph to use. If provided, this exact
   *        pictograph will be used instead of randomly selecting a variation.
   */
  async appendBridgeBeat(
    sequence: SequenceData,
    bridgeLetter: Letter,
    pictographData?: import("$lib/shared/pictograph/shared/domain/models/PictographData").PictographData
  ): Promise<SequenceData> {
    const endPosition = this.sequenceAnalyzer.getCurrentEndPosition(sequence);
    if (!endPosition) {
      throw new Error("Cannot append bridge: no end position found");
    }

    const gridMode = sequence.gridMode || GridMode.DIAMOND;

    let bridgeVariation: import("$lib/shared/pictograph/shared/domain/models/PictographData").PictographData;

    // Use the specific pictograph if provided (preferred - ensures correct end position)
    if (pictographData) {
      // Validate that the provided pictograph starts at the current end position
      if (pictographData.startPosition !== endPosition) {
        throw new Error(
          `Provided pictograph for "${bridgeLetter}" starts at "${pictographData.startPosition}" but sequence ends at "${endPosition}"`
        );
      }
      bridgeVariation = pictographData;
    } else {
      // Fallback: Find a pictograph for the bridge letter that starts at current end position
      const allPictographs =
        await this.letterQueryHandler.getAllPictographVariations(gridMode);

      const bridgeVariations = allPictographs.filter(
        (p) => p.letter === bridgeLetter && p.startPosition === endPosition
      );

      if (bridgeVariations.length === 0) {
        throw new Error(
          `No variation of "${bridgeLetter}" starts at position "${endPosition}"`
        );
      }

      // Pick a random variation for variety
      const randomIndex = Math.floor(Math.random() * bridgeVariations.length);
      const selected = bridgeVariations[randomIndex];
      if (!selected) {
        throw new Error("Failed to select bridge variation");
      }
      bridgeVariation = selected;
    }

    // Convert to beat and append
    const bridgeBeat = this.beatConverter.convertToBeat(
      bridgeVariation,
      (sequence.beats?.length || 0) + 1,
      gridMode
    );

    // Create sequence with bridge letter
    let extendedSequence: SequenceData = {
      ...sequence,
      beats: [...(sequence.beats || []), bridgeBeat],
    };

    // Recalculate orientations
    extendedSequence = recalculateAllOrientations(
      extendedSequence,
      this.orientationCalculator
    );

    return extendedSequence;
  }

  /**
   * Extend a sequence by first appending a bridge letter, then applying a LOOP.
   */
  async extendWithBridge(
    sequence: SequenceData,
    bridgeLetter: Letter,
    loopType: LOOPType
  ): Promise<SequenceData> {
    // Use appendBridgeBeat to add the bridge, then apply LOOP
    const sequenceWithBridge = await this.appendBridgeBeat(
      sequence,
      bridgeLetter
    );
    return this.extendSequence(sequenceWithBridge, { loopType });
  }
}
