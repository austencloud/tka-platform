import { describe, expect, it } from "vitest";

import { resolvePerformerPlaybackStep } from "$lib/shared/3d/domain/performer-step-timing";

describe("performer step timing", () => {
  it("wraps a delayed performer through the sequence seam", () => {
    expect(resolvePerformerPlaybackStep(0.25, -1, 8)).toBeCloseTo(7.25);
    expect(resolvePerformerPlaybackStep(3.5, -2, 8)).toBeCloseTo(1.5);
  });

  it("keeps positive offsets on the same loop", () => {
    expect(resolvePerformerPlaybackStep(7.5, 1, 8)).toBeCloseTo(0.5);
  });
});
