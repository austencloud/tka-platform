/**
 * Parses a word string into individual letter units.
 *
 * A "letter unit" is either a single character (Latin or Greek) or a character
 * followed by a dash suffix (e.g. "Σ-", "W-"). The dash suffix is a naming
 * convention for Type 3/4/5 letters, not a separator.
 *
 * Non-letter characters (spaces, punctuation, etc.) are silently skipped.
 */

/** Matches Latin letters (a-z, A-Z) and Greek letters (U+0370-U+03FF, U+1F00-U+1FFF) */
const LETTER_PATTERN = /[a-zA-Z\u0370-\u03FF\u1F00-\u1FFF]/;

export class LetterParser {
  /**
   * Split a word string into its constituent letter units.
   *
   * Examples:
   *   "BOOK"   → ["B", "O", "O", "K"]
   *   "AΣ-B"   → ["A", "Σ-", "B"]
   *   "Φ-Ψ-Λ-" → ["Φ-", "Ψ-", "Λ-"]
   */
  parse(word: string): string[] {
    const units: string[] = [];
    let i = 0;

    while (i < word.length) {
      const char = word[i]!;

      if (LETTER_PATTERN.test(char)) {
        const nextChar = word[i + 1];
        if (i + 1 < word.length && nextChar === "-") {
          units.push(char + "-");
          i += 2;
        } else {
          units.push(char);
          i += 1;
        }
      } else {
        // Skip non-letter characters
        i += 1;
      }
    }

    return units;
  }
}
