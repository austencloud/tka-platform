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

  it("the 16-count word list is the complete, duplicate-free bucket", () => {
    // All twelve, measured directly from by-count.mjs on 2026-08-05. The second
    // six are phases of the first six; see the doc comment on
    // A_G_SIXTEEN_COUNT_WORDS.
    expect(new Set(A_G_SIXTEEN_COUNT_WORDS).size).toBe(
      A_G_SIXTEEN_COUNT_WORDS.length
    );
    expect(A_G_SIXTEEN_COUNT_WORDS.length).toBe(
      A_G_COUNT_BUCKET_PROFILE[16]!
    );
  });

  it("every recorded word is a 4-letter unit (both buckets are 4-step units)", () => {
    for (const w of [...A_G_FOUR_COUNT_WORDS, ...A_G_SIXTEEN_COUNT_WORDS]) {
      expect([...w].length, w).toBe(4);
    }
  });

  it("every recorded word contains both cards", () => {
    // NOT "starts with A". An earlier version asserted that and passed, but only
    // because the 16-count list was then an incomplete 6 of 12. A phase begins
    // at whichever step it was entered on — JGΦA is AJGΦ read from step two —
    // so the real invariant is membership, not position. A circular word has no
    // privileged first letter.
    for (const w of [...A_G_FOUR_COUNT_WORDS, ...A_G_SIXTEEN_COUNT_WORDS]) {
      expect(w.includes("A"), w).toBe(true);
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
