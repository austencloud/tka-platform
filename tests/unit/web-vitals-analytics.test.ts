import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, (metric: unknown) => void>,
  recordVital: vi.fn(),
}));

vi.mock("web-vitals", () => ({
  onCLS: (handler: (metric: unknown) => void) => (mocks.handlers.CLS = handler),
  onFCP: (handler: (metric: unknown) => void) => (mocks.handlers.FCP = handler),
  onINP: (handler: (metric: unknown) => void) => (mocks.handlers.INP = handler),
  onLCP: (handler: (metric: unknown) => void) => (mocks.handlers.LCP = handler),
  onTTFB: (handler: (metric: unknown) => void) =>
    (mocks.handlers.TTFB = handler),
}));

vi.mock("../../src/lib/shared/analytics/boot-profiler", () => ({
  bootProfiler: { recordVital: mocks.recordVital },
}));

import { initWebVitals } from "../../src/lib/shared/analytics/web-vitals";

describe("Web Vitals analytics", () => {
  beforeEach(() => {
    mocks.recordVital.mockClear();
    vi.stubGlobal("window", { location: { pathname: "/composer" } });
  });

  it("records a field metric once for the development profiler", async () => {
    await initWebVitals();

    mocks.handlers.CLS({
      name: "CLS",
      value: 0.05,
      delta: 0.01,
      id: "vital-1",
      navigationType: "navigate",
    });

    expect(mocks.recordVital).toHaveBeenCalledWith({
      name: "CLS",
      value: 0.05,
      rating: "good",
      delta: 0.01,
    });
  });
});
