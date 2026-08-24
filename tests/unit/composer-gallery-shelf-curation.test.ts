import { describe, expect, it } from "vitest";
import { pickShelfSequences } from "../../src/routes/(public)/composer/_components/composer-gallery-shelf-curation";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

function publicEntry(overrides: Partial<SequenceData>): SequenceData {
  return {
    id: "seq-id",
    name: "AB",
    word: "AB",
    steps: [],
    thumbnails: ["https://example.com/thumb.webp"],
    isFavorite: false,
    isCircular: false,
    tags: [],
    metadata: {},
    ...overrides,
  } as SequenceData;
}

describe("pickShelfSequences", () => {
  it("drops entries with neither thumbnails nor steps", () => {
    const picked = pickShelfSequences(
      [
        publicEntry({ id: "bare", word: "XY", thumbnails: [] }),
        publicEntry({ id: "thumbed", word: "AB" }),
      ],
      7
    );
    expect(picked.map((s) => s.id)).toEqual(["thumbed"]);
  });

  it("keeps one card per simplified word", () => {
    const picked = pickShelfSequences(
      [
        publicEntry({ id: "loop-long", word: "ABAB" }),
        publicEntry({ id: "loop-short", word: "AB" }),
        publicEntry({ id: "other", word: "CD" }),
      ],
      7
    );
    const words = picked.map((s) => s.word);
    expect(words).toHaveLength(2);
    expect(words).toContain("CD");
    expect(words.filter((w) => w === "AB" || w === "ABAB")).toHaveLength(1);
  });

  it("ranks thumbnail-backed popular work first and respects the count", () => {
    const picked = pickShelfSequences(
      [
        publicEntry({
          id: "steps-only",
          word: "EF",
          thumbnails: [],
          steps: [{ id: "s1" }] as SequenceData["steps"],
        }),
        publicEntry({ id: "quiet", word: "GH", publicPerformanceCount: 0 }),
        publicEntry({ id: "popular", word: "IJ", publicPerformanceCount: 5 }),
      ],
      2
    );
    expect(picked.map((s) => s.id)).toEqual(["popular", "quiet"]);
  });
});
