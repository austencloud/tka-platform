/**
 * Oriented-slab torso + twist DOF: turning the chest edge-on clears a staff a
 * face-on torso clips. Preserved from the (removed) stance-trajectory-twist test
 * — these assert StanceSimulator collision behavior, which stays on the offline
 * labeling path even though the trajectory/dodge runtime path was replaced by the
 * analytic VacatePlanner.
 */
import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { StanceSimulator, restPoseFromHeight } from "./stance-simulator";
import type { SimPropTarget } from "./types";
import type { StancePose } from "../domain/types";

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

function torsoDepth(s: StancePose, left: SimPropTarget, right: SimPropTarget): number {
  const r = sim.evaluate(s, left, right);
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
