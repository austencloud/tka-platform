/**
 * Word simplifier (functions port).
 *
 * Faithful port of the canonical app util
 * (src/lib/shared/foundation/utils/word-simplifier.ts, `simplifyRepeatedWord`).
 * The functions package can't import from the SvelteKit `src/` tree, so the
 * pure simplifier lives here too. Keep the two in sync: a LOOP word repeats by
 * construction (FΨFΨFΨFΨ) and must display in its smallest form (FΨ).
 *
 * Only the pieces the Pulse notifier needs are ported: full-repeat collapse
 * plus palindrome (ABBA) collapse over letter units. compressWord/truncate are
 * app-display concerns and intentionally omitted.
 */

/** True when `s` is exactly `pattern` repeated end to end. */
function canFormByRepeating(s: string, pattern: string): boolean {
  const patternLen = pattern.length;
  if (s.length % patternLen !== 0) return false;
  for (let i = 0; i < s.length; i += patternLen) {
    if (s.substring(i, i + patternLen) !== pattern) return false;
  }
  return true;
}

/**
 * Split a word into letter units, treating a trailing dash as part of its
 * letter ("Φ-Ψ-Ω-" → ["Φ-", "Ψ-", "Ω-"]).
 */
function splitIntoLetterUnits(word: string): string[] {
  const units: string[] = [];
  let i = 0;
  while (i < word.length) {
    const char = word[i];
    if (!char) break;
    if (/[a-zA-ZͰ-Ͽἀ-῿]/.test(char)) {
      if (i + 1 < word.length && word[i + 1] === "-") {
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

/** Collapse an ABBA palindrome of letter-unit groups to its first half. */
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

/**
 * Collapse a repeated word to its smallest repeating unit
 * ("ABCABCABC" → "ABC"); falls back to palindrome collapse; returns the
 * original when no pattern is found.
 */
export function simplifyRepeatedWord(word: string): string {
  if (!word || word.length === 0) return word;
  const n = word.length;
  for (let i = 1; i <= Math.floor(n / 2); i++) {
    const pattern = word.substring(0, i);
    if (n % i === 0 && canFormByRepeating(word, pattern)) return pattern;
  }
  return simplifyPalindromicWord(word);
}
