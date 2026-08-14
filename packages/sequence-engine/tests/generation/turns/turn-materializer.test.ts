import { describe, expect, it } from "vitest";
import { materializeTurn } from "../../../src/generation/turns/TurnMaterializer.js";

describe("materializeTurn", () => {
  it("turns a shift float into canonical float motion data", () => {
    expect(
      materializeTurn({ motionType: "pro", rotationDirection: "cw" }, "fl")
    ).toEqual({
      motionType: "float",
      rotationDirection: "noRotation",
      turns: "fl",
      prefloatMotionType: "pro",
      prefloatRotationDirection: "cw",
    });
  });

  it("collapses a float assigned to a static into zero turns", () => {
    expect(
      materializeTurn(
        { motionType: "static", rotationDirection: "noRotation" },
        "fl"
      )
    ).toEqual({
      motionType: "static",
      rotationDirection: "noRotation",
      turns: 0,
    });
  });

  it("gives a newly turning motion a deterministic direction", () => {
    expect(
      materializeTurn(
        { motionType: "dash", rotationDirection: "noRotation" },
        1,
        { random: () => 0.9 }
      ).rotationDirection
    ).toBe("ccw");
  });
});
