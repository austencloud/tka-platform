import { Bone, Euler, Quaternion } from "three";
import { describe, expect, it } from "vitest";
import {
  FINGER_BONES,
  GripType,
} from "../../../node_modules/@austencloud/scene-3d/src/lib/domain/models/GripPose";
import type {
  FingerBoneName,
  FingerChains,
} from "../../../node_modules/@austencloud/scene-3d/src/lib/domain/models/GripPose";
import { STAFF_GRIP_POSES } from "../../../node_modules/@austencloud/scene-3d/src/lib/data/grip-poses/staff-grip-poses";
import { FingerAnimator } from "../../../node_modules/@austencloud/scene-3d/src/lib/services/implementations/FingerAnimator";

function createHand(rest: Quaternion): Map<FingerBoneName, Bone> {
  return new Map(
    FINGER_BONES.map((name) => {
      const bone = new Bone();
      bone.name = name;
      bone.quaternion.copy(rest);
      return [name, bone] as const;
    })
  );
}

function expectedRotation(
  rest: Quaternion,
  grip: GripType,
  boneIndex: number,
  hand: "left" | "right"
): Quaternion {
  const raw = STAFF_GRIP_POSES[grip].rotations[boneIndex]!;
  const delta =
    hand === "right"
      ? new Quaternion(raw[0], -raw[1], -raw[2], raw[3])
      : new Quaternion(raw[0], raw[1], raw[2], raw[3]);
  return rest.clone().multiply(delta).normalize();
}

function expectSameRotation(actual: Quaternion, expected: Quaternion): void {
  expect(
    Math.abs(actual.clone().normalize().dot(expected.clone().normalize()))
  ).toBeCloseTo(1, 6);
}

describe("finger bind-pose retargeting", () => {
  it("composes grip deltas onto each character's authored joint rotations", () => {
    const leftRest = new Quaternion().setFromEuler(new Euler(0.08, 1.1, -0.22));
    const rightRest = new Quaternion().setFromEuler(
      new Euler(-0.12, -0.9, 0.18)
    );
    const left = createHand(leftRest);
    const right = createHand(rightRest);
    const chains: FingerChains = { left, right };
    const animator = new FingerAnimator();

    animator.initialize(chains);

    for (let index = 0; index < FINGER_BONES.length; index += 1) {
      const name = FINGER_BONES[index]!;
      expectSameRotation(
        left.get(name)!.quaternion,
        expectedRotation(leftRest, GripType.IDLE, index, "left")
      );
      expectSameRotation(
        right.get(name)!.quaternion,
        expectedRotation(rightRest, GripType.IDLE, index, "right")
      );
    }

    animator.setGrips(GripType.SQUARE, GripType.SQUARE);
    animator.setBlendSpeed(100);
    animator.update(1);

    for (let index = 0; index < FINGER_BONES.length; index += 1) {
      const name = FINGER_BONES[index]!;
      expectSameRotation(
        left.get(name)!.quaternion,
        expectedRotation(leftRest, GripType.SQUARE, index, "left")
      );
      expectSameRotation(
        right.get(name)!.quaternion,
        expectedRotation(rightRest, GripType.SQUARE, index, "right")
      );
    }
  });

  it("keeps the canonical grip result unchanged for identity-rest rigs", () => {
    const rest = new Quaternion();
    const left = createHand(rest);
    const right = createHand(rest);
    const animator = new FingerAnimator();

    animator.initialize({ left, right });
    animator.setGrips(GripType.SQUARE, GripType.SQUARE);
    animator.setBlendSpeed(100);
    animator.update(1);

    for (let index = 0; index < FINGER_BONES.length; index += 1) {
      const name = FINGER_BONES[index]!;
      expectSameRotation(
        left.get(name)!.quaternion,
        expectedRotation(rest, GripType.SQUARE, index, "left")
      );
      expectSameRotation(
        right.get(name)!.quaternion,
        expectedRotation(rest, GripType.SQUARE, index, "right")
      );
    }
  });
});
