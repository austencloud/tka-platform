import { describe, expect, it } from "vitest";
import { updateSequenceStartPosition } from "$lib/features/create/construct/start-position-picker/services/update-sequence-start-position";
import { createStartPositionData } from "$lib/shared/create/factories/create-start-position-data";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  GridLocation,
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  HandSide,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";

function staticMotion(
  color: HandSide,
  location: GridLocation,
  orientation: Orientation
) {
  return createMotionData({
    hand: color,
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

function movingMotion(color: HandSide) {
  return createMotionData({
    hand: color,
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
      left: staticMotion(HandSide.LEFT, location, blueOrientation),
      right: staticMotion(HandSide.RIGHT, location, Orientation.OUT),
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
          left: movingMotion(HandSide.LEFT),
          right: movingMotion(HandSide.RIGHT),
        },
      }),
    ],
  });
}

describe("updateSequenceStartPosition", () => {
  it("keeps a connecting edit and propagates its orientations", () => {
    const editedStart = start(
      GridLocation.NORTH,
      GridPosition.BETA1,
      Orientation.CLOCK
    );
    const result = updateSequenceStartPosition(
      fixture(),
      editedStart,
      GridMode.DIAMOND
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sequence.steps[0]!.motions.left.startOrientation).toBe(
      Orientation.CLOCK
    );
    expect(result.sequence.steps).toHaveLength(1);
    expect(result.sequence.loopSpec).toBeUndefined();
  });

  it("rejects a pose that would silently break the first transition", () => {
    const result = updateSequenceStartPosition(
      fixture(),
      start(GridLocation.EAST, GridPosition.BETA3),
      GridMode.DIAMOND
    );

    expect(result).toEqual({ ok: false, reason: "broken-transition" });
  });

  it("rejects changing the grid under a nonempty sequence", () => {
    const result = updateSequenceStartPosition(
      fixture(),
      start(GridLocation.NORTH, GridPosition.BETA1),
      GridMode.BOX
    );

    expect(result).toEqual({ ok: false, reason: "grid-mismatch" });
  });
});
