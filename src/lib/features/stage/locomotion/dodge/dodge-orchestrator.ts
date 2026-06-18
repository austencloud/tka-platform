// src/lib/features/stage/locomotion/dodge/dodge-orchestrator.ts

import {
  StanceSimulator,
  restPoseFromHeight,
} from "$lib/features/lab/tabs/collision-lab/services/stance-simulator";
import { StanceOptimizer } from "$lib/features/lab/tabs/collision-lab/services/stance-optimizer";
import { OPTIMIZER_BOUNDS } from "$lib/features/lab/tabs/collision-lab/services/pose-target-mapper";
import type { RestPoseGeometry } from "$lib/features/lab/tabs/collision-lab/services/types";
import type { StancePose } from "$lib/features/lab/tabs/collision-lab/domain/types";
import type { MotionConfig3D } from "$lib/shared/3d/domain/models/motion-data-3d";
import { buildSweptVolume } from "./swept-volume-builder";
import type { DodgeSolution } from "./dodge-types";

const NEUTRAL: StancePose = {
  footOffsetX: 0,
  footOffsetZ: 0,
  rootYawRad: 0,
  spinePitchRad: 0,
};

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
  const result = opt.optimizeSweep({ blue, red }, NEUTRAL, OPTIMIZER_BOUNDS);

  const torso = result.simResult.collisions.find((c) => c.zone === "prop-through-torso");
  const head = result.simResult.collisions.find((c) => c.zone === "prop-through-head");
  const worstBodyDepth = Math.max(torso?.depth ?? 0, head?.depth ?? 0);

  return {
    stance: result.stance,
    feasible: result.feasible,
    loss: result.loss,
    worstBodyDepth,
  };
}
