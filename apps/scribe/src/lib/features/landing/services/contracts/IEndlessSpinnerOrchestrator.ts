/**
 * Endless Spinner Orchestrator Interface
 *
 * Manages continuous sequence playback by chaining sequences together seamlessly.
 * When one sequence ends, finds another that starts where the previous ended.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/**
 * Represents the end state of a sequence that must be matched
 * for seamless transition to the next sequence.
 */
export interface EndState {
  /** Grid position where props end (e.g., BETA3, ALPHA1) */
  position: GridPosition | null;
  /** Blue prop's end orientation (in, out, clock, counter) */
  blueOrientation: Orientation | null;
  /** Red prop's end orientation */
  redOrientation: Orientation | null;
}

/**
 * Position groups for bridge generation.
 * Used when no direct match exists and we need to generate
 * a freeform sequence to transition to a new area.
 */
export type PositionGroup = "alpha" | "beta" | "gamma";

/**
 * Statistics about the endless playback session.
 */
export interface SpinnerStats {
  /** Total sequences played in this session */
  sequencesPlayed: number;
  /** Number of unique sequences used */
  uniqueSequencesUsed: number;
  /** Direct matches (exact start state match) */
  directMatches: number;
  /** Rotated matches (sequence rotated to match) */
  rotatedMatches: number;
  /** Bridge sequences generated */
  bridgesGenerated: number;
}

export interface IEndlessSpinnerOrchestrator {
  /**
   * Initialize the orchestrator by loading and indexing sequences.
   * Must be called before getNextSequence.
   */
  initialize(): Promise<void>;

  /**
   * Check if the orchestrator is ready to provide sequences.
   */
  isReady(): boolean;

  /**
   * Get the next sequence that matches the given end state.
   * Tries in order:
   * 1. Direct matches (exact start state)
   * 2. Rotatable matches (circular sequences that pass through the position)
   * 3. Freeform bridge generation
   *
   * @param endState - The position and orientations to match
   * @returns A sequence that starts where the previous ended
   */
  getNextSequence(endState: EndState): Promise<SequenceData | null>;

  /**
   * Generate a bridge sequence to transition to a different position group.
   * Used to add variety by occasionally jumping to new areas of the grid.
   *
   * @param fromEndState - Current end state to start from
   * @param toPositionGroup - Target position group (alpha, beta, gamma)
   * @returns A freeform sequence that bridges the gap
   */
  generateBridgeSequence(
    fromEndState: EndState,
    toPositionGroup: PositionGroup
  ): Promise<SequenceData | null>;

  /**
   * Get a random initial sequence to start playback.
   */
  getInitialSequence(): Promise<SequenceData | null>;

  /**
   * Get current session statistics.
   */
  getStats(): SpinnerStats;

  /**
   * Reset statistics for a new session.
   */
  resetStats(): void;
}
