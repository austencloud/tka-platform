import { describe, expect, it } from "vitest";
import {
  getChangedTransitionPlaybackWindow,
  toAnimatorMotionCursor,
} from "$lib/shared/create/domain/changed-transition-playback";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

function sequenceWithSteps(count: number): SequenceData {
  return {
    id: "sequence",
    name: "",
    word: "",
    steps: Array.from(
      { length: count },
      (_, index) =>
        ({ id: `step-${index + 1}`, stepNumber: index + 1 }) as StepData
    ),
    thumbnails: [],
    isFavorite: false,
    isCircular: false,
    tags: [],
    metadata: {},
  };
}

describe("changed transition playback window", () => {
  it("maps the third pictograph to motion 3 in the animator", () => {
    expect(toAnimatorMotionCursor(2)).toBe(3);
    expect(toAnimatorMotionCursor(2.5)).toBe(3.5);
  });

  it("bounds the preview to the held candidate motion", () => {
    expect(getChangedTransitionPlaybackWindow(sequenceWithSteps(4), 4)).toEqual(
      {
        startStep: 3,
        endStepExclusive: 4,
        changedStep: 3,
      }
    );
  });

  it("starts a middle candidate from its own starting position", () => {
    expect(getChangedTransitionPlaybackWindow(sequenceWithSteps(5), 3)).toEqual(
      {
        startStep: 2,
        endStepExclusive: 3,
        changedStep: 2,
      }
    );
  });

  it.each<[number, number, number]>([
    [1, 0, 1],
    [5, 4, 5],
  ])(
    "clamps a step %s preview to the available sequence",
    (stepNumber, startStep, endStepExclusive) => {
      expect(
        getChangedTransitionPlaybackWindow(sequenceWithSteps(5), stepNumber)
      ).toMatchObject({ startStep, endStepExclusive });
    }
  );

  it("rejects a request outside the sequence", () => {
    expect(() =>
      getChangedTransitionPlaybackWindow(sequenceWithSteps(2), 3)
    ).toThrow(RangeError);
  });
});
