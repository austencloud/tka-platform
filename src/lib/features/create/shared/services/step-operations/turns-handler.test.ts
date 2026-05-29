import { describe, it, expect, vi } from "vitest";
import { findPreviousRotationDirection, updateStepTurns } from "./turns-handler";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { ICreateModuleState } from "../../types/create-module-types";

vi.mock(
  "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator",
  () => ({
    orientationCalculator: {
      calculateEndOrientation: () => "in",
    },
  })
);

vi.mock("$lib/shared/create/services/reversal-detector", () => ({
  reversalDetector: {
    processReversals: (seq: unknown) => seq,
  },
}));

vi.mock("./OrientationHandler", () => ({
  calculatePropagatedSteps: (
    _stepNum: number,
    _color: string,
    seq: { steps: StepData[] }
  ) => seq.steps,
}));

function makeStep(
  overrides: {
    stepNumber?: number;
    blue?: { motionType?: MotionType; rotationDirection?: RotationDirection; turns?: number | "fl" };
    red?: { motionType?: MotionType; rotationDirection?: RotationDirection; turns?: number | "fl" };
  } = {}
): StepData {
  return {
    id: "test",
    stepNumber: overrides.stepNumber ?? 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    motions: {
      [MotionColor.BLUE]: createMotionData({
        motionType: overrides.blue?.motionType ?? MotionType.DASH,
        rotationDirection:
          overrides.blue?.rotationDirection ?? RotationDirection.NO_ROTATION,
        turns: overrides.blue?.turns ?? 0,
      }),
      [MotionColor.RED]: createMotionData({
        motionType: overrides.red?.motionType ?? MotionType.DASH,
        rotationDirection:
          overrides.red?.rotationDirection ?? RotationDirection.NO_ROTATION,
        turns: overrides.red?.turns ?? 0,
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

function makeMockState(steps: StepData[]): ICreateModuleState {
  let captured: unknown = null;
  const sequence = {
    id: "test",
    name: "test",
    word: "",
    steps,
    gridMode: "diamond",
    difficulty: 1,
    metadata: {},
  };
  return {
    sequenceState: {
      currentSequence: sequence,
      selectedStartPosition: null,
      setCurrentSequence: (seq: unknown) => {
        captured = seq;
      },
      get _captured() {
        return captured;
      },
    },
    pushUndoSnapshot: () => {},
  } as unknown as ICreateModuleState;
}

function getCapturedStep(
  state: ICreateModuleState,
  stepIndex: number,
  color: MotionColor
) {
  const captured = (
    state.sequenceState as unknown as { _captured: { steps: StepData[] } }
  )._captured;
  return captured.steps[stepIndex]!.motions[color]!;
}

describe("updateStepTurns integration", () => {
  it("assigns ccw when previous step has ccw rotation (feedback scenario)", () => {
    const steps = [
      makeStep({
        stepNumber: 1,
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
        stepNumber: 2,
        blue: {
          motionType: MotionType.STATIC,
          rotationDirection: RotationDirection.NO_ROTATION,
        },
        red: {
          motionType: MotionType.STATIC,
          rotationDirection: RotationDirection.NO_ROTATION,
        },
      }),
    ];

    const state = makeMockState(steps);
    updateStepTurns(2, MotionColor.BLUE, 0.5, state);

    expect(getCapturedStep(state, 1, MotionColor.BLUE).rotationDirection).toBe(
      RotationDirection.COUNTER_CLOCKWISE
    );
  });

  it("assigns cw when previous step has cw rotation", () => {
    const steps = [
      makeStep({
        stepNumber: 1,
        blue: {
          motionType: MotionType.DASH,
          rotationDirection: RotationDirection.CLOCKWISE,
        },
      }),
      makeStep({
        stepNumber: 2,
        blue: {
          motionType: MotionType.STATIC,
          rotationDirection: RotationDirection.NO_ROTATION,
        },
      }),
    ];

    const state = makeMockState(steps);
    updateStepTurns(2, MotionColor.BLUE, 0.5, state);

    expect(getCapturedStep(state, 1, MotionColor.BLUE).rotationDirection).toBe(
      RotationDirection.CLOCKWISE
    );
  });

  it("falls back to cw when no previous step has rotation", () => {
    const steps = [
      makeStep({
        stepNumber: 1,
        blue: {
          motionType: MotionType.STATIC,
          rotationDirection: RotationDirection.NO_ROTATION,
        },
      }),
      makeStep({
        stepNumber: 2,
        blue: {
          motionType: MotionType.STATIC,
          rotationDirection: RotationDirection.NO_ROTATION,
        },
      }),
    ];

    const state = makeMockState(steps);
    updateStepTurns(2, MotionColor.BLUE, 0.5, state);

    expect(getCapturedStep(state, 1, MotionColor.BLUE).rotationDirection).toBe(
      RotationDirection.CLOCKWISE
    );
  });

  it("clears rotation when turns go to zero", () => {
    const steps = [
      makeStep({
        stepNumber: 1,
        blue: {
          motionType: MotionType.DASH,
          rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
          turns: 1,
        },
      }),
    ];

    const state = makeMockState(steps);
    updateStepTurns(1, MotionColor.BLUE, 0, state);

    expect(getCapturedStep(state, 0, MotionColor.BLUE).rotationDirection).toBe(
      RotationDirection.NO_ROTATION
    );
  });

  it("does not auto-assign rotation for PRO motion type", () => {
    const steps = [
      makeStep({
        stepNumber: 1,
        blue: {
          motionType: MotionType.PRO,
          rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
        },
      }),
      makeStep({
        stepNumber: 2,
        blue: {
          motionType: MotionType.PRO,
          rotationDirection: RotationDirection.NO_ROTATION,
        },
      }),
    ];

    const state = makeMockState(steps);
    updateStepTurns(2, MotionColor.BLUE, 0.5, state);

    expect(getCapturedStep(state, 1, MotionColor.BLUE).rotationDirection).toBe(
      RotationDirection.NO_ROTATION
    );
  });
});
