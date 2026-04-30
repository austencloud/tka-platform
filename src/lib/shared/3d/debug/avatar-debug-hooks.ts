import { Vector3 } from "three";
import type { IAvatarAnimator } from "../services/contracts/IAvatarAnimator";
import type {
  BoneName,
  IAvatarSkeletonBuilder,
} from "../services/contracts/IAvatarSkeletonBuilder";

type ToggleAnimator = IAvatarAnimator & {
  togglePoleVectors?: () => boolean;
  toggleClavicleRaise?: () => boolean;
  toggleSpineTwist?: () => boolean;
};

interface AvatarDebugHooks {
  __togglePoleVectors?: () => boolean;
  __toggleClavicleRaise?: () => boolean;
  __toggleSpineTwist?: () => boolean;
  __dumpShoulders?: () => unknown;
}

export interface AvatarDebugHandle {
  dispose: () => void;
}

export function installAvatarDebugHooks(args: {
  animator: ToggleAnimator;
  skeleton: IAvatarSkeletonBuilder;
}): AvatarDebugHandle {
  const { animator, skeleton } = args;
  const w = window as typeof window & AvatarDebugHooks;

  w.__togglePoleVectors = () => {
    const enabled = animator.togglePoleVectors?.() ?? false;
    console.log(
      `Pole vectors: ${enabled ? "ON (new)" : "OFF (old - elbows bend backward)"}`,
    );
    return enabled;
  };

  w.__toggleClavicleRaise = () => {
    const enabled = animator.toggleClavicleRaise?.() ?? false;
    console.log(
      `Clavicle raise: ${enabled ? "ON (shoulders elevate)" : "OFF (shoulders static)"}`,
    );
    return enabled;
  };

  w.__toggleSpineTwist = () => {
    const enabled = animator.toggleSpineTwist?.() ?? false;
    console.log(
      `Spine twist: ${enabled ? "ON (torso/head rotate)" : "OFF (spine static)"}`,
    );
    return enabled;
  };

  w.__dumpShoulders = () => {
    const s = skeleton.getState();
    if (!s.isLoaded) return "Skeleton not loaded";
    const names: BoneName[] = [
      "LeftShoulder",
      "RightShoulder",
      "LeftArm",
      "RightArm",
      "Spine2",
      "Hips",
    ];
    const data: Record<string, unknown> = {};
    for (const name of names) {
      const bone = s.bones.get(name);
      if (!bone) continue;
      const wp = new Vector3();
      bone.getWorldPosition(wp);
      const q = bone.quaternion;
      data[name] = {
        worldPos: `(${wp.x.toFixed(3)}, ${wp.y.toFixed(3)}, ${wp.z.toFixed(3)})`,
        localQuat: `(${q.x.toFixed(3)}, ${q.y.toFixed(3)}, ${q.z.toFixed(3)}, ${q.w.toFixed(3)})`,
      };
    }
    const lc = skeleton.getLeftArmChain();
    const rc = skeleton.getRightArmChain();
    if (lc && rc) {
      const lp = new Vector3();
      const rp = new Vector3();
      lc.root.getWorldPosition(lp);
      rc.root.getWorldPosition(rp);
      data._shoulderSpan = lp.distanceTo(rp).toFixed(3);
      data._leftArmWorldY = lp.y.toFixed(3);
      data._rightArmWorldY = rp.y.toFixed(3);
    }
    console.table(data);
    return data;
  };

  return {
    dispose: () => {
      delete w.__togglePoleVectors;
      delete w.__toggleClavicleRaise;
      delete w.__toggleSpineTwist;
      delete w.__dumpShoulders;
    },
  };
}
