import { describe, expect, it } from "vitest";
import { matchesLibraryTagIds } from "../library-repository";

describe("matchesLibraryTagIds", () => {
  it("matches legacy tagIds and structured sequenceTags with OR semantics", () => {
    expect(
      matchesLibraryTagIds({ tagIds: ["legacy"], sequenceTags: [] }, ["legacy"])
    ).toBe(true);
    expect(
      matchesLibraryTagIds(
        {
          tagIds: [],
          sequenceTags: [
            {
              tagId: "structured",
              source: "user",
              addedAt: new Date(),
            },
          ],
        },
        ["missing", "structured"]
      )
    ).toBe(true);
    expect(
      matchesLibraryTagIds({ tagIds: ["other"], sequenceTags: [] }, ["missing"])
    ).toBe(false);
  });
});
