import { describe, it, expect } from "vitest";
import {
  GripType,
  FINGER_BONES,
  mirrorQuaternion,
  type FingerBoneName,
} from "$lib/shared/3d/domain/models/GripPose";

describe("GripPose", () => {
  describe("FINGER_BONES", () => {
    it("has exactly 15 entries", () => {
      expect(FINGER_BONES).toHaveLength(15);
    });

    it("covers all 5 fingers with 3 bones each", () => {
      const fingers = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
      for (const finger of fingers) {
        const bones = FINGER_BONES.filter((b) => b.startsWith(finger));
        expect(bones).toHaveLength(3);
        expect(bones).toEqual([`${finger}1`, `${finger}2`, `${finger}3`]);
      }
    });
  });

  describe("GripType", () => {
    it("has exactly 6 values", () => {
      expect(Object.values(GripType)).toHaveLength(6);
    });

    it("includes all expected grip types", () => {
      expect(GripType.IDLE).toBe("idle");
      expect(GripType.SQUARE).toBe("square");
      expect(GripType.PENCIL).toBe("pencil");
      expect(GripType.CRADLE).toBe("cradle");
      expect(GripType.OPEN_PALM).toBe("open_palm");
      expect(GripType.RELEASE).toBe("release");
    });
  });

  describe("mirrorQuaternion", () => {
    it("negates Y and Z components for right-hand mirroring", () => {
      const left: [number, number, number, number] = [0.1, 0.2, 0.3, 0.9];
      const right = mirrorQuaternion(left);
      expect(right).toEqual([0.1, -0.2, -0.3, 0.9]);
    });

    it("identity quaternion mirrors to itself", () => {
      const identity: [number, number, number, number] = [0, 0, 0, 1];
      expect(mirrorQuaternion(identity)).toEqual([0, -0, -0, 1]);
    });

    it("double mirror returns original", () => {
      const original: [number, number, number, number] = [0.5, 0.3, -0.1, 0.8];
      const mirrored = mirrorQuaternion(original);
      const restored = mirrorQuaternion(mirrored);
      expect(restored).toEqual(original);
    });
  });
});
