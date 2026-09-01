import { describe, it, expect } from "vitest";
import { Plane } from "@austencloud/scene-3d";
import { Vector3 } from "three";
import { StanceSimulator, restPoseFromHeight } from "./stance-simulator";
import { StanceOptimizer } from "./stance-optimizer";
import { OPTIMIZER_BOUNDS, handToPropTarget } from "./pose-target-mapper";
import type { SimPropTarget } from "./types";
import type { StancePose } from "../domain/types";

const NEUTRAL: StancePose = {
  footOffsetX: 0,
  footOffsetZ: 0,
  rootYawRad: 0,
  spinePitchRad: 0,
};

// Wheel-plane staff swinging through the centerline (x=0 plane) at several
// instants — the neutral stance is impaled; the optimizer must step/turn clear.
function wheelSpinSweep(): SimPropTarget[] {
  const out: SimPropTarget[] = [];
  for (let i = 0; i < 12; i++) {
    const t = (i / 11) * Math.PI; // half-disc sweep in the YZ plane (x=0)
    const z = Math.cos(t) * 0.43;
    const y = -0.2 + Math.sin(t) * 0.43;
    out.push({
      gripWorld: new Vector3(0, -0.2, 0),
      tipAWorld: new Vector3(0, y, z),
      tipBWorld: new Vector3(0, -0.4 - Math.sin(t) * 0.43, -z),
      radius: 0.012,
    });
  }
  return out;
}

describe("StanceOptimizer.optimizeSweep", () => {
  it("finds a stance that clears the whole sweep where neutral does not", () => {
    const sim = new StanceSimulator(restPoseFromHeight(1.8));
    const opt = new StanceOptimizer(sim);
    const left = wheelSpinSweep();
    const right = left.map(() => handToPropTarget(Plane.WALL, "N", "in")); // RH wall, out of the way

    const neutral = sim.evaluateSweep(NEUTRAL, left, right);
    const neutralTorso = neutral.collisions.find((c) => c.zone === "prop-through-torso");
    expect(neutralTorso && neutralTorso.depth > 0.01).toBe(true); // impaled at neutral

    const result = opt.optimizeSweep({ left, right }, NEUTRAL, OPTIMIZER_BOUNDS);
    const solvedTorso = result.simResult.collisions.find((c) => c.zone === "prop-through-torso");
    const solvedDepth = solvedTorso ? solvedTorso.depth : 0;
    expect(solvedDepth).toBeLessThan(0.01); // cleared after solve
    expect(result.simResult.balanceMargin).toBeGreaterThan(-0.005); // balanced
  });

  it("existing instantaneous optimize() still works (no regression)", () => {
    const sim = new StanceSimulator(restPoseFromHeight(1.8));
    const opt = new StanceOptimizer(sim);
    const left = handToPropTarget(Plane.WALL, "N", "in");
    const right = handToPropTarget(Plane.WALL, "S", "in");
    const r = opt.optimize({ left, right }, NEUTRAL, OPTIMIZER_BOUNDS);
    expect(r.stance).toBeDefined();
    expect(Number.isFinite(r.loss)).toBe(true);
  });
});
