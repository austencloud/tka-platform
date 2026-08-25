import { describe, expect, it } from "vitest";

import { CollectedFilmSchema } from "../../../src/lib/features/film-collection/domain/film-collection-types";

const base = {
  id: "entry-1",
  name: "My cut",
  createdAt: 1_700_000_000_000,
  poster: "",
  film: { id: "star-of-five", title: "Star of Five", version: 1 },
  durationSeconds: 32,
  sceneCount: 2,
};

describe("CollectedFilmSchema previousFilm", () => {
  it("accepts an entry that has never been overwritten", () => {
    expect(CollectedFilmSchema.parse(base).previousFilm).toBeUndefined();
  });

  it("round-trips the document held before the last overwrite", () => {
    const parsed = CollectedFilmSchema.parse({
      ...base,
      previousFilm: { id: "star-of-five", title: "Star of Five", version: 1 },
    });
    expect(parsed.previousFilm?.title).toBe("Star of Five");
  });

  it("passes unknown keys on the prior document through untouched", () => {
    const parsed = CollectedFilmSchema.parse({
      ...base,
      previousFilm: {
        id: "star-of-five",
        title: "Star of Five",
        version: 1,
        scenes: [{ id: "reveal" }],
      },
    });
    expect((parsed.previousFilm as Record<string, unknown>).scenes).toEqual([
      { id: "reveal" },
    ]);
  });

  it("rejects a prior document missing its identity", () => {
    expect(() =>
      CollectedFilmSchema.parse({ ...base, previousFilm: { title: "x" } })
    ).toThrow();
  });
});
