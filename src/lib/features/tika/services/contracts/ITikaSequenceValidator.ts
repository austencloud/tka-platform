/**
 * ITikaSequenceValidator - Contract for TKA Sequence Validation
 *
 * Validates whether letters can chain together based on position groups.
 * Provides suggestions for bridge letters to fix invalid sequences.
 */

export interface SequenceTransition {
  from: string;
  to: string;
  fromEndGroup: string;
  toStartGroup: string;
  isValid: boolean;
  bridgeOptions?: string[];
}

export interface InvalidTransition {
  position: number;
  from: string;
  to: string;
  reason: string;
  suggestedBridges: string[];
}

export interface SequenceValidationResult {
  isValid: boolean;
  word: string;
  letters: string[];
  transitions: SequenceTransition[];
  invalidTransitions: InvalidTransition[];
  interpolatedSequence?: string;
  explanation: string;
}

export interface ITikaSequenceValidator {
  /**
   * Validate whether a sequence of letters can chain together.
   * @param letters - Array of TKA letters
   * @returns Validation result with transitions and suggestions
   */
  validateChaining(letters: string[]): SequenceValidationResult;

  /**
   * Parse a word string into individual letters (handling dash suffixes).
   * @param word - The word to parse, e.g., "ABC" or "W-X-"
   * @returns Array of individual letters
   */
  parseWordToLetters(word: string): string[];

  /**
   * Check if a letter is a valid TKA letter.
   * @param letter - The letter to check
   * @returns True if valid
   */
  isValidLetter(letter: string): boolean;

  /**
   * Get the type info for a letter.
   * @param letter - The letter to look up
   * @returns Type info or undefined
   */
  getLetterType(letter: string): { type: string; name: string } | undefined;
}
