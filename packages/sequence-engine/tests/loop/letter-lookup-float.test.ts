import { describe, expect, it } from "vitest";
import { findLetterByMotions } from "../../src/loop/LetterLookup.js";

const pictographs = [
  {
    letter: "A",
    startPosition: "alpha1",
    endPosition: "alpha3",
    timing: "together",
    direction: "same",
    blueMotion: {
      motionType: "pro",
      rotationDirection: "cw",
      startLocation: "s",
      endLocation: "e",
    },
    redMotion: {
      motionType: "anti",
      rotationDirection: "ccw",
      startLocation: "n",
      endLocation: "w",
    },
  },
];

describe("findLetterByMotions float provenance", () => {
  it("matches float output through its original shift type and rotation", () => {
    expect(
      findLetterByMotions(
        {
          motionType: "float",
          rotationDirection: "noRotation",
          prefloatMotionType: "pro",
          prefloatRotationDirection: "cw",
          startLocation: "s",
          endLocation: "e",
        },
        {
          motionType: "float",
          rotationDirection: "noRotation",
          prefloatMotionType: "anti",
          prefloatRotationDirection: "ccw",
          startLocation: "n",
          endLocation: "w",
        },
        pictographs
      )
    ).toBe("A");
  });
});
