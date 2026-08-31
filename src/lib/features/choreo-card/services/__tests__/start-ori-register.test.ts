import { describe, it, expect } from "vitest";
import {
  resolveStartOrientation,
  positionFamilyOf,
} from "../start-ori-register";
import { Orientation, HandSide } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";

const { IN, CLOCK, COUNTER } = Orientation;

describe("resolveStartOrientation — family-aware register table", () => {
  it("radial is in|in for every family", () => {
    for (const fam of ["alpha", "beta", "gamma"] as const) {
      expect(resolveStartOrientation("radial", fam)).toEqual({ left: IN, right: IN });
    }
  });

  it("mixed (split): alpha=in|counter, beta=in|clock, gamma=in|counter", () => {
    expect(resolveStartOrientation("split", "alpha")).toEqual({ left: IN, right: COUNTER });
    expect(resolveStartOrientation("split", "beta")).toEqual({ left: IN, right: CLOCK });
    expect(resolveStartOrientation("split", "gamma")).toEqual({ left: IN, right: COUNTER });
  });

  it("nonradial: alpha=clock|counter, beta=counter|clock, gamma=clock|counter", () => {
    expect(resolveStartOrientation("nonradial", "alpha")).toEqual({ left: CLOCK, right: COUNTER });
    expect(resolveStartOrientation("nonradial", "beta")).toEqual({ left: COUNTER, right: CLOCK });
    expect(resolveStartOrientation("nonradial", "gamma")).toEqual({ left: CLOCK, right: COUNTER });
  });
});

function startPose(
  left: GridLocation,
  right: GridLocation,
  named?: Partial<StartPositionData>,
): StartPositionData {
  return {
    isStartPosition: true,
    id: "sp",
    motions: {
      [HandSide.LEFT]: createMotionData({ hand: HandSide.LEFT, startLocation: left, endLocation: left }),
      [HandSide.RIGHT]: createMotionData({ hand: HandSide.RIGHT, startLocation: right, endLocation: right }),
    },
    ...named,
  } as StartPositionData;
}

describe("positionFamilyOf", () => {
  it("reads the stored gridPosition when present", () => {
    const sp = startPose(GridLocation.NORTH, GridLocation.SOUTH, { gridPosition: "gamma13" as StartPositionData["gridPosition"] });
    expect(positionFamilyOf(sp)).toBe("gamma");
  });

  it("derives the family from hand locations when no position is stored (both N = beta)", () => {
    const sp = startPose(GridLocation.NORTH, GridLocation.NORTH);
    expect(positionFamilyOf(sp)).toBe("beta");
  });

  it("derives alpha from opposite hands (N / S)", () => {
    const sp = startPose(GridLocation.NORTH, GridLocation.SOUTH);
    expect(positionFamilyOf(sp)).toBe("alpha");
  });

  it("derives gamma from a 90° pair (N / E)", () => {
    const sp = startPose(GridLocation.NORTH, GridLocation.EAST);
    expect(positionFamilyOf(sp)).toBe("gamma");
  });

  it("returns null for an unsupported family it cannot classify", () => {
    const sp = startPose(GridLocation.NORTH, GridLocation.NORTH, {
      gridPosition: "zeta1" as StartPositionData["gridPosition"],
    });
    expect(positionFamilyOf(sp)).toBeNull();
  });
});
