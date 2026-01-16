/**
 * Interface for coordinating sequence state operations
 */
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ArrowPosition } from "$lib/shared/pictograph/arrow/orchestration/domain/arrow-models";

export interface SequenceStatistics {
  totalSteps: number;
  blankBeats: number;
  filledSteps: number;
  duration: number;
  hasTurns: boolean;
  hasReversals: boolean;
}

export interface ISequenceCoordinator {
  /**
   * Get sequence statistics
   */
  getSequenceStatistics(sequence: SequenceData | null): SequenceStatistics;

  /**
   * Get sequence word/name
   */
  getSequenceWord(sequence: SequenceData | null): string;

  /**
   * Get sequence total duration
   */
  getSequenceDuration(sequence: SequenceData | null): number;

  /**
   * Get beat count for sequence
   */
  getStepCount(sequence: SequenceData | null): number;

  /**
   * Check if sequence has steps
   */
  hasBeats(sequence: SequenceData | null): boolean;

  /**
   * Check if sequence has arrow positions
   */
  hasArrowPositions(arrowPositions: Map<string, ArrowPosition>): boolean;

  /**
   * Check if arrow positioning is complete
   */
  isArrowPositioningComplete(
    arrowPositions: Map<string, ArrowPosition>
  ): boolean;

  /**
   * Get current sequence data as pictograph array
   */
  getCurrentSequenceData(
    sequence: SequenceData | null,
    selectedStartPosition: PictographData | null
  ): PictographData[];
}
