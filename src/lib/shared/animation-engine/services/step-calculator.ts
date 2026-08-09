/**
 * Beat Calculation Service
 *
 * Focused service for beat indexing and progress calculations.
 * Single responsibility: Beat timing and progress calculations.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { Step } from "@tka/tka-types";

export interface StepCalculationResult {
  currentStepIndex: number;
  stepProgress: number;
  currentStepData: StepData;
  isValid: boolean;
}

/**
 * Calculate current beat index and progress from animation time
 * EXACT LOGIC FROM STANDALONE ANIMATOR
 */
export function calculateBeatState(
  currentStep: number,
  steps: readonly StepData[],
  totalSteps: number
): StepCalculationResult {
  // Validate inputs
  if (steps.length === 0 || totalSteps === 0) {
    return {
      currentStepIndex: 0,
      stepProgress: 0,
      currentStepData: steps[0]!,
      isValid: false,
    };
  }

  // ✅ PURE DOMAIN LOGIC - Direct beat access!
  const clampedStep = Math.max(0, Math.min(currentStep, totalSteps));
  const currentStepIndex = Math.floor(
    clampedStep === totalSteps ? totalSteps - 1 : clampedStep
  );
  const stepProgress =
    clampedStep === totalSteps ? 1.0 : clampedStep - currentStepIndex;

  const currentStepData = steps[currentStepIndex]!;

  return {
    currentStepIndex,
    stepProgress,
    currentStepData,
    isValid: true,
  };
}

/**
 * Beat number to DISPLAY (glyph letter, step number, path lines) for a given
 * currentStep. Returns 0 for the start position, N for beat N.
 *
 * An integer currentStep is ambiguous: it is both the end of beat N-1's motion
 * and the start of beat N's. Two attribution conventions exist:
 *
 * - Continuous / seek convention (dwellOnCompletedBeat = false): beat N owns
 *   [N, N+1) — plain floor. Correct while time flows through the boundary, and
 *   for explicit beat selection (step-cell click parks at N to preview beat N).
 *
 * - Step-dwell convention (dwellOnCompletedBeat = true): the boundary belongs
 *   to the beat whose motion just COMPLETED — ceil(currentStep - 1). Step
 *   playback parks on integer boundaries for its pause; during that freeze the
 *   props hold the completed beat's END position, so the glyph must keep
 *   showing the completed beat's letter (a pictograph = motion + end position).
 *   Labeling the freeze with the upcoming beat describes a motion not yet seen.
 */
export function displayedBeatNumber(
  currentStep: number,
  dwellOnCompletedBeat: boolean,
  epsilon = 0.01
): number {
  if (dwellOnCompletedBeat) {
    const rounded = Math.round(currentStep);
    if (Math.abs(currentStep - rounded) < epsilon) {
      return Math.max(0, rounded - 1);
    }
  }
  return Math.floor(currentStep);
}

/**
 * Keep a displayed beat inside the sequence's real motion beats. Freeform
 * playback adds one timeline beat after the final motion so the ending pose
 * can stay on screen; that hold still belongs to the final pictograph.
 */
export function clampDisplayedBeatNumber(
  beatNumber: number,
  totalMotionBeats: number
): number {
  if (totalMotionBeats <= 0) return 0;
  return Math.max(0, Math.min(beatNumber, totalMotionBeats));
}

/**
 * Validate step data array
 */
export function validateSteps(steps: readonly Step[]): boolean {
  if (!Array.isArray(steps)) {
    console.error("StepCalculator: steps is not an array");
    return false;
  }

  if (steps.length === 0) {
    console.error("StepCalculator: steps array is empty");
    return false;
  }

  const isValid = steps.every((step, index) => {
    const valid =
      step && typeof step.stepNumber === "number" && step.stepNumber >= 0;
    if (!valid) {
      console.error(`StepCalculator: Invalid step at index ${index}:`, {
        step,
        hasStep: !!step,
        stepNumber: step?.stepNumber,
        stepNumberType: typeof step?.stepNumber,
      });
    }
    return valid;
  });

  return isValid;
}

/**
 * Get beat by index with bounds checking
 */
export function getStepSafely(steps: readonly StepData[], index: number): StepData | null {
  if (index < 0 || index >= steps.length) {
    return null;
  }
  return steps[index] ?? null;
}

/**
 * Calculate total duration of sequence
 */
export function calculateTotalDuration(steps: readonly Step[]): number {
  if (steps.length === 0) {
    return 0;
  }
  // Default to 1 if duration is undefined (defensive)
  return steps.reduce((sum, step) => sum + (step.duration ?? 1), 0);
}

/**
 * Find beat by beat number
 */
export function findStepByNumber(
  steps: readonly StepData[],
  stepNumber: number
): StepData | null {
  return steps.find((step) => step.stepNumber === stepNumber) ?? null;
}

/**
 * Map a time position to beat index and progress within that beat.
 * Accounts for variable beat durations.
 *
 * Example: steps with durations [1.0, 2.0, 1.5, 1.0] (total = 5.5)
 * - timePosition 0.5 → beat 0, progress 0.5
 * - timePosition 1.0 → beat 1, progress 0.0
 * - timePosition 2.0 → beat 1, progress 0.5 (halfway through 2.0 duration)
 * - timePosition 3.0 → beat 2, progress 0.0
 * - timePosition 3.75 → beat 2, progress 0.5 (halfway through 1.5 duration)
 */
export function mapTimePositionToBeat(
  timePosition: number,
  steps: readonly Step[]
): { stepIndex: number; stepProgress: number } {
  if (steps.length === 0) {
    return { stepIndex: 0, stepProgress: 0 };
  }

  // Clamp to valid range - note: don't recalculate total (use cached if possible)
  let totalDuration = 0;
  for (const step of steps) {
    totalDuration += step.duration ?? 1;
  }
  const clampedTime = Math.max(0, Math.min(timePosition, totalDuration));

  // Find which beat we're in by accumulating durations
  let accumulatedTime = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const stepDuration = step.duration ?? 1;
    const beatEndTime = accumulatedTime + stepDuration;

    if (clampedTime < beatEndTime || i === steps.length - 1) {
      // We're in this beat
      const timeInBeat = clampedTime - accumulatedTime;
      const stepProgress = stepDuration > 0 ? timeInBeat / stepDuration : 0;
      return {
        stepIndex: i,
        stepProgress: Math.min(stepProgress, 1.0),
      };
    }

    accumulatedTime = beatEndTime;
  }

  // Fallback (shouldn't reach here)
  return { stepIndex: steps.length - 1, stepProgress: 1.0 };
}

/**
 * Calculate the time position where a specific beat starts.
 * @param stepIndex - The 0-based beat index
 * @param steps - Array of step data
 * @returns The cumulative time position where this beat begins
 */
export function getStepStartTime(stepIndex: number, steps: readonly Step[]): number {
  if (stepIndex <= 0 || steps.length === 0) {
    return 0;
  }

  let accumulatedTime = 0;
  const clampedIndex = Math.min(stepIndex, steps.length);

  for (let i = 0; i < clampedIndex; i++) {
    accumulatedTime += steps[i]!.duration ?? 1;
  }

  return accumulatedTime;
}

/**
 * Calculate beat state using duration-aware timing.
 * Uses actual beat durations to determine current beat and progress.
 */
export function calculateBeatStateDurationAware(
  timePosition: number,
  steps: readonly StepData[]
): StepCalculationResult {
  if (steps.length === 0) {
    return {
      currentStepIndex: 0,
      stepProgress: 0,
      currentStepData: steps[0]!,
      isValid: false,
    };
  }

  const { stepIndex, stepProgress } = mapTimePositionToBeat(
    timePosition,
    steps
  );
  const currentStepData = steps[stepIndex]!;

  return {
    currentStepIndex: stepIndex,
    stepProgress,
    currentStepData,
    isValid: true,
  };
}
