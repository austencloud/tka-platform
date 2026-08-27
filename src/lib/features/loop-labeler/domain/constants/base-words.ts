/**
 * TKA Base Words
 * Fundamental 4-step sequences that can be composed together
 */

export interface BaseWord {
  id: string;
  name: string;
  pattern: string; // e.g., "AAAA", "EKEK"
  stepCount: 4;
}

export const BASE_WORDS: BaseWord[] = [
  { id: "aaaa", name: "AAAA", pattern: "AAAA", stepCount: 4 },
  { id: "bbbb", name: "BBBB", pattern: "BBBB", stepCount: 4 },
  { id: "cccc", name: "CCCC", pattern: "CCCC", stepCount: 4 },
  { id: "djdj", name: "DJDJ", pattern: "DJDJ", stepCount: 4 },
  { id: "ekek", name: "EKEK", pattern: "EKEK", stepCount: 4 },
  { id: "flfl", name: "FLFL", pattern: "FLFL", stepCount: 4 },
  { id: "gggg", name: "GGGG", pattern: "GGGG", stepCount: 4 },
  { id: "hhhh", name: "HHHH", pattern: "HHHH", stepCount: 4 },
  { id: "iiii", name: "IIII", pattern: "IIII", stepCount: 4 },
  { id: "mpmp", name: "MPMP", pattern: "MPMP", stepCount: 4 },
  { id: "nqnq", name: "NQNQ", pattern: "NQNQ", stepCount: 4 },
  { id: "oror", name: "OROR", pattern: "OROR", stepCount: 4 },
  { id: "ssss", name: "SSSS", pattern: "SSSS", stepCount: 4 },
  { id: "tttt", name: "TTTT", pattern: "TTTT", stepCount: 4 },
  { id: "uuuu", name: "UUUU", pattern: "UUUU", stepCount: 4 },
  { id: "vvvv", name: "VVVV", pattern: "VVVV", stepCount: 4 },
];

export const BASE_WORD_MAP = new Map(BASE_WORDS.map((bw) => [bw.id, bw]));

export function getBaseWord(id: string): BaseWord | undefined {
  return BASE_WORD_MAP.get(id.toLowerCase());
}

/**
 * Extract base word fragments from a sequence
 * For example: BBKE contains BB (first half of BBBB) and KE (first half of EKEK)
 */
export function detectBaseWordFragments(word: string): string[] {
  const fragments: string[] = [];
  const normalized = word.toUpperCase();

  // Check for 2-step fragments (half of base words)
  for (let i = 0; i < normalized.length - 1; i += 2) {
    const fragment = normalized.slice(i, i + 2);

    // Check if this fragment is part of any base word
    for (const baseWord of BASE_WORDS) {
      if (baseWord.pattern.includes(fragment)) {
        fragments.push(`${fragment} (from ${baseWord.name})`);
        break;
      }
    }
  }

  return fragments;
}
