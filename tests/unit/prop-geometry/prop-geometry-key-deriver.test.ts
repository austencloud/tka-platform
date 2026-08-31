import { describe, it, expect } from "vitest";
import { derivePropGeometryKey } from "$lib/shared/pictograph/arrow/positioning/prop-geometry/domain/prop-geometry-key-deriver";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";

function makeMotion(over: Partial<MotionData> = {}): MotionData {
  return {
    color: "blue",
    motionType: "anti",
    startLocation: "w",
    endLocation: "n",
    startOrientation: "in",
    endOrientation: "out",
    rotationDirection: "ccw",
    turns: 1.5,
    propType: "staff",
    gridMode: "diamond",
    ...over,
  } as MotionData;
}

function makePictograph(left: MotionData, right: MotionData): PictographData {
  return {
    id: "t",
    letter: "Q",
    startPosition: "gamma1",
    endPosition: "gamma15",
    motions: { left, right },
  } as PictographData;
}

describe("derivePropGeometryKey", () => {
  it("builds a 9-dimension key from blue motion context", () => {
    const left = makeMotion();
    const right = makeMotion({ color: "red", motionType: "static", endOrientation: "in", turns: 0 });
    const key = derivePropGeometryKey(makePictograph(left, right), left, "blue");
    expect(key).toEqual({
      placementFrame: "canonical",
      propType: "staff",
      otherPropType: "staff",
      positionType: "gamma",
      endOrientation: "out",
      otherEndOrientation: "in",
      motionType: "anti",
      turns: "1.5",
      arrowColor: "blue",
    });
  });

  it("returns null when endPosition is missing", () => {
    const left = makeMotion();
    const right = makeMotion({ color: "red" });
    const pg = makePictograph(left, right);
    (pg as { endPosition?: string }).endPosition = undefined;
    expect(derivePropGeometryKey(pg, left, "blue")).toBeNull();
  });

  it("returns null when a motion is absent", () => {
    const left = makeMotion();
    const pg = { id: "t", letter: "Q", startPosition: "a", endPosition: "beta5", motions: { left } } as unknown as PictographData;
    expect(derivePropGeometryKey(pg, left, "blue")).toBeNull();
  });
});
