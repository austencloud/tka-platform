import { describe, it, expect } from "vitest";
import { simplex2d } from "$lib/shared/animation-engine/domain/patterns/noise";

describe("simplex2d", () => {
  it("returns values in [-1, 1]", () => {
    for (let x = -10; x <= 10; x += 0.7) {
      for (let y = -10; y <= 10; y += 0.7) {
        const v = simplex2d(x, y);
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is deterministic (same input = same output)", () => {
    const a = simplex2d(3.14, 2.71);
    const b = simplex2d(3.14, 2.71);
    expect(a).toBe(b);
  });

  it("varies with input (not constant)", () => {
    const values = new Set<number>();
    for (let i = 0; i < 10; i++) {
      values.add(simplex2d(i * 0.5, i * 0.3));
    }
    expect(values.size).toBeGreaterThan(5);
  });
});
