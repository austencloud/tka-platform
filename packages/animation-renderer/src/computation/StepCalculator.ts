import type { StepData } from "@tka/types";
import type {
  StepCalculationResult,
  IStepCalculator,
} from "../contracts/IStepCalculator";

export class StepCalculator implements IStepCalculator {
  calculateBeatState(
    currentStep: number,
    steps: readonly StepData[],
    totalSteps: number
  ): StepCalculationResult {
    if (steps.length === 0 || totalSteps === 0) {
      return {
        currentStepIndex: 0,
        stepProgress: 0,
        currentStepData: steps[0]!,
        isValid: false,
      };
    }

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

  validateBeats(steps: readonly StepData[]): boolean {
    if (!Array.isArray(steps) || steps.length === 0) return false;
    return steps.every(
      (beat) =>
        beat && typeof beat.stepNumber === "number" && beat.stepNumber >= 0
    );
  }

  getBeatSafely(steps: readonly StepData[], index: number): StepData | null {
    if (index < 0 || index >= steps.length) return null;
    return steps[index] ?? null;
  }

  calculateTotalDuration(steps: readonly StepData[]): number {
    if (steps.length === 0) return 0;
    return steps.reduce((sum, beat) => sum + (beat.duration ?? 1), 0);
  }

  findBeatByNumber(
    steps: readonly StepData[],
    stepNumber: number
  ): StepData | null {
    return steps.find((beat) => beat.stepNumber === stepNumber) ?? null;
  }

  mapTimePositionToBeat(
    timePosition: number,
    steps: readonly StepData[]
  ): { stepIndex: number; stepProgress: number } {
    if (steps.length === 0) {
      return { stepIndex: 0, stepProgress: 0 };
    }

    let totalDuration = 0;
    for (const beat of steps) {
      totalDuration += beat.duration ?? 1;
    }
    const clampedTime = Math.max(0, Math.min(timePosition, totalDuration));

    let accumulatedTime = 0;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      const stepDuration = step.duration ?? 1;
      const beatEndTime = accumulatedTime + stepDuration;

      if (clampedTime < beatEndTime || i === steps.length - 1) {
        const timeInBeat = clampedTime - accumulatedTime;
        const stepProgress = stepDuration > 0 ? timeInBeat / stepDuration : 0;
        return {
          stepIndex: i,
          stepProgress: Math.min(stepProgress, 1.0),
        };
      }

      accumulatedTime = beatEndTime;
    }

    return { stepIndex: steps.length - 1, stepProgress: 1.0 };
  }

  getBeatStartTime(stepIndex: number, steps: readonly StepData[]): number {
    if (stepIndex <= 0 || steps.length === 0) return 0;

    let accumulatedTime = 0;
    const clampedIndex = Math.min(stepIndex, steps.length);

    for (let i = 0; i < clampedIndex; i++) {
      accumulatedTime += steps[i]!.duration ?? 1;
    }

    return accumulatedTime;
  }

  calculateBeatStateDurationAware(
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

    const { stepIndex, stepProgress } = this.mapTimePositionToBeat(
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
}
