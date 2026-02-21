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

  // No repeating pattern found, try palindrome detection
  return simplifyPalindromicWord(word);
}

/**
 * Split a word into letter units, treating letter+dash combinations as single units
 *
 * Examples:
 * - "ABC" → ["A", "B", "C"]
 * - "AW-B" → ["A", "W-", "B"]
 * - "Φ-Ψ-Ω-" → ["Φ-", "Ψ-", "Ω-"]
 */
function splitIntoLetterUnits(word: string): string[] {
  const units: string[] = [];
  let i = 0;

  while (i < word.length) {
    const char = word[i];
    if (!char) break;

    if (/[a-zA-Z\u0370-\u03FF\u1F00-\u1FFF]/.test(char)) {
      const nextChar = word[i + 1];
      if (i + 1 < word.length && nextChar === "-") {
        units.push(char + "-");
        i += 2;
      } else {
        units.push(char);
        i += 1;
      }
    } else {
      i += 1;
    }
  }

  return units;
}

/**
 * Simplify a word with palindromic (ABBA) group structure by removing the mirrored half.
 *
 * Works on letter-unit groups, not raw characters, so "Δ-UY-Ψ-" is one group
 * when group size = 4 tokens.
 *
 * Example:
 * - "Δ-UY-Ψ-Σ-VZ-Ψ-Σ-VZ-Ψ-Δ-UY-Ψ-" (ABBA at G=4) → "Δ-UY-Ψ-Σ-VZ-Ψ-"
 */
function simplifyPalindromicWord(word: string): string {
  const tokens = splitIntoLetterUnits(word);
  const n = tokens.length;
  if (n < 2) return word;

  for (let g = 1; g <= Math.floor(n / 2); g++) {
    if (n % g !== 0) continue;

    const numGroups = n / g;
    if (numGroups < 2) continue;

    const groups: string[] = [];
    for (let i = 0; i < numGroups; i++) {
      groups.push(tokens.slice(i * g, (i + 1) * g).join(""));
    }

    let isPalindrome = true;
    for (let i = 0; i < Math.floor(numGroups / 2); i++) {
      if (groups[i] !== groups[numGroups - 1 - i]) {
        isPalindrome = false;
        break;
      }
    }

    if (isPalindrome && groups[0] !== groups[1]) {
      const halfCount = Math.ceil(numGroups / 2);
      return groups.slice(0, halfCount).join("");
    }
  }

  return word;
}
