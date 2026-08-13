import { describe, expect, it } from "vitest";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  dashClockwiseOverrideMap,
  dashCounterClockwiseOverrideMap,
} from "$lib/shared/pictograph/arrow/positioning/calculation/config/dash-rotation-maps";
import { checkAndApplyOverride } from "$lib/shared/pictograph/arrow/positioning/calculation/utils/rotation-override-checker";
import type { IRotationAngleOverrideKeyGenerator } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/rotation-angle-override-key-generator";
import type { SpecialPlacer } from "$lib/shared/pictograph/arrow/positioning/placement/services/special-placer";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

const OG_CLOCKWISE_OVERRIDES = {
  [GridLocation.NORTH]: 270,
  [GridLocation.EAST]: 0,
  [GridLocation.SOUTH]: 90,
  [GridLocation.WEST]: 180,
  [GridLocation.NORTHEAST]: 315,
  [GridLocation.SOUTHEAST]: 45,
  [GridLocation.SOUTHWEST]: 135,
  [GridLocation.NORTHWEST]: 225,
};

const OG_COUNTERCLOCKWISE_OVERRIDES = {
  [GridLocation.NORTH]: 270,
  [GridLocation.EAST]: 180,
  [GridLocation.SOUTH]: 90,
  [GridLocation.WEST]: 0,
  [GridLocation.NORTHEAST]: 225,
  [GridLocation.SOUTHEAST]: 135,
  [GridLocation.SOUTHWEST]: 45,
  [GridLocation.NORTHWEST]: 315,
};

describe("DASH rotation override maps", () => {
  it("matches every OG desktop clockwise override angle", () => {
    expect(dashClockwiseOverrideMap).toEqual(OG_CLOCKWISE_OVERRIDES);
  });

  it("matches every OG desktop counterclockwise override angle", () => {
    expect(dashCounterClockwiseOverrideMap).toEqual(
      OG_COUNTERCLOCKWISE_OVERRIDES
    );
  });

  it("does not invent a center override for a DASH arrow", () => {
    expect(dashClockwiseOverrideMap[GridLocation.CENTER]).toBeUndefined();
    expect(
      dashCounterClockwiseOverrideMap[GridLocation.CENTER]
    ).toBeUndefined();
  });

  it("keeps the OG straight-line angle when the DASH has no prop rotation", async () => {
    const motion = createMotionData({
      color: MotionColor.BLUE,
      motionType: MotionType.DASH,
      turns: 0,
      rotationDirection: RotationDirection.NO_ROTATION,
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.SOUTH,
      arrowLocation: GridLocation.EAST,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.OUT,
    });
    const specialPlacer = {
      hasRotationAngleOverride: async () => true,
    } as unknown as SpecialPlacer;
    const keyGenerator = {
      generateRotationAngleOverrideKey: () => "dash_rot_angle_override",
    } as unknown as IRotationAngleOverrideKeyGenerator;

    await expect(
      checkAndApplyOverride(
        motion,
        GridLocation.EAST,
        {} as PictographData,
        true,
        specialPlacer,
        keyGenerator
      )
    ).resolves.toBe(90);
  });
});
