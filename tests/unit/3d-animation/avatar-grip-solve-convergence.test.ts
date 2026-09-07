import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Object3D, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { AvatarAnimator } from "../../../node_modules/@austencloud/scene-3d/src/lib/services/implementations/AvatarAnimator";

/**
 * A frozen step must solve to one pose. Two per-frame feedback loops used to
 * break that on the catalog rigs: the body frame chose its forward hemisphere
 * by comparing against the previous frame's forward, and the hug wrist goal
 * eased toward the previous frame's elbow. Both settled into exact period-2
 * alternations, so a held side stance flickered between a converged hug and a
 * collapse (ch18 at East measured 41 mm grip separation with two collisions on
 * one frame and 247 mm with none on the next).
 *
 * These assertions pin the invariant that replaced them: the solve's branch
 * choices are functions of the pose and of static rig properties, never of the
 * previous frame's output.
 */

type BodyFrameProbe = {
  _bodyFrame: { lateral: Vector3; forward: Vector3 };
  _bodyFrameLateralSign: number;
  refreshBodyFrame(
    state: { root: Object3D | null },
    leftChain: { root: Object3D } | null,
    rightChain: { root: Object3D } | null
  ): void;
};

const packageFile = (path: string) =>
  readFileSync(
    resolve(process.cwd(), "node_modules/@austencloud/scene-3d", path),
    "utf8"
  );

/**
 * A root facing +Z with the bone named left at +X, which is how every shipped
 * catalog rig and the intake rig export the shoulder line. `chestYawRad` blades
 * the shoulder pair without turning the root, the way the spine twist and the
 * stance correction do mid-solve.
 */
function makeTorso(chestYawRad: number) {
  const root = new Object3D();
  const chest = new Object3D();
  chest.rotation.y = chestYawRad;
  root.add(chest);
  const left = new Object3D();
  left.position.set(0.18, 1.5, 0);
  const right = new Object3D();
  right.position.set(-0.18, 1.5, 0);
  chest.add(left);
  chest.add(right);
  root.updateMatrixWorld(true);
  return { state: { root }, leftChain: { root: left }, rightChain: { root: right } };
}

function solveForward(animator: BodyFrameProbe, chestYawRad: number): Vector3 {
  const { state, leftChain, rightChain } = makeTorso(chestYawRad);
  animator.refreshBodyFrame(state, leftChain, rightChain);
  return animator._bodyFrame.forward.clone();
}

const QUARTER_TURN = (87 * Math.PI) / 180;

describe("avatar grip solve convergence", () => {
  it("resolves the body frame from the pose alone, not from the previous frame", () => {
    const animator = new AvatarAnimator(
      {} as never,
      {} as never
    ) as unknown as BodyFrameProbe;

    // A square sample resolves the rig's export handedness.
    const square = solveForward(animator, 0);
    expect(square.z).toBeGreaterThan(0.99);

    // refreshBodyFrame runs three times per solve against different torso
    // states. Alternating square and bladed samples is what the old
    // previous-frame hysteresis could not survive: each sample answered for
    // the one before it rather than for its own pose.
    const bladedLeft = solveForward(animator, QUARTER_TURN);
    const bladedRight = solveForward(animator, -QUARTER_TURN);

    for (let frame = 0; frame < 60; frame++) {
      expect(solveForward(animator, 0).toArray()).toEqual(square.toArray());
      expect(solveForward(animator, QUARTER_TURN).toArray()).toEqual(
        bladedLeft.toArray()
      );
      expect(solveForward(animator, -QUARTER_TURN).toArray()).toEqual(
        bladedRight.toArray()
      );
    }

    // The two blades must land on opposite sides of the root's forward, or the
    // stance correction reads one of them as a half turn of error and clamps
    // the torso to the wrong side.
    expect(bladedLeft.x * bladedRight.x).toBeLessThan(0);
    expect(animator._bodyFrameLateralSign).toBe(-1);
  });

  it("keeps the latched handedness through bladed samples that cannot decide it", () => {
    const animator = new AvatarAnimator(
      {} as never,
      {} as never
    ) as unknown as BodyFrameProbe;

    solveForward(animator, 0);
    expect(animator._bodyFrameLateralSign).toBe(-1);

    for (let frame = 0; frame < 30; frame++) {
      solveForward(animator, QUARTER_TURN);
      expect(animator._bodyFrameLateralSign).toBe(-1);
    }
  });

  it("never latches handedness off a chest too bladed to answer decisively", () => {
    const animator = new AvatarAnimator(
      {} as never,
      {} as never
    ) as unknown as BodyFrameProbe;

    solveForward(animator, QUARTER_TURN);
    expect(animator._bodyFrameLateralSign).toBe(0);
  });

  it("ships history-free branch choices in source and runtime", () => {
    for (const code of [
      packageFile("src/lib/services/implementations/AvatarAnimator.ts"),
      packageFile("dist/lib/services/implementations/AvatarAnimator.js"),
    ]) {
      // The body frame latches a static rig property instead of comparing
      // against the forward it produced last frame.
      expect(code).toContain("_bodyFrameLateralSign");
      expect(code).not.toContain("_bodyFramePreviousForward");
      expect(code).not.toContain("_bodyFrameForwardSeeded");
      expect(code).not.toContain("BODY_FRAME_HYSTERESIS_MIN_DOT");

      // The hug wrist goal eases toward the shoulder, which is an input to
      // this solve. `chain.middle` is where the previous frame's IK put the
      // elbow, and closing that loop is what made the hug alternate.
      expect(code).toMatch(
        /chain\.root\.getWorldPosition\(this\._handForearm\)/
      );
      expect(code).not.toMatch(
        /chain\.middle\.getWorldPosition\(this\._handForearm\)/
      );

      // Stance yaw is one open-loop pass, so it has to deliver the angle it
      // asked for. Blading about each spine bone's local Y assumed the spine
      // stands vertical and left a rig-dependent shortfall behind.
      expect(code).toContain("applyBladeYaw");
      expect(code).not.toMatch(
        /spine1Bone\.quaternion\.multiply\(this\._q1\)/
      );
      expect(code).not.toMatch(
        /spine2Bone\.quaternion\.multiply\(this\._q1\)/
      );
    }
  });
});
