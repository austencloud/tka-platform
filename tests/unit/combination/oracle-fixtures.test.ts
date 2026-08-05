import { describe, expect, it } from "vitest";

import {
  A_G_COUNT_BUCKET_PROFILE,
  A_G_FOUR_COUNT_WORDS,
  A_G_SIXTEEN_COUNT_WORDS,
  ALL_PAIR_FINGERPRINTS,
  COMPOUND_CARD_PAIR_FINGERPRINTS,
  CROSS_WORLD_PAIR_FINGERPRINTS,
  predictCrossWorldFingerprint,
  SAME_WORLD_PAIR_FINGERPRINTS,
} from "./oracle-fixtures";

// This suite checks the fixture is INTERNALLY consistent — that the numbers
// transcribed from scripts/combinator-research/ agree with each other. It
// does not call app source (nothing under src/ is imported here) and it does
// not re-run the research scripts. See oracle-fixtures.ts for the full
// provenance and known limits.

describe("oracle fixtures — pair fingerprint tables", () => {
  it("has no duplicate pair entries across the three regimes", () => {
    const keys = ALL_PAIR_FINGERPRINTS.map((f) =>
      [f.cardA, f.cardB].sort().join("+")
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("records only positive integer word counts", () => {
    for (const f of ALL_PAIR_FINGERPRINTS) {
      expect(Number.isInteger(f.words), `${f.cardA}+${f.cardB}`).toBe(true);
      expect(f.words, `${f.cardA}+${f.cardB}`).toBeGreaterThan(0);
    }
  });

  it("cross-world fingerprints are only ever 256 or 512", () => {
    for (const f of CROSS_WORLD_PAIR_FINGERPRINTS) {
      expect([256, 512], `${f.cardA}+${f.cardB}`).toContain(f.words);
    }
  });

  it("same-world and compound fingerprints all exceed the cross-world ceiling", () => {
    // The exploding regimes (same-world, compound) never collide with the
    // 256/512 cross-world law — every value here is well above 512.
    for (const f of [
      ...SAME_WORLD_PAIR_FINGERPRINTS,
      ...COMPOUND_CARD_PAIR_FINGERPRINTS,
    ]) {
      expect(f.words, `${f.cardA}+${f.cardB}`).toBeGreaterThan(512);
    }
  });
});

describe("oracle fixtures — the fingerprint law", () => {
  it("predictCrossWorldFingerprint reproduces every recorded cross-world fingerprint", () => {
    for (const f of CROSS_WORLD_PAIR_FINGERPRINTS) {
      expect(
        predictCrossWorldFingerprint(f.cardA, f.cardB),
        `${f.cardA}+${f.cardB}`
      ).toBe(f.words);
      // The law is symmetric in its two cards.
      expect(
        predictCrossWorldFingerprint(f.cardB, f.cardA),
        `${f.cardB}+${f.cardA}`
      ).toBe(f.words);
    }
  });

  it("only the three gap-involution partner pairs predict 256", () => {
    const at256 = CROSS_WORLD_PAIR_FINGERPRINTS.filter((f) => f.words === 256);
    expect(
      at256.map((f) => [f.cardA, f.cardB].sort().join("+")).sort()
    ).toEqual(["A+G", "B+H", "C+I"]);
    expect(
      CROSS_WORLD_PAIR_FINGERPRINTS.filter((f) => f.words === 512).length
    ).toBe(CROSS_WORLD_PAIR_FINGERPRINTS.length - 3);
  });
});

describe("oracle fixtures — A+G count-bucket profile", () => {
  it("the 4-count word list is complete: its length equals the bucket profile", () => {
    expect(new Set(A_G_FOUR_COUNT_WORDS).size).toBe(A_G_FOUR_COUNT_WORDS.length);
    expect(A_G_FOUR_COUNT_WORDS.length).toBe(A_G_COUNT_BUCKET_PROFILE[4]);
  });

  it("the 16-count word list is a non-empty, duplicate-free subset of its bucket count", () => {
    // Deliberately NOT asserting equality here — this fixture only recorded
    // 6 of the bucket's 12 words (see the doc comment on
    // A_G_SIXTEEN_COUNT_WORDS). Asserting == would be a fabricated claim.
    expect(new Set(A_G_SIXTEEN_COUNT_WORDS).size).toBe(
      A_G_SIXTEEN_COUNT_WORDS.length
    );
    expect(A_G_SIXTEEN_COUNT_WORDS.length).toBeGreaterThan(0);
    expect(A_G_SIXTEEN_COUNT_WORDS.length).toBeLessThanOrEqual(
      A_G_COUNT_BUCKET_PROFILE[16]!
    );
  });

  it("every recorded word is a 4-letter unit (both buckets are 4-step units)", () => {
    for (const w of [...A_G_FOUR_COUNT_WORDS, ...A_G_SIXTEEN_COUNT_WORDS]) {
      expect([...w].length, w).toBe(4);
    }
  });

  it("every recorded word starts with A and contains G (both cards required)", () => {
    for (const w of [...A_G_FOUR_COUNT_WORDS, ...A_G_SIXTEEN_COUNT_WORDS]) {
      expect(w.startsWith("A"), w).toBe(true);
      expect(w.includes("G"), w).toBe(true);
    }
  });

  it("the profile's nine buckets do not sum to the 256-word fingerprint", () => {
    // Documented in the fixture: a word can close via more than one
    // transform and land in more than one bucket. This asserts the fixture
    // is honest about that, not that the arithmetic is a coincidence.
    const total = Object.values(A_G_COUNT_BUCKET_PROFILE).reduce(
      (a, b) => a + b,
      0
    );
    expect(total).toBe(460);
    expect(total).not.toBe(256);
  });
});
