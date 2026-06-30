import { describe, it, expect, beforeEach, vi } from "vitest";
import { markScan, reportScanToStable, _resetScanPerf } from "./scan-perf";

describe("scan-perf", () => {
  beforeEach(() => {
    _resetScanPerf();
    performance.clearMarks();
    performance.clearMeasures();
  });

  it("returns null when scan:start was never marked", () => {
    markScan("all-cells-stable");
    expect(reportScanToStable()).toBeNull();
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
});
