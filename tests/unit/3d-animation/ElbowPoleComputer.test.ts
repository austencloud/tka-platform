import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { computePoleVector } from "$lib/shared/3d/services/elbow-pole-computer";
import { Plane } from "@austencloud/scene-3d";

/**
 * Coordinate convention (TKA / Mixamo):
 *   - character's right = +X
 *   - character's left  = -X
 *   - forward (toward camera) = +Z
 *   - up = +Y
 *
 * So the left shoulder sits at -X and the left arm's natural outward
 * direction is -X. The right shoulder sits at +X and its outward is +X.
 * "Cross-body" for the left arm means the hand target is at +X
 * (the right side of the body); for the right arm it means -X.
 */

function expectNormalized(v: Vector3) {
  expect(v.length()).toBeCloseTo(1, 4);
}

function expectDominantComponent(v: Vector3, axis: "x" | "y" | "z") {
  const abs = { x: Math.abs(v.x), y: Math.abs(v.y), z: Math.abs(v.z) };
  const dominant = abs[axis];
  for (const [key, val] of Object.entries(abs)) {
    if (key !== axis) {
      expect(dominant).toBeGreaterThan(val);
    }
  }
}

describe("ElbowPoleComputer", () => {
  const bodyCenter = new Vector3(0, 1, 0);

  describe("all returned vectors are unit length", () => {
    it("wall plane", () => {
      const pole = computePoleVector(
        new Vector3(-0.3, 1.2, 0), Plane.WALL, "left", bodyCenter
      );
      expectNormalized(pole);
    });

    it("wheel plane", () => {
      const pole = computePoleVector(
        new Vector3(0, 1.2, 0.3), Plane.WHEEL, "right", bodyCenter
      );
      expectNormalized(pole);
    });

    it("floor plane", () => {
      const pole = computePoleVector(
        new Vector3(-0.3, 1, 0.3), Plane.FLOOR, "left", bodyCenter
      );
      expectNormalized(pole);
    });
  });

  describe("wall plane", () => {
    it("left arm on its native side: pole is primarily forward (+Z)", () => {
      // Left arm at localX = -0.3 → native side, not cross-body
      const pole = computePoleVector(
        new Vector3(-0.3, 1.2, 0), Plane.WALL, "left", bodyCenter
      );
      expect(pole.z).toBeGreaterThan(0);
      expectDominantComponent(pole, "z");
    });

    it("left arm cross-body (hand at +X): extra forward Z push", () => {
      // Left arm's wrong side is +X. Cross-body should push pole more forward
      // than the native-side case.
      const nativePole = computePoleVector(
        new Vector3(-0.3, 1.2, 0), Plane.WALL, "left", bodyCenter
      );
      const crossBodyPole = computePoleVector(
        new Vector3(0.3, 1.2, 0), Plane.WALL, "left", bodyCenter
      );
      expect(crossBodyPole.z).toBeGreaterThan(0.5);
      // Cross-body gets more forward push, so normalized z is at least as
      // dominant as the native case (and the overall forward bias is larger).
      expect(crossBodyPole.z).toBeGreaterThanOrEqual(nativePole.z - 1e-6);
    });

    it("right arm cross-body (hand at -X): extra forward Z push", () => {
      const pole = computePoleVector(
        new Vector3(-0.3, 1.2, 0), Plane.WALL, "right", bodyCenter
      );
      expect(pole.z).toBeGreaterThan(0.5);
      expectDominantComponent(pole, "z");
    });

    it("left arm at south: forward Z + outward (-X) bias", () => {
      // Low-pose outward bias for the left arm should push toward -X.
      const pole = computePoleVector(
        new Vector3(0, 0.3, 0), Plane.WALL, "left", bodyCenter
      );
      expect(pole.z).toBeGreaterThan(0);
      expect(pole.x).toBeLessThan(0);
    });

    it("right arm at south: forward Z + outward (+X) bias", () => {
      const pole = computePoleVector(
        new Vector3(0, 0.3, 0), Plane.WALL, "right", bodyCenter
      );
      expect(pole.z).toBeGreaterThan(0);
      expect(pole.x).toBeGreaterThan(0);
    });

    it("overhead position: pole shifts slightly downward", () => {
      const pole = computePoleVector(
        new Vector3(0, 2.2, 0), Plane.WALL, "left", bodyCenter
      );
      expect(pole.z).toBeGreaterThan(0);
      expect(pole.y).toBeLessThan(0);
    });
  });

  describe("wheel plane", () => {
    it("left arm: pole is primarily lateral outward (-X)", () => {
      const pole = computePoleVector(
        new Vector3(0, 1.2, 0.3), Plane.WHEEL, "left", bodyCenter
      );
      expect(pole.x).toBeLessThan(0);
      expectDominantComponent(pole, "x");
    });

    it("right arm: pole is primarily lateral outward (+X)", () => {
      const pole = computePoleVector(
        new Vector3(0, 1.2, 0.3), Plane.WHEEL, "right", bodyCenter
      );
      expect(pole.x).toBeGreaterThan(0);
      expectDominantComponent(pole, "x");
    });

    it("hand in front: adds upward Y bias", () => {
      // Hand far forward in Z — should increase Y component
      const poleFar = computePoleVector(
        new Vector3(0, 1.2, 0.5), Plane.WHEEL, "left", bodyCenter
      );
      const poleNear = computePoleVector(
        new Vector3(0, 1.2, 0.01), Plane.WHEEL, "left", bodyCenter
      );
      expect(poleFar.y).toBeGreaterThan(poleNear.y);
    });
  });

  describe("floor plane", () => {
    it("pole is primarily upward (+Y)", () => {
      const pole = computePoleVector(
        new Vector3(0.3, 1, 0.3), Plane.FLOOR, "left", bodyCenter
      );
      expect(pole.y).toBeGreaterThan(0);
      expectDominantComponent(pole, "y");
    });

    it("left arm near center: upward +Y plus outward -X bias", () => {
      const pole = computePoleVector(
        new Vector3(0.02, 1, 0.02), Plane.FLOOR, "left", bodyCenter
      );
      expect(pole.y).toBeGreaterThan(0);
      expect(pole.x).toBeLessThan(0);
    });

    it("right arm near center: upward +Y plus outward +X bias", () => {
      const pole = computePoleVector(
        new Vector3(0.02, 1, 0.02), Plane.FLOOR, "right", bodyCenter
      );
      expect(pole.y).toBeGreaterThan(0);
      expect(pole.x).toBeGreaterThan(0);
    });
  });

  describe("degenerate cases", () => {
    it("floor plane, hand directly above body: still returns valid vector", () => {
      const pole = computePoleVector(
        new Vector3(0, 2.5, 0), Plane.FLOOR, "left", bodyCenter
      );
      expectNormalized(pole);
      expect(Math.abs(pole.x) + Math.abs(pole.z)).toBeGreaterThan(0.1);
    });

    it("wheel plane, hand directly to the side: still returns valid vector", () => {
      const pole = computePoleVector(
        new Vector3(-0.5, 1, 0), Plane.WHEEL, "left", bodyCenter
      );
      expectNormalized(pole);
    });
  });

  describe("mixed planes: each arm independent", () => {
    it("left on wall, right on wheel: different dominant axes", () => {
      const leftPole = computePoleVector(
        new Vector3(-0.3, 1.2, 0), Plane.WALL, "left", bodyCenter
      );
      const rightPole = computePoleVector(
        new Vector3(0, 1.2, 0.3), Plane.WHEEL, "right", bodyCenter
      );
      expectDominantComponent(leftPole, "z");
      expectDominantComponent(rightPole, "x");
    });
  });

  describe("left/right symmetry", () => {
    it("mirroring the hand across the body mirrors the pole X", () => {
      // Right arm native-side sample
      const rightPole = computePoleVector(
        new Vector3(0.3, 1.2, 0), Plane.WALL, "right", bodyCenter
      );
      // Left arm mirrored
      const leftPole = computePoleVector(
        new Vector3(-0.3, 1.2, 0), Plane.WALL, "left", bodyCenter
      );
      expect(leftPole.z).toBeCloseTo(rightPole.z, 4);
      expect(leftPole.y).toBeCloseTo(rightPole.y, 4);
      // Same magnitude, opposite sign (or both zero)
      expect(Math.abs(leftPole.x) + Math.abs(rightPole.x))
        .toBeCloseTo(Math.abs(leftPole.x - (-rightPole.x)), 4);
    });
  });
});
