/**
 * Orientation Cycle Detector Service Contract
 *
 * Service for detecting how many repetitions of a sequence are needed
 * to return to the starting prop orientation.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { OrientationCycleResult } from "../implementations/OrientationCycleDetector";

export interface IOrientationCycleDetector {
  /**
   * Detect how many repetitions are needed to return to starting orientation
   *
   * @param sequence The sequence to analyze
   * @returns Result containing cycle count and orientation tracking
   */
  detectOrientationCycle(sequence: SequenceData): OrientationCycleResult;
}
