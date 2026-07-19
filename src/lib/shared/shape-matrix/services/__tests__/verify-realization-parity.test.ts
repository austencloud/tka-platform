import { describe, it, expect } from "vitest";
import type { SVGPathData } from "$lib/shared/mandala/domain/mandala-types";
import { pathPoints, loopDistance, MATCH_EPS } from "../verify-realization-parity";

/** Build a closed-loop SVGPathData from points (mirrors pointsToSVGPath's M…C form). */
function pathFrom(points: { x: number; y: number }[]): SVGPathData[] {
  if (points.length < 2) return [];
  const first = points[0]!;
  // mirror pointsToSVGPath: fixed-2 decimals (no scientific notation)
  const f = (v: number) => v.toFixed(2);
  let d = `M ${f(first.x)} ${f(first.y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i + 1]!;
    // control points are ignored by pathPoints (it reads the C endpoint only)
    d += ` C 0 0, 0 0, ${f(p.x)} ${f(p.y)}`;
  }
  return [{ d, tipIndex: 0 }];
}

function circle(n: number, r: number, phase = 0, cx = 0, cy = 0) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (2 * Math.PI * i) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

function rotate(pts: { x: number; y: number }[], deg: number) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
}

describe("pathPoints", () => {
  it("extracts the M point and each cubic endpoint", () => {
    const pts = pathPoints([{ d: "M 10 20 C 1 1, 2 2, 30 40 C 3 3, 4 4, 50 60", tipIndex: 0 }]);
    expect(pts).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ]);
  });

  it("handles negative + decimal coordinates", () => {
    const pts = pathPoints([{ d: "M -1.5 2.25 C 0 0, 0 0, -3.5 4.75", tipIndex: 0 }]);
    expect(pts).toEqual([
      { x: -1.5, y: 2.25 },
      { x: -3.5, y: 4.75 },
    ]);
  });
});

describe("loopDistance", () => {
  const a = pathFrom(circle(60, 100));

  it("is ~0 for an identical loop", () => {
    expect(loopDistance(pathPoints(a), pathPoints(a))).toBeLessThan(1e-6);
  });

  it("is ~0 for a cyclic phase shift (same locus, different sample start)", () => {
    const shifted = pathFrom(circle(60, 100, (2 * Math.PI * 17) / 60));
    // toFixed(2) round-trip leaves sub-pixel noise; well under MATCH_EPS.
    expect(loopDistance(pathPoints(a), pathPoints(shifted))).toBeLessThan(0.05);
  });

  it("is ~0 for reversed traversal direction", () => {
    const rev = pathFrom([...circle(60, 100)].reverse());
    expect(loopDistance(pathPoints(a), pathPoints(rev))).toBeLessThan(0.05);
  });

  it("flags a spatial rotation (the defect) as far above tolerance", () => {
    const rot = pathFrom(rotate(circle(60, 100), 37));
    // A perfect circle is rotation-symmetric, so use a non-symmetric loop:
    const teardrop = (phase = 0) =>
      circle(60, 100, phase).map((p, i) => ({ x: p.x, y: p.y * (1 + 0.6 * (i / 60)) }));
    const base = pathFrom(teardrop());
    const rotated = pathFrom(rotate(teardrop(), 90));
    expect(loopDistance(pathPoints(base), pathPoints(rotated))).toBeGreaterThan(MATCH_EPS * 5);
    // (rot kept to document the symmetric-circle caveat)
    expect(rot.length).toBe(1);
  });

  it("returns Infinity for unequal sample counts", () => {
    const small = pathFrom(circle(40, 100));
    expect(loopDistance(pathPoints(a), pathPoints(small))).toBe(Infinity);
  });
});
