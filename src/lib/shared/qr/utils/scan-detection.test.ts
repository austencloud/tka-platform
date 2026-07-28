// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isFirstScanRouteVisit } from "./scan-detection";

describe("scan route deduplication", () => {
  beforeEach(() => {
    sessionStorage.clear();
    history.replaceState({}, "", "/q/AB12");
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { type: "navigate" } as PerformanceNavigationTiming,
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deduplicates one physical card while allowing another copy of the same code", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    expect(isFirstScanRouteVisit("AB12", "card-one")).toBe(true);
    expect(isFirstScanRouteVisit("AB12", "card-one")).toBe(false);
    expect(isFirstScanRouteVisit("AB12", "card-two")).toBe(true);
  });

  it("keeps one compatibility bucket for legacy cards without pid", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    expect(isFirstScanRouteVisit("AB12")).toBe(true);
    expect(isFirstScanRouteVisit("AB12")).toBe(false);
  });

  it("allows a later visit so a moved card can create another city fact", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    expect(isFirstScanRouteVisit("AB12", "card-one")).toBe(true);

    now.mockReturnValue(1_300_001);
    expect(isFirstScanRouteVisit("AB12", "card-one")).toBe(true);
  });

  it("does not count reload navigation as a new scan", () => {
    vi.mocked(performance.getEntriesByType).mockReturnValue([
      { type: "reload" } as PerformanceNavigationTiming,
    ]);
    expect(isFirstScanRouteVisit("AB12", "card-one")).toBe(false);
  });
});
