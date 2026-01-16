import type {
  ExtractedBeat,
  InternalBeatPair,
} from "../../domain/models/internal-beat-models";
import type { SequenceEntry } from "../../domain/models/sequence-models";

/**
 * Orchestrator service that combines results from individual comparison services
 * and manages beat pair generation.
 */
export interface IBeatComparisonOrchestrator {
  /**
   * Extract normalized beat data from a sequence.
   */
  extractBeats(sequence: SequenceEntry): ExtractedBeat[];

  /**
   * Compare two beats and identify ALL transformations between them.
   */
  compareBeatPair(beat1: ExtractedBeat, beat2: ExtractedBeat): string[];

  /**
   * Generate beat-pair relationships for halved sequences (180° apart).
   */
  generateHalvedBeatPairs(beats: ExtractedBeat[]): InternalBeatPair[];

  /**
   * Generate beat-pair relationships for quartered sequences (90° apart).
   * Includes wrap-around comparison.
   */
  generateQuarteredBeatPairs(beats: ExtractedBeat[]): InternalBeatPair[];

  /**
   * Detect rotation direction for quartered sequences.
   */
  detectRotationDirection(beats: ExtractedBeat[]): "cw" | "ccw" | null;
}
