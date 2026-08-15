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

function makePictograph(blue: MotionData, red: MotionData): PictographData {
  return {
    id: "t",
    letter: "Q",
    startPosition: "gamma1",
    endPosition: "gamma15",
    motions: { blue, red },
  } as PictographData;
}

describe("derivePropGeometryKey", () => {
  it("builds a 9-dimension key from blue motion context", () => {
    const blue = makeMotion();
    const red = makeMotion({ color: "red", motionType: "static", endOrientation: "in", turns: 0 });
    const key = derivePropGeometryKey(makePictograph(blue, red), blue, "blue");
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
    const blue = makeMotion();
    const red = makeMotion({ color: "red" });
    const pg = makePictograph(blue, red);
    (pg as { endPosition?: string }).endPosition = undefined;
    expect(derivePropGeometryKey(pg, blue, "blue")).toBeNull();
  });

  it("returns null when a motion is absent", () => {
    const blue = makeMotion();
    const pg = { id: "t", letter: "Q", startPosition: "a", endPosition: "beta5", motions: { blue } } as unknown as PictographData;
    expect(derivePropGeometryKey(pg, blue, "blue")).toBeNull();
  });
});
