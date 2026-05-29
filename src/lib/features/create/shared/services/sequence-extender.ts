/**
 * Sequence Extender Implementation
 *
 * Detects when a sequence is in an extendable state and generates extension steps
 * using the LOOP (Linked Orbital Offset Pattern) executor infrastructure.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { GridMode, type GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { LOOPOption } from "./loop-validator";
import type { OrientationAlignment } from "./orientation-alignment-calculator";
import { Period, type LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

/**
 * Describes the type of extension available for a sequence
 */
export type ExtensionType =
  | "already_complete"
  | "half_rotation"
  | "quarter_rotation"
  | "not_extendable";

/**
 * Result of analyzing whether a sequence can be extended
 */
export interface ExtensionAnalysis {
  /** Whether extension is available */
  canExtend: boolean;
  /** The type of extension possible */
  extensionType: ExtensionType;
  /** Start position of the sequence */
  startPosition: GridPosition | null;
  /** Current end position of the sequence */
  currentEndPosition: GridPosition | null;
  /** Available LOOP options for extension */
  availableLOOPOptions: LOOPOption[];
  /** Unavailable LOOP options */
  unavailableLOOPOptions: LOOPOption[];
  /** Human-readable description of the extension */
  description: string;
}

/**
 * Options for generating extension steps
 */
export interface ExtensionOptions {
  /** The LOOP type to use for extension */
  loopType: LOOPType;
  /** Period override */
  period?: Period;
  /** Difficulty level (1-3) */
  difficulty?: number;
  /** Turn intensity (0-1) */
  turnIntensity?: number;
}

/**
 * Describes the rotation relationship between end position and start position.
 */
export type RotationRelation =
  | "exact"
  | "quarter"
  | "half";

/**
 * Option for making a non-loopable sequence circular via bridge letter.
 */
export interface CircularizationOption {
  /** Bridge letters needed to reach a loopable position */
  bridgeLetters: Letter[];
  /** The position we'd end at after adding bridge letters */
  endPosition: string;
  /** Available LOOP types for this ending position */
  availableLOOPs: LOOPOption[];
  /** Description for UI display */
  description: string;
  /** Pictograph data for visual display of the bridge letter */
  pictographData?: PictographData;
  /** Rotation relationship to start position */
  rotationRelation?: RotationRelation;
  /** Orientation alignment info */
  orientationAlignment?: OrientationAlignment;
  /** Current sequence length */
  currentLength?: number;
  /** Resulting sequence length after applying LOOP with this bridge */
  resultingLength?: number;
}

/**
 * Result of starting an extension flow
 */
export interface ExtensionFlowStart {
  /** Whether extension is possible at all */
  canExtend: boolean;
  /** Analysis of the sequence's extension potential */
  analysis: ExtensionAnalysis | null;
  /** Bridge options if direct LOOPs not available */
  circularizationOptions: CircularizationOption[];
  /** Reason direct extension isn't available (if applicable) */
  directUnavailableReason: string | null;
  /** Error message if extension is impossible */
  errorMessage: string | null;
}

/**
 * Result of appending a bridge beat
 */
export interface BridgeAppendResult {
  /** Whether the bridge was successfully appended */
  success: boolean;
  /** The sequence with bridge appended (if successful) */
  sequence: SequenceData | null;
  /** Updated analysis after adding bridge */
  analysis: ExtensionAnalysis | null;
  /** Message to display to user */
  message: string;
}

/**
 * Result of applying a LOOP extension
 */
export interface ExtensionApplyResult {
  /** Whether the extension was successful */
  success: boolean;
  /** The extended sequence (if successful) */
  sequence: SequenceData | null;
  /** Number of steps added */
  stepsAdded: number;
  /** Message to display to user */
  message: string;
}
import type { LOOPExecutorSelector } from "$lib/features/create/generate/circular/services/loop-executor-selector";
import type { ReversalDetector } from "$lib/shared/create/services/reversal-detector";
import type { ILetterQueryHandler, IMotionQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { stepConverter as StepConverterSingleton } from "$lib/features/create/generate/shared/services/step-converter";
type StepConverter = typeof StepConverterSingleton;
import type { OrientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import type { LOOPValidator } from "./loop-validator";
import type { SequenceAnalyzer } from "./sequence-analyzer";
import type { BridgeFinder } from "./bridge-finder";
import { recalculateAllOrientations } from "$lib/shared/create/services/orientation-propagation";
import {
  HALVED_LOOPS,
  QUARTERED_LOOPS,
} from "$lib/shared/foundation/domain/models/generation/circular-position-maps";

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
    private motionQueryHandler: IMotionQueryHandler
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
    pictographData?: PictographData
  ): Promise<SequenceData> {
    const endPosition = this.sequenceAnalyzer.getCurrentEndPosition(sequence);
    if (!endPosition) {
      throw new Error("Cannot append bridge: no end position found");
    }

    const gridMode = sequence.gridMode || GridMode.DIAMOND;

    let bridgeVariation: PictographData;

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
    pictographData?: PictographData,
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
import { loopExecutorSelector } from "$lib/features/create/generate/circular/services/loop-executor-selector";
import { reversalDetector } from "$lib/shared/create/services/reversal-detector";
import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler";
import { stepConverter } from "$lib/features/create/generate/shared/services/step-converter";
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import { loopValidator } from "./loop-validator";
import { sequenceAnalyzer } from "./sequence-analyzer";
import { bridgeFinder } from "./bridge-finder";
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/implementations/MotionQueryHandler";

export const sequenceExtender = new SequenceExtender(
  loopExecutorSelector,
  reversalDetector,
  letterQueryHandler,
  stepConverter,
  orientationCalculator,
  loopValidator,
  sequenceAnalyzer,
  bridgeFinder,
  motionQueryHandler
);
