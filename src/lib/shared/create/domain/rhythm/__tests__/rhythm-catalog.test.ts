import { describe, it, expect } from "vitest";
import {
  PER_HAND_RHYTHMS,
  CONTINUOUS,
  DURATION_RHYTHMS,
} from "../rhythm-catalog";

describe("rhythm-catalog", () => {
  it("per-hand catalog ids match the reversal vocabulary", () => {
    expect(PER_HAND_RHYTHMS.map((r) => r.id)).toEqual([
      "book", "long-book", "alternating", "red-book", "blue-book",
    ]);
  });
  it("syms use only P/R/B/- symbols", () => {
    for (const r of [...PER_HAND_RHYTHMS, CONTINUOUS, ...DURATION_RHYTHMS]) {
      expect(r.sym).toMatch(/^[PRB-]+$/);
    }
  });
  it("alternating is the two-beat RB unit", () => {
    expect(PER_HAND_RHYTHMS.find((r) => r.id === "alternating")?.sym).toBe("RB");
  });
});
