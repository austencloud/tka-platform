import { describe, expect, it } from "vitest";
import { calculateEndOrientation } from "../../../src/core/orientation/OrientationCalculator.js";
import type {
  MotionData,
  Orientation,
  SequenceStep,
} from "../../../src/core/types/sequence-engine-types.js";
import {
  analyzeOrientationCycle,
  closeOrientationCycle,
} from "../../../src/loop/execution/orientation-cycle.js";

function motion(
  turns: number,
  startOrientation: Orientation = "in"
): MotionData {
  const base = {
    motionType: "pro",
    startLocation: "n",
    endLocation: "n",
    rotationDirection: "cw",
    startOrientation,
    turns,
  };
  return {
    ...base,
    endOrientation: calculateEndOrientation(base),
  } as MotionData;
}

function closedPositionPattern(
  blueTurns: number,
  redTurns = blueTurns
): SequenceStep[] {
  return [
    {
      id: "start",
      stepNumber: 0,
      letter: null,
      startPosition: "beta1",
      endPosition: "beta1",
      motions: {
        blue: motion(0),
        red: motion(0),
      },
    },
    {
      id: "step-1",
      stepNumber: 1,
      letter: "A",
      startPosition: "beta1",
      endPosition: "beta1",
      motions: {
        blue: motion(blueTurns),
        red: motion(redTurns),
      },
    },
  ] as SequenceStep[];
}

describe("orientation cycle ownership", () => {
  it("analyzes the least common cycle required by both props", () => {
    const result = analyzeOrientationCycle(closedPositionPattern(1, 0.5));

    expect(result.cycleCount).toBe(4);
    expect(result.blueOrientations.at(-1)).toBe("in");
    expect(result.redOrientations.at(-1)).toBe("in");
  });

  it("supports all eight radial orientation states", () => {
    const result = analyzeOrientationCycle(closedPositionPattern(0.25));

    expect(result.cycleCount).toBe(8);
    expect(result.blueOrientations).toHaveLength(9);
    expect(result.blueOrientations.at(-1)).toBe("in");
    expect(result.redOrientations.at(-1)).toBe("in");
  });

  it("emits repeated steps until orientations close", () => {
    const result = closeOrientationCycle(closedPositionPattern(1), {
      seedStepCount: 1,
    });

    expect(result.steps).toHaveLength(3);
    expect(result.orientationCycleCount).toBe(2);
    expect(result.patternRepetitions).toBe(2);
    expect(result.expansionMultiplier).toBe(2);
    expect(result.steps[2]!.stepNumber).toBe(2);
    expect(result.steps[2]!.motions.blue.startOrientation).toBe("out");
    expect(result.steps[2]!.motions.blue.endOrientation).toBe("in");
    expect(result.steps[2]!.motions.red.endOrientation).toBe("in");
    expect(new Set(result.steps.map((step) => step.id)).size).toBe(3);
  });

  it("honors the larger multiplier chosen for an exact total length", () => {
    const result = closeOrientationCycle(closedPositionPattern(1), {
      seedStepCount: 1,
      minimumExpansionMultiplier: 4,
    });

    expect(result.steps).toHaveLength(5);
    expect(result.orientationCycleCount).toBe(2);
    expect(result.patternRepetitions).toBe(4);
    expect(result.expansionMultiplier).toBe(4);
    expect(result.steps[4]!.motions.blue.endOrientation).toBe("in");
    expect(result.steps[4]!.motions.red.endOrientation).toBe("in");
  });

  it("refuses to repeat a position pattern that is still open", () => {
    const open = closedPositionPattern(1);
    open[1] = {
      ...open[1]!,
      endPosition: "beta3",
    };

    expect(() => closeOrientationCycle(open)).toThrow(
      /open position pattern/
    );
  });
});
