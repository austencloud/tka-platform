/**
 * Variation Exploration Orchestrator Interface
 *
 * Handles word parsing and bridge letter insertion for spell generation.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";

/**
 * Result of parsing a word for generation
 */
export interface WordParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed letters (original, without bridges) */
  originalLetters?: Letter[];
  /** Expanded letters (with bridges inserted) */
  expandedLetters?: Letter[];
  /** Expanded word string */
  expandedWord?: string;
  /** Error message if parsing failed */
  error?: string;
}

export interface IVariationExplorationOrchestrator {
  /**
   * Parse a word and prepare for generation
   * @param word The input word
   * @returns Parsed result with original and expanded letters
   */
  parseWord(word: string): Promise<WordParseResult>;
}
