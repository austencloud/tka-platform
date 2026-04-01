import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { ElbowPoleComputer } from "$lib/shared/3d/services/implementations/ElbowPoleComputer";
import { Plane } from "$lib/shared/3d/domain/enums/Plane";

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
  const computer = new ElbowPoleComputer();
  const bodyCenter = new Vector3(0, 1, 0);

  describe("all returned vectors are unit length", () => {
    it("wall plane", () => {
      const pole = computer.computePoleVector(
        new Vector3(0.3, 1.2, 0), Plane.WALL, "left", bodyCenter
      );
      expectNormalized(pole);
    });

    it("wheel plane", () => {
      const pole = computer.computePoleVector(
        new Vector3(0, 1.2, 0.3), Plane.WHEEL, "right", bodyCenter
      );
      expectNormalized(pole);
    });

    it("floor plane", () => {
      const pole = computer.computePoleVector(
        new Vector3(0.3, 1, 0.3), Plane.FLOOR, "left", bodyCenter
      );
      expectNormalized(pole);
    });
  });

  describe("wall plane", () => {
    it("normal position: pole is primarily forward (+Z)", () => {
      const pole = computer.computePoleVector(
        new Vector3(0.3, 1.2, 0), Plane.WALL, "left", bodyCenter
      );
      expect(pole.z).toBeGreaterThan(0);
      expectDominantComponent(pole, "z");
    });

    it("cross-body reach: strong forward Z", () => {
      const pole = computer.computePoleVector(
        new Vector3(-0.3, 1.2, 0), Plane.WALL, "left", bodyCenter
      );
      expect(pole.z).toBeGreaterThan(0.5);
    });

    it("hand at south: forward Z + outward X bias", () => {
      const pole = computer.computePoleVector(
        new Vector3(0, 0.3, 0), Plane.WALL, "left", bodyCenter
      );
      expect(pole.z).toBeGreaterThan(0);
      expect(pole.x).toBeGreaterThan(0);
    });

    it("overhead position: pole shifts slightly downward", () => {
      const pole = computer.computePoleVector(
        new Vector3(0, 2.2, 0), Plane.WALL, "left", bodyCenter
      );
      expect(pole.z).toBeGreaterThan(0);
      expect(pole.y).toBeLessThan(0);
    });
  });

  describe("wheel plane", () => {
    it("pole is primarily lateral (outward)", () => {
      const pole = computer.computePoleVector(
        new Vector3(0, 1.2, 0.3), Plane.WHEEL, "left", bodyCenter
      );
      expect(pole.x).toBeGreaterThan(0);
      expectDominantComponent(pole, "x");
    });

    it("right arm: opposite lateral direction", () => {
      const pole = computer.computePoleVector(
        new Vector3(0, 1.2, 0.3), Plane.WHEEL, "right", bodyCenter
      );
      expect(pole.x).toBeLessThan(0);
    });
  });

  describe("floor plane", () => {
    it("pole is primarily upward (+Y)", () => {
      const pole = computer.computePoleVector(
        new Vector3(0.3, 1, 0.3), Plane.FLOOR, "left", bodyCenter
      );
      expect(pole.y).toBeGreaterThan(0);
      expectDominantComponent(pole, "y");
    });

    it("hand near center: adds outward X bias", () => {
      const pole = computer.computePoleVector(
        new Vector3(0.02, 1, 0.02), Plane.FLOOR, "left", bodyCenter
      );
      expect(pole.y).toBeGreaterThan(0);
      expect(pole.x).toBeGreaterThan(0);
    });
  });

  describe("degenerate cases", () => {
    it("floor plane, hand directly above body: still returns valid vector", () => {
      const pole = computer.computePoleVector(
        new Vector3(0, 2.5, 0), Plane.FLOOR, "left", bodyCenter
      );
      expectNormalized(pole);
      expect(Math.abs(pole.x) + Math.abs(pole.z)).toBeGreaterThan(0.1);
    });

    it("wheel plane, hand directly to the side: still returns valid vector", () => {
      const pole = computer.computePoleVector(
        new Vector3(0.5, 1, 0), Plane.WHEEL, "left", bodyCenter
      );
      expectNormalized(pole);
    });
  });

  describe("mixed planes: each arm independent", () => {
    it("left on wall, right on wheel: different dominant axes", () => {
      const leftPole = computer.computePoleVector(
        new Vector3(0.3, 1.2, 0), Plane.WALL, "left", bodyCenter
      );
      const rightPole = computer.computePoleVector(
        new Vector3(0, 1.2, 0.3), Plane.WHEEL, "right", bodyCenter
      );
      expectDominantComponent(leftPole, "z");
      expectDominantComponent(rightPole, "x");
    });
  });
});
