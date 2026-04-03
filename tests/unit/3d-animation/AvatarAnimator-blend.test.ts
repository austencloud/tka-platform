import { describe, it, expect } from "vitest";

describe("ArmIKState blend weight ramp", () => {
  const ikBlendSpeed = 1 / 0.3;

  function rampWeight(current: number, target: number, delta: number): number {
    const factor = 1 - Math.exp(-ikBlendSpeed * delta);
    return current + (target - current) * factor;
  }

  it("ramps from 0 toward 1 over multiple frames", () => {
    let weight = 0;
    for (let i = 0; i < 10; i++) {
      weight = rampWeight(weight, 1, 1 / 60);
    }
    // After ~0.17s at 60fps, should be past 0.4 but not yet 1
    expect(weight).toBeGreaterThan(0.4);
    expect(weight).toBeLessThan(1);
  });

  it("ramps from 1 toward 0 when prop removed", () => {
    let weight = 1;
    // Run for ~0.9s (54 frames gets below 0.05; use 60 to be safe)
    for (let i = 0; i < 60; i++) {
      weight = rampWeight(weight, 0, 1 / 60);
    }
    // After ~1s (3x the 0.3s ramp constant), should be very near 0
    expect(weight).toBeLessThan(0.05);
  });

  it("stays at 0 when target is 0 and current is 0", () => {
    expect(rampWeight(0, 0, 1 / 60)).toBe(0);
  });

  it("stays at 1 when target is 1 and current is 1", () => {
    expect(rampWeight(1, 1, 1 / 60)).toBe(1);
  });

  it("handles large delta without overshooting", () => {
    const result = rampWeight(0, 1, 10);
    expect(result).toBeLessThanOrEqual(1);
    expect(result).toBeGreaterThan(0.99);
  });

  it("handles zero delta gracefully", () => {
    const result = rampWeight(0.5, 1, 0);
    expect(result).toBe(0.5); // No change with zero time
  });

  it("converges to target asymptotically", () => {
    let weight = 0;
    // Run for 2 seconds (much longer than 0.3s ramp)
    for (let i = 0; i < 120; i++) {
      weight = rampWeight(weight, 1, 1 / 60);
    }
    // After 2s (~6.7x the time constant), should be extremely close to 1
    expect(weight).toBeGreaterThan(0.998);
  });
});
