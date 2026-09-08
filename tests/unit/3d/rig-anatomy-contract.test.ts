/**
 * Rig anatomy contract
 *
 * The first of the two anatomy layers, and the cheap one: it drives nothing.
 * Every check here reads a rig's bind pose, which is where the properties that
 * decide whether a leg *can* be posed correctly are fixed.
 *
 * The knee's IK hinge axis is the reason this exists. It is derived once, at
 * load, from the bind pose alone, and a rig whose derivation goes wrong has a
 * knee that bends in the wrong plane for the rest of its life. `ch07` shipped
 * that way: its left knee's hinge came out 84 degrees off sagittal, so the leg
 * folded sideways, and the entire gait report stayed green through it because
 * every row in that report describes the pattern the feet traced rather than
 * the legs. It was found by looking at the screen.
 *
 * Checking it here costs one GLB parse per character and no frames at all,
 * names the rig rather than the symptom, and fails at import time instead of
 * on a screenshot. The motion grading in `locomotion-anatomy.test.ts` is the
 * second layer, for everything that only goes wrong once a leg moves.
 *
 * The calibrator is imported, not reimplemented. A contract that re-derived
 * the axis would be asserting against its own copy of the arithmetic and would
 * pass forever after the shipped one drifted.
 */

import { Bone, Matrix4, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  buildTwoBoneChain,
  KneeHingeAxisCalibrator,
} from "@austencloud/scene-3d";
import type { BoneChain } from "@austencloud/scene-3d";

import { ALL_RIGS, avatar, avatarAssetsPresent, loadRig } from "./locomotion-harness";

const present = avatarAssetsPresent();

const deg = (radians: number) => (radians * 180) / Math.PI;

function worldOf(chain: BoneChain) {
  const hip = chain.root.getWorldPosition(new Vector3());
  const knee = chain.middle.getWorldPosition(new Vector3());
  const ankle = chain.effector.getWorldPosition(new Vector3());
  return {
    hip,
    knee,
    ankle,
    femur: knee.clone().sub(hip),
    tibia: ankle.clone().sub(knee),
  };
}

/** Interior bend at the knee in the bind pose, degrees; 0 is dead straight. */
function bindBendDeg(chain: BoneChain): number {
  const { femur, tibia } = worldOf(chain);
  return deg(femur.clone().normalize().angleTo(tibia.clone().normalize()));
}

/**
 * How far the hinge the solver will actually use sits from the body's own
 * mediolateral axis, degrees.
 *
 * The calibrator returns the axis in the hip bone's local space, because that
 * is the space the solver writes the knee's quaternion in. Comparing it to a
 * world reference means putting it back into world first -- the original bug
 * was three lines that each mixed up exactly this.
 */
function hingeOffAxisDeg(chain: BoneChain, referenceWorld: Vector3): number {
  const local = new KneeHingeAxisCalibrator().compute(chain, referenceWorld);
  const world = local
    .clone()
    .transformDirection(new Matrix4().copy(chain.root.matrixWorld))
    .normalize();
  // Folded: a hinge is an axis, not a direction. Which end points where is the
  // solver's bend-sign question, not this one.
  return deg(Math.acos(Math.min(1, Math.abs(world.dot(referenceWorld)))));
}

describe.skipIf(!present)("rig anatomy contract", () => {
  for (const id of ALL_RIGS) {
    describe(id, () => {
      it("resolves a complete leg on both sides", async () => {
        const rig = await loadRig(avatar(id));
        for (const [side, chain] of [
          ["left", rig.leftLeg],
          ["right", rig.rightLeg],
        ] as const) {
          for (const [part, bone] of [
            ["hip", chain.root],
            ["knee", chain.middle],
            ["ankle", chain.effector],
          ] as const) {
            expect(bone, `${side} ${part}`).toBeTruthy();
          }
        }
        // Without a toe the planter can pin an ankle but cannot tell which way
        // the foot points, so it keeps whatever the clip drew.
        expect(rig.skeleton.getBone("LeftToeBase"), "left toe").toBeTruthy();
        expect(rig.skeleton.getBone("RightToeBase"), "right toe").toBeTruthy();
      }, 60_000);

      it("stands square, so the hip line can act as the body axis", async () => {
        const rig = await loadRig(avatar(id));
        const { x, y, z } = rig.hipAxis;
        // Yaw of the hip line away from the axis it is measured against. Every
        // downstream mediolateral judgement -- the hinge reference here, the
        // medial direction in the motion grading -- is taken from this line,
        // so a rig standing at an angle in its own bind pose poisons both.
        expect(Math.abs(y), "hip line is level").toBeLessThan(0.05);
        expect(deg(Math.atan2(Math.abs(z), Math.abs(x)))).toBeLessThan(10);
      }, 60_000);

      it("bends both knees in the body's own frontal plane", async () => {
        const rig = await loadRig(avatar(id));
        const reference = new Vector3(
          rig.hipAxis.x,
          rig.hipAxis.y,
          rig.hipAxis.z
        );
        for (const [side, chain] of [
          ["left", rig.leftLeg],
          ["right", rig.rightLeg],
        ] as const) {
          // 84 degrees is what shipped. Ten is far looser than any healthy rig
          // measures and still an order of magnitude inside the defect.
          expect(
            hingeOffAxisDeg(chain, reference),
            `${side} knee hinge off the body axis`
          ).toBeLessThan(10);
        }
      }, 60_000);

      it("has legs the same length on both sides", async () => {
        const rig = await loadRig(avatar(id));
        const left = worldOf(rig.leftLeg);
        const right = worldOf(rig.rightLeg);
        for (const [part, a, b] of [
          ["femur", left.femur.length(), right.femur.length()],
          ["tibia", left.tibia.length(), right.tibia.length()],
        ] as const) {
          // Asymmetric segments make one leg reach further than the other, so
          // a planter that can hit its target on one side cannot on the other
          // and the character limps for a reason no clip explains.
          expect(Math.abs(a - b) / ((a + b) / 2), `${part} symmetry`).toBeLessThan(
            0.02
          );
        }
      }, 60_000);

      it("is proportioned like a person", async () => {
        const rig = await loadRig(avatar(id));
        for (const [side, chain] of [
          ["left", rig.leftLeg],
          ["right", rig.rightLeg],
        ] as const) {
          const { femur, tibia } = worldOf(chain);
          // Human femur-to-tibia sits near 1.2; the shipped characters are
          // stylised and measure 0.89 to 1.27. Well outside that band means a
          // unit mix-up or the wrong bones, not a design choice.
          const ratio = femur.length() / tibia.length();
          expect(ratio, `${side} femur over tibia`).toBeGreaterThan(0.7);
          expect(ratio, `${side} femur over tibia`).toBeLessThan(1.6);
        }
      }, 60_000);

      it("does not bind with a knee bent far enough to steer the hinge", async () => {
        const rig = await loadRig(avatar(id));
        for (const [side, chain] of [
          ["left", rig.leftLeg],
          ["right", rig.rightLeg],
        ] as const) {
          // A bind knee is either straight enough that the calibrator falls
          // back to the body axis, or bent enough to be trusted on its own.
          // In between is where the old code lived: a one-degree bend gives a
          // cross product whose direction is noise but whose magnitude clears
          // any reasonable guard. Every shipped rig binds under five degrees.
          const bend = bindBendDeg(chain);
          expect(bend, `${side} bind knee bend`).toBeLessThan(15);
        }
      }, 60_000);
    });
  }
});

/**
 * A three-bone leg posed exactly where the caller says, for proving the
 * measurement above can actually go red.
 *
 * A threshold nobody has watched fail is an assumption. Built from bones and
 * `buildTwoBoneChain` rather than a literal so the chain the calibrator sees
 * here is the same shape it sees on a character.
 */
function syntheticLeg(ankle: [number, number, number]): BoneChain {
  const hip = new Bone();
  const knee = new Bone();
  const foot = new Bone();
  hip.position.set(0, 1, 0);
  knee.position.set(0, -0.5, 0);
  foot.position.set(...ankle);
  hip.add(knee);
  knee.add(foot);
  hip.updateMatrixWorld(true);
  return buildTwoBoneChain(hip, knee, foot);
}

describe("the hinge check has teeth", () => {
  const reference = new Vector3(1, 0, 0);

  it("passes a knee bent the way a knee bends", () => {
    // Shank swung behind the thigh, 37 degrees of bend: deep enough that the
    // calibrator trusts the pose instead of falling back to the body axis.
    expect(hingeOffAxisDeg(syntheticLeg([0, -0.4, -0.3]), reference)).toBeLessThan(1);
  });

  it("fails the same knee folded sideways", () => {
    // The same bend, rotated into the frontal plane. This is the shape `ch07`
    // was solving in, and it has to read as a right angle or the per-rig
    // checks above are decorative.
    expect(
      hingeOffAxisDeg(syntheticLeg([0.3, -0.4, 0]), reference)
    ).toBeGreaterThan(80);
  });
});
