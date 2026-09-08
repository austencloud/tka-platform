import { describe, expect, it } from "vitest";
import { normalizePersistedGridCell } from "./arrange-grid-persister";

describe("Arrange grid persistence", () => {
  it("restores literal blue/red cell visibility", () => {
    expect(
      normalizePersistedGridCell({
        id: "cell-1",
        blueMotionVisible: false,
        redMotionVisible: true,
      })
    ).toEqual({
      id: "cell-1",
      leftMotionVisible: false,
      rightMotionVisible: true,
    });
  });
});
