/**
 * Sequence Extender Implementation
 *
 * Detects when a sequence is in an extendable state and generates extension steps
 * using the LOOP (Linked Orbital Offset Pattern) executor infrastructure.
 */

import type { StepData } from "../../domain/models/StepData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { ExtensionAnalysis, ExtensionOptions, ExtensionType, CircularizationOption } from "../contracts/types";
import type { LOOPExecutorSelector } from "$lib/features/create/generate/circular/services/implementations/LOOPExecutorSelector";
import type { ReversalDetector } from "../reversal-detector";
import type { ILetterQueryHandler, IMotionQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { stepConverter as StepConverterSingleton } from "$lib/features/create/generate/shared/services/step-converter";
type StepConverter = typeof StepConverterSingleton;
import type { OrientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import type { LOOPValidator } from "./LOOPValidator";
import type { SequenceAnalyzer } from "./SequenceAnalyzer";
import type { BridgeFinder } from "./BridgeFinder";
import type { GridModeDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridModeDeriver";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { recalculateAllOrientations } from "./sequence-transforms/orientation-propagation";
import {
  HALVED_LOOPS,
  QUARTERED_LOOPS,
} from "$lib/features/create/generate/circular/domain/constants/circular-position-maps";
import type {
  LOOPType} from "$lib/features/create/generate/circular/domain/models/circular-models";
import {
  Period,
} from "$lib/features/create/generate/circular/domain/models/circular-models";

export class SequenceExtender {
  constructor(
    private loopExecutorSelector: LOOPExecutorSelector,
    private reversalDetector: ReversalDetector,
    private letterQueryHandler: ILetterQueryHandler,
    private stepConverter: StepConverter,
    private orientationCalculator: OrientationCalculator,
    private loopValidator: LOOPValidator,
    private sequenceAnalyzer: SequenceAnalyzer,
    private bridgeFinder: BridgeFinder,
    private motionQueryHandler: IMotionQueryHandler,
    private gridModeDeriver: GridModeDeriver
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
        description: "No steps in sequence",
      };
    }

    // Check position relationships
    const positionPair = `${startPosition},${currentEndPosition}`;
    const isHalvedValid = HALVED_LOOPS.has(positionPair);
    const isQuarteredValid = QUARTERED_LOOPS.has(positionPair);
    const isAlreadyComplete = currentEndPosition === startPosition;

    // Determine extension type
    let extensionType: ExtensionType = "not_extendable";
    let period = Period.HALVED;

    if (isAlreadyComplete) {
      extensionType = "already_complete";
    } else if (isHalvedValid) {
      extensionType = "half_rotation";
    } else if (isQuarteredValid) {
      extensionType = "quarter_rotation";
      period = Period.QUARTERED;
    }

    // Get LOOP options filtered by validity for this position pair
    const { available, unavailable } =
      this.loopValidator.getLOOPOptionsForPositionPair(
        startPosition,
        currentEndPosition,
        period
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
   * Generate steps to extend a sequence back to its starting position
   */
  async generateExtensionSteps(
    sequence: SequenceData,
    options: ExtensionOptions
  ): Promise<StepData[]> {
    const analysis = this.analyzeSequence(sequence);

    if (!analysis.canExtend) {
      throw new Error(`Cannot extend: ${analysis.description}`);
    }

    const { loopType } = options;
    // Use explicitly provided period, otherwise derive from position pair analysis
    const period = options.period ??
      (analysis.extensionType === "quarter_rotation"
        ? Period.QUARTERED
        : Period.HALVED);

    // Get the executor for the selected LOOP type
    const executor = this.loopExecutorSelector.getExecutor(loopType);

    // Convert sequence to StepData array for the executor
    const sequenceSteps =
      this.sequenceAnalyzer.convertSequenceToBeats(sequence);

    if (sequenceSteps.length === 0) {
      throw new Error("No steps in sequence to extend");
    }

    // IMPORTANT: Save original length BEFORE executing, since executor modifies array in place
    const originalLength = sequenceSteps.length;

    // Execute the LOOP transformation (modifies sequenceSteps in place)
    const completedSteps = executor.executeLOOP(sequenceSteps, period);

    // Return only the new steps (after the original sequence)
    const newSteps = completedSteps.slice(originalLength);

    return newSteps;
  }

  /**
   * Extend a sequence by appending the generated extension steps
   */
  async extendSequence(
    sequence: SequenceData,
    options: ExtensionOptions
  ): Promise<SequenceData> {
    const extensionSteps = await this.generateExtensionSteps(sequence, options);

    if (extensionSteps.length === 0) {
      return sequence;
    }

    // Renumber the extension steps to continue from the existing sequence
    const existingStepCount = sequence.steps?.length || 0;

    // IMPORTANT: The LOOP executors copy the letter from the source step,
    // but the motions are transformed (reversed, rotated, etc.), so the letter
    // is WRONG. We need to derive the correct letter from the transformed motions.
    const stepsWithDerivedLetters = await Promise.all(
      extensionSteps.map(async (beat, index) => {
        const derivedLetter = await this.deriveLetterForStep(beat, sequence.gridMode || GridMode.DIAMOND);
        return {
          ...beat,
          stepNumber: existingStepCount + index + 1,
          letter: derivedLetter ?? beat.letter, // Use derived letter, fall back to original if derivation fails
        };
      })
    );

    // Combine existing steps with extension steps
    const newSteps = [...(sequence.steps || []), ...stepsWithDerivedLetters];

    // Build the updated word from all step letters
    const word = newSteps.map((step) => step.letter ?? "").join("");

    let extendedSequence: SequenceData = {
      ...sequence,
      steps: newSteps,
      word,
      isCircular: true,
      loopType: options.loopType,
    };

    // Recalculate all orientations through the combined sequence.
    // The LOOP executor updates orientations on engine-format fields (blueMotion/redMotion),
    // but the app reads from motions.blue/motions.red. Without this recalculation,
    // the motions field carries stale orientations from the source step's spread,
    // causing the choreo card to render wrong prop angles.
    extendedSequence = recalculateAllOrientations(
      extendedSequence,
      this.orientationCalculator
    );

    // Process reversals for the extended sequence
    // This detects rotation direction changes between consecutive steps
    return this.reversalDetector.processReversals(extendedSequence);
  }

  /**
   * Derive the correct letter for a step based on its motion configuration.
   * Used after LOOP transformations to find what letter the transformed motions represent.
   */
  private async deriveLetterForStep(
    step: StepData,
    gridMode: GridMode
  ): Promise<Letter | null> {
    const blueMotion = step.motions?.blue;
    const redMotion = step.motions?.red;

    if (!blueMotion || !redMotion) {
      return null;
    }

    try {
      const letter = await this.motionQueryHandler.findLetterByMotionConfiguration(
        blueMotion,
        redMotion,
        gridMode
      );
      return letter as Letter | null;
    } catch (error) {
      console.warn(
        `Failed to derive letter for step ${step.stepNumber}:`,
        error
      );
      return null;
    }
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
    const bridgeBeat = this.stepConverter.convertToStep(
      bridgeVariation,
      (sequence.steps?.length || 0) + 1,
      gridMode
    );

    // Create sequence with bridge letter
    let extendedSequence: SequenceData = {
      ...sequence,
      steps: [...(sequence.steps || []), bridgeBeat],
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
    loopType: LOOPType,
    pictographData?: import("$lib/shared/pictograph/shared/domain/models/PictographData").PictographData,
    period?: Period
  ): Promise<SequenceData> {
    // Use appendBridgeBeat to add the bridge, then apply LOOP
    // Pass pictographData to ensure the exact variation (and thus end position) is used
    const sequenceWithBridge = await this.appendBridgeBeat(
      sequence,
      bridgeLetter,
      pictographData
    );
    return this.extendSequence(sequenceWithBridge, { loopType, period });
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { loopExecutorSelector } from "$lib/features/create/generate/circular/services/implementations/LOOPExecutorSelector";
import { reversalDetector } from "../reversal-detector";
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler";
import { stepConverter } from "$lib/features/create/generate/shared/services/step-converter";
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import { loopValidator } from "./LOOPValidator";
import { sequenceAnalyzer } from "./SequenceAnalyzer";
import { bridgeFinder } from "./BridgeFinder";
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler";
import { gridModeDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridModeDeriver";

export const sequenceExtender = new SequenceExtender(
  loopExecutorSelector,
  reversalDetector,
  letterQueryHandler,
  stepConverter,
  orientationCalculator,
  loopValidator,
  sequenceAnalyzer,
  bridgeFinder,
  motionQueryHandler,
  gridModeDeriver
);
