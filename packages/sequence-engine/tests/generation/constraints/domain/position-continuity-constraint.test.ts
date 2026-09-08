import { describe, it, expect } from "vitest";
import { PositionContinuityConstraint } from "../../../../src/generation/constraints/domain/PositionContinuityConstraint.js";
import type {
  ConstraintContext,
  PictographData,
} from "../../../../src/generation/constraints/types.js";

const EMPTY_MOTION = {
  hand: "",
  startLocation: "",
  endLocation: "",
  motionType: "",
  rotationDirection: "",
  startOrientation: "",
  endOrientation: "",
};

function makePictograph(
  overrides: Partial<PictographData>,
): PictographData {
  return {
    letter: "A",
    startPosition: "alpha1",
    endPosition: "alpha1",
    timing: "together",
    direction: "same",
    leftMotion: EMPTY_MOTION,
    rightMotion: EMPTY_MOTION,
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<ConstraintContext>,
): ConstraintContext {
  const defaults: ConstraintContext = {
    stepIndex: 0,
    totalSteps: 4,
    previousSteps: [],
    candidate: makePictograph({}),
    letter: "A",
  };
  return { ...defaults, ...overrides };
}

describe("PositionContinuityConstraint", () => {
  const constraint = new PositionContinuityConstraint();

  it("is a hard constraint", () => {
    expect(constraint.mode).toBe("hard");
  });

  it("satisfied on first step", () => {
    const result = constraint.evaluate(
      makeContext({ previousSteps: [] }),
    );
    expect(result.satisfied).toBe(true);
    expect(result.score).toBe(1);
  });

  it("satisfied when positions match", () => {
    const prev = makePictograph({
      startPosition: "alpha1",
      endPosition: "beta5",
    });
    const candidate = makePictograph({
      startPosition: "beta5",
      endPosition: "gamma11",
    });

    const result = constraint.evaluate(
      makeContext({
        stepIndex: 1,
        previousSteps: [prev],
        candidate,
      }),
    );
    expect(result.satisfied).toBe(true);
    expect(result.score).toBe(1);
  });

  it("not satisfied when positions don't match", () => {
    const prev = makePictograph({
      startPosition: "alpha1",
      endPosition: "beta5",
    });
    const candidate = makePictograph({
      startPosition: "gamma11",
      endPosition: "alpha1",
    });

    const result = constraint.evaluate(
      makeContext({
        stepIndex: 1,
        previousSteps: [prev],
        candidate,
      }),
    );
    expect(result.satisfied).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reason).toContain("beta5");
    expect(result.reason).toContain("gamma11");
  });

  it("checks only the last previous step", () => {
    const step1 = makePictograph({
      startPosition: "alpha1",
      endPosition: "beta5",
    });
    const step2 = makePictograph({
      startPosition: "beta5",
      endPosition: "gamma11",
    });
    const candidate = makePictograph({
      startPosition: "gamma11",
      endPosition: "alpha1",
    });

    const result = constraint.evaluate(
      makeContext({
        stepIndex: 2,
        previousSteps: [step1, step2],
        candidate,
      }),
    );
    expect(result.satisfied).toBe(true);
  });
});
