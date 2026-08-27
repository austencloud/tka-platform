
import { Bone, Object3D, Vector3 } from "three";
import type { RigBinding, LegChain } from "../rig-binding";
import type { PoseSample } from "../feature-types";

/**
 * Minimal RigBinding for controller logic tests: a root + hips + two static leg
 * chains. applyClip is a no-op (clip poses don't matter for the translation /
 * settle logic under test) but keeps world matrices current.
 */
export function makeFakeRig(): RigBinding {
  const root = new Object3D();
  const hips = new Bone();
  hips.position.set(0, 0.9, 0);
  root.add(hips);

  const mkChain = (sign: number): LegChain => {
    const up = new Bone();
    up.position.set(sign * 0.1, -0.1, 0);
    const lo = new Bone();
    lo.position.set(0, -0.4, 0);
    const foot = new Bone();
    foot.position.set(0, -0.4, 0);
    up.add(lo);
    lo.add(foot);
    hips.add(up);
    return {
      root: up,
      middle: lo,
      effector: foot,
      totalLength: 0.8,
      upperLength: 0.4,
      lowerLength: 0.4,
      rootRestDir: new Vector3(0, -1, 0),
      middleRestDir: new Vector3(0, -1, 0),
    };
  };
  const left = mkChain(-1);
  const right = mkChain(1);
  root.updateMatrixWorld(true);

  const blank: PoseSample = {
    hips: [0, 0.9, 0],
    leftFoot: [-0.1, -0.9, 0],
    rightFoot: [0.1, -0.9, 0],
    facing: 0,
    rootXZ: [0, 0],
  };

  return {
    root,
    getBone: (n) => (n === "Hips" ? hips : null),
    getLeftLegChain: () => left,
    getRightLegChain: () => right,
    clipSpecs: () => [
      { clipId: "idle", durationSec: 1 },
      { clipId: "turn-left", durationSec: 0.9 },
      { clipId: "turn-right", durationSec: 0.9 },
    ],
    samplePose: () => blank,
    readLivePose: () => blank,
    applyClip: () => {
      root.updateMatrixWorld(true);
    },
    rootMotionDelta: () => ({ x: 0, forward: 0, yawDelta: 0 }),
    resetRootMotion: () => {},
  };
}
