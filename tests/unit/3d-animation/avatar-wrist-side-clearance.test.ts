import { Bone, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { AvatarAnimator } from "../../../node_modules/@austencloud/scene-3d/src/lib/services/implementations/AvatarAnimator";
import type { BoneChain } from "../../../node_modules/@austencloud/scene-3d/src/lib/services/contracts/IAvatarSkeletonBuilder";

type SocketTargetProbe = {
  rightGripAxisLocal: Vector3 | null;
  leftPalmLocal: Vector3 | null;
  rightPalmLocal: Vector3 | null;
  _bodyFrame: { lateral: Vector3 };
  targetPose: {
    leftHand: { targetPosition: Vector3 } | null;
    rightHand: { targetPosition: Vector3 } | null;
  };
  computeSocketTarget: (
    side: "left" | "right",
    chain: BoneChain,
    gripPoint: Vector3
  ) => Vector3;
  applyWristOrientation: (
    side: "left" | "right",
    chain: BoneChain,
    hand: {
      targetPosition: Vector3;
      wristRotation: Quaternion;
      weight: number;
    },
    ikWeight: number
  ) => void;
};

function createArmChain(): BoneChain {
  const root = new Bone();
  const middle = new Bone();
  const effector = new Bone();
  middle.position.set(0, 0, 0.2);
  effector.position.set(0, 0, 0.2);
  root.add(middle);
  middle.add(effector);
  root.updateMatrixWorld(true);
  return {
    root,
    middle,
    effector,
    totalLength: 0.4,
    upperLength: 0.2,
    lowerLength: 0.2,
    rootRestDir: new Vector3(0, 0, 1),
    middleRestDir: new Vector3(0, 0, 1),
  };
}

describe("avatar wrist-side clearance", () => {
  it("places each wrist outside its own grip instead of between adjacent staffs", () => {
    const animator = new AvatarAnimator(
      {} as never,
      {} as never
    ) as unknown as SocketTargetProbe;
    const anatomicalRight = new Vector3(0, 0, 1);
    const palmLength = 0.04;
    const chain = createArmChain();
    chain.root.scale.setScalar(0.25);
    chain.root.updateMatrixWorld(true);

    animator.leftPalmLocal = new Vector3(palmLength, 0, 0);
    animator.rightPalmLocal = new Vector3(palmLength, 0, 0);
    animator._bodyFrame.lateral.copy(anatomicalRight);

    const leftGrip = anatomicalRight.clone().multiplyScalar(-0.03);
    const rightGrip = anatomicalRight.clone().multiplyScalar(0.03);
    const leftWrist = animator.computeSocketTarget(
      "left",
      chain,
      leftGrip
    );
    const rightWrist = animator.computeSocketTarget(
      "right",
      chain,
      rightGrip
    );

    const lateral = (point: Vector3) => point.dot(anatomicalRight);
    expect(lateral(leftWrist)).toBeCloseTo(-0.04);
    expect(lateral(rightWrist)).toBeCloseTo(0.04);
    expect(leftWrist.distanceTo(rightWrist)).toBeGreaterThan(
      leftGrip.distanceTo(rightGrip)
    );
  });

  it("splits coincident paired grips around their authored midpoint", () => {
    const leftChain = createArmChain();
    const rightChain = createArmChain();
    leftChain.root.position.x = -0.2;
    rightChain.root.position.x = 0.2;
    leftChain.root.updateMatrixWorld(true);
    rightChain.root.updateMatrixWorld(true);
    const skeleton = {
      getLeftArmChain: () => leftChain,
      getRightArmChain: () => rightChain,
    };
    const animator = new AvatarAnimator(
      {} as never,
      skeleton as never
    ) as unknown as SocketTargetProbe & {
      setPropsAndBlend: AvatarAnimator["setPropsAndBlend"];
    };
    const coincidentProp = {
      worldPosition: new Vector3(0, 0.03, 0.3),
      staffRotationAngle: 0,
      plane: "wall",
    } as never;

    animator.setPropsAndBlend(coincidentProp, coincidentProp);

    expect(animator.targetPose.leftHand?.targetPosition.x).toBeCloseTo(-0.035);
    expect(animator.targetPose.rightHand?.targetPosition.x).toBeCloseTo(0.035);
  });

  it("resolves the free staff roll so the palm faces inward", () => {
    const animator = new AvatarAnimator(
      {} as never,
      {} as never
    ) as unknown as SocketTargetProbe;
    const chain = createArmChain();
    const palmLocal = new Vector3(0.04, 0, 0);

    animator.rightGripAxisLocal = new Vector3(0, -1, 0);
    animator.rightPalmLocal = palmLocal.clone();
    animator._bodyFrame.lateral.set(1, 0, 0);

    for (let frame = 0; frame < 40; frame++) {
      animator.applyWristOrientation(
        "right",
        chain,
        {
          targetPosition: new Vector3(),
          wristRotation: new Quaternion(),
          weight: 1,
        },
        1
      );
      chain.root.updateMatrixWorld(true);
    }

    const wrist = chain.effector.getWorldPosition(new Vector3());
    const palmDirection = chain.effector
      .localToWorld(palmLocal.clone())
      .sub(wrist)
      .normalize();
    expect(palmDirection.dot(animator._bodyFrame.lateral)).toBeLessThan(-0.9);
  });
});
