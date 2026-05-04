/**
 * Result of cyclic equivalence comparison
 */
export interface WordCyclicEquivalenceResult {
  /** Whether the words are cyclic rotations of each other */
  readonly isEquivalent: boolean;
  /** Number of positions the first word needs to rotate to match the second (null if not equivalent) */
  readonly rotationOffset: number | null;
  /** The canonical (normalized) form of the word */
  readonly canonicalForm: string;
}

/**
 * Interface describing the shape of the word cyclic equivalence detector module.
 * Consumers that previously held a class instance can use this type.
 */
export interface WordCyclicEquivalenceDetector {
  areCyclicEquivalent: (wordA: string, wordB: string) => WordCyclicEquivalenceResult;
  getCanonicalForm: (word: string) => string;
  getAllRotations: (word: string) => readonly string[];
  findRotationOffset: (wordA: string, wordB: string) => number | null;
}

/**
 * Detects cyclic equivalence between words (letter sequences).
 *
 * Two words are cyclic equivalents if one is a rotation of the other.
 * This uses the classic algorithm: s2 is a rotation of s1 if s2 is
 * a substring of s1 + s1.
 */

export function areCyclicEquivalent(wordA: string, wordB: string): WordCyclicEquivalenceResult {
  // Quick checks
  if (wordA === wordB) {
    return {
      isEquivalent: true,
      rotationOffset: 0,
      canonicalForm: getCanonicalForm(wordA),
    };
  }

  if (wordA.length !== wordB.length) {
    return {
      isEquivalent: false,
      rotationOffset: null,
      canonicalForm: getCanonicalForm(wordA),
    };
  }

  if (wordA.length === 0) {
    return {
      isEquivalent: true,
      rotationOffset: 0,
      canonicalForm: "",
    };
  }

  // Classic rotation check: wordB is a rotation of wordA if
  // wordB appears as a substring of wordA + wordA
  const doubled = wordA + wordA;
  const index = doubled.indexOf(wordB);

  if (index !== -1 && index < wordA.length) {
    return {
      isEquivalent: true,
      rotationOffset: index,
      canonicalForm: getCanonicalForm(wordA),
    };
  }

  return {
    isEquivalent: false,
    rotationOffset: null,
    canonicalForm: getCanonicalForm(wordA),
  };
}

export function getCanonicalForm(word: string): string {
  if (word.length <= 1) {
    return word;
  }

  // Find lexicographically smallest rotation
  let canonical = word;
  let current = word;

  for (let i = 1; i < word.length; i++) {
    // Rotate left by 1
    current = current.slice(1) + current[0];
    if (current < canonical) {
      canonical = current;
    }
  }

  return canonical;
}

export function getAllRotations(word: string): readonly string[] {
  if (word.length === 0) {
    return [""];
  }

  const rotations: string[] = [];
  let current = word;

  for (let i = 0; i < word.length; i++) {
    rotations.push(current);
    current = current.slice(1) + current[0];
  }

  // Remove duplicates (e.g., "AA" only has one unique rotation)
  return [...new Set(rotations)];
}

export function findRotationOffset(wordA: string, wordB: string): number | null {
  const result = areCyclicEquivalent(wordA, wordB);
  return result.rotationOffset;
}
