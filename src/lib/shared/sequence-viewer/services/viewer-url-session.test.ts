import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createViewerUrlSession } from "./viewer-url-session";

describe("ViewerUrlSession", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("exposes decoded seeds", () => {
    const session = createViewerUrlSession(
      new URLSearchParams({ pane: "split", fx: "sparkles" }),
      { writeParams: vi.fn() }
    );
    expect(session.getSeed("vw")).toEqual({ mode: "split" });
    expect(session.getSeed("fx")).toEqual({ active: "sparkles" });
    expect(session.getSeed("tn")).toBeNull();
  });

  it("isOverride: seed present and different from persisted", () => {
    const session = createViewerUrlSession(
      new URLSearchParams({ fx: "sparkles" }),
      { writeParams: vi.fn() }
    );
    expect(session.isOverride("fx", { active: "fire" })).toBe(true);
    expect(session.isOverride("fx", { active: "sparkles" })).toBe(false); // own-link rule
    expect(session.isOverride("tn", null)).toBe(false); // no seed
    expect(session.isOverride("fx", null)).toBe(true); // seed, nothing persisted
  });

  it("captureNow merges live captures over URL seeds (unmounted pass-through)", () => {
    const session = createViewerUrlSession(
      new URLSearchParams({ pane: "animation", fx: "fire" }),
      { writeParams: vi.fn() }
    );
    session.registerSlice("vw", () => ({ mode: "card" }));
    // fx surface never mounted — its seed must survive verbatim
    expect(session.captureNow()).toEqual({
      vw: { mode: "card" },
      fx: { active: "fire" },
    });
  });

  it("a capture returning null clears that slice from the snapshot", () => {
    const session = createViewerUrlSession(new URLSearchParams({ pane: "card" }), {
      writeParams: vi.fn(),
    });
    session.registerSlice("vw", () => null); // back at defaults
    expect(session.captureNow()).toEqual({});
  });

  it("scheduleUrlWrite debounces; captureNow does not depend on it", () => {
    const writeParams = vi.fn();
    const session = createViewerUrlSession(new URLSearchParams(), { writeParams });
    session.registerSlice("vw", () => ({ mode: "card" }));
    session.scheduleUrlWrite();
    session.scheduleUrlWrite();
    expect(writeParams).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(writeParams).toHaveBeenCalledTimes(1);
    expect(writeParams.mock.calls[0][0].set.pane).toBe("card");
  });

  it("unregister removes the live hook; seed pass-through resumes", () => {
    const session = createViewerUrlSession(new URLSearchParams({ pane: "split" }), {
      writeParams: vi.fn(),
    });
    const off = session.registerSlice("vw", () => ({ mode: "card" }));
    off();
    expect(session.captureNow()).toEqual({ vw: { mode: "split" } });
  });

  it("dispose cancels a pending write", () => {
    const writeParams = vi.fn();
    const session = createViewerUrlSession(new URLSearchParams(), { writeParams });
    session.registerSlice("vw", () => ({ mode: "card" }));
    session.scheduleUrlWrite();
    session.dispose();
    vi.advanceTimersByTime(1000);
    expect(writeParams).not.toHaveBeenCalled();
  });
});
