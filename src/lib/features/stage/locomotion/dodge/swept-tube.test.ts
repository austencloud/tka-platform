import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { SweptTube } from "./swept-tube";
import type { SweepSample } from "./dodge-types";

/** A vertical staff whose grip sits at (x,y,z); shaft runs ±halfLen along Y. */
function vstaff(x: number, y: number, z: number, halfLen = 0.4): SweepSample {
  const grip = new Vector3(x, y, z);
  return {
    gripWorld: grip,
    tipAWorld: grip.clone().add(new Vector3(0, halfLen, 0)),
    tipBWorld: grip.clone().add(new Vector3(0, -halfLen, 0)),
    radius: 0.012,
  };
}

describe("SweptTube.minDistanceToSegments", () => {
  it("returns the perpendicular distance to the nearest staff segment", () => {
    // One vertical staff at x=1,z=0. A point at the origin at staff mid-height
    // is exactly 1 m away horizontally from the shaft line.
    const tube = new SweptTube([vstaff(1, 0, 0)]);
    const r = tube.minDistanceToSegments(new Vector3(0, 0, 0));
    expect(r.dist).toBeCloseTo(1, 5);
    expect(r.sampleIndex).toBe(0);
  });

  it("picks the closest of several samples", () => {
    const tube = new SweptTube([vstaff(2, 0, 0), vstaff(0.3, 0, 0), vstaff(2, 0, 1)]);
    const r = tube.minDistanceToSegments(new Vector3(0, 0, 0));
    expect(r.dist).toBeCloseTo(0.3, 5);
    expect(r.sampleIndex).toBe(1);
  });

  it("clamps to the segment ends (above the tip is farther than beside it)", () => {
    const tube = new SweptTube([vstaff(0, 0, 0, 0.4)]);
    const beside = tube.minDistanceToSegments(new Vector3(0.5, 0, 0)).dist;
    const above = tube.minDistanceToSegments(new Vector3(0.5, 2, 0)).dist;
    expect(above).toBeGreaterThan(beside);
  });
});

describe("SweptTube.centroid / principalAxis", () => {
  it("centroid is the mean grip", () => {
    const tube = new SweptTube([vstaff(0, 0, 0), vstaff(2, 0, 0)]);
    const c = tube.centroid();
    expect(c.x).toBeCloseTo(1, 5);
    expect(c.z).toBeCloseTo(0, 5);
  });

  it("principalAxis follows the dominant XZ travel of the grips", () => {
    // Grips travel along +X → principal axis is ~(±1,0).
    const tube = new SweptTube([vstaff(0, 0, 0), vstaff(1, 0, 0), vstaff(2, 0, 0)]);
    const axis = tube.principalAxis();
    expect(axis).not.toBeNull();
    expect(Math.abs(axis!.x)).toBeCloseTo(1, 2);
    expect(Math.abs(axis!.z)).toBeLessThan(0.05);
  });

  it("principalAxis is null for a degenerate (coincident) sweep", () => {
    const tube = new SweptTube([vstaff(1, 0, 0), vstaff(1, 0, 0)]);
    expect(tube.principalAxis()).toBeNull();
  });
});
