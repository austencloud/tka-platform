/**
 * Word Simplifier Utility
 *
 * Simplifies long words by detecting and removing repeated patterns.
 * Ported from desktop application: legacy/src/utils/word_simplifier.py
 *
 * Example:
 * - "ABCABCABC" → "ABC"
 * - "TESTTEST" → "TEST"
 * - "HELLO" → "HELLO" (no pattern, returns original)
 */

/**
 * Check if a string can be formed by repeating a pattern
 */
function canFormByRepeating(s: string, pattern: string): boolean {
  const patternLen = pattern.length;
  if (s.length % patternLen !== 0) {
    return false;
  }

  for (let i = 0; i < s.length; i += patternLen) {
    const chunk = s.substring(i, i + patternLen);
    if (chunk !== pattern) {
      return false;
    }
  }

  return true;
}

/**
 * Simplify a word by detecting and removing repeated patterns
 *
 * @param word - The word to simplify (e.g., "ABCABCABC")
 * @returns The simplified word (e.g., "ABC")
 *
 * Algorithm:
 * 1. Try patterns of increasing length (1, 2, 3, ... up to half the word length)
 * 2. For each pattern length, check if the word is formed by repeating that pattern
 * 3. Return the first (shortest) repeating pattern found
 * 4. If no pattern found, return the original word
 */
export function simplifyRepeatedWord(word: string): string {
  if (!word || word.length === 0) {
    return word;
  }

  const n = word.length;

  // Try patterns from length 1 to half the word length
  for (let i = 1; i <= Math.floor(n / 2); i++) {
    const pattern = word.substring(0, i);

    // Check if word length is divisible by pattern length
    // and if the word can be formed by repeating this pattern
    if (n % i === 0 && canFormByRepeating(word, pattern)) {
      return pattern;
    }
  }

  // No repeating pattern found, return original word
  return word;
}

/**
 * Split a word into letter units, treating letter+dash combinations as single units
 *
 * Examples:
 * - "ABC" → ["A", "B", "C"] (3 letters)
 * - "AW-B" → ["A", "W-", "B"] (3 letters, not 4)
 * - "Φ-Ψ-Ω-" → ["Φ-", "Ψ-", "Ω-"] (3 letters)
 * - "A-B-C" → ["A-", "B-", "C"] (3 letters)
 */
function splitIntoLetterUnits(word: string): string[] {
  const units: string[] = [];
  let i = 0;

  while (i < word.length) {
    const char = word[i];
    if (!char) break;

    // Check if current character is a letter
    if (/[a-zA-Z\u0370-\u03FF\u1F00-\u1FFF]/.test(char)) {
      // Check if next character is a dash
      const nextChar = word[i + 1];
      if (i + 1 < word.length && nextChar === "-") {
        // Treat letter+dash as one unit
        units.push(char + "-");
        i += 2;
      } else {
        // Just the letter
        units.push(char);
        i += 1;
      }
    } else {
      // Non-letter character (shouldn't happen in normal TKA words, but handle it)
      i += 1;
    }
  }

  return units;
}

/**
 * Truncate a word to a maximum number of letter units,
 * treating letter+dash combinations as single letters
 *
 * @param word - The word to truncate
 * @param maxLetters - Maximum number of letter units (default: 8)
 * @returns The truncated word with "..." if it was truncated
 *
 * Example:
 * - simplifyAndTruncate("ABC-DEF-GHI-JKL", 8) → "ABC-DEF-..." (6 letter units)
 * - simplifyAndTruncate("AW-BX-CY-DZ-", 8) → "AW-BX-CY-DZ-" (4 letter units, no truncation)
 * - simplifyAndTruncate("ABCDEFGHIJK", 8) → "ABCDEFGH..." (truncated to 8)
 */
export function simplifyAndTruncate(
  word: string,
  maxLetters: number = 8
): string {
  // First simplify the word
  const simplified = simplifyRepeatedWord(word);

  // Split into letter units
  const letterUnits = splitIntoLetterUnits(simplified);

  // If within limit, return as-is
  if (letterUnits.length <= maxLetters) {
    return simplified;
  }

  // Truncate to maxLetters units and add ellipsis
  const truncatedUnits = letterUnits.slice(0, maxLetters);
  return truncatedUnits.join("") + "...";
}
