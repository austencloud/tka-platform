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
} from "../../domain/models/SequenceEngineTypes";

/**
 * Interface for letter transition graph operations.
 */
export interface ITransitionGraph {
  /**
   * Initialize the graph by loading letter mapping data.
   * Must be called before using other methods.
   */
  initialize(): Promise<void>;

  /**
   * Check if letterB can directly follow letterA.
   * True if letterB's start position group equals letterA's end position group.
   */
  canFollow(letterA: string, letterB: string): boolean;

  /**
   * Get all letters that can directly follow the given letter.
   */
  getValidSuccessors(letter: string): string[];

  /**
   * Get all letters that start at the given position group.
   */
  getLettersStartingAt(positionGroup: PositionGroup): string[];

  /**
   * Get all letters that end at the given position group.
   */
  getLettersEndingAt(positionGroup: PositionGroup): string[];

  /**
   * Get the position info for a letter (start/end position groups).
   */
  getLetterPositionInfo(letter: string): LetterPositionInfo | null;

  /**
   * Get the start position group for a letter.
   */
  getStartPositionGroup(letter: string): PositionGroup | null;

  /**
   * Get the end position group for a letter.
   */
  getEndPositionGroup(letter: string): PositionGroup | null;

  /**
   * Find bridge letters to connect letterA to letterB when they can't directly follow.
   * Uses BFS to find the shortest path.
   *
   * @returns Array of bridge letters (empty if direct transition is possible)
   */
  findBridgeLetters(letterA: string, letterB: string): string[];

  /**
   * Find ALL valid single-letter bridges between two letters.
   * Returns all letters that can connect letterA's end to letterB's start in one step.
   *
   * @returns Array of possible bridge letters (empty if direct transition or no single-letter bridge)
   */
  findAllBridgeOptions(letterA: string, letterB: string): string[];

  /**
   * Get all letters in the graph.
   *
   * @param excludeLetters - Optional set of letters to exclude
   */
  getAllLetters(excludeLetters?: Set<string>): string[];

  /**
   * Check if the graph has been initialized.
   */
  isInitialized(): boolean;
}
