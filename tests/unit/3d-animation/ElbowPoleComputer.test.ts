import { describe, expect, it } from "vitest";
import { Bone, Vector3 } from "three";
import {
  ElbowPoleComputer,
  IKSolver,
  Plane,
  SpineTwister,
  type BoneChain,
  type BodyFrame,
} from "@austencloud/scene-3d";

const bodyCenter = new Vector3(0, 1, 0);
const conventionalFrame: BodyFrame = {
  lateral: new Vector3(1, 0, 0),
  forward: new Vector3(0, 0, 1),
};
const mirroredFrame: BodyFrame = {
  lateral: new Vector3(-1, 0, 0),
  forward: new Vector3(0, 0, 1),
};

function expectNormalized(vector: Vector3): void {
  expect(vector.length()).toBeCloseTo(1, 6);
}

function makeArm(
  shoulder: Vector3,
  outward: Vector3,
  upperLength = 0.3,
  lowerLength = 0.27
): BoneChain {
  const parent = new Bone();
  const root = new Bone();
  const middle = new Bone();
  const effector = new Bone();

  root.position.copy(shoulder);
  middle.position.copy(outward).setLength(upperLength);
  effector.position.copy(outward).setLength(lowerLength);
  parent.add(root);
  root.add(middle);
  middle.add(effector);
  parent.updateMatrixWorld(true);

  return {
    root,
    middle,
    effector,
    totalLength: upperLength + lowerLength,
    upperLength,
    lowerLength,
    rootRestDir: middle.position.clone().normalize(),
    middleRestDir: effector.position.clone().normalize(),
  };
}

function pointToSegmentDistance(point: Vector3, a: Vector3, b: Vector3): number {
  const segment = b.clone().sub(a);
  const lengthSq = segment.lengthSq();
  if (lengthSq < 1e-8) return point.distanceTo(a);
  const t = Math.max(0, Math.min(1, point.clone().sub(a).dot(segment) / lengthSq));
  return point.distanceTo(a.clone().addScaledVector(segment, t));
}

function segmentDistance(a0: Vector3, a1: Vector3, b0: Vector3, b1: Vector3): number {
  return Math.min(
    pointToSegmentDistance(a0, b0, b1),
    pointToSegmentDistance(a1, b0, b1),
    pointToSegmentDistance(b0, a0, a1),
    pointToSegmentDistance(b1, a0, a1)
  );
}

describe("ElbowPoleComputer", () => {
  const computer = new ElbowPoleComputer();

  it("uses anatomical shoulder axes instead of assuming model X handedness", () => {
    const conventionalLeft = computer.computePoleVector(
      new Vector3(-0.48, 1.12, 0.08),
      Plane.WALL,
      "left",
      bodyCenter,
      {
        bodyFrame: conventionalFrame,
        shoulderPosition: new Vector3(-0.18, 1.5, 0),
      }
    );
    const mirroredLeft = computer.computePoleVector(
      new Vector3(0.48, 1.12, 0.08),
      Plane.WALL,
      "left",
      bodyCenter,
      {
        bodyFrame: mirroredFrame,
        shoulderPosition: new Vector3(0.18, 1.5, 0),
      }
    );

    expectNormalized(conventionalLeft);
    expectNormalized(mirroredLeft);
    expect(conventionalLeft.dot(conventionalFrame.lateral)).toBeLessThan(0);
    expect(mirroredLeft.dot(mirroredFrame.lateral)).toBeLessThan(0);
    expect(conventionalLeft.dot(conventionalFrame.forward)).toBeCloseTo(
      mirroredLeft.dot(mirroredFrame.forward),
      6
    );
  });

  it("gives neutral elbows a mirrored outward corridor below the shoulders", () => {
    const left = computer.computePoleVector(
      new Vector3(-0.48, 1.12, 0.08),
      Plane.WALL,
      "left",
      bodyCenter,
      {
        bodyFrame: conventionalFrame,
        shoulderPosition: new Vector3(-0.18, 1.5, 0),
      }
    );
    const right = computer.computePoleVector(
      new Vector3(0.48, 1.12, 0.08),
      Plane.WALL,
      "right",
      bodyCenter,
      {
        bodyFrame: conventionalFrame,
        shoulderPosition: new Vector3(0.18, 1.5, 0),
      }
    );

    expect(left.x).toBeLessThan(-0.35);
    expect(right.x).toBeGreaterThan(0.35);
    expect(left.z).toBeCloseTo(right.z, 6);
  });

  it("assigns stable complementary layers to an equal-height crossed pair", () => {
    const routing = computer.computePairRouting(
      new Vector3(0.34, 1.3, 0.2),
      new Vector3(-0.34, 1.3, 0.2),
      bodyCenter,
      conventionalFrame
    );
    const mirrored = computer.computePairRouting(
      new Vector3(-0.34, 1.3, 0.2),
      new Vector3(0.34, 1.3, 0.2),
      bodyCenter,
      mirroredFrame
    );

    expect(routing).toEqual({ left: "over", right: "under", crossing: 1 });
    expect(mirrored).toEqual(routing);
  });

  it("lets a meaningfully higher right hand take the over route", () => {
    expect(
      computer.computePairRouting(
        new Vector3(0.34, 1.2, 0.2),
        new Vector3(-0.34, 1.35, 0.2),
        bodyCenter,
        conventionalFrame
      )
    ).toMatchObject({ left: "under", right: "over" });
  });

  it("keeps every plane pole normalized", () => {
    for (const plane of [Plane.WALL, Plane.WHEEL, Plane.FLOOR]) {
      expectNormalized(
        computer.computePoleVector(
          new Vector3(-0.25, 1.25, 0.3),
          plane,
          "left",
          bodyCenter,
          { bodyFrame: conventionalFrame }
        )
      );
    }
  });

  it("solves crossed arms into distinct over/under forearm corridors", () => {
    const leftShoulder = new Vector3(0.18, 1.5, 0);
    const rightShoulder = new Vector3(-0.18, 1.5, 0);
    const leftTarget = new Vector3(-0.26, 1.34, 0.24);
    const rightTarget = new Vector3(0.26, 1.34, 0.24);
    const leftChain = makeArm(leftShoulder, new Vector3(1, 0, 0));
    const rightChain = makeArm(rightShoulder, new Vector3(-1, 0, 0));
    const routing = computer.computePairRouting(
      leftTarget,
      rightTarget,
      bodyCenter,
      mirroredFrame
    );
    const leftPole = computer.computePoleVector(
      leftTarget,
      Plane.WALL,
      "left",
      bodyCenter,
      {
        bodyFrame: mirroredFrame,
        shoulderPosition: leftShoulder,
        routing: routing.left,
      }
    );
    const rightPole = computer.computePoleVector(
      rightTarget,
      Plane.WALL,
      "right",
      bodyCenter,
      {
        bodyFrame: mirroredFrame,
        shoulderPosition: rightShoulder,
        routing: routing.right,
      }
    );
    const solver = new IKSolver();
    solver.solveAndApply(leftChain, { position: leftTarget, poleHint: leftPole });
    solver.solveAndApply(rightChain, { position: rightTarget, poleHint: rightPole });

    const leftElbow = new Vector3();
    const rightElbow = new Vector3();
    const leftHand = new Vector3();
    const rightHand = new Vector3();
    leftChain.middle.getWorldPosition(leftElbow);
    rightChain.middle.getWorldPosition(rightElbow);
    leftChain.effector.getWorldPosition(leftHand);
    rightChain.effector.getWorldPosition(rightHand);

    expect(leftHand.distanceTo(leftTarget)).toBeLessThan(0.002);
    expect(rightHand.distanceTo(rightTarget)).toBeLessThan(0.002);
    expect(leftElbow.y - rightElbow.y).toBeGreaterThan(0.08);
    expect(segmentDistance(leftElbow, leftHand, rightElbow, rightHand)).toBeGreaterThan(0.06);
  });
});

describe("SpineTwister crossed-arm posture", () => {
  it("activates the same forward hunch on conventional and mirrored rigs", () => {
    const twister = new SpineTwister();
    const conventional = twister.computeSpineTwist(
      new Vector3(0.34, 1.3, 0.2),
      new Vector3(-0.34, 1.3, 0.2),
      bodyCenter,
      undefined,
      conventionalFrame
    );
    const mirrored = twister.computeSpineTwist(
      new Vector3(-0.34, 1.3, 0.2),
      new Vector3(0.34, 1.3, 0.2),
      bodyCenter,
      undefined,
      mirroredFrame
    );

    expect(conventional.spine1.x).toBeGreaterThan(0.01);
    expect(mirrored.spine1.x).toBeCloseTo(conventional.spine1.x, 6);
    expect(mirrored.spine2.x).toBeCloseTo(conventional.spine2.x, 6);
  });
});
