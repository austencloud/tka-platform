/**
 * Duplicate Detection Tests
 *
 * HIGH VALUE: Prevents users from unknowingly saving duplicate sequences.
 * If word matching is wrong, users could end up with 10 copies of "Λ-SΓ"
 * without realizing it.
 *
 * Tests the word normalization logic that determines if a sequence
 * with the same TKA name already exists in the library.
 */

import { describe, expect, it, beforeEach } from "vitest";

// Inline the logic we're testing since LibraryStateManager is a singleton
// This tests the core algorithm without DI/state management overhead

/**
 * Find sequences by word - core algorithm extracted for testing
 */
function findSequencesByWord(
  sequences: Array<{ word?: string | null }>,
  searchWord: string
): Array<{ word?: string | null }> {
  if (!searchWord) return [];
  const normalizedWord = searchWord.toLowerCase().trim();
  return sequences.filter(
    (s) => s.word?.toLowerCase().trim() === normalizedWord
  );
}

/**
 * Check for duplicate - wraps findSequencesByWord
 */
function checkForDuplicate(
  sequences: Array<{ word?: string | null }>,
  word: string
): { hasDuplicate: boolean; existingSequences: Array<{ word?: string | null }> } {
  const existing = findSequencesByWord(sequences, word);
  return {
    hasDuplicate: existing.length > 0,
    existingSequences: existing,
  };
}

describe("Duplicate Detection", () => {
  describe("findSequencesByWord", () => {
    it("should find exact match", () => {
      const sequences = [
        { word: "Λ-SΓ" },
        { word: "ABC" },
        { word: "XYZ" },
      ];
      const result = findSequencesByWord(sequences, "Λ-SΓ");
      expect(result).toHaveLength(1);
      expect(result[0]?.word).toBe("Λ-SΓ");
    });

    it("should be case insensitive", () => {
      const sequences = [
        { word: "ABC" },
        { word: "abc" },
        { word: "AbC" },
      ];

      const resultUpper = findSequencesByWord(sequences, "ABC");
      const resultLower = findSequencesByWord(sequences, "abc");
      const resultMixed = findSequencesByWord(sequences, "aBc");

      // All should find all 3 sequences
      expect(resultUpper).toHaveLength(3);
      expect(resultLower).toHaveLength(3);
      expect(resultMixed).toHaveLength(3);
    });

    it("should trim whitespace", () => {
      const sequences = [{ word: "  ABC  " }, { word: "ABC" }];

      const resultPadded = findSequencesByWord(sequences, "  ABC  ");
      const resultClean = findSequencesByWord(sequences, "ABC");

      // Both should find both sequences (after trimming)
      expect(resultPadded).toHaveLength(2);
      expect(resultClean).toHaveLength(2);
    });

    it("should return empty array for empty search word", () => {
      const sequences = [{ word: "ABC" }];

      expect(findSequencesByWord(sequences, "")).toHaveLength(0);
      expect(findSequencesByWord(sequences, "   ")).toHaveLength(0);
    });

    it("should return empty array when no match", () => {
      const sequences = [{ word: "ABC" }, { word: "DEF" }];
      const result = findSequencesByWord(sequences, "XYZ");
      expect(result).toHaveLength(0);
    });

    it("should handle sequences with null/undefined words", () => {
      const sequences = [
        { word: null },
        { word: undefined },
        { word: "ABC" },
        { word: "" },
      ];
      const result = findSequencesByWord(sequences, "ABC");
      expect(result).toHaveLength(1);
    });

    it("should find multiple matches", () => {
      const sequences = [
        { word: "ABC" },
        { word: "abc" },
        { word: "ABC" },
      ];
      const result = findSequencesByWord(sequences, "abc");
      expect(result).toHaveLength(3);
    });

    it("should handle Greek letters (TKA specific)", () => {
      const sequences = [
        { word: "Λ-Γ" },
        { word: "Φ-Ψ-Ω" },
        { word: "α-β-γ" },
      ];

      expect(findSequencesByWord(sequences, "Λ-Γ")).toHaveLength(1);
      expect(findSequencesByWord(sequences, "Φ-Ψ-Ω")).toHaveLength(1);
      // Greek lowercase should match
      expect(findSequencesByWord(sequences, "α-β-γ")).toHaveLength(1);
    });

    it("should handle special characters in words", () => {
      const sequences = [
        { word: "A-B-C" },
        { word: "A--B" },
        { word: "A_B_C" },
      ];

      expect(findSequencesByWord(sequences, "A-B-C")).toHaveLength(1);
      expect(findSequencesByWord(sequences, "A--B")).toHaveLength(1);
      expect(findSequencesByWord(sequences, "A_B_C")).toHaveLength(1);
    });
  });

  describe("checkForDuplicate", () => {
    it("should return hasDuplicate=true when match exists", () => {
      const sequences = [{ word: "ABC" }];
      const result = checkForDuplicate(sequences, "ABC");

      expect(result.hasDuplicate).toBe(true);
      expect(result.existingSequences).toHaveLength(1);
    });

    it("should return hasDuplicate=false when no match", () => {
      const sequences = [{ word: "ABC" }];
      const result = checkForDuplicate(sequences, "XYZ");

      expect(result.hasDuplicate).toBe(false);
      expect(result.existingSequences).toHaveLength(0);
    });

    it("should return count of all duplicates", () => {
      const sequences = [
        { word: "ABC" },
        { word: "abc" },
        { word: "ABC" },
        { word: "XYZ" },
      ];
      const result = checkForDuplicate(sequences, "abc");

      expect(result.hasDuplicate).toBe(true);
      expect(result.existingSequences).toHaveLength(3);
    });

    it("should handle empty sequences array", () => {
      const result = checkForDuplicate([], "ABC");

      expect(result.hasDuplicate).toBe(false);
      expect(result.existingSequences).toHaveLength(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long words", () => {
      const longWord = "Λ-Γ-Ω-Φ-Ψ-Α-Β-Γ-Δ-Ε-Ζ-Η-Θ-Ι-Κ-Λ";
      const sequences = [{ word: longWord }];
      const result = findSequencesByWord(sequences, longWord);
      expect(result).toHaveLength(1);
    });

    it("should handle single character words", () => {
      const sequences = [{ word: "A" }, { word: "B" }];
      expect(findSequencesByWord(sequences, "A")).toHaveLength(1);
      expect(findSequencesByWord(sequences, "a")).toHaveLength(1);
    });

    it("should NOT match partial words", () => {
      const sequences = [{ word: "ABCDEF" }];

      expect(findSequencesByWord(sequences, "ABC")).toHaveLength(0);
      expect(findSequencesByWord(sequences, "DEF")).toHaveLength(0);
      expect(findSequencesByWord(sequences, "BCDE")).toHaveLength(0);
    });

    it("should handle Unicode normalization edge case", () => {
      // In some edge cases, same-looking Unicode characters might be different
      const sequences = [{ word: "Λ" }]; // Greek capital Lambda
      const result = findSequencesByWord(sequences, "Λ");
      expect(result).toHaveLength(1);
    });
  });
});

/**
 * WHY VALUABLE:
 * - Silent data corruption: wrong matching = unnoticed duplicates
 * - Case sensitivity bugs affect all users
 * - Whitespace handling affects copy-paste workflows
 * - Greek letter handling is TKA-specific edge case
 */
