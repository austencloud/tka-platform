import { describe, it, expect } from "vitest";
import { copyWaste, minZeroWasteCopies, suggestCopyCounts } from "../print-copy-suggester";

// "TKA 1: Learning Letters" shape: one group of 4 (sun) + five groups of 3.
const LEARNING_LETTERS = [4, 3, 3, 3, 3, 3];

describe("copyWaste", () => {
  it("is zero-blank at 9 copies for the learning-letters deck (poker 3x3)", () => {
    const w = copyWaste(LEARNING_LETTERS, 9, 9);
    expect(w.sheets).toBe(19);
    expect(w.blanks).toBe(0);
    expect(w.wastePct).toBe(0);
  });

  it("blanks come only from the size-4 group at 3 and 6 copies", () => {
    expect(copyWaste(LEARNING_LETTERS, 9, 3).blanks).toBe(6);
    expect(copyWaste(LEARNING_LETTERS, 9, 6).blanks).toBe(3);
  });

  it("clamps copies < 1 to 1", () => {
    expect(copyWaste([3], 9, 0).sheets).toBe(1);
  });
});

describe("minZeroWasteCopies", () => {
  it("is 9 for learning letters on poker (size-4 group is binding)", () => {
    expect(minZeroWasteCopies(LEARNING_LETTERS, 9)).toBe(9);
  });

  it("is 6 for learning letters on tarot (3x2 = 6 per sheet)", () => {
    expect(minZeroWasteCopies(LEARNING_LETTERS, 6)).toBe(6);
  });

  it("is 3 when all groups are size 3 on poker", () => {
    expect(minZeroWasteCopies([3, 3], 9)).toBe(3);
  });

  it("is 1 for an empty deck", () => {
    expect(minZeroWasteCopies([], 9)).toBe(1);
  });
});

describe("suggestCopyCounts", () => {
  it("returns the Pareto-improving ladder ending in a perfect fit", () => {
    const s = suggestCopyCounts(LEARNING_LETTERS, 9);
    expect(s.map((x) => x.copies)).toEqual([1, 2, 3, 6, 9]);
    expect(s[s.length - 1]!.perfect).toBe(true);
    expect(s[s.length - 1]!.copies).toBe(9);
    // each step strictly improves waste
    for (let i = 1; i < s.length; i++) {
      expect(s[i]!.wastePct).toBeLessThan(s[i - 1]!.wastePct);
    }
  });

  it("always includes copies=1 first", () => {
    expect(suggestCopyCounts(LEARNING_LETTERS, 9)[0]!.copies).toBe(1);
  });

  it("respects a limit by keeping copies=1 plus the lowest-waste tail", () => {
    const s = suggestCopyCounts(LEARNING_LETTERS, 9, { limit: 3 });
    expect(s.length).toBeLessThanOrEqual(3);
    expect(s[0]!.copies).toBe(1);
    expect(s[s.length - 1]!.copies).toBe(9); // perfect fit survives the cap
  });

  it("handles a single uniform group", () => {
    const s = suggestCopyCounts([3], 9);
    expect(s[0]!.copies).toBe(1);
    expect(s[s.length - 1]!.perfect).toBe(true);
    expect(s[s.length - 1]!.copies).toBe(3);
  });
});
