import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetScanPerf,
  markScan,
  markScanAfterNextFrame,
  markScanAfterPaint,
  reportScanToStable,
} from "./scan-perf";

describe("scan-perf", () => {
  beforeEach(() => {
    _resetScanPerf();
    performance.clearMarks();
    performance.clearMeasures();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when scan:start was never marked", () => {
    markScan("all-cells-stable");
    expect(reportScanToStable()).toBeNull();
    expect(
      performance.getEntriesByName("scan:all-cells-stable", "mark")
    ).toHaveLength(0);
  });

  it("measures start -> all-cells-stable when both marks exist", () => {
    markScan("start");
    markScan("all-cells-stable");
    const ms = reportScanToStable();
    expect(ms).not.toBeNull();
    expect(ms!).toBeGreaterThanOrEqual(0);
  });

  it("only reports once per scan", () => {
    markScan("start");
    markScan("all-cells-stable");
    expect(reportScanToStable()).not.toBeNull();
    expect(reportScanToStable()).toBeNull();
  });

  it("coalesces duplicate frame-aligned marks", async () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    markScan("start");

    const first = markScanAfterNextFrame("first-cell-painted");
    const duplicate = markScanAfterNextFrame("first-cell-painted");

    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(
      performance.getEntriesByName("scan:first-cell-painted", "mark")
    ).toHaveLength(0);

    callbacks[0]!(16);
    await Promise.all([first, duplicate]);

    expect(
      performance.getEntriesByName("scan:first-cell-painted", "mark")
    ).toHaveLength(1);
  });

  it("marks presented content on the frame after the commit frame", async () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      })
    );
    markScan("start");

    const painted = markScanAfterPaint("all-cells-stable");
    callbacks.shift()!(16);
    expect(
      performance.getEntriesByName("scan:all-cells-stable", "mark")
    ).toHaveLength(0);

    callbacks.shift()!(32);
    await painted;
    expect(
      performance.getEntriesByName("scan:all-cells-stable", "mark")
    ).toHaveLength(1);
  });
});
