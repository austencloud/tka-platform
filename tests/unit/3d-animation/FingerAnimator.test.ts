// tests/unit/3d-animation/FingerAnimator.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { FingerAnimator } from "$lib/shared/3d/services/implementations/FingerAnimator";
import { GripType, FINGER_BONES, type FingerChains, type FingerBoneName } from "$lib/shared/3d/domain/models/GripPose";
import { Quaternion } from "three";
import type { Bone } from "three";

function mockBone(name: string): Bone {
  return {
    name,
    isBone: true,
    quaternion: new Quaternion(0, 0, 0, 1),
  } as unknown as Bone;
}

function createMockChains(): FingerChains {
  const left = new Map<FingerBoneName, Bone>();
  const right = new Map<FingerBoneName, Bone>();
  for (const name of FINGER_BONES) {
    left.set(name, mockBone(`Left${name}`));
    right.set(name, mockBone(`Right${name}`));
  }
  return { left, right };
}

describe("FingerAnimator", () => {
  let animator: FingerAnimator;
  let chains: FingerChains;

  beforeEach(() => {
    animator = new FingerAnimator();
    chains = createMockChains();
  });

  it("isReady() returns false before initialize", () => {
    expect(animator.isReady()).toBe(false);
  });

  it("isReady() returns true after initialize", () => {
    animator.initialize(chains);
    expect(animator.isReady()).toBe(true);
  });

  it("defaults to IDLE grip for both hands", () => {
    animator.initialize(chains);
    expect(animator.getCurrentGrip("left")).toBe(GripType.IDLE);
    expect(animator.getCurrentGrip("right")).toBe(GripType.IDLE);
  });

  it("setGrip updates the target grip type", () => {
    animator.initialize(chains);
    animator.setGrip("left", GripType.SQUARE);
    expect(animator.getCurrentGrip("left")).toBe(GripType.SQUARE);
    expect(animator.getCurrentGrip("right")).toBe(GripType.IDLE);
  });

  it("setGrips updates both hands", () => {
    animator.initialize(chains);
    animator.setGrips(GripType.SQUARE, GripType.RELEASE);
    expect(animator.getCurrentGrip("left")).toBe(GripType.SQUARE);
    expect(animator.getCurrentGrip("right")).toBe(GripType.RELEASE);
  });

  it("update() modifies bone quaternions toward target pose", () => {
    animator.initialize(chains);
    animator.setGrip("left", GripType.SQUARE);

    const index1 = chains.left.get("Index1")!;
    const beforeW = index1.quaternion.w;

    for (let i = 0; i < 60; i++) {
      animator.update(1 / 60);
    }

    expect(index1.quaternion.w).not.toBeCloseTo(beforeW, 1);
  });

  it("update() is a no-op before initialize", () => {
    animator.setGrip("left", GripType.SQUARE);
    animator.update(1 / 60);
  });

  it("dispose() makes isReady return false", () => {
    animator.initialize(chains);
    expect(animator.isReady()).toBe(true);
    animator.dispose();
    expect(animator.isReady()).toBe(false);
  });
});
