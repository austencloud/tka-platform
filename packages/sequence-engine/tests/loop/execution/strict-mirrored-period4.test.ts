/**
 * Unit tests for StrictMirroredExecutor period-4 (quartered) behavior.
 *
 * The executor's job: given an N-beat partial, produce a 2N-beat sequence
 * for period 2 or a 4N-beat sequence for period 4. Orientation closure
 * itself depends on turn parity (enforced by SequenceBuilder), so this
 * test only verifies the structural output — length, quarter pattern,
 * and that copied quarters preserve letters while mirrored quarters
 * apply the V-mirror transform.
 */

import { describe, it, expect } from "vitest";
import { StrictMirroredExecutor } from "../../../src/loop/execution/StrictMirroredExecutor.js";
import { Period } from "../../../src/loop/loop-types.js";
import type {
  SequenceStep,
  MotionData,
} from "../../../src/core/types/sequence-engine-types.js";

function makeMotion(overrides: Partial<MotionData> = {}): MotionData {
  return {
    motionType: "pro" as MotionData["motionType"],
    startLocation: "n" as MotionData["startLocation"],
    endLocation: "s" as MotionData["endLocation"],
    rotationDirection: "cw" as MotionData["rotationDirection"],
    startOrientation: "in" as MotionData["startOrientation"],
    endOrientation: "in" as MotionData["endOrientation"],
    turns: 0.5,
    plane: "wall" as MotionData["plane"],
    ...overrides,
  };
}

function makeStep(
  stepNumber: number,
  startPos: string,
  endPos: string,
  letter: string = "A"
): SequenceStep {
  return {
    id: `step-${stepNumber}-${letter}`,
    letter: letter as SequenceStep["letter"],
    startPosition: startPos as SequenceStep["startPosition"],
    endPosition: endPos as SequenceStep["endPosition"],
    stepNumber,
    duration: 1,
    motions: {
      blue: makeMotion(),
      red: makeMotion(),
    },
  };
}

// Valid mirror pair for MIRRORED validation: alpha2 → alpha8.
// (V-mirror of alpha2 = alpha8 per VERTICAL_MIRROR_POSITION_MAP.)

describe("StrictMirroredExecutor — halved (period 2)", () => {
  it("produces 2N beats from an N-beat partial", () => {
    const executor = new StrictMirroredExecutor();
    const seq: SequenceStep[] = [
      makeStep(0, "alpha2", "alpha2", "start"),
      makeStep(1, "alpha2", "alpha1"),
      makeStep(2, "alpha1", "alpha8"),
    ];

    const result = executor.executeLOOP(seq, Period.HALVED);

    // 1 start + 2 partial + 2 mirror = 5 entries
    expect(result).toHaveLength(5);
  });
});

describe("StrictMirroredExecutor — quartered (period 4)", () => {
  it("produces 4N beats from an N-beat partial", () => {
    const executor = new StrictMirroredExecutor();
    const seq: SequenceStep[] = [
      makeStep(0, "alpha2", "alpha2", "start"),
      makeStep(1, "alpha2", "alpha1"),
      makeStep(2, "alpha1", "alpha8"),
    ];

    const result = executor.executeLOOP(seq, Period.QUARTERED);

    // 1 start + 2 partial + 2 (Q2 mirror) + 2 (Q3 copy) + 2 (Q4 mirror) = 9
    expect(result).toHaveLength(9);
  });

  it("Q3 beats preserve the partial's letters (copy, not mirror)", () => {
    const executor = new StrictMirroredExecutor();
    const seq: SequenceStep[] = [
      makeStep(0, "alpha2", "alpha2", "start"),
      makeStep(1, "alpha2", "alpha1", "Y"),
      makeStep(2, "alpha1", "alpha8", "I"),
    ];

    const result = executor.executeLOOP(seq, Period.QUARTERED);

    // Q1 letters (indices 1-2 in result): Y, I
    // Q3 letters (indices 5-6 in result) should also be Y, I (copy of Q1)
    expect(result[1]!.letter).toBe("Y");
    expect(result[2]!.letter).toBe("I");
    expect(result[5]!.letter).toBe("Y");
    expect(result[6]!.letter).toBe("I");
  });

  it("Q4 beats match Q2 letters (both apply the mirror transform)", () => {
    const executor = new StrictMirroredExecutor();
    const seq: SequenceStep[] = [
      makeStep(0, "alpha2", "alpha2", "start"),
      makeStep(1, "alpha2", "alpha1", "Y"),
      makeStep(2, "alpha1", "alpha8", "I"),
    ];

    const result = executor.executeLOOP(seq, Period.QUARTERED);

    // Q2 is at result[3..4], Q4 is at result[7..8]
    // They should have the same letter structure (both are mirror passes)
    expect(result[3]!.letter).toBe(result[7]!.letter);
    expect(result[4]!.letter).toBe(result[8]!.letter);
  });

  it("single-beat partial: N=1 produces 4-beat output", () => {
    const executor = new StrictMirroredExecutor();
    const seq: SequenceStep[] = [
      makeStep(0, "alpha2", "alpha2", "start"),
      makeStep(1, "alpha2", "alpha8"),
    ];

    const result = executor.executeLOOP(seq, Period.QUARTERED);

    // 1 start + 1 Q1 + 1 Q2 + 1 Q3 + 1 Q4 = 5
    expect(result).toHaveLength(5);
  });
});
