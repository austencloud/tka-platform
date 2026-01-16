import type { StepData } from "../../../../features/create/shared/domain/models/StepData";
import type { SequenceData } from "../../../foundation/domain/models/SequenceData";

/**
 * Canvas management and optimization service
 */
export interface ICanvasManager {
  /**
   * Create optimized canvas
   */
  createCanvas(width: number, height: number): HTMLCanvasElement;

  /**
   * Clone canvas
   */
  cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement;

  /**
   * Dispose canvas resources
   */
  disposeCanvas(canvas: HTMLCanvasElement): void;

  /**
   * Get canvas memory usage
   */
  getMemoryUsage(): number;

  /**
   * Clear canvas cache
   */
  clearCache(): void;
}

export interface IReversalDetector {
  /**
   * Process reversals for sequence
   */
  processReversals(sequence: SequenceData, steps: StepData[]): StepData[];

  /**
   * Detect reversal for single beat
   */
  detectReversal(
    previousSteps: StepData[],
    currentStep: StepData
  ): { blueReversal: boolean; redReversal: boolean };

  /**
   * Apply reversal symbols to beat
   */
  applyReversalSymbols(
    stepData: StepData,
    reversalInfo: { blueReversal: boolean; redReversal: boolean }
  ): StepData;
}
