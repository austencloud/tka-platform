import { describe, it, expect } from "vitest";
import {
  getArrowPath,
  getArrowSvgPath,
} from "$lib/shared/pictograph/arrow/rendering/services/arrow-path-resolver";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { createArrowPlacementData } from "$lib/shared/pictograph/arrow/positioning/placement/domain/create-arrow-placement-data";
import {
  MotionType,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

const HALF = { t0: 0, t1: 0.5 };

describe("arrow path resolvers — _half variant (turn-invariant, no skew)", () => {
  it("getArrowPath returns the _half asset for a segment pro motion", () => {
    const m = createMotionData({
      motionType: MotionType.PRO,
      turns: 1,
      startOrientation: Orientation.IN,
      segment: HALF,
    });
    expect(getArrowPath(createArrowPlacementData(), m)).toBe(
      "/images/arrows/pro_half/from_radial/pro_half.svg"
    );
  });

  it("getArrowSvgPath returns the _half asset for a segment anti motion", () => {
    const m = createMotionData({
      motionType: MotionType.ANTI,
      turns: 2,
      startOrientation: Orientation.IN,
      segment: HALF,
    });
    expect(getArrowSvgPath(m)).toBe(
      "/images/arrows/anti_half/from_radial/anti_half.svg"
    );
  });

  it("does NOT alter the path for a non-segment (full) motion", () => {
    const m = createMotionData({
      motionType: MotionType.PRO,
      turns: 1,
      startOrientation: Orientation.IN,
    });
    expect(getArrowPath(createArrowPlacementData(), m)).toBe(
      "/images/arrows/pro/from_radial/pro_1.0.svg"
    );
    expect(getArrowSvgPath(m)).toBe(
      "/images/arrows/pro/from_radial/pro_1.0.svg"
    );
  });
});
