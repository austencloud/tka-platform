/**
 * Variation Exploration Orchestrator Interface
 *
 * Handles word parsing and bridge letter insertion for spell generation.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { LetterSource, SpellPreferences } from "../../domain/models/spell-models";

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
  /** Letter sources tracking which letters are original vs bridge */
  letterSources?: LetterSource[];
  /** Error message if parsing failed */
  error?: string;
}

/**
 * Options for word parsing
 */
export interface WordParseOptions {
  /** Preferences that affect bridge letter selection */
  preferences?: SpellPreferences;
}

export interface IVariationExplorationOrchestrator {
  /**
   * Parse a word and prepare for generation
   * @param word The input word
   * @param options Optional parsing options including preferences
   * @returns Parsed result with original and expanded letters
   */
  parseWord(word: string, options?: WordParseOptions): Promise<WordParseResult>;
}
