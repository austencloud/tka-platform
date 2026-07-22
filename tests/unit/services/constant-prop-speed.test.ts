import { describe, expect, it } from "vitest";
import { analyzeConstantPropSpeed } from "$lib/features/create/shared/services/constant-prop-speed";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";

function pro(
  color: MotionColor,
  startLocation: GridLocation,
  endLocation: GridLocation,
  turns: number
) {
  return createMotionData({
    color,
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    startLocation,
    endLocation,
    turns,
  });
}

function staticSpin(
  color: MotionColor,
  turns: number,
  rotationDirection = RotationDirection.CLOCKWISE
) {
  return createMotionData({
    color,
    motionType: MotionType.STATIC,
    rotationDirection,
    turns,
  });
}

function spinSequence(
  pairs: ReadonlyArray<
    readonly [
      ReturnType<typeof createMotionData>,
      ReturnType<typeof createMotionData>,
    ]
  >
) {
  return createSequenceData({
    word: "TEST",
    steps: pairs.map(([blue, red], index) =>
      createStepData({
        stepNumber: index + 1,
        motions: { blue, red },
      })
    ),
  });
}

describe("analyzeConstantPropSpeed", () => {
  it("normalizes WAA5 to 5, 1, 5, 1 at 90 degrees per beat", () => {
    const sequence = spinSequence([
      [
        pro(MotionColor.BLUE, GridLocation.NORTH, GridLocation.EAST, 2),
        pro(MotionColor.RED, GridLocation.SOUTH, GridLocation.WEST, 2),
      ],
      [
        pro(MotionColor.BLUE, GridLocation.EAST, GridLocation.SOUTH, 0),
        pro(MotionColor.RED, GridLocation.WEST, GridLocation.NORTH, 0),
      ],
      [
        pro(MotionColor.BLUE, GridLocation.SOUTH, GridLocation.WEST, 2),
        pro(MotionColor.RED, GridLocation.NORTH, GridLocation.EAST, 2),
      ],
      [
        pro(MotionColor.BLUE, GridLocation.WEST, GridLocation.NORTH, 0),
        pro(MotionColor.RED, GridLocation.EAST, GridLocation.SOUTH, 0),
      ],
    ]);

    const result = analyzeConstantPropSpeed(sequence, "both");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.durations).toEqual([5, 1, 5, 1]);
    expect(result.blueDegreesPerBeat).toBeCloseTo(90);
    expect(result.redDegreesPerBeat).toBeCloseTo(90);
    expect(result.steps.map((step) => step.blueDegrees)).toEqual([
      450, 90, 450, 90,
    ]);
  });

  it("rejects Both when the hands require different duration ratios", () => {
    const sequence = spinSequence([
      [staticSpin(MotionColor.BLUE, 1), staticSpin(MotionColor.RED, 1)],
      [staticSpin(MotionColor.BLUE, 2), staticSpin(MotionColor.RED, 1)],
    ]);

    const both = analyzeConstantPropSpeed(sequence, "both");
    const blue = analyzeConstantPropSpeed(sequence, "blue");

    expect(both).toMatchObject({
      success: false,
      reason: "incompatible-hands",
      affectedSteps: [2],
    });
    expect(blue).toMatchObject({ success: true, durations: [1, 2] });
  });

  it("reports zero-spin beats because duration cannot create rotation", () => {
    const sequence = spinSequence([
      [staticSpin(MotionColor.BLUE, 1), staticSpin(MotionColor.RED, 1)],
      [staticSpin(MotionColor.BLUE, 0), staticSpin(MotionColor.RED, 1)],
    ]);

    expect(analyzeConstantPropSpeed(sequence, "blue")).toMatchObject({
      success: false,
      reason: "zero-spin",
      affectedSteps: [2],
    });
  });

  it("reports direction changes because positive durations cannot remove them", () => {
    const sequence = spinSequence([
      [staticSpin(MotionColor.BLUE, 1), staticSpin(MotionColor.RED, 1)],
      [
        staticSpin(MotionColor.BLUE, 1, RotationDirection.COUNTER_CLOCKWISE),
        staticSpin(MotionColor.RED, 1),
      ],
    ]);

    expect(analyzeConstantPropSpeed(sequence, "blue")).toMatchObject({
      success: false,
      reason: "direction-change",
      affectedSteps: [2],
    });
  });

  it("reports exact results that exceed the supported duration range", () => {
    const sequence = spinSequence([
      [staticSpin(MotionColor.BLUE, 0.5), staticSpin(MotionColor.RED, 0.5)],
      [staticSpin(MotionColor.BLUE, 6), staticSpin(MotionColor.RED, 6)],
    ]);

    expect(analyzeConstantPropSpeed(sequence, "both")).toMatchObject({
      success: false,
      reason: "duration-limit",
      affectedSteps: [2],
      requiredMaxDuration: 12,
    });
  });
});
