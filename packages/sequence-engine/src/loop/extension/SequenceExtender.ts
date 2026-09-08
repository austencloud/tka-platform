/**
 * Sequence Extender
 *
 * Detects when a sequence is in an extendable state and generates extension
 * steps using the LOOP executor infrastructure.
 *
 * Analyzes position relationships between start and end to determine:
 * - Whether the sequence can be extended with a LOOP pattern
 * - Which LOOP types are available for the current position pair
 * - What extension steps to generate
 *
 * The app version has deeper integration with bridge-finding, pictograph queries,
 * and letter derivation. This engine version focuses on the core analysis and
 * execution logic that doesn't require browser-side services.
 *
 * Ported from app's SequenceExtender.ts.
 */

import type { SequenceStep } from "../../core/types/sequence-engine-types.js";
import { LOOPType, Period, type LOOPOption, type LOOPValidationResult } from "../loop-types.js";
import {
  HALVED_LOOPS,
  QUARTERED_LOOPS,
} from "../position-maps/circular-position-maps.js";
import {
  getLOOPOptionsForPositionPair,
} from "../validation/LOOPValidator.js";
import { loopExecutorSelector, type LOOPExecutorSelector } from "../execution/LOOPExecutorSelector.js";
import { closeOrientationCycle } from "../execution/orientation-cycle.js";


/**
 * Categorizes how a sequence can be extended.
 */
export type ExtensionType =
  | "already_complete"
  | "half_rotation"
  | "quarter_rotation"
  | "not_extendable";

/**
 * Analysis of a sequence's extension possibilities.
 */
export interface ExtensionAnalysis {
  canExtend: boolean;
  extensionType: ExtensionType;
  startPosition: string | null;
  currentEndPosition: string | null;
  availableLOOPOptions: LOOPOption[];
  unavailableLOOPOptions: Array<LOOPOption & { reason?: string }>;
  description: string;
}

/**
 * Options for generating extension steps.
 */
export interface ExtensionOptions {
  loopType: LOOPType;
  period?: Period;
}


export class SequenceExtender {
  constructor(private readonly executorSelector: LOOPExecutorSelector) {}

  /**
   * Analyze a sequence to determine if it can be extended with LOOP patterns.
   * @param steps - Full step array (step 0 = start position, rest = steps)
   * @returns Analysis of extension possibilities
   */
  analyzeSequence(steps: SequenceStep[]): ExtensionAnalysis {
    const startPosition = getStartPosition(steps);
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

    const currentEndPosition = getCurrentEndPosition(steps);
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
    const { available, unavailable } = getLOOPOptionsForPositionPair(
      startPosition,
      currentEndPosition,
      period
    );

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
      description = `${available.length} patterns available (180 degree rotation)`;
    } else if (isQuarteredValid) {
      description = `${available.length} patterns available (90 degree rotation)`;
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
   * Generate extension steps for a sequence using a LOOP executor.
   * @param steps - Full step array (step 0 = start position, rest = steps)
   * @param options - LOOP type and period for extension
   * @returns New steps to append after the original sequence
   */
  generateExtensionSteps(
    steps: SequenceStep[],
    options: ExtensionOptions
  ): SequenceStep[] {
    const analysis = this.analyzeSequence(steps);

    if (!analysis.canExtend) {
      throw new Error(`Cannot extend: ${analysis.description}`);
    }

    const { loopType } = options;
    const period =
      options.period ??
      (analysis.extensionType === "quarter_rotation"
        ? Period.QUARTERED
        : Period.HALVED);

    // Get the executor for the selected LOOP type
    const executor = this.executorSelector.getExecutor(loopType);

    const letterSteps = steps.filter((step) => step.stepNumber > 0);

    if (letterSteps.length === 0) {
      throw new Error("No letter steps in sequence to extend");
    }

    const originalLength = letterSteps.length;
    const input = steps.map((step) => ({
      ...step,
      motions: {
        left: { ...step.motions.left },
        right: { ...step.motions.right },
      },
    }));
    const structurallyCompleted = executor.executeLOOP(input, period);
    const completed = closeOrientationCycle(structurallyCompleted, {
      seedStepCount: originalLength,
    });

    return completed.steps.filter(
      (step) => step.stepNumber > originalLength
    );
  }
}


function getStartPosition(steps: SequenceStep[]): string | null {
  const startStep = steps.find((step) => step.stepNumber === 0);
  return startStep?.startPosition ?? null;
}

function getCurrentEndPosition(steps: SequenceStep[]): string | null {
  const letterSteps = steps.filter((step) => step.stepNumber > 0);
  if (letterSteps.length === 0) return null;
  return letterSteps[letterSteps.length - 1]!.endPosition;
}


export const sequenceExtender = new SequenceExtender(loopExecutorSelector);
