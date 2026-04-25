import type {
  ExtractedStep,
  InternalStepPair,
} from "../../domain/models/internal-step-models";
import type { SequenceEntry } from "../../domain/models/sequence-models";

/**
 * Orchestrator service that combines results from individual comparison services
 * and manages beat pair generation.
 */
export interface IStepComparisonOrchestrator {
  /**
   * Extract normalized step data from a sequence.
   */
  extractBeats(sequence: SequenceEntry): ExtractedStep[];

  /**
   * Compare two steps and identify ALL transformations between them.
   */
  compareStepPair(step1: ExtractedStep, step2: ExtractedStep): string[];

  /**
   * Generate step-pair relationships for halved sequences (180° apart).
   */
  generateHalvedBeatPairs(steps: ExtractedStep[]): InternalStepPair[];

  /**
   * Generate step-pair relationships for quartered sequences (90° apart).
   * Includes wrap-around comparison.
   */
  generateQuarteredBeatPairs(steps: ExtractedStep[]): InternalStepPair[];

  /**
   * Detect rotation direction for quartered sequences.
   */
  detectRotationDirection(steps: ExtractedStep[]): "cw" | "ccw" | null;
}
