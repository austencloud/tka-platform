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
      strikePhases: Float32Array;
      stepsPerCycle: number;
      rootDistance: Float32Array;
      soleOffset: number;
      toeOffset: number;
    };
  };
  walkActions: { forward: { time: number } };
  currentDirWeights: { forward: number };
  playRate: number;
  commandedMoving: boolean;
  advanceGaitPhase(delta: number): void;
  advanceTerminalStep(delta: number): void;
  terminalPlan: {
    id: string;
    startAtGaitStep: number;
    landAtGaitStep: number;
    terminalFoot: "left" | "right";
    stepDistances: [number, number];
    remainingDistance: number;
    cadence: number;
    targetFacing: number;
  } | null;
  terminalStatus: "armed" | "braking" | "landed" | "settled" | null;
  terminalMotions: {
    stopLeft: null;
    stopRight: {
      version: 1;
      clipName: string;
      terminalFoot: "right";
      frameRate: number;
      frameCount: number;
      stepFrames: [number, number];
      stepPhases: [number, number];
      settlePhase: number;
      nativeTravelMeters: number;
      rootDistance: number[];
      leftFoot: number[];
      rightFoot: number[];
    } | null;
  };
  stopActions: {
    stopLeft: null;
    stopRight: {
      time: number;
      getClip(): { duration: number };
    } | null;
  };
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
    strikePhases: new Float32Array([0, 0.5]),
    stepsPerCycle: 2,
    rootDistance: new Float32Array([0, 0.1, 0.5, 0.9, 1]),
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
    const beforeWrap = animator.getGaitClock();
    expect(beforeWrap).toMatchObject({
      phase: 0.6,
      step: 1.2,
      cadence: 2,
      moving: true,
    });
    expect(beforeWrap.distanceStep).toBeCloseTo(1.32, 7);

    harness.advanceGaitPhase(0.6);
    const afterWrap = animator.getGaitClock();
    expect(afterWrap.phase).toBeCloseTo(0.2, 10);
    expect(afterWrap.step).toBeCloseTo(2.4, 10);
    expect(afterWrap.distanceStep).toBeCloseTo(2.16, 7);
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

  it("counts every authored footfall in a long mocap loop", () => {
    const { animator, harness } = animatorWithOneSecondGait();
    harness.gaits.forward.duration = 4;
    harness.gaits.forward.stepsPerCycle = 8;
    harness.gaits.forward.strikePhases = new Float32Array([
      0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88,
    ]);
    harness.gaits.forward.rootDistance = new Float32Array([
      0, 0.25, 0.5, 0.75, 1,
    ]);

    harness.advanceGaitPhase(1);

    expect(animator.getGaitClock()).toMatchObject({
      step: 2,
      distanceStep: 2,
      cadence: 2,
      moving: true,
    });
    expect(harness.walkActions.forward.time).toBeCloseTo(1, 5);
  });

  it("lands and settles from the authored terminal distance curve", () => {
    const { animator, harness } = animatorWithOneSecondGait();
    harness.terminalPlan = {
      id: "arrival-1",
      startAtGaitStep: 10,
      landAtGaitStep: 12,
      terminalFoot: "right",
      stepDistances: [0.65, 0.45],
      remainingDistance: 1.1,
      cadence: 2,
      targetFacing: 0,
    };
    harness.terminalStatus = "braking";
    harness.terminalMotions.stopRight = {
      version: 1,
      clipName: "stop-right",
      terminalFoot: "right",
      frameRate: 30,
      frameCount: 5,
      stepFrames: [2, 3],
      stepPhases: [0.5, 0.75],
      settlePhase: 1,
      nativeTravelMeters: 1,
      rootDistance: [0, 0.3, 0.6, 1, 1],
      leftFoot: [1, 0, 1, 1, 1],
      rightFoot: [1, 1, 0, 1, 1],
    };
    const stopAction = {
      time: 0,
      getClip: () => ({ duration: 1.2 }),
    };
    harness.stopActions.stopRight = stopAction;

    // Two desired steps at 2 steps/sec place the terminal foot in one second.
    harness.advanceTerminalStep(1);
    expect(stopAction.time).toBeCloseTo(0.9, 10);
    expect(animator.getGaitClock()).toMatchObject({
      step: 12,
      distanceStep: 12,
      cadence: 0,
      moving: false,
      terminal: { status: "landed", foot: "right", phase: 0.75 },
    });

    harness.advanceTerminalStep(1 / 3);
    expect(animator.getGaitClock()).toMatchObject({
      step: 12,
      terminal: { status: "settled", foot: "right", phase: 1 },
    });
  });
});
