import { describe, expect, it } from "vitest";
import {
  getStepIndexFromVideo,
  passCountFromStepMap,
  passNumberFromVideo,
  seekTimeForStep,
} from "$lib/shared/video-collaboration/utils/step-map-utils";

/**
 * The real map Austen marked by hand for OmLam-XJ.mp4: 43.67 seconds of
 * footage running the 16-move LOOP ΩΛ-XJ four times over, 65 taps. Hand-built
 * fixtures would space the marks evenly and hide exactly the bugs these
 * functions exist to prevent, so this is the take.
 */
const OM_LAM_XJ_MARKS = [
  0.0, 0.86, 1.55, 2.07, 2.69, 3.4, 3.94, 4.59, 5.18, 5.76, 6.45, 7.11, 7.7,
  8.36, 8.94, 9.49, 10.17, 10.8, 11.36, 12.0, 12.61, 13.23, 14.02, 14.54, 15.17,
  15.88, 16.46, 17.09, 17.71, 18.33, 18.89, 19.49, 20.26, 20.86, 21.52, 22.15,
  22.83, 23.42, 24.05, 24.66, 25.32, 26.0, 26.61, 27.19, 27.89, 28.48, 29.07,
  29.65, 30.37, 31.04, 31.69, 32.37, 32.93, 33.64, 34.25, 34.89, 35.57, 36.21,
  36.87, 37.54, 38.21, 39.03, 39.67, 40.24, 40.81,
];

/** Every mark but the last launches a move; the last is the closing arrival. */
const fourPass = {
  beatTimestamps: OM_LAM_XJ_MARKS.slice(0, -1),
  stepCount: 16,
};

/** The same take marked only once through, which is what older maps look like. */
const onePass = {
  beatTimestamps: OM_LAM_XJ_MARKS.slice(0, 16),
  stepCount: 16,
};

describe("reading a multi-pass map", () => {
  it("counts the passes the take actually holds", () => {
    expect(passCountFromStepMap(fourPass)).toBe(4);
    expect(passCountFromStepMap(onePass)).toBe(1);
  });

  it("wraps to move one when the performer goes round again", () => {
    // 10.17 opens pass two, so the step there is the first move, not the last.
    expect(getStepIndexFromVideo(9.6, fourPass)).toBe(15);
    expect(getStepIndexFromVideo(10.2, fourPass)).toBe(0);
    expect(getStepIndexFromVideo(20.3, fourPass)).toBe(0);
    expect(getStepIndexFromVideo(30.4, fourPass)).toBe(0);
  });

  it("keeps following the footage to the end of the clip", () => {
    // The bug this replaced froze on step 15 for three quarters of the take.
    expect(getStepIndexFromVideo(40.3, fourPass)).toBe(15);
  });

  it("reports nothing before the first mark", () => {
    expect(getStepIndexFromVideo(-1, fourPass)).toBe(-1);
    expect(passNumberFromVideo(-1, fourPass)).toBe(0);
  });

  it("names which time through the sequence is playing", () => {
    expect(passNumberFromVideo(0.5, fourPass)).toBe(1);
    expect(passNumberFromVideo(10.5, fourPass)).toBe(2);
    expect(passNumberFromVideo(20.5, fourPass)).toBe(3);
    expect(passNumberFromVideo(40.5, fourPass)).toBe(4);
    expect(passNumberFromVideo(40.5, onePass)).toBe(1);
  });
});

describe("seeking the footage to a step", () => {
  it("lands in the pass being watched, not back at the top", () => {
    // Move 1 is at 0.00, 10.17, 20.26 and 30.37. Watching pass three should
    // stay in pass three.
    expect(seekTimeForStep(0, 20.5, fourPass)).toBe(20.26);
    expect(seekTimeForStep(0, 31.0, fourPass)).toBe(30.37);
    expect(seekTimeForStep(0, 0.4, fourPass)).toBe(0.0);
  });

  it("takes the nearest instance even when it is behind the playhead", () => {
    // Move 13 runs at 7.70, 17.71, 27.89 and 38.21. At 18.5 the nearest is
    // the one just passed, not the one coming up.
    expect(seekTimeForStep(12, 18.5, fourPass)).toBe(17.71);
    expect(seekTimeForStep(12, 23.5, fourPass)).toBe(27.89);
  });

  it("resolves every move in the sequence", () => {
    for (let step = 0; step < 16; step++) {
      const at = seekTimeForStep(step, 0, fourPass);
      expect(at).toBe(fourPass.beatTimestamps[step]);
    }
  });

  it("has one answer per step on a single-pass map", () => {
    expect(seekTimeForStep(3, 0, onePass)).toBe(2.07);
    expect(seekTimeForStep(3, 999, onePass)).toBe(2.07);
  });

  it("returns nothing when the step is not in the map", () => {
    expect(seekTimeForStep(-1, 5, fourPass)).toBeNull();
    expect(seekTimeForStep(16, 5, fourPass)).toBeNull();
    expect(
      seekTimeForStep(0, 5, { beatTimestamps: [], stepCount: 16 })
    ).toBeNull();
  });

  it("treats a map with no step count as a single pass", () => {
    const countless = { beatTimestamps: [1, 2, 3], stepCount: 0 };
    expect(seekTimeForStep(2, 99, countless)).toBe(3);
    expect(seekTimeForStep(3, 0, countless)).toBeNull();
  });
});
