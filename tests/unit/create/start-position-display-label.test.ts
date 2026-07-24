import { describe, expect, it } from "vitest";
import { getStartPositionDisplayLabel } from "$lib/features/create/construct/start-position-picker/services/start-position-display-label";

describe("start position display label", () => {
  it("combines the canonical Greek letter and position number", () => {
    expect(
      getStartPositionDisplayLabel({
        letter: "α",
        startPosition: "alpha1",
      } as never)
    ).toBe("α1");
  });

  it("returns null until the position can be recognized", () => {
    expect(
      getStartPositionDisplayLabel({
        letter: null,
        startPosition: null,
      })
    ).toBeNull();
  });
});
