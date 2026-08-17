// tests/unit/pronunciation/letter-syllables.test.ts
import { describe, expect, it } from "vitest";

import { Letter } from "$lib/shared/foundation/domain/models/letter";
import { syllablesOf, syllablesInWord } from "$lib/features/lab/pronunciation-recorder/domain/letter-syllables";

describe("syllablesOf", () => {
  it("covers every letter in the alphabet", () => {
    // A missing letter would silently read as one syllable and make every word
    // containing it look overrun, so it would be re-queued until it retired.
    for (const letter of Object.values(Letter)) {
      expect(syllablesOf(letter), `missing ${letter}`).toBeGreaterThan(0);
    }
  });

  it("counts the names that a rule would get wrong", () => {
    expect(syllablesOf(Letter.W)).toBe(3); // "double-you"
    expect(syllablesOf(Letter.PSI)).toBe(1); // "sigh"
    expect(syllablesOf(Letter.OMEGA)).toBe(3);
    expect(syllablesOf(Letter.A)).toBe(1);
  });

  it("adds one syllable for the spoken dash", () => {
    expect(syllablesOf(Letter.W_DASH)).toBe(syllablesOf(Letter.W) + 1);
    expect(syllablesOf(Letter.SIGMA_DASH)).toBe(syllablesOf(Letter.SIGMA) + 1);
  });

  it("sums a word", () => {
    expect(syllablesInWord([Letter.ALPHA, Letter.W, Letter.PSI])).toBe(6);
  });
});
