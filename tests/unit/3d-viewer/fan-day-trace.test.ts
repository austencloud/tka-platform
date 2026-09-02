import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const tracePath = path.join(
  root,
  "scripts",
  "assets",
  "doodlegrip-day-contours.json"
);
const builderPath = path.join(root, "scripts", "build-fan-model.py");

describe("DoodleGrip Day fan source trace", () => {
  const hasMirroredPoint = (
    point: number[],
    candidates: number[][],
    tolerance = 0.000002
  ) =>
    candidates.some(
      (candidate) =>
        Math.abs(candidate[0] + point[0]) <= tolerance &&
        Math.abs(candidate[1] - point[1]) <= tolerance
    );

  it("preserves the product image's complete contour topology", () => {
    const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));

    expect(trace.source).toContain("user-supplied Flowtoys DoodleGrip");
    expect(trace.contour_count).toBe(18);
    expect(trace.holes).toHaveLength(17);
    expect(trace.width_m).toBe(0.51);
    expect(trace.height_m).toBe(0.35);
    expect(trace.ring_diameter_m).toBe(0.044);
    const ring = trace.holes.at(-1) as number[][];
    expect(ring).toHaveLength(64);
    expect(Math.max(...ring.map((point) => point[0]))).toBe(0.022);
    expect(Math.min(...ring.map((point) => point[0]))).toBe(-0.022);
    expect(trace.symmetry).toBe(
      "bilateral average of eight left/right cutout pairs"
    );
    expect(trace.curve_cleanup).toBe(
      "uniform resampling plus restrained periodic fairing"
    );
    expect(trace.minimum_web_m).toBeGreaterThanOrEqual(0.007);
    expect(trace.official_dimensions_source).toBe(
      "https://flowtoys.com/products/doodlegrip-practice-fans"
    );
    expect(trace.outline.length).toBeGreaterThan(40);
    expect(
      trace.outline.length +
        trace.holes.reduce(
          (total: number, contour: unknown[]) => total + contour.length,
          0
        )
    ).toBeGreaterThanOrEqual(250);
  });

  it("removes camera skew without choosing either photographed side", () => {
    const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
    const outline = trace.outline as number[][];
    const holePoints = (trace.holes as number[][][]).flat();

    expect(outline.every((point) => hasMirroredPoint(point, outline))).toBe(
      true
    );
    expect(
      holePoints.every((point) => hasMirroredPoint(point, holePoints))
    ).toBe(true);
  });

  it("builds the Day plate from the extracted contours", () => {
    const builder = fs.readFileSync(builderPath, "utf8");
    const dayBuilderStart = builder.indexOf("def build_day_frame(");
    const dayBuilderEnd = builder.indexOf(
      "\ndef build_moon_fan(",
      dayBuilderStart
    );
    expect(dayBuilderStart).toBeGreaterThanOrEqual(0);
    expect(dayBuilderEnd).toBeGreaterThan(dayBuilderStart);
    const dayBuilder = builder.slice(dayBuilderStart, dayBuilderEnd);

    expect(dayBuilder).toContain('trace["outline"]');
    expect(dayBuilder).toContain('trace["holes"]');
    expect(dayBuilder).not.toContain("top_left =");
    expect(dayBuilder).not.toContain("lower_left =");
  });
});
