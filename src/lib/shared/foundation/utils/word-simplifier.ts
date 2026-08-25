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

import { Letter } from "../domain/models/letter";

/** Every canonical letter value, for {@link isTkaWord}'s membership test. */
const TKA_LETTER_UNITS: ReadonlySet<string> = new Set<string>(
  Object.values(Letter),
);

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

    // Build group strings for comparison
    const groups: string[] = [];
    for (let i = 0; i < numGroups; i++) {
      groups.push(tokens.slice(i * g, (i + 1) * g).join(""));
    }

    // Check palindrome: group[i] === group[numGroups - 1 - i]
    let isPalindrome = true;
    for (let i = 0; i < Math.floor(numGroups / 2); i++) {
      if (groups[i] !== groups[numGroups - 1 - i]) {
        isPalindrome = false;
        break;
      }
    }

    // Must be a true palindrome (not all identical - that's a repeat, already handled)
    if (isPalindrome && groups[0] !== groups[1]) {
      const halfCount = Math.ceil(numGroups / 2);
      return groups.slice(0, halfCount).join("");
    }
  }

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
export function splitIntoLetterUnits(word: string): string[] {
  const units: string[] = [];
  let i = 0;

  while (i < word.length) {
    const char = word[i];
    if (!char) break;

    // Check if current character is a letter. \u2295 is \u2295 (Terra, a Type 6
    // letter): without it the tokenizer silently DROPS the glyph, so a word
    // containing Terra compressed and simplified as if it were not there.
    if (/[a-zA-Z\u0370-\u03FF\u1F00-\u1FFF\u2295]/.test(char)) {
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

export interface CompressedSegment {
  tokens: string[];
  repeat: number;
}

/**
 * Compress a word by detecting repeated consecutive subsequences.
 *
 * Unlike simplifyRepeatedWord (which only handles full-word repetition like
 * ABCABC → ABC), this detects partial runs:
 *   "AKEAAαΦ-AAKEAAαΦ-AAAAABαΦ-BAAAABαΦ-B"
 *   → [{tokens: [A,K,E,A,A,α,Φ-,A], repeat: 2},
 *      {tokens: [A,A,A,A,B,α,Φ-,B], repeat: 2}]
 *
 * Falls back to a single segment with repeat=1 when no runs are found.
 */
export function compressWord(word: string): CompressedSegment[] {
  if (!word) return [];
  const units = splitIntoLetterUnits(word);
  if (units.length === 0) return [];

  const segments: CompressedSegment[] = [];
  let i = 0;

  while (i < units.length) {
    let bestLen = 0;
    let bestCount = 0;

    const maxPatternLen = Math.floor((units.length - i) / 2);
    for (let len = 1; len <= maxPatternLen; len++) {
      const pattern = units.slice(i, i + len);
      let count = 1;
      let j = i + len;
      while (j + len <= units.length && arraysEqual(units, j, pattern, len)) {
        count++;
        j += len;
      }
      const minCount = len === 1 ? 4 : 2;
      if (count >= minCount && len * count > bestLen * bestCount) {
        bestLen = len;
        bestCount = count;
      }
    }

    if (bestCount >= 2) {
      segments.push({ tokens: units.slice(i, i + bestLen), repeat: bestCount });
      i += bestLen * bestCount;
    } else {
      segments.push({ tokens: [units[i]!], repeat: 1 });
      i++;
    }
  }

  return mergeUnrepeatedSegments(segments);
}

function arraysEqual(source: string[], offset: number, pattern: string[], len: number): boolean {
  for (let k = 0; k < len; k++) {
    if (source[offset + k] !== pattern[k]) return false;
  }
  return true;
}

function mergeUnrepeatedSegments(segments: CompressedSegment[]): CompressedSegment[] {
  const merged: CompressedSegment[] = [];
  for (const seg of segments) {
    if (seg.repeat === 1 && merged.length > 0 && merged[merged.length - 1]!.repeat === 1) {
      merged[merged.length - 1]!.tokens.push(...seg.tokens);
    } else {
      merged.push(seg);
    }
  }
  return merged;
}

/**
 * Render compressed segments back to a flat display string.
 * Repeated segments get (tokens)×N notation.
 */
export function compressedToDisplayString(segments: CompressedSegment[]): string {
  return segments
    .map((seg) => {
      const inner = seg.tokens.join("");
      return seg.repeat > 1 ? `(${inner})×${seg.repeat}` : inner;
    })
    .join("");
}

/**
 * True when `text` is a Kinetic Alphabet word — a single unbroken run of
 * canonical TKA letters, dash letters included ("BBBA", "ΩORZ", "AW-B", "Φ-").
 *
 * The question this answers is a display one: only a real TKA word may be drawn
 * with the alphabet's glyphs. Anything a person typed as a name ("Sunrise",
 * "Tunnel #3", "Mandala Duo") has to stay text, so the test is deliberately
 * strict on both ends — no whitespace, no punctuation, and every unit has to be
 * an actual member of {@link Letter}. Lowercase Latin fails on membership
 * (`Letter.ALPHA` is "α", never "a"), which is what keeps ordinary English words
 * out even though the tokenizer happily splits them.
 */
export function isTkaWord(text: string): boolean {
  if (!text) return false;
  const units = splitIntoLetterUnits(text);
  // The tokenizer skips characters it does not recognize; rejoining proves that
  // nothing was dropped, so "A B" and "A!" fail here rather than passing as "AB".
  if (units.length === 0 || units.join("") !== text) return false;
  return units.every((unit) => TKA_LETTER_UNITS.has(unit));
}
