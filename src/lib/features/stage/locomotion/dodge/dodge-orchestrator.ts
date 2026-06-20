// src/lib/features/stage/locomotion/dodge/dodge-orchestrator.ts

import {
  StanceSimulator,
  restPoseFromHeight,
  REACH_FEASIBILITY_TOLERANCE,
} from "$lib/features/lab/tabs/collision-lab/services/stance-simulator";
import { StanceOptimizer } from "$lib/features/lab/tabs/collision-lab/services/stance-optimizer";
import { OPTIMIZER_BOUNDS } from "$lib/features/lab/tabs/collision-lab/services/pose-target-mapper";
import type { RestPoseGeometry, SimResult } from "$lib/features/lab/tabs/collision-lab/services/types";
import type { StancePose } from "$lib/features/lab/tabs/collision-lab/domain/types";
import type { MotionConfig3D } from "$lib/shared/3d/domain/models/motion-data-3d";
import { buildSweptVolume } from "./swept-volume-builder";
import { computeInsideGammaTarget } from "./inside-gamma-target";
import type { DodgeSolution } from "./dodge-types";

const NEUTRAL: StancePose = {
  footOffsetX: 0,
  footOffsetZ: 0,
  rootYawRad: 0,
  spinePitchRad: 0,
};

// Soft preference weights pulling the solve into the inside-gamma corner. Kept
// well below the reach disqualifier (1000) and body-collision (~400/m) weights,
// so they only break ties between otherwise-clear stances — never trade hands
// off the props or push the body into a staff to satisfy placement.
const W_PLACE = 18; // loss per m² of foot-offset error from the target point
const W_FACE = 9; // loss per rad² of facing error from "face the grips"

function angleDelta(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Solve the anticipatory dodge for one move: sample both hands' swept volumes,
 * then search for a single fixed stance that clears the worst-case prop position
 * while staying balanced and keeping both hands reachable across the sweep.
 *
 * Per the project's soft-feasibility rule this NEVER throws on an infeasible
 * solve — it returns the least-collision best-effort stance plus the worst body
 * penetration depth so the caller can surface a diagnostic. Two props are always
 * reachable in reality; an infeasible result means the inputs/solver are suspect.
 */
export function solveDodge(
  blueConfig: MotionConfig3D,
  redConfig: MotionConfig3D,
  heightMeters = 1.8,
  sampleCount = 24,
  restPoseOverride?: RestPoseGeometry
): DodgeSolution {
  const blue = buildSweptVolume(blueConfig, sampleCount).samples;
  const red = buildSweptVolume(redConfig, sampleCount).samples;

  // Prefer a body model measured from the real rig (correct handedness, real
  // arm reach) so "reachable/feasible" matches the actual avatar; fall back to
  // idealized anthropometrics by height.
  const sim = new StanceSimulator(restPoseOverride ?? restPoseFromHeight(heightMeters));
  const opt = new StanceOptimizer(sim);

  // Inside-gamma home: stand among the grips, facing the gamma vertex (the
  // crossing point of the two staff lines), so the props sit out to either side
  // at ~90°. Bias + seed the solve toward it so the result is the performer's
  // natural inside-corner stance, not whichever clear basin descent finds.
  const { stance: target } = computeInsideGammaTarget(blue, red);
  // Bias ONLY feasible stances toward the inside-gamma home. Gating on
  // feasibility means the placement/facing preference can never trade clearance,
  // reach, or balance for position — it only breaks ties between stances that
  // already clear the swept volume (so a preset whose inside corner is NOT clear,
  // e.g. a spinning static prop, keeps the optimizer's backed-off clear stance).
  const stancePenalty = (s: StancePose, sim: SimResult) => {
    if (!sim.feasible) return 0;
    const dx = s.footOffsetX - target.footOffsetX;
    const dz = s.footOffsetZ - target.footOffsetZ;
    const dyaw = angleDelta(s.rootYawRad, target.rootYawRad);
    return W_PLACE * (dx * dx + dz * dz) + W_FACE * dyaw * dyaw;
  };

  const bodyDepth = (r: { simResult: SimResult }): number => {
    const torso = r.simResult.collisions.find((c) => c.zone === "prop-through-torso");
    const head = r.simResult.collisions.find((c) => c.zone === "prop-through-head");
    return Math.max(torso?.depth ?? 0, head?.depth ?? 0);
  };

  // Plain solve = the original 4-yaw multistart from NEUTRAL (unbiased).
  // Biased solve = same, plus the inside-gamma target as an extra seed and the
  // gated placement/facing preference.
  const plain = opt.optimizeSweep({ blue, red }, NEUTRAL, OPTIMIZER_BOUNDS);
  const biased = opt.optimizeSweep({ blue, red }, NEUTRAL, OPTIMIZER_BOUNDS, {
    stancePenalty,
    extraSeeds: [target],
    // Don't punish near-max reach the body can close via shrug/lean + the live
    // reach-step — otherwise the solve flees the upright inside-gamma corner to a
    // roomier but heavily-leaned outside stance.
    reachTolerance: REACH_FEASIBILITY_TOLERANCE,
  });

  // Take the inside-gamma stance whenever it is FEASIBLE — feasibility already
  // guarantees it clears (body intrusion ≤ 1 cm), reaches, and balances, so a
  // little more torso graze than the wide-open outside stance is fine. When the
  // inside corner is NOT feasible (e.g. a spinning static prop whose corner the
  // swept volume fills), fall back to the unbiased clear stance.
  const result = biased.feasible ? biased : plain;

  const worstBodyDepth = bodyDepth(result);

  return {
    stance: result.stance,
    feasible: result.feasible,
    loss: result.loss,
    worstBodyDepth,
  };
}
