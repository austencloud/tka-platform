import { describe, it, expect } from "vitest";
import {
  applyReversalToMotion,
  getReversalFlagsForBeat,
  resolvePattern,
  type ResolvedReversalPattern,
} from "$lib/features/choreo-card/domain/reversal-transform";

describe("applyReversalToMotion", () => {
  it("flips pro↔anti when reversed", () => {
    expect(applyReversalToMotion("pro", true)).toBe("anti");
    expect(applyReversalToMotion("anti", true)).toBe("pro");
  });
  it("leaves pro/anti unchanged when not reversed", () => {
    expect(applyReversalToMotion("pro", false)).toBe("pro");
    expect(applyReversalToMotion("anti", false)).toBe("anti");
  });
  it("leaves static and dash unchanged even when reversed", () => {
    expect(applyReversalToMotion("static", true)).toBe("static");
    expect(applyReversalToMotion("dash", true)).toBe("dash");
  });
});

describe("getReversalFlagsForBeat", () => {
  it("maps P/R/B/- symbols", () => {
    expect(getReversalFlagsForBeat("PPPP", 0)).toEqual({ blueReversal: true, redReversal: true });
    expect(getReversalFlagsForBeat("RRRR", 0)).toEqual({ blueReversal: false, redReversal: true });
    expect(getReversalFlagsForBeat("BBBB", 0)).toEqual({ blueReversal: true, redReversal: false });
    expect(getReversalFlagsForBeat("----", 0)).toEqual({ blueReversal: false, redReversal: false });
  });
  it("wraps via modulo", () => {
    expect(getReversalFlagsForBeat("P-", 4)).toEqual(getReversalFlagsForBeat("P-", 0));
  });
  it("throws on unknown symbol", () => {
    expect(() => getReversalFlagsForBeat("X", 0)).toThrow();
  });
});

describe("resolvePattern", () => {
  const F = false, T = true;

  it("all-false → continuous, named, clean", () => {
    const r = resolvePattern([F, F, F, F], [F, F, F, F]);
    expect(r.sequence).toBe("----");
    expect(r.id).toBe("continuous");
    expect(r.label).toBe("Continuous");
    expect(r.isNamed).toBe(true);
    expect(r.isCleanLoop).toBe(true);
  });

  it("both all-true → book (PPPP)", () => {
    const r = resolvePattern([T, T, T, T], [T, T, T, T]);
    expect(r.sequence).toBe("PPPP");
    expect(r.id).toBe("book");
    expect(r.isNamed).toBe(true);
  });

  it("red all-true, blue none → red-book (RRRR)", () => {
    const r = resolvePattern([F, F, F, F], [T, T, T, T]);
    expect(r.sequence).toBe("RRRR");
    expect(r.id).toBe("red-book");
  });

  it("alternating red@0,2 blue@1,3 → RBRB", () => {
    const r = resolvePattern([F, T, F, T], [T, F, T, F]);
    expect(r.sequence).toBe("RBRB");
    expect(r.id).toBe("alternating");
    expect(r.isNamed).toBe(true);
  });

  it("custom even-count pattern → string id, not named, clean", () => {
    const r = resolvePattern([T, T, F, F], [F, F, F, F]);
    expect(r.sequence).toBe("BB--");
    expect(r.id).toBe("BB--");
    expect(r.label).toBe("Custom");
    expect(r.isNamed).toBe(false);
    expect(r.isCleanLoop).toBe(true);
  });

  it("odd reversal count on a hand → not clean loop", () => {
    const r = resolvePattern([T, F, F, F], [F, F, F, F]);
    expect(r.sequence).toBe("B---");
    expect(r.isCleanLoop).toBe(false);
  });

  it("pair symbol emitted when both reverse same step", () => {
    const r = resolvePattern([T, F, F, F], [T, F, F, F]);
    expect(r.sequence[0]).toBe("P");
    expect(r.isCleanLoop).toBe(false);
  });
});
