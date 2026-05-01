/**
 * Transition Graph Interface
 *
 * Manages valid letter transitions based on position groups.
 * A letter can follow another if its start position group matches
 * the previous letter's end position group.
 */

import type {
  PositionGroup,
  LetterPositionInfo,
} from "../types/sequence-engine-types.js";

/**
 * Interface for letter transition graph operations.
 */
export interface ITransitionGraph {
  /**
   * Must be called before using other methods.
   */
  initialize(): Promise<void>;

  /**
   * True if letterB's start position group equals letterA's end position group.
   */
  canFollow(letterA: string, letterB: string): boolean;

  /**
   * Get all letters that can directly follow the given letter.
   */
  getValidSuccessors(letter: string): string[];

  getLettersStartingAt(positionGroup: PositionGroup): string[];

  getLettersEndingAt(positionGroup: PositionGroup): string[];

  getLetterPositionInfo(letter: string): LetterPositionInfo | null;

  getStartPositionGroup(letter: string): PositionGroup | null;

  getEndPositionGroup(letter: string): PositionGroup | null;

  /**
   * Find bridge letters to connect letterA to letterB when they can't directly follow.
   * Uses BFS to find the shortest path.
   * @returns Array of bridge letters (empty if direct transition is possible)
   */
  findBridgeLetters(letterA: string, letterB: string): string[];

  /**
   * Find ALL valid single-letter bridges between two letters.
   * Returns all letters that can connect letterA's end to letterB's start in one step.
   * @returns Array of possible bridge letters (empty if direct transition or no single-letter bridge)
   */
  findAllBridgeOptions(letterA: string, letterB: string): string[];

  /**
   * Get all letters in the graph.
   * @param excludeLetters - Optional set of letters to exclude
   */
  getAllLetters(excludeLetters?: Set<string>): string[];

  isInitialized(): boolean;
}
