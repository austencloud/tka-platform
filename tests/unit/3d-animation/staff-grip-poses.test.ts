import { describe, it, expect } from "vitest";
import { STAFF_GRIP_POSES } from "$lib/shared/3d/data/grip-poses/staff-grip-poses";
import { GripType, FINGER_BONES } from "$lib/shared/3d/domain/models/GripPose";

describe("STAFF_GRIP_POSES", () => {
  it("has an entry for every GripType", () => {
    for (const type of Object.values(GripType)) {
      expect(STAFF_GRIP_POSES[type]).toBeDefined();
      expect(STAFF_GRIP_POSES[type].type).toBe(type);
    }
  });

  it("every pose has exactly 15 quaternion rotations", () => {
    for (const pose of Object.values(STAFF_GRIP_POSES)) {
      expect(pose.rotations).toHaveLength(FINGER_BONES.length);
    }
  });

  it("every quaternion has 4 components", () => {
    for (const pose of Object.values(STAFF_GRIP_POSES)) {
      for (const q of pose.rotations) {
        expect(q).toHaveLength(4);
      }
    }
  });

  it("every quaternion is approximately unit length", () => {
    for (const pose of Object.values(STAFF_GRIP_POSES)) {
      for (const [x, y, z, w] of pose.rotations) {
        const len = Math.sqrt(x * x + y * y + z * z + w * w);
        expect(len).toBeCloseTo(1.0, 2);
      }
    }
  });

  it("IDLE pose has minimal finger curl", () => {
    const idle = STAFF_GRIP_POSES[GripType.IDLE];
    for (const [, , , w] of idle.rotations) {
      expect(w).toBeGreaterThan(0.9);
    }
  });

  it("SQUARE pose has significant finger curl", () => {
    const square = STAFF_GRIP_POSES[GripType.SQUARE];
    const fingerBones = square.rotations.slice(3);
    const hasCurl = fingerBones.some(([, , , w]) => w < 0.95);
    expect(hasCurl).toBe(true);
  });
});
