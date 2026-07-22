/**
 * Turn Pattern Apply (firebase-free)
 *
 * The pure transform half of the turn-pattern service: extract a pattern from a
 * sequence, validate it, and apply it (turn application + forward orientation
 * propagation). Split out of `turn-pattern-manager.ts` so consumers that only
 * transform sequences — the deck variation engine and the firebase-free landing
 * hero pool — can import these without dragging the Firestore CRUD half (and its
 * `$lib/shared/auth/firebase` side effects) into their bundle.
 *
 * `turn-pattern-manager.ts` re-exports everything here for backward compatibility.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type {
  TurnPattern,
  TurnPatternCreateData,
  TurnPatternEntry,
} from "$lib/shared/create/domain/turn-pattern-data";
import {
  createMotionData,
  isVisibleMotion,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionColor,
  type Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { calculateEndOrientation } from "$lib/shared/pictograph/prop/services/orientation-calculator";
import { applyTurnToMotion } from "./apply-turns-to-motion";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("TurnPatternApply");

/**
 * Specifies which hand(s) to apply pattern changes to
 */
export type TargetHand = "blue" | "red" | "both";

/**
 * Result of applying a turn pattern to a sequence
 */
export interface TurnPatternApplyResult {
  /** Whether the application was successful */
  readonly success: boolean;
  /** The modified sequence (if successful) */
  readonly sequence?: SequenceData;
  /** Error message if not successful */
  readonly error?: string;
  /** Number of steps that were modified */
  readonly modifiedSteps?: number;
  /** Warnings about edge cases encountered */
  readonly warnings?: readonly string[];
}

/**
 * Extract a turn pattern from a sequence
 */
export function extractPattern(sequence: SequenceData, name: string): TurnPatternCreateData {
  const entries: TurnPatternEntry[] = [];

  for (let i = 0; i < sequence.steps.length; i++) {
    const beat = sequence.steps[i];
    if (!beat) continue;

    // Invisible placeholder = hand not really there (both-required Step
    // shape): extract null (the "skip this hand" signal), never placeholder turns.
    const blueMotion = isVisibleMotion(beat.motions?.blue) ? beat.motions.blue : undefined;
    const redMotion = isVisibleMotion(beat.motions?.red) ? beat.motions.red : undefined;

    entries.push({
      stepIndex: i,
      blue: blueMotion?.turns ?? null,
      red: redMotion?.turns ?? null,
    });
  }

  return {
    name,
    userId: "", // Will be set when saving
    stepCount: sequence.steps.length,
    entries,
  };
}

/**
 * Apply a turn pattern to a sequence
 */
export function applyPattern(
  pattern: TurnPattern,
  sequence: SequenceData,
  targetHand: TargetHand = "both"
): TurnPatternApplyResult {
  // Validate beat count match
  const validation = validateForSequence(pattern, sequence);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const warnings: string[] = [];
  let modifiedSteps = 0;

  // Step 1: Apply all turn changes
  const updatedSteps: StepData[] = sequence.steps.map((step, stepIndex) => {
    const entry = pattern.entries.find((e) => e.stepIndex === stepIndex);
    if (!entry) return step;

    let stepModified = false;
    const updatedMotions = { ...step.motions };

    // Apply blue turns (if targeting blue or both)
    if (
      (targetHand === "both" || targetHand === "blue") &&
      entry.blue !== null &&
      isVisibleMotion(step.motions?.blue)
    ) {
      const result = applyTurnToMotion(
        entry.blue,
        step.motions.blue,
        MotionColor.BLUE,
        sequence.steps,
        stepIndex
      );
      if (result.motion) {
        updatedMotions.blue = result.motion;
        stepModified = true;
      }
      if (result.warning) {
        warnings.push(`Beat ${stepIndex + 1} blue: ${result.warning}`);
      }
    }

    // Apply red turns (if targeting red or both)
    if (
      (targetHand === "both" || targetHand === "red") &&
      entry.red !== null &&
      isVisibleMotion(step.motions?.red)
    ) {
      const result = applyTurnToMotion(
        entry.red,
        step.motions.red,
        MotionColor.RED,
        sequence.steps,
        stepIndex
      );
      if (result.motion) {
        updatedMotions.red = result.motion;
        stepModified = true;
      }
      if (result.warning) {
        warnings.push(`Beat ${stepIndex + 1} red: ${result.warning}`);
      }
    }

    if (stepModified) {
      modifiedSteps++;
      return { ...step, motions: updatedMotions };
    }
    return step;
  });

  // Step 2: Propagate orientations forward through the sequence
  // This ensures each beat's startOrientation matches the previous beat's endOrientation
  for (let i = 0; i < updatedSteps.length - 1; i++) {
    const currentStep = updatedSteps[i];
    const nextStep = updatedSteps[i + 1];
    if (!currentStep || !nextStep) continue;

    // Propagate blue motion orientation (skip invisible placeholders — the
    // hand isn't really there on that beat)
    if (isVisibleMotion(currentStep.motions?.blue) && isVisibleMotion(nextStep.motions?.blue)) {
      const currentEndOrientation = currentStep.motions.blue.endOrientation;
      const nextStartOrientation = nextStep.motions.blue.startOrientation;

      if (currentEndOrientation !== nextStartOrientation) {
        const updatedNextMotion = updateMotionStartOrientation(
          nextStep.motions.blue,
          currentEndOrientation,
          MotionColor.BLUE
        );

        updatedSteps[i + 1] = {
          ...nextStep,
          motions: {
            ...nextStep.motions,
            blue: updatedNextMotion,
          },
        };
      }
    }

    // Propagate red motion orientation
    if (isVisibleMotion(currentStep.motions?.red) && isVisibleMotion(nextStep.motions?.red)) {
      const currentEndOrientation = currentStep.motions.red.endOrientation;
      const nextStartOrientation = nextStep.motions.red.startOrientation;

      if (currentEndOrientation !== nextStartOrientation) {
        const updatedNextMotion = updateMotionStartOrientation(
          nextStep.motions.red,
          currentEndOrientation,
          MotionColor.RED
        );

        // Get latest step data (might have been updated for blue already)
        const latestNextStep = updatedSteps[i + 1];
        if (!latestNextStep) continue;
        updatedSteps[i + 1] = {
          ...latestNextStep,
          motions: {
            ...latestNextStep.motions,
            red: updatedNextMotion,
          },
        };
      }
    }
  }

  // Create updated sequence
  const updatedSequence: SequenceData = {
    ...sequence,
    steps: updatedSteps,
  };

  logger.log(
    `Applied pattern "${pattern.name}" - modified ${modifiedSteps} steps with propagation`
  );

  return {
    success: true,
    sequence: updatedSequence,
    modifiedSteps,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate that a pattern can be applied to a sequence
 */
export function validateForSequence(
  pattern: TurnPattern,
  sequence: SequenceData
): { valid: boolean; error?: string } {
  if (pattern.stepCount !== sequence.steps.length) {
    return {
      valid: false,
      error: `Pattern has ${pattern.stepCount} steps but sequence has ${sequence.steps.length} steps`,
    };
  }
  return { valid: true };
}

/**
 * Update a motion's start orientation and recalculate end orientation
 */
function updateMotionStartOrientation(
  motion: MotionData,
  newStartOrientation: Orientation,
  color: MotionColor
): MotionData {
  const tempMotion = createMotionData({
    ...motion,
    startOrientation: newStartOrientation,
  });

  const newEndOrientation = calculateEndOrientation(
    tempMotion,
    color
  );

  return createMotionData({
    ...motion,
    startOrientation: newStartOrientation,
    endOrientation: newEndOrientation,
  });
}
