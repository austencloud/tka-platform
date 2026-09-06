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
    const [firstWrite] = writeParams.mock.calls;
    if (!firstWrite) throw new Error("the debounced write never landed");
    expect(firstWrite[0].set.pane).toBe("card");
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

  describe("full snapshot", () => {
    it("passes { full: true } to live captures and prefers them over fallbacks", () => {
      const session = createViewerUrlSession(new URLSearchParams(), {
        writeParams: vi.fn(),
      });
      const live = vi.fn((o: { full: boolean }) => ({ mode: o.full ? "full" : "diff" }));
      const fallback = vi.fn(() => ({ mode: "fallback" }));
      session.registerSlice("vw", live);
      session.registerFullFallback("vw", fallback);
      expect(session.captureNow({ full: true })).toEqual({ vw: { mode: "full" } });
      expect(session.captureNow()).toEqual({ vw: { mode: "diff" } });
      expect(fallback).not.toHaveBeenCalled();
    });

    it("fallback outranks the seed pass-through only in full mode", () => {
      const session = createViewerUrlSession(new URLSearchParams({ fx: "fire" }), {
        writeParams: vi.fn(),
      });
      session.registerFullFallback("fx", () => ({ active: "fire", tuning: { fire: {} } }));
      // Address bar (diff): the unmounted seed passes through verbatim.
      expect(session.captureNow()).toEqual({ fx: { active: "fire" } });
      // Share (full): the fallback expands it.
      expect(session.captureNow({ full: true })).toEqual({
        fx: { active: "fire", tuning: { fire: {} } },
      });
    });

    it("unregistering a fallback restores pass-through; a null fallback clears the slice", () => {
      const session = createViewerUrlSession(new URLSearchParams({ fx: "fire" }), {
        writeParams: vi.fn(),
      });
      const off = session.registerFullFallback("fx", () => null);
      expect(session.captureNow({ full: true })).toEqual({});
      off();
      expect(session.captureNow({ full: true })).toEqual({ fx: { active: "fire" } });
    });

    it("captureNowAsParams({ full: true }) encodes the full snapshot", () => {
      const session = createViewerUrlSession(new URLSearchParams(), {
        writeParams: vi.fn(),
      });
      session.registerSlice("vw", (o) =>
        o.full ? { mode: "split", split: { leftPane: "animation", rightPane: "card" } } : null
      );
      expect(session.captureNowAsParams().set).toEqual({});
      const full = session.captureNowAsParams({ full: true });
      expect(full.set.pane).toBe("split");
      expect(full.set.split).toBe("animation,card");
    });
  });
});
