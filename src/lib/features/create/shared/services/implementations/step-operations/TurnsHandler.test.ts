import { describe, it, expect } from "vitest";
import { findPreviousRotationDirection } from "./TurnsHandler";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";

function makeStep(
  overrides: {
    blue?: { motionType?: MotionType; rotationDirection?: RotationDirection };
    red?: { motionType?: MotionType; rotationDirection?: RotationDirection };
  } = {}
): StepData {
  return {
    id: "test",
    stepNumber: 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    motions: {
      [MotionColor.BLUE]: createMotionData({
        motionType: overrides.blue?.motionType ?? MotionType.DASH,
        rotationDirection:
          overrides.blue?.rotationDirection ?? RotationDirection.NO_ROTATION,
      }),
      [MotionColor.RED]: createMotionData({
        motionType: overrides.red?.motionType ?? MotionType.DASH,
        rotationDirection:
          overrides.red?.rotationDirection ?? RotationDirection.NO_ROTATION,
      }),
    },
  } as StepData;
}

describe("findPreviousRotationDirection", () => {
  it("returns CCW when previous step blue has CCW rotation", () => {
    const steps = [
      makeStep({
        blue: {
          motionType: MotionType.DASH,
          rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        },
      }),
      makeStep(),
    ];

    const result = findPreviousRotationDirection(
      steps,
      2,
      MotionColor.BLUE
    );
    expect(result).toBe(RotationDirection.COUNTER_CLOCKWISE);
  });

  it("returns CW when previous step blue has CW rotation", () => {
    const steps = [
      makeStep({
        blue: {
          motionType: MotionType.PRO,
          rotationDirection: RotationDirection.CLOCKWISE,
        },
      }),
      makeStep(),
    ];

    const result = findPreviousRotationDirection(
      steps,
      2,
      MotionColor.BLUE
    );
    expect(result).toBe(RotationDirection.CLOCKWISE);
  });

  it("searches backward past steps with NO_ROTATION", () => {
    const steps = [
      makeStep({
        blue: {
          motionType: MotionType.ANTI,
          rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        },
      }),
      makeStep(), // NO_ROTATION
      makeStep(), // NO_ROTATION — this is the step being edited (step 3)
    ];

    const result = findPreviousRotationDirection(
      steps,
      3,
      MotionColor.BLUE
    );
    expect(result).toBe(RotationDirection.COUNTER_CLOCKWISE);
  });

  it("uses correct color — red step context doesn't bleed into blue", () => {
    const steps = [
      makeStep({
        blue: { rotationDirection: RotationDirection.NO_ROTATION },
        red: { rotationDirection: RotationDirection.COUNTER_CLOCKWISE },
      }),
      makeStep(),
    ];

    const result = findPreviousRotationDirection(
      steps,
      2,
      MotionColor.BLUE
    );
    // Blue has no rotation context, should fall back to CLOCKWISE
    expect(result).toBe(RotationDirection.CLOCKWISE);
  });

  it("returns red rotation when querying red color", () => {
    const steps = [
      makeStep({
        blue: { rotationDirection: RotationDirection.CLOCKWISE },
        red: { rotationDirection: RotationDirection.COUNTER_CLOCKWISE },
      }),
      makeStep(),
    ];

    const result = findPreviousRotationDirection(
      steps,
      2,
      MotionColor.RED
    );
    expect(result).toBe(RotationDirection.COUNTER_CLOCKWISE);
  });

  it("falls back to CLOCKWISE when no prior rotation exists", () => {
    const steps = [makeStep(), makeStep()];

    const result = findPreviousRotationDirection(
      steps,
      2,
      MotionColor.BLUE
    );
    expect(result).toBe(RotationDirection.CLOCKWISE);
  });

  it("falls back to CLOCKWISE for step 1 (no prior steps)", () => {
    const steps = [makeStep()];

    const result = findPreviousRotationDirection(
      steps,
      1,
      MotionColor.BLUE
    );
    expect(result).toBe(RotationDirection.CLOCKWISE);
  });

  it("picks nearest rotation when multiple prior steps have rotation", () => {
    const steps = [
      makeStep({
        blue: { rotationDirection: RotationDirection.CLOCKWISE },
      }),
      makeStep({
        blue: { rotationDirection: RotationDirection.COUNTER_CLOCKWISE },
      }),
      makeStep(),
    ];

    const result = findPreviousRotationDirection(
      steps,
      3,
      MotionColor.BLUE
    );
    // Step 2 (index 1) is closer — should pick CCW
    expect(result).toBe(RotationDirection.COUNTER_CLOCKWISE);
  });

  // Reproduces the exact scenario from the feedback:
  // Step 1: dash ccw for both hands
  // Step 2: static with 0 turns — adding turns should default to ccw
  it("feedback scenario: step 1 dash ccw → step 2 static defaults to ccw", () => {
    const steps = [
      makeStep({
        blue: {
          motionType: MotionType.DASH,
          rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        },
        red: {
          motionType: MotionType.DASH,
          rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        },
      }),
      makeStep({
        blue: { motionType: MotionType.STATIC },
        red: { motionType: MotionType.STATIC },
      }),
    ];

    expect(
      findPreviousRotationDirection(steps, 2, MotionColor.BLUE)
    ).toBe(RotationDirection.COUNTER_CLOCKWISE);

    expect(
      findPreviousRotationDirection(steps, 2, MotionColor.RED)
    ).toBe(RotationDirection.COUNTER_CLOCKWISE);
  });
});
