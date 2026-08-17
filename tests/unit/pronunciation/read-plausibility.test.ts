import { describe, expect, it } from "vitest";

import { createRateTracker } from "$lib/features/lab/pronunciation-recorder/domain/read-plausibility";

describe("createRateTracker", () => {
  it("passes everything until it has seen enough reads to have a rate", () => {
    // Seeding on the first reads is the point: Austen's pace is not known in
    // advance, and a guessed rate would reject his real one.
    const tracker = createRateTracker();

    expect(tracker.judge(4, 0.2)).toBe("ok");
    tracker.observe(4, 0.2);
    expect(tracker.judge(4, 9)).toBe("ok");
  });

  it("flags a read cut short once the rate is established", () => {
    const tracker = createRateTracker();
    for (const seconds of [1.2, 1.2, 1.2]) tracker.observe(4, seconds);

    expect(tracker.judge(4, 1.2)).toBe("ok");
    expect(tracker.judge(4, 0.5)).toBe("too-short");
  });

  it("flags a stumble or a restart", () => {
    const tracker = createRateTracker();
    for (const seconds of [1.2, 1.2, 1.2]) tracker.observe(4, seconds);

    expect(tracker.judge(4, 3.0)).toBe("too-long");
  });

  it("scales expectation with the word, not with a fixed duration", () => {
    const tracker = createRateTracker();
    for (const seconds of [1.2, 1.2, 1.2]) tracker.observe(4, seconds);

    expect(tracker.judge(12, 3.6)).toBe("ok");
    expect(tracker.judge(2, 3.6)).toBe("too-long");
  });

  it("follows a pace that drifts across a sitting", () => {
    // He speeds up as he settles in. A rate fixed at the first three words
    // would start calling every later read too short.
    const tracker = createRateTracker();
    for (const seconds of [1.6, 1.6, 1.6]) tracker.observe(4, seconds);
    for (const seconds of [0.8, 0.8, 0.8, 0.8, 0.8]) tracker.observe(4, seconds);

    expect(tracker.judge(4, 0.8)).toBe("ok");
  });

  it("ignores a zero-syllable word rather than dividing by it", () => {
    const tracker = createRateTracker();
    for (const seconds of [1.2, 1.2, 1.2]) tracker.observe(4, seconds);

    expect(tracker.judge(0, 1.2)).toBe("ok");
  });
});
