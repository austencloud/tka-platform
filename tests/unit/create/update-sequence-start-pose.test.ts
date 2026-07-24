import { describe, expect, it } from "vitest";
import { updateSequenceStartPose } from "$lib/features/create/construct/start-position-picker/services/update-sequence-start-pose";
import { createStartPositionData } from "$lib/shared/create/factories/create-start-position-data";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  GridLocation,
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";

function staticMotion(
  color: MotionColor,
  location: GridLocation,
  orientation: Orientation
) {
  return createMotionData({
    color,
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    startLocation: location,
    endLocation: location,
    turns: 0,
    startOrientation: orientation,
    endOrientation: orientation,
    arrowLocation: location,
    gridMode: GridMode.DIAMOND,
  });
}

function movingMotion(color: MotionColor) {
  return createMotionData({
    color,
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    startLocation: GridLocation.NORTH,
    endLocation: GridLocation.EAST,
    turns: 0.5,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.OUT,
    arrowLocation: GridLocation.NORTH,
    gridMode: GridMode.DIAMOND,
  });
}

function start(
  location: GridLocation,
  position: GridPosition,
  blueOrientation = Orientation.IN
) {
  return createStartPositionData({
    id: "start",
    startPosition: position,
    endPosition: position,
    motions: {
      blue: staticMotion(MotionColor.BLUE, location, blueOrientation),
      red: staticMotion(MotionColor.RED, location, Orientation.OUT),
    },
  });
}

function fixture() {
  const originalStart = start(GridLocation.NORTH, GridPosition.BETA1);
  return createSequenceData({
    id: "sequence",
    name: "Start edit",
    gridMode: GridMode.DIAMOND,
    startPosition: originalStart,
    startingPosition: originalStart,
    loopSpec: {} as never,
    steps: [
      createStepData({
        id: "one",
        stepNumber: 1,
        startPosition: GridPosition.BETA1,
        endPosition: GridPosition.BETA3,
        motions: {
          blue: movingMotion(MotionColor.BLUE),
          red: movingMotion(MotionColor.RED),
        },
      }),
    ],
  });
}

describe("updateSequenceStartPose", () => {
  it("keeps a connecting edit and propagates its orientations", () => {
    const editedStart = start(
      GridLocation.NORTH,
      GridPosition.BETA1,
      Orientation.CLOCK
    );
    const result = updateSequenceStartPose(
      fixture(),
      editedStart,
      GridMode.DIAMOND
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sequence.steps[0]!.motions.blue.startOrientation).toBe(
      Orientation.CLOCK
    );
    expect(result.sequence.steps).toHaveLength(1);
    expect(result.sequence.loopSpec).toBeUndefined();
  });

  it("rejects a pose that would silently break the first transition", () => {
    const result = updateSequenceStartPose(
      fixture(),
      start(GridLocation.EAST, GridPosition.BETA3),
      GridMode.DIAMOND
    );

    expect(result).toEqual({ ok: false, reason: "broken-transition" });
  });

  it("rejects changing the grid under a nonempty sequence", () => {
    const result = updateSequenceStartPose(
      fixture(),
      start(GridLocation.NORTH, GridPosition.BETA1),
      GridMode.BOX
    );

    expect(result).toEqual({ ok: false, reason: "grid-mismatch" });
  });
});
