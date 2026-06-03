import { describe, it, expect } from "vitest";
import { simplex2D, curl2D, SampledCurlGrid2D } from "./smoke-curl-field";

describe("simplex2D", () => {
  it("is deterministic - same (x,y) yields same value across calls", () => {
    for (let i = 0; i < 50; i++) {
      const x = (i * 0.317) % 7.0;
      const y = (i * 0.591) % 11.0;
      const a = simplex2D(x, y);
      const b = simplex2D(x, y);
      expect(a).toBe(b);
    }
  });

  it("covers a bounded range - sampled values fall within [-1.5, 1.5]", () => {
    // Stefan Gustavson's 2D simplex is formally bounded to ~[-1,1]; we
    // loosen the range slightly to catch regressions without making the
    // test flaky on floating-point edge cases.
    let min = Infinity;
    let max = -Infinity;
    for (let j = 0; j < 40; j++) {
      for (let i = 0; i < 40; i++) {
        const v = simplex2D(i * 0.13, j * 0.17);
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    expect(min).toBeGreaterThan(-1.5);
    expect(max).toBeLessThan(1.5);
  });
});

describe("curl2D", () => {
  it("is deterministic at a fixed time", () => {
    const a = curl2D(1.5, 2.3, 0);
    const b = curl2D(1.5, 2.3, 0);
    expect(a.vx).toBe(b.vx);
    expect(a.vy).toBe(b.vy);
  });

  it("evolves over time - same position produces different velocity at t=0 vs t=5", () => {
    const a = curl2D(1.5, 2.3, 0);
    const b = curl2D(1.5, 2.3, 5);
    const deltaX = Math.abs(a.vx - b.vx);
    const deltaY = Math.abs(a.vy - b.vy);
    expect(deltaX + deltaY).toBeGreaterThan(0);
  });

  it("produces roughly divergence-free flow - random positions don't explode", () => {
    // Curl-noise is divergence-free by construction. We can't prove that
    // from finite samples but we can assert that velocities stay bounded
    // (not explosively growing) and non-degenerate (not collapsing to
    // zero everywhere).
    let maxMag = 0;
    let nonZero = 0;
    for (let i = 0; i < 200; i++) {
      const x = (i * 0.131) % 10;
      const y = (i * 0.971) % 10;
      const v = curl2D(x, y, 1.0);
      const mag = Math.hypot(v.vx, v.vy);
      if (mag > maxMag) maxMag = mag;
      if (mag > 1e-3) nonZero++;
    }
    expect(nonZero).toBeGreaterThan(150); // most samples non-trivial
    expect(maxMag).toBeLessThan(5e5); // typical magnitudes are O(few-thousand) at eps=1e-4
  });
});

describe("SampledCurlGrid2D", () => {
  it("produces smooth bilinear samples within the grid domain", () => {
    const grid = new SampledCurlGrid2D(32, 8, 1);
    grid.bake(0);
    const a = grid.sample(1.0, 1.0, 0);
    const b = grid.sample(1.01, 1.0, 0);
    const c = grid.sample(1.0, 1.01, 0);
    // Small position delta → small velocity delta. Empirical ceiling
    // captured from bake output; regression guard rather than a tight bound.
    const dAB = Math.hypot(a.vx - b.vx, a.vy - b.vy);
    const dAC = Math.hypot(a.vx - c.vx, a.vy - c.vy);
    expect(dAB).toBeLessThan(50);
    expect(dAC).toBeLessThan(50);
  });

  it("regenerates when time advances past regenerateEvery", () => {
    const grid = new SampledCurlGrid2D(16, 4, 0.1);
    const a = grid.sample(1.0, 1.0, 0);
    // Request a sample well beyond the regeneration window.
    const b = grid.sample(1.0, 1.0, 10);
    // Same position, very different times → bake refreshed, values differ.
    const delta = Math.hypot(a.vx - b.vx, a.vy - b.vy);
    expect(delta).toBeGreaterThan(0);
  });

  it("wraps positions modulo domain (seamless tiling)", () => {
    const grid = new SampledCurlGrid2D(32, 8, 1);
    grid.bake(0);
    const inside = grid.sample(1.0, 1.0, 0);
    const wrapped = grid.sample(1.0 + 8, 1.0 + 8, 0);
    // Exact wrap - positions 8 units apart with domain=8 must sample
    // the same grid node.
    expect(wrapped.vx).toBeCloseTo(inside.vx, 6);
    expect(wrapped.vy).toBeCloseTo(inside.vy, 6);
  });
});
