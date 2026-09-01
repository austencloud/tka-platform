import { describe, expect, it } from "vitest";
import { createSoloProp } from "$lib/shared/foundation/services/solo-prop-factory";
import {
  handPathToSequence,
  soloPropToSequence,
} from "$lib/shared/foundation/services/solo-prop-sequence-adapter";
import { createHandPath } from "$lib/shared/foundation/services/hand-path-factory";
import { getSequenceMotionProfile } from "$lib/shared/foundation/services/sequence-motion-profile";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { hashSoloProp } from "$lib/shared/foundation/services/content-hasher";
import {
  extractLeftSoloProp,
  extractRightSoloProp,
} from "$lib/shared/foundation/services/sequence-decomposer";

const SOLO = createSoloProp(
  [
    {
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.EAST,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      turns: 1,
      duration: 1,
    },
  ],
  GridLocation.NORTH,
  Orientation.IN,
  { name: "Arc" }
);

describe("soloPropToSequence", () => {
  it("projects the same choreography to the authored left hand", () => {
    const sequence = soloPropToSequence(SOLO, "left");
    expect(getSequenceMotionProfile(sequence)).toMatchObject({
      kind: "solo",
      hand: "left",
      authoredHand: "left",
    });
    expect(hashSoloProp(extractLeftSoloProp(sequence))).toBe(SOLO.contentHash);
  });

  it("reassigns presentation to the right hand without changing content", () => {
    const sequence = soloPropToSequence(SOLO, "right");
    expect(getSequenceMotionProfile(sequence)).toMatchObject({
      kind: "solo",
      hand: "right",
      authoredHand: "right",
    });
    expect(hashSoloProp(extractRightSoloProp(sequence))).toBe(SOLO.contentHash);
  });

  it("refuses a zero-step hand path instead of creating an empty card", () => {
    const handPath = createHandPath([GridLocation.NORTH]);

    expect(() => handPathToSequence(handPath, "left")).toThrow(
      "a visible path needs at least two locations"
    );
  });
});
