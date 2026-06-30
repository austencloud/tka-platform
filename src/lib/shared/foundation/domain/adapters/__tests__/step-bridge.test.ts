import { describe, it, expect } from "vitest";
import {
  stepDataToStep,
  motionDataToMotion,
  stepToStepData,
} from "../step-bridge";
import { createStepData } from "../../factories/create-step-data";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

describe("motionDataToMotion", () => {
  it("maps structural fields and drops embedded render data", () => {
    const md = createMotionData({ color: MotionColor.BLUE });
    const m = motionDataToMotion(md);
    expect(m.motionType).toBe(md.motionType);
    expect(m.startLocation).toBe(md.startLocation);
    expect(m.endLocation).toBe(md.endLocation);
    expect(m.rotationDirection).toBe(md.rotationDirection);
    expect(m.turns).toBe(md.turns);
    // render-only fields must not survive onto the lean Motion
    expect("arrowPlacementData" in m).toBe(false);
    expect("propPlacementData" in m).toBe(false);
    expect("isVisible" in m).toBe(false);
    expect("propType" in m).toBe(false);
    expect(Object.isFrozen(m)).toBe(true);
  });
});

describe("stepDataToStep", () => {
  it("converts a StepData with both motions into a frozen Step", () => {
    const sd = createStepData({
      stepNumber: 1,
      duration: 1,
      motions: {
        [MotionColor.BLUE]: createMotionData({ color: MotionColor.BLUE }),
        [MotionColor.RED]: createMotionData({ color: MotionColor.RED }),
      },
    });
    const step = stepDataToStep(sd);
    expect(step.stepNumber).toBe(1);
    expect(step.motions.blue.motionType).toBe(sd.motions.blue!.motionType);
    expect(step.motions.red.motionType).toBe(sd.motions.red!.motionType);
    expect(Object.isFrozen(step)).toBe(true);
    expect(Object.isFrozen(step.motions)).toBe(true);
    // dropped: stored reversal + selection state
    expect("blueReversal" in step).toBe(false);
    expect("isSelected" in step).toBe(false);
  });

  it("throws when a hand motion is missing", () => {
    const sd = createStepData({
      stepNumber: 1,
      motions: { [MotionColor.BLUE]: createMotionData({ color: MotionColor.BLUE }) },
    });
    expect(() => stepDataToStep(sd)).toThrow(/missing its red motion/);
  });
});

describe("stepToStepData (reverse) + round-trip", () => {
  it("rebuilds a StepData from a Step, render fields defaulted, reversal false", () => {
    const original = createStepData({
      stepNumber: 2,
      duration: 1,
      motions: {
        [MotionColor.BLUE]: createMotionData({ color: MotionColor.BLUE, turns: 1 }),
        [MotionColor.RED]: createMotionData({ color: MotionColor.RED }),
      },
    });
    const step = stepDataToStep(original);
    const back = stepToStepData(step);

    // structural fields survive the round trip
    expect(back.stepNumber).toBe(2);
    expect(back.duration).toBe(1);
    expect(back.motions[MotionColor.BLUE]!.motionType).toBe(
      original.motions.blue!.motionType
    );
    expect(back.motions[MotionColor.BLUE]!.turns).toBe(1);
    expect(back.motions[MotionColor.RED]!.startLocation).toBe(
      original.motions.red!.startLocation
    );

    // render cache rebuilt with defaults (recomputed downstream), present + valid
    expect(back.motions[MotionColor.BLUE]!.arrowPlacementData).toBeDefined();
    expect(back.motions[MotionColor.BLUE]!.propPlacementData).toBeDefined();

    // reversal flags default false (filled by the reversal pipeline), discriminator kept
    expect(back.blueReversal).toBe(false);
    expect(back.redReversal).toBe(false);
    expect(back.isStep).toBe(true);
  });
});
