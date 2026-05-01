/**
 * Word Simplifier Utility for MCP Server
 *
 * Simplifies long words by detecting and removing repeated patterns.
 * Ported from: src/lib/features/create/shared/workspace-panel/shared/utils/word-simplifier.ts
 *
 * Example:
 * - "ABCABCABC" → "ABC"
 * - "TESTTEST" → "TEST"
 * - "AΣSSWJIΘPYEAΣSSWJIΘPYE" → "AΣSSWJIΘPYE"
 * - "HELLO" → "HELLO" (no pattern, returns original)
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
