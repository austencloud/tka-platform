import { describe, expect, it } from "vitest";
import { propPlacer } from "./prop-placer";
import DefaultPropPositioner from "./default-prop-positioner";
import { createMotionData } from "../../shared/domain/models/motion-data";
import { createPictographData } from "../../shared/domain/factories/create-pictograph-data";
import { Letter } from "../../../foundation/domain/models/letter";
import { GridLocation, GridMode } from "../../grid/domain/enums/grid-enums";
import {
  HandSide,
  MotionType,
  Orientation,
  RotationDirection,
} from "../../shared/domain/enums/pictograph-enums";

// Regression: letter Y, both props end at the SAME point (beta) at WEST — blue is a
// radial OUT shift (pro) and red is a radial IN static. Both radial, different
// orientation. For one-ended UNILATERAL props (club/fan/etc.) the two props extend in
// opposite directions from the shared point and do not overlap, so the beta separation
// offset must be SKIPPED (render-core Gate 5: sameType-but-different + isUnilateralProp).
//
// The bug: the user's selected prop type never reached the beta calc. The in-app
// singleton carries no settings, so calculateBetaOffset fell back to the STORED "staff"
// (bilateral) type and wrongly applied the 21.11px offset even though clubs render.
// The fix threads per-call propSettings through calculatePlacement → calculateBetaOffset.
describe("PropPlacer beta offset — unilateral radial-but-different (letter Y)", () => {
  const left = createMotionData({
    motionType: MotionType.PRO,
    startLocation: GridLocation.NORTH,
    endLocation: GridLocation.WEST,
    startOrientation: Orientation.OUT,
    endOrientation: Orientation.OUT,
    rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
    hand: HandSide.LEFT,
  });
  const right = createMotionData({
    motionType: MotionType.STATIC,
    startLocation: GridLocation.WEST,
    endLocation: GridLocation.WEST,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    rotationDirection: RotationDirection.NO_ROTATION,
    hand: HandSide.RIGHT,
  });
  const pictograph = createPictographData({
    letter: Letter.Y,
    motions: { left, right },
  });

  const def = DefaultPropPositioner.calculatePosition(
    GridLocation.WEST,
    GridMode.DIAMOND
  );

  it("skips the offset when the actual props are unilateral clubs", async () => {
    const placement = await propPlacer.calculatePlacement(
      pictograph,
      left,
      undefined,
      { leftPropType: "club", rightPropType: "club" }
    );
    // No beta offset → prop sits at the default hand point.
    expect(placement.positionX).toBeCloseTo(def.x, 1);
    expect(placement.positionY).toBeCloseTo(def.y, 1);
  });

  it("still applies the offset for bilateral staffs", async () => {
    const placement = await propPlacer.calculatePlacement(
      pictograph,
      left,
      undefined,
      { leftPropType: "staff", rightPropType: "staff" }
    );
    const moved =
      Math.abs(placement.positionX - def.x) > 0.5 ||
      Math.abs(placement.positionY - def.y) > 0.5;
    expect(moved).toBe(true);
  });

  it("treats an invisible structural partner as absent", async () => {
    const soloPictograph = createPictographData({
      letter: null,
      motions: {
        left,
        right: { ...right, isVisible: false },
      },
    });
    const placement = await propPlacer.calculatePlacement(
      soloPictograph,
      left,
      undefined,
      { leftPropType: "staff", rightPropType: "staff" }
    );

    expect(placement.positionX).toBeCloseTo(def.x, 1);
    expect(placement.positionY).toBeCloseTo(def.y, 1);
  });

  it("removes beta separation when the partner is presentation-hidden", async () => {
    const placement = await propPlacer.calculatePlacement(
      pictograph,
      left,
      { showLeft: true, showRight: false },
      { leftPropType: "staff", rightPropType: "staff" }
    );

    expect(placement.positionX).toBeCloseTo(def.x, 1);
    expect(placement.positionY).toBeCloseTo(def.y, 1);
  });
});
