import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import type { SimPropTarget } from "$lib/features/lab/tabs/collision-lab/services/types";
import { computeInsideGammaTarget } from "./inside-gamma-target";

const HALF = 0.43;

/** Build a staff instant: grip at (x,z), shaft along `axis` (unit XZ). */
function target(x: number, z: number, ax: number, az: number): SimPropTarget {
  const grip = new Vector3(x, 0, z);
  const a = new Vector3(ax, 0, az).multiplyScalar(HALF);
  return {
    gripWorld: grip,
    tipAWorld: grip.clone().add(a),
    tipBWorld: grip.clone().sub(a),
    radius: 0.012,
  };
}

// Mirror the live preset (read from the running tab): blue (WHEEL) is a rod
// along Z at x=0 sweeping z 0.3 -> -0.22; red (WALL) is a rod along X at z=0.3
// sweeping x 0 -> -0.52. They cross at the gamma vertex (0, 0.3); the hands hold
// on the -X,-Z side, so the inside corner is quadrant 3.
function presetSweeps(): { blue: SimPropTarget[]; red: SimPropTarget[] } {
  const n = 24;
  const blue: SimPropTarget[] = [];
  const red: SimPropTarget[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    blue.push(target(0, 0.3 + t * (-0.22 - 0.3), 0, 1));
    red.push(target(0 + t * (-0.52 - 0), 0.3, 1, 0));
  }
  return { blue, red };
}

describe("inside-gamma-target", () => {
  it("finds the gamma vertex where the two staff lines cross", () => {
    const { blue, red } = presetSweeps();
    const { vertex } = computeInsideGammaTarget(blue, red);
    expect(vertex).not.toBeNull();
    expect(vertex!.x).toBeCloseTo(0, 2);
    expect(vertex!.z).toBeCloseTo(0.3, 2);
  });

  it("stands among the grips on the -X (red-grip) side, off the blue staff line", () => {
    const { blue, red } = presetSweeps();
    const { stance } = computeInsideGammaTarget(blue, red);
    // Grips centroid is pulled -X by the red grips, and the blue staff line is
    // at x=0 — so the stand point is on the -X side, clear of it (|x|>0.13).
    expect(stance.footOffsetX).toBeLessThan(-0.1);
    // Stand near the grips' depth (forward), NOT backed off behind the origin —
    // backing off detaches the hands from the forward grips.
    expect(stance.footOffsetZ).toBeGreaterThan(0);
    expect(stance.footOffsetZ).toBeLessThan(0.17); // clear of the red staff line at z=0.3
  });

  it("faces the gamma vertex (into the corner) — yaw toward NE", () => {
    const { blue, red } = presetSweeps();
    const { stance } = computeInsideGammaTarget(blue, red);
    // Vertex (0,0.3) is NE of the stand point → forward (sin θ, cos θ) toward +X,+Z.
    expect(stance.rootYawRad).toBeGreaterThan(0);
    expect(stance.rootYawRad).toBeLessThan(Math.PI / 2);
  });
});
