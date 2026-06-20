/**
 * Proves the torso-twist DOF + oriented-slab torso + stance trajectory: turning
 * the chest edge-on clears a staff a face-on torso clips, the trajectory sampler
 * interpolates its keyframes, and the trajectory optimizer runs end-to-end.
 */
import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { StanceSimulator, restPoseFromHeight } from "./stance-simulator";
import type { SimPropTarget } from "./types";
import type { StancePose } from "../domain/types";
import { sampleTrajectory, type StanceTrajectory } from "./stance-trajectory";
import { TrajectoryOptimizer } from "./trajectory-optimizer";

const body = restPoseFromHeight(1.8);
const sim = new StanceSimulator(body);

function stance(p: Partial<StancePose>): StancePose {
  return { footOffsetX: 0, footOffsetZ: 0, rootYawRad: 0, spinePitchRad: 0, torsoTwistRad: 0, ...p };
}

/** A vertical staff whose grip sits at (x,y,z); shaft runs ±halfLen along Y. */
function verticalStaff(x: number, y: number, z: number, halfLen = 0.4): SimPropTarget {
  const grip = new Vector3(x, y, z);
  return {
    gripWorld: grip,
    tipAWorld: grip.clone().add(new Vector3(0, halfLen, 0)),
    tipBWorld: grip.clone().add(new Vector3(0, -halfLen, 0)),
    radius: 0.01,
  };
}

function torsoDepth(s: StancePose, blue: SimPropTarget, red: SimPropTarget): number {
  const r = sim.evaluate(s, blue, red);
  let d = 0;
  for (const c of r.collisions) if (c.zone === "prop-through-torso") d = Math.max(d, c.depth);
  return d;
}

describe("oriented-slab torso + twist", () => {
  // A vertical staff 12 cm to the performer's right, at chest height. Within the
  // wide (shoulder-axis) half-width 0.14 but outside the thin depth 0.095.
  const sideStaff = verticalStaff(0.12, -0.1, 0);
  const farDummy = verticalStaff(2, 0, 0); // out of the way, irrelevant to torso

  it("face-on torso (twist 0) is clipped by the side staff", () => {
    expect(torsoDepth(stance({}), sideStaff, farDummy)).toBeGreaterThan(0.02);
  });

  it("edge-on torso (twist 90°) clears the same staff", () => {
    const d = torsoDepth(stance({ torsoTwistRad: Math.PI / 2 }), sideStaff, farDummy);
    expect(d).toBeLessThan(0.005);
  });

  it("reduces to the isotropic sphere when no twist and a centered staff", () => {
    // Directly in front along forward: depth axis governs at twist 0.
    const front = verticalStaff(0, -0.1, 0.1);
    expect(torsoDepth(stance({}), front, farDummy)).toBeGreaterThan(0);
  });
});

describe("sampleTrajectory", () => {
  const traj: StanceTrajectory = {
    keyframes: [
      { t: 0, pose: stance({ footOffsetX: -0.2, rootYawRad: 0 }) },
      { t: 0.5, pose: stance({ footOffsetX: 0, rootYawRad: 0.3 }) },
      { t: 1, pose: stance({ footOffsetX: 0.2, rootYawRad: 0.6 }) },
    ],
  };

  it("hits the keyframes at their times", () => {
    expect(sampleTrajectory(traj, 0).footOffsetX).toBeCloseTo(-0.2, 5);
    expect(sampleTrajectory(traj, 0.5).footOffsetX).toBeCloseTo(0, 5);
    expect(sampleTrajectory(traj, 1).footOffsetX).toBeCloseTo(0.2, 5);
  });

  it("interpolates monotonically between keyframes", () => {
    const a = sampleTrajectory(traj, 0.25).footOffsetX;
    const b = sampleTrajectory(traj, 0.75).footOffsetX;
    expect(a).toBeGreaterThan(-0.2);
    expect(a).toBeLessThan(0);
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThan(0.2);
  });

  it("clamps progress outside [0,1]", () => {
    expect(sampleTrajectory(traj, -1).footOffsetX).toBeCloseTo(-0.2, 5);
    expect(sampleTrajectory(traj, 2).footOffsetX).toBeCloseTo(0.2, 5);
  });
});

describe("TrajectoryOptimizer", () => {
  // Two reachable staffs in front of the body, swept gently across the sweep —
  // a neutral-ish stance already clears, so the optimizer should report feasible.
  const N = 12;
  const blue: SimPropTarget[] = [];
  const red: SimPropTarget[] = [];
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    blue.push(verticalStaff(-0.25 + 0.05 * f, 0, 0.32, 0.15));
    red.push(verticalStaff(0.25 - 0.05 * f, 0, 0.32, 0.15));
  }
  const bounds = {
    footOffsetX: { min: -1, max: 1 },
    footOffsetZ: { min: -1, max: 1 },
    rootYawRad: { min: -Math.PI, max: Math.PI },
    spinePitchRad: { min: -Math.PI / 18, max: (40 * Math.PI) / 180 },
    torsoTwistRad: { min: -Math.PI / 3, max: Math.PI / 3 },
  };

  it("runs end-to-end and returns one verdict per dense sample", () => {
    const opt = new TrajectoryOptimizer(sim);
    const res = opt.optimize({ blue, red }, stance({}), bounds);
    expect(res.feasiblePerSample).toHaveLength(N);
    expect(Number.isFinite(res.loss)).toBe(true);
    expect(Number.isFinite(res.meanStretch)).toBe(true);
    expect(res.trajectory.keyframes.length).toBeGreaterThanOrEqual(2);
  });

  it("finds a feasible, comfortable trajectory for reachable staffs", () => {
    const opt = new TrajectoryOptimizer(sim);
    const res = opt.optimize({ blue, red }, stance({}), bounds, { reachTolerance: 0.03 });
    expect(res.feasible).toBe(true);
    expect(res.meanStretch).toBeLessThan(1.0);
  });
});
