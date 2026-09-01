import { Bone, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { AvatarAnimator } from "../../../node_modules/@austencloud/scene-3d/src/lib/services/implementations/AvatarAnimator";
import type {
  BoneChain,
  SkeletonState,
} from "../../../node_modules/@austencloud/scene-3d/src/lib/services/contracts/IAvatarSkeletonBuilder";
import type { FingerBoneName } from "../../../node_modules/@austencloud/scene-3d/src/lib/domain/models/GripPose";

type SocketTargetProbe = {
  rightGripAxisLocal: Vector3 | null;
  leftPalmLocal: Vector3 | null;
  rightPalmLocal: Vector3 | null;
  leftPalmNormalLocal: Vector3 | null;
  rightPalmNormalLocal: Vector3 | null;
  leftPalmWorldLength: number;
  rightPalmWorldLength: number;
  _bodyFrame: { lateral: Vector3 };
  targetPose: {
    leftHand: { targetPosition: Vector3 } | null;
    rightHand: { targetPosition: Vector3 } | null;
  };
  calibrateGrips: (state: SkeletonState) => void;
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

const QUATERNIUS_FINGER_ROOTS = {
  Index1: [0.007159, 0.117403, 0.040643],
  Middle1: [0.004683, 0.115439, 0.015113],
  Pinky1: [0.006038, 0.098541, -0.034617],
  Thumb1: [0.027481, 0.033814, 0.041063],
} as const;

function createMeasuredPowerGripArm(side: "left" | "right"): {
  chain: BoneChain;
  fingers: Map<FingerBoneName, Bone>;
} {
  const root = new Bone();
  const middle = new Bone();
  const effector = new Bone();
  middle.position.set(0, 0.2, 0);
  effector.position.set(0, 0.243594, 0);
  effector.quaternion.set(-0.015602, 0, 0, 0.999878);
  root.add(middle);
  middle.add(effector);

  const fingers = new Map<FingerBoneName, Bone>();
  for (const [name, position] of Object.entries(QUATERNIUS_FINGER_ROOTS)) {
    const finger = new Bone();
    const mirror = side === "right" ? -1 : 1;
    finger.position.set(position[0] * mirror, position[1], position[2]);
    effector.add(finger);
    fingers.set(name as FingerBoneName, finger);
  }
  root.updateMatrixWorld(true);

  return {
    chain: {
      root,
      middle,
      effector,
      totalLength: 0.443594,
      upperLength: 0.2,
      lowerLength: 0.243594,
      rootRestDir: new Vector3(0, 1, 0),
      middleRestDir: new Vector3(0, 1, 0),
    },
    fingers,
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
    animator.leftPalmWorldLength = 0.01;
    animator.rightPalmWorldLength = 0.01;
    animator._bodyFrame.lateral.copy(anatomicalRight);

    const leftGrip = anatomicalRight.clone().multiplyScalar(-0.03);
    const rightGrip = anatomicalRight.clone().multiplyScalar(0.03);
    const leftWrist = animator.computeSocketTarget("left", chain, leftGrip);
    const rightWrist = animator.computeSocketTarget("right", chain, rightGrip);

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
    // A GLB briefly reports coincident shoulder origins while its matrices
    // bind. The last valid anatomical frame must survive that interval.
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
    animator.rightPalmNormalLocal = palmLocal.clone();
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

  it("keeps the world-space wrist goal steady while the forearm frame moves", () => {
    const animator = new AvatarAnimator(
      {} as never,
      {} as never
    ) as unknown as SocketTargetProbe;
    const chain = createArmChain();
    const palmLocal = new Vector3(0.04, 0, 0);
    const worldPalmDirections: Vector3[] = [];

    animator.rightGripAxisLocal = new Vector3(0, -1, 0);
    animator.rightPalmLocal = palmLocal.clone();
    animator.rightPalmNormalLocal = palmLocal.clone();
    animator._bodyFrame.lateral.set(1, 0, 0);

    for (let frame = 0; frame < 80; frame++) {
      chain.middle.quaternion.setFromAxisAngle(
        new Vector3(0, 0, 1),
        frame % 2 === 0 ? -0.04 : 0.04
      );
      chain.root.updateMatrixWorld(true);
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
      const wrist = chain.effector.getWorldPosition(new Vector3());
      worldPalmDirections.push(
        chain.effector.localToWorld(palmLocal.clone()).sub(wrist).normalize()
      );
    }

    const settled = worldPalmDirections.slice(-20);
    const maximumWorldJitter = Math.max(
      ...settled
        .slice(1)
        .map((direction, index) => direction.angleTo(settled[index]!))
    );
    expect(maximumWorldJitter).toBeLessThan(0.01);
  });

  it("keeps a measured power-grip wrist longitudinal instead of folding across the knuckles", () => {
    const left = createMeasuredPowerGripArm("left");
    const right = createMeasuredPowerGripArm("right");
    const skeleton = {
      getLeftArmChain: () => left.chain,
      getRightArmChain: () => right.chain,
    };
    const animator = new AvatarAnimator(
      {} as never,
      skeleton as never
    ) as unknown as SocketTargetProbe;
    animator._bodyFrame.lateral.set(1, 0, 0);

    animator.calibrateGrips({
      isLoaded: true,
      root: left.chain.root,
      meshes: [],
      bones: new Map(),
      leftArmChain: left.chain,
      rightArmChain: right.chain,
      leftLegChain: null,
      rightLegChain: null,
      fingerChains: {
        left: left.fingers,
        right: right.fingers,
      },
    });

    const longitudinal = new Vector3(...QUATERNIUS_FINGER_ROOTS.Middle1)
      .normalize()
      .negate();
    const transverse = new Vector3(...QUATERNIUS_FINGER_ROOTS.Pinky1)
      .sub(new Vector3(...QUATERNIUS_FINGER_ROOTS.Index1))
      .normalize();
    expect(animator.leftGripAxisLocal?.dot(longitudinal)).toBeGreaterThan(
      0.999
    );
    expect(
      Math.abs(animator.leftGripAxisLocal?.dot(transverse) ?? 1)
    ).toBeLessThan(0.45);

    const leftRest = left.chain.effector.quaternion.clone();
    const rightRest = right.chain.effector.quaternion.clone();
    for (let frame = 0; frame < 40; frame++) {
      for (const [side, chain] of [
        ["left", left.chain],
        ["right", right.chain],
      ] as const) {
        animator.applyWristOrientation(
          side,
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
    }

    expect(left.chain.effector.quaternion.angleTo(leftRest)).toBeLessThan(
      (15 * Math.PI) / 180
    );
    expect(right.chain.effector.quaternion.angleTo(rightRest)).toBeLessThan(
      (15 * Math.PI) / 180
    );
  });
});
