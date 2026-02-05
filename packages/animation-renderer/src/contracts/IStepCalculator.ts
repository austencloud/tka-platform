import type { StepData } from "@tka/types";

export interface StepCalculationResult {
  currentStepIndex: number;
  stepProgress: number;
  currentStepData: StepData;
  isValid: boolean;
}

export interface IStepCalculator {
  calculateBeatState(
    currentStep: number,
    steps: readonly StepData[],
    totalSteps: number
  ): StepCalculationResult;
  validateBeats(steps: readonly StepData[]): boolean;
  getBeatSafely(steps: readonly StepData[], index: number): StepData | null;
  calculateTotalDuration(steps: readonly StepData[]): number;
  findBeatByNumber(
    steps: readonly StepData[],
    stepNumber: number
  ): StepData | null;
  mapTimePositionToBeat(
    timePosition: number,
    steps: readonly StepData[]
  ): { stepIndex: number; stepProgress: number };
  getBeatStartTime(stepIndex: number, steps: readonly StepData[]): number;
  calculateBeatStateDurationAware(
    timePosition: number,
    steps: readonly StepData[]
  ): StepCalculationResult;
}
