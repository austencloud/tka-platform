import { describe, it, expect, vi } from "vitest";
import { StepOperator } from "./step-operator";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { ICreateModuleState } from "../types/create-module-types";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";

// Keep orientation + reversal + propagation inert so the test exercises only
// the turns edit + the new letter-reconcile wiring.
vi.mock("$lib/shared/pictograph/prop/services/orientation-calculator", () => ({
  calculateEndOrientation: () => "in",
}));
vi.mock("$lib/shared/create/services/reversal-detector", () => ({
  reversalDetector: { processReversals: (seq: unknown) => seq },
}));
vi.mock(
  "$lib/features/create/shared/services/step-operations/orientation-handler",
  () => ({
    calculatePropagatedSteps: (
      _stepNum: number,
      _color: string,
      seq: { steps: StepData[] }
    ) => seq.steps,
    calculateEndOrientation: () => "in",
  })
);

function makeStep(stepNumber: number): StepData {
  return {
    id: `step-${stepNumber}`,
    stepNumber,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    motions: {
      [MotionColor.BLUE]: createMotionData({
        color: MotionColor.BLUE,
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.CLOCKWISE,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.EAST,
        turns: 0,
      }),
      [MotionColor.RED]: createMotionData({
        color: MotionColor.RED,
        motionType: MotionType.PRO,
        rotationDirection: RotationDirection.CLOCKWISE,
        startLocation: GridLocation.SOUTH,
        endLocation: GridLocation.WEST,
        turns: 0,
      }),
    },
  } as StepData;
}

function makeMockState(steps: StepData[]): ICreateModuleState {
  let current = {
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
      get currentSequence() {
        return current;
      },
      selectedStartPosition: null,
      setCurrentSequence: (seq: unknown) => {
        current = seq as typeof current;
      },
      setStartPosition: () => {},
      updateStep: () => {},
    },
    pushUndoSnapshot: () => {},
  } as unknown as ICreateModuleState;
}

describe("StepOperator.updateStepTurns reconciles the letter", () => {
  it("invokes the motion query handler to re-derive the letter after a turns edit", async () => {
    const spy = vi.fn().mockResolvedValue("A");
    const handler = {
      findLetterByMotionConfiguration: spy,
    } as unknown as IMotionQueryHandler;

    const op = new StepOperator(handler);
    const state = makeMockState([makeStep(1), makeStep(2)]);

    op.updateStepTurns(2, MotionColor.BLUE, 0.5, state, null);

    // recalculateLetterForBeat runs synchronously up to its first await, so the
    // handler is already invoked; flush a microtask to be safe.
    await Promise.resolve();
    expect(spy).toHaveBeenCalled();
  });
});
