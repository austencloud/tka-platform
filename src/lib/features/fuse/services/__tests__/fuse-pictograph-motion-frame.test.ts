import { describe, expect, it } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { resolveFusePictographMotionFrame } from "../fuse-pictograph-motion-frame";

function step(id: string, stepNumber: number): StepData {
  return { id, stepNumber, duration: 1, motions: {} } as StepData;
}

function sequence(
  steps: readonly StepData[],
  startPosition?: StartPositionData
): SequenceData {
  return {
    id: "fuse-source",
    name: "Fuse source",
    word: "",
    steps,
    startPosition,
    thumbnails: [],
    isFavorite: false,
    isCircular: true,
    tags: [],
    metadata: {},
  };
}

describe("resolveFusePictographMotionFrame", () => {
  const steps = [step("one", 1), step("two", 2), step("three", 3)];
  const startPosition = {
    id: "start",
    isStartPosition: true,
    motions: {},
  } as StartPositionData;

  it("maps the Fuse clock to the active target motion and its progress", () => {
    const frame = resolveFusePictographMotionFrame(
      sequence(steps, startPosition),
      1.4
    );

    expect(frame).toMatchObject({
      step: steps[1],
      stepIndex: 1,
      motionStartData: steps[0],
    });
    expect(frame?.motionProgress).toBeCloseTo(0.4);
  });

  it("uses the canonical start position for the first motion", () => {
    const frame = resolveFusePictographMotionFrame(
      sequence(steps, startPosition),
      0.25
    );

    expect(frame?.step).toBe(steps[0]);
    expect(frame?.motionStartData).toBe(startPosition);
    expect(frame?.motionProgress).toBe(0.25);
  });

  it("wraps across the loop seam and falls back to the last pictograph", () => {
    const frame = resolveFusePictographMotionFrame(sequence(steps), 3.5);

    expect(frame).toMatchObject({
      step: steps[0],
      stepIndex: 0,
      motionStartData: steps[2],
      motionProgress: 0.5,
    });
  });

  it("normalizes negative and invalid clock values", () => {
    const wrapped = resolveFusePictographMotionFrame(sequence(steps), -0.25);
    const invalid = resolveFusePictographMotionFrame(
      sequence(steps, startPosition),
      Number.NaN
    );

    expect(wrapped).toMatchObject({
      step: steps[2],
      stepIndex: 2,
      motionStartData: steps[1],
      motionProgress: 0.75,
    });
    expect(invalid).toMatchObject({
      step: steps[0],
      stepIndex: 0,
      motionStartData: startPosition,
      motionProgress: 0,
    });
  });

  it("returns null when there is no motion sequence", () => {
    expect(resolveFusePictographMotionFrame(null, 0)).toBeNull();
    expect(resolveFusePictographMotionFrame(sequence([]), 0)).toBeNull();
  });
});
