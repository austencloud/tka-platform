import { describe, it, expect } from "vitest";
import {
  buildTaperedMesh,
  createSmoothCurve,
  adaptiveSubdivisions,
  MIN_TAIL_WIDTH_RATIO,
  type Point2D,
} from "$lib/shared/render-graph/math/trail-mesh";

describe("createSmoothCurve", () => {
  it("returns an empty array for empty input", () => {
    expect(createSmoothCurve([])).toEqual([]);
  });

  it("passes a single point through unchanged (cloned)", () => {
    const input: Point2D[] = [{ x: 1, y: 2 }];
    const out = createSmoothCurve(input);
    expect(out).toEqual(input);
    expect(out[0]).not.toBe(input[0]);
  });

  it("interpolates linearly between two points", () => {
    const out = createSmoothCurve(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      { subdivisionsPerSegment: 4 },
    );
    expect(out).toHaveLength(5);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[2]!.x).toBeCloseTo(0.5, 5);
    expect(out[4]).toEqual({ x: 1, y: 0 });
  });

  it("produces more than N points for N control points (spline subdivision)", () => {
    const control: Point2D[] = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.8 },
      { x: 1, y: 0 },
      { x: 1.5, y: -0.5 },
    ];
    const out = createSmoothCurve(control, { subdivisionsPerSegment: 8 });
    expect(out.length).toBeGreaterThan(control.length);
    // Endpoints preserved.
    expect(out[0]).toEqual(control[0]);
    expect(out[out.length - 1]).toEqual(control[control.length - 1]);
  });
});

describe("adaptiveSubdivisions", () => {
  it("drops per-segment subdivisions as point count grows", () => {
    expect(adaptiveSubdivisions(4)).toBeGreaterThan(adaptiveSubdivisions(50));
  });

  it("clamps to a minimum for very large paths", () => {
    expect(adaptiveSubdivisions(1000)).toBeGreaterThanOrEqual(2);
  });
});

describe("buildTaperedMesh", () => {
  const straightPath: Point2D[] = [
    { x: -0.5, y: 0 },
    { x: 0, y: 0 },
    { x: 0.5, y: 0 },
  ];

  it("emits an empty mesh for sub-2-point paths", () => {
    expect(buildTaperedMesh([], { thickness: 0.01 }).vertexCount).toBe(0);
    expect(buildTaperedMesh([{ x: 0, y: 0 }], { thickness: 0.01 }).vertexCount).toBe(0);
  });

  it("produces exactly 2 * pathLength vertices (left + right edge per point)", () => {
    const mesh = buildTaperedMesh(straightPath, { thickness: 0.02 });
    expect(mesh.vertexCount).toBe(straightPath.length * 2);
    expect(mesh.vertices.length).toBe(straightPath.length * 2 * 4);
  });

  it("alternates edge_t between -1 and +1", () => {
    const mesh = buildTaperedMesh(straightPath, { thickness: 0.02 });
    for (let i = 0; i < mesh.vertexCount; i += 1) {
      const edgeT = mesh.vertices[i * 4 + 2]!;
      expect(edgeT).toBe(i % 2 === 0 ? -1 : 1);
    }
  });

  it("tapers width — first-pair separation is smaller than last-pair", () => {
    const mesh = buildTaperedMesh(straightPath, { thickness: 0.05 });
    const firstLeft = { x: mesh.vertices[0]!, y: mesh.vertices[1]! };
    const firstRight = { x: mesh.vertices[4]!, y: mesh.vertices[5]! };
    const lastLeft = {
      x: mesh.vertices[mesh.vertices.length - 8]!,
      y: mesh.vertices[mesh.vertices.length - 7]!,
    };
    const lastRight = {
      x: mesh.vertices[mesh.vertices.length - 4]!,
      y: mesh.vertices[mesh.vertices.length - 3]!,
    };
    const tailWidth = Math.hypot(firstLeft.x - firstRight.x, firstLeft.y - firstRight.y);
    const headWidth = Math.hypot(lastLeft.x - lastRight.x, lastLeft.y - lastRight.y);
    expect(headWidth).toBeGreaterThan(tailWidth);
    expect(tailWidth / headWidth).toBeCloseTo(MIN_TAIL_WIDTH_RATIO, 2);
  });

  it("per-vertex alpha rises from tail (0) to head (maxAlpha)", () => {
    const mesh = buildTaperedMesh(straightPath, {
      thickness: 0.02,
      maxAlpha: 0.9,
      fadeExponent: 2.5,
    });
    const firstAlpha = mesh.vertices[3]!;
    const lastAlpha = mesh.vertices[mesh.vertices.length - 1]!;
    expect(firstAlpha).toBeCloseTo(0, 5);
    expect(lastAlpha).toBeCloseTo(0.9, 5);
  });

  it("coreRatio = 1.0 when glow is 0", () => {
    const mesh = buildTaperedMesh(straightPath, { thickness: 0.04, glow: 0 });
    expect(mesh.coreRatio).toBe(1);
  });

  it("coreRatio < 1.0 when glow > 0", () => {
    const mesh = buildTaperedMesh(straightPath, { thickness: 0.04, glow: 0.02 });
    expect(mesh.coreRatio).toBeGreaterThan(0);
    expect(mesh.coreRatio).toBeLessThan(1);
  });
});
