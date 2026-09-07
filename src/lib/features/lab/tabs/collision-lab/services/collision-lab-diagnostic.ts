import type { Vector3 } from "three";
import type { StanceOptimizer } from "./stance-optimizer";
import type { PoseDefinition, PoseLabel, StancePose } from "../domain/types";
import type { ReachabilityInfo } from "../state/collision-lab-state.svelte";
import { poseToOptimizerInput, OPTIMIZER_BOUNDS } from "./pose-target-mapper";

const CENTER_STANCE: StancePose = {
  footOffsetX: 0,
  footOffsetZ: 0,
  rootYawRad: 0,
  spinePitchRad: 0,
};

function vec3ToPlain(v: Vector3): { x: number; y: number; z: number } {
  return { x: v.x, y: v.y, z: v.z };
}

export function buildDiagnosticReport(
  currentPose: PoseDefinition | null,
  allPoses: PoseDefinition[],
  currentStance: StancePose,
  currentReachability: ReachabilityInfo,
  optimizer: StanceOptimizer | null,
  labels: Record<string, PoseLabel>
): Record<string, unknown> {
  if (!currentPose) return { error: "no-current-pose" };

  const simInput = poseToOptimizerInput(currentPose);
  const fresh = optimizer
    ? optimizer.optimize(simInput, CENTER_STANCE, OPTIMIZER_BOUNDS)
    : null;
  const currentSimResult = optimizer
    ? optimizer.simulator.evaluate(currentStance, simInput.left, simInput.right)
    : null;

  return {
    schemaVersion: 1,
    timestamp: Date.now(),
    poseId: currentPose.id,
    poseIndex: allPoses.findIndex((p) => p.id === currentPose.id),
    totalPoses: allPoses.length,
    poseDefinition: {
      leftHand: currentPose.leftHand,
      rightHand: currentPose.rightHand,
    },
    propTargets: {
      left: {
        grip: vec3ToPlain(simInput.left.gripWorld),
        tipA: vec3ToPlain(simInput.left.tipAWorld),
        tipB: vec3ToPlain(simInput.left.tipBWorld),
      },
      right: {
        grip: vec3ToPlain(simInput.right.gripWorld),
        tipA: vec3ToPlain(simInput.right.tipAWorld),
        tipB: vec3ToPlain(simInput.right.tipBWorld),
      },
    },
    currentStance: {
      footOffsetX: currentStance.footOffsetX,
      footOffsetZ: currentStance.footOffsetZ,
      rootYawRad: currentStance.rootYawRad,
      rootYawDeg: (currentStance.rootYawRad * 180) / Math.PI,
      spinePitchRad: currentStance.spinePitchRad,
      spinePitchDeg: (currentStance.spinePitchRad * 180) / Math.PI,
    },
    currentReachability: { ...currentReachability },
    currentSimResult: currentSimResult
      ? {
          feasible: currentSimResult.feasible,
          reachShortfall: currentSimResult.reachShortfall,
          reachStretch: currentSimResult.reachStretch,
          balanceMargin: currentSimResult.balanceMargin,
          jointViolationRad: currentSimResult.jointViolationRad,
          totalCollisionDepth: currentSimResult.totalCollisionDepth,
          collisions: currentSimResult.collisions.map((c) => ({
            zone: c.zone,
            depthCm: c.depth * 100,
            description: c.description,
          })),
        }
      : null,
    freshOptimizerRun: fresh
      ? {
          feasible: fresh.feasible,
          loss: fresh.loss,
          evaluations: fresh.evaluations,
          stance: {
            footOffsetX: fresh.stance.footOffsetX,
            footOffsetZ: fresh.stance.footOffsetZ,
            rootYawRad: fresh.stance.rootYawRad,
            rootYawDeg: (fresh.stance.rootYawRad * 180) / Math.PI,
            spinePitchRad: fresh.stance.spinePitchRad,
            spinePitchDeg: (fresh.stance.spinePitchRad * 180) / Math.PI,
          },
          reachShortfall: fresh.simResult.reachShortfall,
          balanceMargin: fresh.simResult.balanceMargin,
          totalCollisionDepth: fresh.simResult.totalCollisionDepth,
          collisions: fresh.simResult.collisions.map((c) => ({
            zone: c.zone,
            depthCm: c.depth * 100,
            description: c.description,
          })),
        }
      : null,
    priorLabel: labels[currentPose.id] ?? null,
    bounds: OPTIMIZER_BOUNDS,
  };
}
