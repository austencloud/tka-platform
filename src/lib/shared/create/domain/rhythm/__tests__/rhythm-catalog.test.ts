import { describe, it, expect } from "vitest";
import {
  PER_HAND_RHYTHMS,
  CONTINUOUS,
  DURATION_RHYTHMS,
} from "../rhythm-catalog";

describe("rhythm-catalog", () => {
  it("per-hand catalog ids match the reversal vocabulary", () => {
    expect(PER_HAND_RHYTHMS.map((r) => r.id)).toEqual([
      "book", "long-book", "alternating", "red-book", "blue-book", "solo-1",
    ]);
  });
  it("syms use only P/R/B/- symbols", () => {
    for (const r of [...PER_HAND_RHYTHMS, CONTINUOUS, ...DURATION_RHYTHMS]) {
      expect(r.sym).toMatch(/^[PRB-]+$/);
    }
  });
  it("a fixed-period rhythm's sym length equals its period", () => {
    for (const r of PER_HAND_RHYTHMS) {
      if (r.period != null) expect(r.sym.length).toBe(r.period);
    }
  });
  it("solo-1 is the canonical 8-beat solo pattern", () => {
    const solo = PER_HAND_RHYTHMS.find((r) => r.id === "solo-1");
    expect(solo?.sym).toBe("RBBRBRRB");
    expect(solo?.period).toBe(8);
  });
  it("alternating is the two-beat RB unit", () => {
    expect(PER_HAND_RHYTHMS.find((r) => r.id === "alternating")?.sym).toBe("RB");
  });
});
