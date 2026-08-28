import { describe, expect, it } from "vitest";

import { LocomotionAnimator } from "@austencloud/scene-3d";

interface GaitClockHarness {
  gaits: {
    forward: {
      duration: number;
      nativeSpeed: number;
      leftContact: Float32Array;
      rightContact: Float32Array;
      leftStrikePhase: number;
      soleOffset: number;
      toeOffset: number;
    };
  };
  walkActions: { forward: { time: number } };
  currentDirWeights: { forward: number };
  playRate: number;
  commandedMoving: boolean;
  advanceGaitPhase(delta: number): void;
}

function animatorWithOneSecondGait(): {
  animator: LocomotionAnimator;
  harness: GaitClockHarness;
} {
  const animator = new LocomotionAnimator();
  const harness = animator as unknown as GaitClockHarness;
  harness.gaits.forward = {
    duration: 1,
    nativeSpeed: 1,
    leftContact: new Float32Array([1, 1, 0, 0]),
    rightContact: new Float32Array([0, 0, 1, 1]),
    leftStrikePhase: 0,
    soleOffset: 0,
    toeOffset: 0,
  };
  harness.walkActions.forward = { time: 0 };
  harness.currentDirWeights.forward = 1;
  harness.playRate = 1;
  harness.commandedMoving = true;
  return { animator, harness };
}

describe("locomotion gait clock", () => {
  it("keeps authored steps monotonic when normalized phase wraps", () => {
    const { animator, harness } = animatorWithOneSecondGait();

    harness.advanceGaitPhase(0.6);
    expect(animator.getGaitClock()).toMatchObject({
      phase: 0.6,
      step: 1.2,
      cadence: 2,
      moving: true,
    });

    harness.advanceGaitPhase(0.6);
    const afterWrap = animator.getGaitClock();
    expect(afterWrap.phase).toBeCloseTo(0.2, 10);
    expect(afterWrap.step).toBeCloseTo(2.4, 10);
  });

  it("freezes at the last gait phase when world movement stops", () => {
    const { animator, harness } = animatorWithOneSecondGait();
    harness.advanceGaitPhase(0.45);
    const stoppedAt = animator.getGaitClock();

    harness.commandedMoving = false;
    harness.advanceGaitPhase(1);

    expect(animator.getGaitClock()).toEqual({
      ...stoppedAt,
      cadence: 0,
      moving: false,
    });
  });
});
