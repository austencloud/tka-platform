/**
 * buildPlacementTransition shapes the in-place start-position move animation:
 * the moving prop gets a pro-with-zero-turns arc motion (forced "arc" path so
 * the global path-shape setting can't flatten it) and the partner stays a
 * static hold, so calculatePictographMotionPositions resolves its beta offset
 * via the prepared-endpoint correction lerp.
 */

import { describe, expect, it } from "vitest";
import {
  GridLocation,
  GridMode,
} from "../../src/lib/shared/pictograph/grid/domain/enums/grid-enums";
import { buildPlacementTransition } from "../../src/lib/shared/pictograph/grid/services/prop-placement-view-model";
import { PropType } from "../../src/lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "../../src/lib/shared/pictograph/shared/domain/enums/pictograph-enums";

const baseInput = {
  gridMode: GridMode.DIAMOND,
  blueOrientation: Orientation.IN,
  redOrientation: Orientation.IN,
  bluePropType: PropType.STAFF,
  redPropType: PropType.STAFF,
  betaSwapped: false,
  previewPictographData: null,
};

describe("buildPlacementTransition", () => {
  it("gives the moving prop a pro-zero-turns arc and holds the partner static", () => {
    const { startData, transitionStep } = buildPlacementTransition({
      ...baseInput,
      movingColor: MotionColor.BLUE,
      fromLocation: GridLocation.SOUTH,
      toLocation: GridLocation.WEST,
      direction: "clockwise",
      blueLocation: GridLocation.WEST,
      redLocation: GridLocation.NORTH,
    });

    const moving = transitionStep.motions.blue;
    expect(moving.motionType).toBe(MotionType.PRO);
    expect(moving.turns).toBe(0);
    expect(moving.rotationDirection).toBe(RotationDirection.CLOCKWISE);
    expect(moving.startLocation).toBe(GridLocation.SOUTH);
    expect(moving.endLocation).toBe(GridLocation.WEST);
    expect(moving.pathShape).toBe("arc");

    const partner = transitionStep.motions.red;
    expect(partner.motionType).toBe(MotionType.STATIC);
    expect(partner.startLocation).toBe(GridLocation.NORTH);
    expect(partner.endLocation).toBe(GridLocation.NORTH);

    // The start pose has the moving prop at its pre-move location.
    expect(startData.motions.blue?.startLocation).toBe(GridLocation.SOUTH);
    expect(startData.motions.red?.startLocation).toBe(GridLocation.NORTH);

    // PictographContainer only computes motion overrides for StepData, which
    // it detects via the stepNumber field.
    expect("stepNumber" in transitionStep).toBe(true);
  });

  it("keeps the partner at the shared location when the move departs a beta", () => {
    const { startData, transitionStep } = buildPlacementTransition({
      ...baseInput,
      movingColor: MotionColor.RED,
      fromLocation: GridLocation.NORTH,
      toLocation: GridLocation.EAST,
      direction: "counterclockwise",
      blueLocation: GridLocation.NORTH,
      redLocation: GridLocation.EAST,
    });

    expect(transitionStep.motions.red.motionType).toBe(MotionType.PRO);
    expect(transitionStep.motions.red.rotationDirection).toBe(
      RotationDirection.COUNTER_CLOCKWISE
    );
    expect(transitionStep.motions.blue.startLocation).toBe(GridLocation.NORTH);

    // Both props share north at the start — the beta pose the partner
    // animates out of.
    expect(startData.motions.red?.startLocation).toBe(GridLocation.NORTH);
    expect(startData.motions.blue?.startLocation).toBe(GridLocation.NORTH);
  });
});
