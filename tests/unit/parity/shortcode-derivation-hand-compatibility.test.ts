import { describe, expect, it } from "vitest";
import {
  deriveFromSteps,
  letterForBeat,
} from "../../../scripts/migrations/lib/shortcode-derivation";

const leftMotion = {
  motionType: "pro",
  rotationDirection: "cw",
  startLocation: "w",
  endLocation: "n",
};

const rightMotion = {
  motionType: "pro",
  rotationDirection: "cw",
  startLocation: "e",
  endLocation: "s",
};

describe("shortcode derivation hand compatibility", () => {
  it("derives the same letter from canonical and legacy motion keys", () => {
    expect(
      letterForBeat({ motions: { left: leftMotion, right: rightMotion } })
    ).toBe("A");
    expect(
      letterForBeat({ motions: { blue: leftMotion, red: rightMotion } })
    ).toBe("A");
  });

  it("keeps legacy embedded payloads complete during a left/right migration", () => {
    const result = deriveFromSteps(
      [
        {
          stepNumber: 1,
          motions: { blue: leftMotion, red: rightMotion },
        },
        {
          stepNumber: 2,
          motions: { blue: leftMotion, red: rightMotion },
        },
      ],
      "embedded"
    );

    expect(result).toMatchObject({
      word: "AA",
      complete: true,
      missingStepIndexes: [],
      stepCount: 2,
    });
  });
});
