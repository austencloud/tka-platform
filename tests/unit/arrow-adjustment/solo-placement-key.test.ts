import { describe, expect, it } from "vitest";
import { generatePlacementKey } from "$lib/shared/pictograph/arrow/positioning/key-generation/services/arrow-placement-key-generator";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

const AVAILABLE_KEYS = [
  "static_to_layer1_alpha",
  "static_to_layer1_beta",
  "static",
];

function staticMotion(color: MotionColor) {
  return createMotionData({
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    startLocation: GridLocation.WEST,
    endLocation: GridLocation.WEST,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    turns: 0,
    color,
  });
}

describe("solo arrow placement keys", () => {
  const blue = staticMotion(MotionColor.BLUE);
  const red = staticMotion(MotionColor.RED);

  it("resolves an invisible placeholder exactly like an absent partner", () => {
    const absentPartner: PictographData = {
      id: "solo-absent",
      motions: { blue },
    };
    const placeholderPartner: PictographData = {
      id: "solo-placeholder",
      motions: { blue, red: { ...red, isVisible: false } },
    };

    const absentKey = generatePlacementKey(blue, absentPartner, AVAILABLE_KEYS);
    const placeholderKey = generatePlacementKey(
      blue,
      placeholderPartner,
      AVAILABLE_KEYS
    );

    expect(absentKey).toBe("static_to_layer1_alpha");
    expect(placeholderKey).toBe(absentKey);
  });

  it("keeps a genuinely paired beta pictograph beta-specific", () => {
    const paired: PictographData = {
      id: "paired-beta",
      letter: "G" as PictographData["letter"],
      motions: { blue, red },
    };

    expect(generatePlacementKey(blue, paired, AVAILABLE_KEYS)).toBe(
      "static_to_layer1_beta"
    );
  });
});
