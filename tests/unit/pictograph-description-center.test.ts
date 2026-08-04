import { describe, expect, it } from "vitest";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { describePictograph } from "$lib/shared/pictograph/shared/domain/utils/pictograph-description";

describe("center pictograph description", () => {
  it("speaks the center location instead of exposing its storage code", () => {
    const blue = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: GridLocation.CENTER,
      endLocation: GridLocation.CENTER,
      isVisible: true,
    });

    expect(describePictograph({ motions: { blue } })).toContain(
      "Blue hand static hold at center."
    );
  });
});
