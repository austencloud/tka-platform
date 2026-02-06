/**
 * Word Cyclic Equivalence Detector Contract
 *
 * Detects when two words (letter sequences) are cyclic rotations of each other.
 * For example, AABB and BAAB are cyclic equivalents because rotating AABB
 * by 3 positions yields BAAB.
 *
 * This is useful for identifying circular sequences with different starting
 * beats that are essentially the same sequence.
 */

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

export interface IWordCyclicEquivalenceDetector {
  /**
   * Check if two words are cyclic rotations of each other
   *
   * @example
   * areCyclicEquivalent("AABB", "ABBA") // { isEquivalent: true, rotationOffset: 1, ... }
   * areCyclicEquivalent("AABB", "BAAB") // { isEquivalent: true, rotationOffset: 3, ... }
   * areCyclicEquivalent("AABB", "ABCD") // { isEquivalent: false, rotationOffset: null, ... }
   */
  areCyclicEquivalent(wordA: string, wordB: string): WordCyclicEquivalenceResult;

  /**
   * Get the canonical (lexicographically smallest rotation) form of a word.
   * Two cyclic equivalent words will have the same canonical form.
   *
   * @example
   * getCanonicalForm("BAAB") // "AABB"
   * getCanonicalForm("ABBA") // "AABB"
   */
  getCanonicalForm(word: string): string;

  /**
   * Get all unique rotations of a word
   *
   * @example
   * getAllRotations("ABC") // ["ABC", "BCA", "CAB"]
   */
  getAllRotations(word: string): readonly string[];

  /**
   * Find the rotation offset needed to transform wordA into wordB.
   * Returns null if they are not cyclic equivalents.
   *
   * @example
   * findRotationOffset("AABB", "BBAA") // 2
   * findRotationOffset("AABB", "ABCD") // null
   */
  findRotationOffset(wordA: string, wordB: string): number | null;
}
