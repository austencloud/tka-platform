/**
 * reversal-detector.ts
 *
 * Detects reversals between steps in sequences based on prop rotation direction changes.
 * Ported from desktop app's ReversalDetector logic.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createStepData } from "$lib/shared/create/factories/create-step-data";

/**
 * Reversal Detection Service Contract
 */
export interface ReversalInfo {
  blueReversal: boolean;
  redReversal: boolean;
}

export interface PictographWithReversals extends PictographData {
  blueReversal: boolean;
  redReversal: boolean;
}

/**
 * Process reversals for an entire sequence.
 *
 * For loop sequences (rotated, mirrored, etc.) the last beats wrap into the
 * first beats, so beat 1's "previous" context includes the tail of the
 * sequence. We build a virtual prefix from the end of the sequence so that
 * early beats can detect reversals across the loop boundary.
 */
export function processReversals(sequence: SequenceData): SequenceData {
  const isLoop = !!sequence.loopType;
  const steps = sequence.steps;
  const processedBeats: StepData[] = [];

  for (let i = 0; i < steps.length; i++) {
    const currentStep = steps[i]!;

    // For loop sequences, early beats that have no prior context (or only
    // noRotation predecessors) can look back through the tail of the sequence.
    // We concatenate the full sequence before the current slice so that
    // _getLastValidPropRotDir can walk backwards across the loop boundary.
    let previousSteps: StepData[];
    if (isLoop && i < steps.length) {
      // Wrap: [...allBeats, ...beatsBeforeCurrent]
      previousSteps = [...steps, ...steps.slice(0, i)];
    } else {
      previousSteps = steps.slice(0, i);
    }

    const reversalInfo = detectReversal(previousSteps, currentStep);
    const processedBeat = applyReversalSymbols(currentStep, reversalInfo);

    processedBeats.push(processedBeat);
  }

  return {
    ...sequence,
    steps: processedBeats,
  };
}

/**
 * Detect reversal for a single beat based on previous steps
 */
export function detectReversal(
  previousSteps: StepData[],
  currentStep: StepData
): ReversalInfo {
  const reversalInfo: ReversalInfo = {
    blueReversal: false,
    redReversal: false,
  };

  if (currentStep.isBlank) {
    return reversalInfo;
  }

  // Check blue motion reversal
  const lastBluePropRotDir = getLastValidPropRotDir(previousSteps, "blue");
  const currentBluePropRotDir = getPropRotDir(currentStep, "blue");

  if (isReversal(lastBluePropRotDir, currentBluePropRotDir)) {
    reversalInfo.blueReversal = true;
  }

  // Check red motion reversal
  const lastRedPropRotDir = getLastValidPropRotDir(previousSteps, "red");
  const currentRedPropRotDir = getPropRotDir(currentStep, "red");

  if (isReversal(lastRedPropRotDir, currentRedPropRotDir)) {
    reversalInfo.redReversal = true;
  }

  return reversalInfo;
}

/**
 * Apply reversal symbols to a beat
 */
export function applyReversalSymbols(
  stepData: StepData,
  reversalInfo: ReversalInfo
): StepData {
  return createStepData({
    ...stepData,
    blueReversal: reversalInfo.blueReversal,
    redReversal: reversalInfo.redReversal,
  });
}

/**
 * Detect reversal for an option preview based on current sequence.
 * Used to show reversal indicators on options before they're selected.
 */
export function detectReversalForOption(
  currentSequence: StepData[],
  optionPictographData: PictographData
): ReversalInfo {
  const reversalInfo: ReversalInfo = {
    blueReversal: false,
    redReversal: false,
  };

  if (!optionPictographData.motions) {
    return reversalInfo;
  }

  // If sequence is empty, no reversals possible
  if (currentSequence.length === 0) {
    return reversalInfo;
  }

  // Get the last valid prop rotation directions from the current sequence
  const lastBluePropRotDir = getLastValidPropRotDirFromSequence(
    currentSequence,
    "blue"
  );
  const lastRedPropRotDir = getLastValidPropRotDirFromSequence(
    currentSequence,
    "red"
  );

  // Get the prop rotation directions from the option's motion data
  const optionBluePropRotDir = getPropRotDirFromPictographData(
    optionPictographData,
    "blue"
  );
  const optionRedPropRotDir = getPropRotDirFromPictographData(
    optionPictographData,
    "red"
  );

  // Check for reversals
  if (isReversal(lastBluePropRotDir, optionBluePropRotDir)) {
    reversalInfo.blueReversal = true;
  }

  if (isReversal(lastRedPropRotDir, optionRedPropRotDir)) {
    reversalInfo.redReversal = true;
  }

  return reversalInfo;
}

/**
 * Detect reversals for multiple option pictographs at once.
 * Optimized for option picker display where we need to show reversals for all options.
 */
export function detectReversalsForOptions(
  currentSequence: PictographData[],
  options: PictographData[]
): PictographWithReversals[] {
  // If sequence is empty, no reversals possible
  if (currentSequence.length === 0) {
    return options.map((option) => ({
      ...option,
      blueReversal: false,
      redReversal: false,
    }));
  }

  // Get the last valid prop rotation directions from the current sequence
  const lastBluePropRotDir = getLastValidPropRotDirFromPictographs(
    currentSequence,
    "blue"
  );
  const lastRedPropRotDir = getLastValidPropRotDirFromPictographs(
    currentSequence,
    "red"
  );

  // Process each option and add reversal information
  return options.map((option) => {
    const reversalInfo: ReversalInfo = {
      blueReversal: false,
      redReversal: false,
    };

    if (!option.motions) {
      return { ...option, ...reversalInfo };
    }

    // Get the prop rotation directions from the option's motion data
    const optionBluePropRotDir = getPropRotDirFromPictographData(option, "blue");
    const optionRedPropRotDir = getPropRotDirFromPictographData(option, "red");

    // Check for reversals
    if (isReversal(lastBluePropRotDir, optionBluePropRotDir)) {
      reversalInfo.blueReversal = true;
    }

    if (isReversal(lastRedPropRotDir, optionRedPropRotDir)) {
      reversalInfo.redReversal = true;
    }

    return {
      ...option,
      ...reversalInfo,
    };
  });
}

// ============================================================================
// MODULE-PRIVATE HELPERS
// ============================================================================

function getLastValidPropRotDir(
  steps: StepData[],
  color: "blue" | "red"
): string | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const beat = steps[i]!;
    const propRotDir = getPropRotDir(beat, color);

    if (propRotDir && propRotDir !== "noRotation") {
      return propRotDir;
    }
  }
  return null;
}

function getPropRotDir(beat: StepData, color: "blue" | "red"): string | null {
  if (!beat || beat.isBlank) {
    return null;
  }

  // Use current data structure: motions[MotionColor]
  const motionColor = color === "blue" ? MotionColor.BLUE : MotionColor.RED;
  const motionData = beat.motions[motionColor];

  if (!motionData) {
    return null;
  }

  // PRIMARY: Use rotationDirection if present
  if (motionData.rotationDirection) {
    return motionData.rotationDirection;
  }

  // Static and dash motions legitimately have no rotation - the prop doesn't
  // spin during these motions, so rotationDirection is intentionally absent.
  // Treat the missing value as "noRotation" rather than warning.
  if (motionData.motionType === "static" || motionData.motionType === "dash") {
    return "noRotation";
  }

  // Pro/anti/float motions should always have a rotationDirection. If one
  // really is missing here it's bad data - warn and fall through to cw so
  // downstream reversal detection doesn't crash.
  console.warn(
    `Missing rotationDirection for ${color} at step ${beat.stepNumber}. ` +
      `Motion type: ${motionData.motionType}. Defaulting to 'cw'.`
  );

  return "cw";
}

function isReversal(
  lastPropRotDir: string | null,
  currentPropRotDir: string | null
): boolean {
  // If either is null or noRotation, no reversal
  if (
    !lastPropRotDir ||
    !currentPropRotDir ||
    lastPropRotDir === "noRotation" ||
    currentPropRotDir === "noRotation"
  ) {
    return false;
  }

  // If directions are different, it's a reversal
  return lastPropRotDir !== currentPropRotDir;
}

function getLastValidPropRotDirFromSequence(
  steps: StepData[],
  color: "blue" | "red"
): string | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const beat = steps[i];
    if (beat && !beat.isBlank) {
      const propRotDir = getPropRotDir(beat, color);
      if (propRotDir && propRotDir !== "noRotation") {
        return propRotDir;
      }
    }
  }
  return null;
}

function getPropRotDirFromPictographData(
  pictographData: PictographData,
  color: "blue" | "red"
): string | null {
  const motionColor = color === "blue" ? MotionColor.BLUE : MotionColor.RED;
  const motionData = pictographData.motions[motionColor];

  if (!motionData) {
    return null;
  }

  const rotationDirection = motionData.rotationDirection;
  return rotationDirection || null;
}

// ============================================================================
// SINGLETON EXPORT (backward-compatible object form for class consumers)
// ============================================================================
export const reversalDetector = {
  processReversals,
  detectReversal,
  applyReversalSymbols,
  detectReversalForOption,
  detectReversalsForOptions,
};

/** Structural type matching the reversal-detector module's public API. */
export type ReversalDetector = typeof reversalDetector;

function getLastValidPropRotDirFromPictographs(
  pictographs: PictographData[],
  color: "blue" | "red"
): string | null {
  for (let i = pictographs.length - 1; i >= 0; i--) {
    const pictograph = pictographs[i]!;
    if (pictograph.motions) {
      const propRotDir = getPropRotDirFromPictographData(pictograph, color);
      if (propRotDir && propRotDir !== "noRotation") {
        return propRotDir;
      }
    }
  }
  return null;
}
