import { describe, expect, it } from "vitest";
import { PropType } from "@austencloud/scene-3d";
import {
  FAN_TIP_POINTS,
  QUIAD_TIP_POINTS,
  TRIAD_TIP_POINTS,
} from "$lib/shared/animation-engine/domain/types/prop-tip-points";
import { FAN_FIRE_WICK_CENTERS_M } from "./prop-build-tip-geometry-3d";
import { resolvePropTipAnchors3D } from "./prop-tip-geometry-3d";

const PICTOGRAPH = { fanBuild: "pictograph", finish: "day" } as const;

describe("resolvePropTipAnchors3D", () => {
  it("places all five fire fan emitters at measured wick centres", () => {
    const anchors = resolvePropTipAnchors3D(PropType.FAN, 0.5, {
      fanBuild: "fire",
      finish: "fire",
    });
    expect(anchors).toEqual(
      FAN_FIRE_WICK_CENTERS_M.map((offset) => ({
        effectTipIndex: 1,
        offset,
      }))
    );
  });

  it("scales five pictograph fan rib ends with staff length", () => {
    const staffLength = 0.8636;
    const anchors = resolvePropTipAnchors3D(
      PropType.FAN,
      staffLength / 2,
      PICTOGRAPH
    );
    expect(anchors).toHaveLength(5);
    anchors.forEach((anchor, index) => {
      expect(anchor.offset.x).toBeCloseTo(
        FAN_TIP_POINTS.points[index].dy * (staffLength / 252.8)
      );
      expect(anchor.offset.y).toBeCloseTo(
        FAN_TIP_POINTS.points[index].dx * (staffLength / 252.8)
      );
    });
  });

  it.each([
    [PropType.TRIAD, TRIAD_TIP_POINTS],
    [PropType.QUIAD, QUIAD_TIP_POINTS],
  ])("preserves every scaling emitter for %s", (propType, points) => {
    const anchors = resolvePropTipAnchors3D(propType, 0.5, PICTOGRAPH);
    expect(anchors).toHaveLength(points.points.length);
    anchors.forEach((anchor, index) => {
      expect(anchor.offset.x).toBeCloseTo(points.points[index].dy / 252.8);
      expect(anchor.offset.y).toBeCloseTo(points.points[index].dx / 252.8);
      expect(anchor.offset.z).toBe(0);
    });
  });

  it.each([
    [PropType.STAFF, 0.5, [-0.5, 0.5]],
    [PropType.CLUB, 0.5, [0.50343]],
    [PropType.SWORD, 0.5, [0.61706]],
    [PropType.CAPSULE_BATON, 0.5, [-0.4099367, 0.4099367]],
    [PropType.FIRE_DOUBLE_STAFF, 0.5, [-0.413, 0.413]],
  ])("keeps %s emitter reach unchanged", (propType, halfLength, expectedY) => {
    const anchors = resolvePropTipAnchors3D(propType, halfLength, PICTOGRAPH);
    expect(anchors.map((anchor) => anchor.offset)).toEqual(
      expectedY.map((y) => ({ x: 0, y, z: 0 }))
    );
  });
});
