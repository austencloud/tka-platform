import { describe, it, expect } from "vitest";
import { StanceSimulator, restPoseFromHeight } from "./stance-simulator";
import type { SimPropTarget } from "./types";
import type { StancePose } from "../domain/types";
import { Vector3 } from "three";

function staffAt(z: number): SimPropTarget {
  // A horizontal staff centered on the body centerline at depth z, at chest
  // height (shoulder-centered frame: y=0 at shoulders, torso spheres below).
  return {
    gripWorld: new Vector3(0, -0.2, z),
    tipAWorld: new Vector3(0.43, -0.2, z),
    tipBWorld: new Vector3(-0.43, -0.2, z),
    radius: 0.012,
  };
}

const NEUTRAL: StancePose = {
  footOffsetX: 0,
  footOffsetZ: 0,
  rootYawRad: 0,
  spinePitchRad: 0,
};
// A far-away grip the hands don't need to reach for this collision-only test.
const farTarget: SimPropTarget = staffAt(2);

describe("StanceSimulator.evaluateSweep", () => {
  it("reports the WORST torso intrusion across the sweep", () => {
    const sim = new StanceSimulator(restPoseFromHeight(1.8));
    // One sample passes through the body (z=0), others are clear (z far).
    const blueSweep = [staffAt(2), staffAt(0), staffAt(2)];
    const redSweep = [farTarget, farTarget, farTarget];
    const swept = sim.evaluateSweep(NEUTRAL, blueSweep, redSweep);
    const single = sim.evaluate(NEUTRAL, staffAt(0), farTarget);
    const sweptTorso = swept.collisions.find((c) => c.zone === "prop-through-torso");
    const singleTorso = single.collisions.find((c) => c.zone === "prop-through-torso");
    expect(sweptTorso).toBeDefined();
    expect(singleTorso).toBeDefined();
    // Worst-of-sweep depth equals the single worst instant's depth.
    expect(sweptTorso!.depth).toBeCloseTo(singleTorso!.depth, 5);
  });

  it("is clear when no sample intrudes", () => {
    const sim = new StanceSimulator(restPoseFromHeight(1.8));
    const clear = [staffAt(2), staffAt(2)];
    const swept = sim.evaluateSweep(NEUTRAL, clear, clear);
    const torso = swept.collisions.find((c) => c.zone === "prop-through-torso");
    expect(torso).toBeUndefined();
  });
});
