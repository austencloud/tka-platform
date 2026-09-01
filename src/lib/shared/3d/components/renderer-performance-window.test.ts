import { describe, expect, it } from "vitest";

import { createRendererPerformanceWindow } from "./renderer-performance-window";

describe("renderer performance window", () => {
  it("reports frame-time percentiles and long-frame rate over a bounded window", () => {
    const window = createRendererPerformanceWindow(10);
    [8, 9, 10, 11, 12, 13, 14, 15, 34, 50, 80].forEach((frameMs) =>
      window.record(frameMs)
    );

    expect(window.snapshot()).toEqual({
      sampleCount: 10,
      frameP50Ms: 13,
      frameP95Ms: 50,
      frameP99Ms: 50,
      longFrameRate: 0.3,
      thermalDrift: 5.842105263157895,
    });
  });

  it("resets without retaining an old thermal baseline", () => {
    const window = createRendererPerformanceWindow(120);
    window.record(30);
    window.record(40);
    window.reset();
    window.record(10);

    expect(window.snapshot()).toEqual({
      sampleCount: 1,
      frameP50Ms: 10,
      frameP95Ms: 10,
      frameP99Ms: 10,
      longFrameRate: 0,
      thermalDrift: 0,
    });
  });
});
