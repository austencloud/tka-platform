import { describe, expect, it } from "vitest";
import { tunnelStepIndexAt } from "./tunnel-prop-sampling";

describe("tunnelStepIndexAt", () => {
  it("wraps the shared playhead through a performer's own sequence", () => {
    expect(tunnelStepIndexAt(8, 1)).toBe(0);
    expect(tunnelStepIndexAt(8, 8.99)).toBe(7);
    expect(tunnelStepIndexAt(8, 9)).toBe(0);
  });

  it("uses the same speed and stagger phase as the animated layer", () => {
    expect(tunnelStepIndexAt(10, 5, 0, 0.5)).toBe(2);
    expect(tunnelStepIndexAt(10, 5, 3, 0.5)).toBe(5);
    expect(tunnelStepIndexAt(10, 1, -1, 1)).toBe(9);
  });

  it("does not invent a highlighted step for an empty sequence", () => {
    expect(tunnelStepIndexAt(0, 4)).toBeNull();
  });
});
