/**
 * Word Sequence Generator Service Interface
 *
 * Orchestrates the conversion of a typed word into a valid TKA sequence.
 * Handles parsing, bridge letter insertion, and beat generation.
 */

import type {
  SpellGenerationOptions,
  SpellResult,
} from "../../domain/models/spell-models";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";

export interface IWordSequenceGenerator {
  /**
   * Generate a sequence from a word
   * @param options Generation options including word and preferences
   * @returns SpellResult with the generated sequence and metadata
   */
  generateFromWord(options: SpellGenerationOptions): Promise<SpellResult>;

  /**
   * Parse a word string into an array of Letter enums
   * Handles Greek letter aliases and validation
   * @param word The input word string
   * @returns Array of parsed letters, or null if parsing fails
   */
  parseWord(
    word: string
  ): {
    letters: Letter[];
    error?: string;
  } | null;

  /**
   * Validate that a word can be converted to a sequence
   * @param word The input word string
   * @returns Validation result with any error message
   */
  validateWord(word: string): { valid: boolean; error?: string };
}
