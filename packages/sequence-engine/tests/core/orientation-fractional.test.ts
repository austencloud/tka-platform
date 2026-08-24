import { describe, expect, it } from "vitest";
import { calculateEndOrientation } from "../../src/core/orientation/OrientationCalculator.js";

describe("fractional orientation continuity", () => {
  it("retains the anti/dash zero-turn reversal before adding quarter turns", () => {
    for (const motionType of ["anti", "dash"]) {
      expect(
        calculateEndOrientation({
          motionType,
          turns: 0.25,
          rotationDirection: "cw",
          startLocation: "n",
          endLocation: "e",
          startOrientation: "in",
        })
      ).toBe("clockOut");
      expect(
        calculateEndOrientation({
          motionType,
          turns: 0.75,
          rotationDirection: "cw",
          startLocation: "n",
          endLocation: "e",
          startOrientation: "in",
        })
      ).toBe("clockIn");
      expect(
        calculateEndOrientation({
          motionType,
          turns: 1,
          rotationDirection: "cw",
          startLocation: "n",
          endLocation: "e",
          startOrientation: "in",
        })
      ).toBe("in");
    }
  });

  it("applies physical prop rotation in the same direction for every motion family", () => {
    expect(
      calculateEndOrientation({
        motionType: "pro",
        turns: 0.25,
        rotationDirection: "cw",
        startLocation: "n",
        endLocation: "e",
        startOrientation: "in",
      })
    ).toBe("counterIn");
    expect(
      calculateEndOrientation({
        motionType: "anti",
        turns: 0.25,
        rotationDirection: "cw",
        startLocation: "n",
        endLocation: "e",
        startOrientation: "in",
      })
    ).toBe("clockOut");
  });
});
