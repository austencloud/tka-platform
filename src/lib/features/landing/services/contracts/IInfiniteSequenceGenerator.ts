/**
 * Infinite Sequence Generator Interface
 *
 * Generates novel sequences algorithmically for the endless spinner's
 * "Infinite" mode. Each generated sequence is unique and has never
 * been seen before.
 */

import type { GeneratedSequenceInfo } from "../../domain/models/spinner-models";
import type { EndState } from "./IEndlessSpinnerOrchestrator";

export interface IInfiniteSequenceGenerator {
  /**
   * Generate a novel sequence that chains from the given end state.
   * The sequence will start where the previous one ended for seamless transition.
   *
   * @param endState - Position and orientations from the previous sequence's end
   * @returns Generated sequence with metadata, or null if generation fails
   */
  generateFromEndState(endState: EndState): Promise<GeneratedSequenceInfo | null>;

  /**
   * Generate an initial sequence for starting infinite mode.
   * Uses a random starting position.
   *
   * @returns Generated sequence with metadata, or null if generation fails
   */
  generateInitial(): Promise<GeneratedSequenceInfo | null>;

  /**
   * Get the count of sequences generated in this session.
   */
  getSessionCount(): number;

  /**
   * Reset the session counter (e.g., when switching modes).
   */
  resetSessionCount(): void;
}
