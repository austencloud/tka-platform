/**
 * Beat Calculation Service Interface
 *
 * Interface for beat calculation and timing services.
 * Handles beat state calculations and validation.
 */

import type { StepData } from "../../../create/shared/domain/models/StepData";

export interface IStepCalculator {
  calculateBeatState(
    currentStep: number,
    steps: readonly StepData[],
    totalSteps: number
  ): StepCalculationResult;
  validateSteps(steps: readonly StepData[]): boolean;
  getStepSafely(steps: readonly StepData[], index: number): StepData | null;
  calculateTotalDuration(steps: readonly StepData[]): number;
  findStepByNumber(
    steps: readonly StepData[],
    stepNumber: number
  ): StepData | null;

  /**
   * Map a time position to beat index and progress within that beat.
   * Accounts for variable beat durations.
   *
   * @param timePosition - Position in "duration units" (0 to totalDuration)
   * @param steps - Array of step data with durations
   * @returns Beat index and progress (0-1) within that beat
   */
  mapTimePositionToBeat(
    timePosition: number,
    steps: readonly StepData[]
  ): { stepIndex: number; stepProgress: number };

  /**
   * Calculate the time position where a specific beat starts.
   * @param stepIndex - The 0-based beat index
   * @param steps - Array of step data
   * @returns The cumulative time position where this beat begins
   */
  getStepStartTime(stepIndex: number, steps: readonly StepData[]): number;

  /**
   * Calculate beat state using duration-aware timing.
   * Uses actual beat durations to determine current beat and progress.
   *
   * @param timePosition - Current position in sequence time (0 to totalDuration)
   * @param steps - Array of step data
   * @returns Calculation result with beat index and progress
   */
  calculateBeatStateDurationAware(
    timePosition: number,
    steps: readonly StepData[]
  ): StepCalculationResult;
}

export interface StepCalculationResult {
  currentStepIndex: number;
  stepProgress: number;
  currentStepData: StepData;
  isValid: boolean;
}
