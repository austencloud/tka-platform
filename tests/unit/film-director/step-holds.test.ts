import { describe, expect, it } from "vitest";

import { resolveHeldStep } from "../../../src/routes/test/film-director/_lib/director-step-holds";

const hold = [{ fromStep: 4, steps: 4 }];

describe("resolveHeldStep", () => {
  it("passes the shared clock straight through when nothing holds", () => {
    expect(resolveHeldStep(6, 0.25, 0, [], 0)).toEqual({
      step: 6,
      progress: 0.25,
    });
  });

  it("passes through before the hold starts", () => {
    expect(resolveHeldStep(3, 0.5, 0, hold, 0)).toEqual({
      step: 3,
      progress: 0.5,
    });
  });

  it("pins the performer to the held step at progress zero for the whole window", () => {
    for (const [step, progress] of [
      [4, 0],
      [4, 0.9],
      [5, 0.5],
      [7, 0.99],
    ] as const) {
      expect(resolveHeldStep(step, progress, 0, hold, 0)).toEqual({
        step: 4,
        progress: 0,
      });
    }
  });

  it("resumes from the held step, so every later step lags by the hold", () => {
    expect(resolveHeldStep(8, 0, 0, hold, 0)).toEqual({ step: 4, progress: 0 });
    expect(resolveHeldStep(9, 0.5, 0, hold, 0)).toEqual({
      step: 5,
      progress: 0.5,
    });
    expect(resolveHeldStep(15, 0, 0, hold, 0)).toEqual({
      step: 11,
      progress: 0,
    });
  });

  it("accumulates lag across several holds", () => {
    const holds = [
      { fromStep: 2, steps: 2 },
      { fromStep: 6, steps: 3 },
    ];
    // First hold: shared 2-3 pins to 2, so shared 4 is the performer's 2.
    expect(resolveHeldStep(4, 0, 0, holds, 0)).toEqual({ step: 2, progress: 0 });
    // The second hold starts at the performer's step 6, which the two-step lag
    // puts at shared step 8.
    expect(resolveHeldStep(7, 0, 0, holds, 0)).toEqual({ step: 5, progress: 0 });
    expect(resolveHeldStep(8, 0, 0, holds, 0)).toEqual({ step: 6, progress: 0 });
    expect(resolveHeldStep(10, 0.5, 0, holds, 0)).toEqual({
      step: 6,
      progress: 0,
    });
    expect(resolveHeldStep(11, 0, 0, holds, 0)).toEqual({ step: 6, progress: 0 });
    // Five steps of accumulated lag after both holds.
    expect(resolveHeldStep(14, 0, 0, holds, 0)).toEqual({ step: 9, progress: 0 });
  });

  it("applies the performer's beatOffset before the hold windows", () => {
    // beatOffset 2 puts this performer two steps ahead, so they reach the
    // step-4 hold two shared steps early.
    expect(resolveHeldStep(2, 0, 2, hold, 0)).toEqual({ step: 4, progress: 0 });
    expect(resolveHeldStep(1, 0, 2, hold, 0)).toEqual({ step: 3, progress: 0 });
  });

  it("wraps to the sequence length when one is known, and does not when it is not", () => {
    expect(resolveHeldStep(13, 0.5, 0, hold, 8)).toEqual({
      step: 1,
      progress: 0.5,
    });
    expect(resolveHeldStep(13, 0.5, 0, hold, 0)).toEqual({
      step: 9,
      progress: 0.5,
    });
  });

  it("keeps a negative offset in range when a sequence length is known", () => {
    const wrapped = resolveHeldStep(0, 0, -1, [], 8);
    expect(wrapped.step).toBe(7);
    expect(wrapped.progress).toBe(0);
  });

  it("returns the opening step for non-finite input", () => {
    expect(resolveHeldStep(Number.NaN, 0, 0, hold, 0)).toEqual({
      step: 0,
      progress: 0,
    });
  });
});
