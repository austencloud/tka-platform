import { describe, it, expect, beforeEach } from "vitest";
import { Quaternion, Vector3, Euler } from "three";
import { ClipBasedTurnAnimator } from "$lib/shared/3d/services/implementations/ClipBasedTurnAnimator";
import type { BakedTurnClip } from "$lib/shared/3d/services/implementations/ClipBasedTurnAnimator";

function buildSyntheticClip(
  clipName: string,
  angleDeg: number,
  frameCount: number
): BakedTurnClip {
  const angleRad = (angleDeg * Math.PI) / 180;
  const boneFrames = new Map<string, Quaternion[]>();

  const hipsFrames: Quaternion[] = [];
  const hipsPositions: Vector3[] = [];
  for (let i = 0; i < frameCount; i++) {
    const t = i / (frameCount - 1);
    const yaw = angleRad * t;
    const q = new Quaternion().setFromEuler(new Euler(0, 0, yaw));
    hipsFrames.push(q);
    hipsPositions.push(new Vector3(0, 0, 0));
  }
  boneFrames.set("Hips", hipsFrames);

  const legBones = [
    "LeftUpLeg",
    "LeftLeg",
    "LeftFoot",
    "RightUpLeg",
    "RightLeg",
    "RightFoot",
  ];
  for (const name of legBones) {
    const frames: Quaternion[] = [];
    for (let i = 0; i < frameCount; i++) {
      frames.push(new Quaternion());
    }
    boneFrames.set(name, frames);
  }

  const leftContact: number[] = [];
  const rightContact: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    const t = i / (frameCount - 1);
    leftContact.push(t < 0.5 ? 1 : 0);
    rightContact.push(t >= 0.5 ? 1 : 0);
  }

  return {
    angleDeg,
    clipName,
    duration: 1.0,
    frameCount,
    boneFrames,
    hipsPositions,
    contactLeft: leftContact,
    contactRight: rightContact,
  };
}

function yawFromQuat(q: Quaternion): number {
  const e = new Euler().setFromQuaternion(q, "XYZ");
  return e.z;
}

describe("ClipBasedTurnAnimator", () => {
  let animator: ClipBasedTurnAnimator;

  beforeEach(() => {
    animator = new ClipBasedTurnAnimator();
    animator.initializeFromData([
      buildSyntheticClip("turn-left-90", 90, 31),
      buildSyntheticClip("turn-right-90", -90, 31),
      buildSyntheticClip("turn-left-180", 180, 39),
      buildSyntheticClip("turn-right-180", -180, 39),
    ]);
  });

  describe("computeShortestAngle", () => {
    it("returns positive value for a CCW (left) turn: 0 → π/2", () => {
      const angle = animator.computeShortestAngle(0, Math.PI / 2);
      expect(angle).toBeCloseTo(Math.PI / 2, 5);
    });

    it("returns negative value for a CW (right) turn: 0 → -π/2", () => {
      const angle = animator.computeShortestAngle(0, -Math.PI / 2);
      expect(angle).toBeCloseTo(-Math.PI / 2, 5);
    });

    it("takes shortest path across the ±π boundary: 170° → -170° = +20°", () => {
      const from = (170 * Math.PI) / 180;
      const to = (-170 * Math.PI) / 180;
      const angle = animator.computeShortestAngle(from, to);
      expect(angle).toBeCloseTo((20 * Math.PI) / 180, 5);
    });

    it("returns zero for identical headings", () => {
      const angle = animator.computeShortestAngle(1.2, 1.2);
      expect(angle).toBeCloseTo(0, 10);
    });
  });

  describe("sample — clip selection", () => {
    it("selects turn-left-90 for +π/2 heading change", () => {
      const result = animator.sample({ fromHeading: 0, toHeading: Math.PI / 2, phase: 0.5 });
      expect(result.clipName).toBe("turn-left-90");
    });

    it("selects turn-right-90 for -π/2 heading change", () => {
      const result = animator.sample({ fromHeading: 0, toHeading: -Math.PI / 2, phase: 0.5 });
      expect(result.clipName).toBe("turn-right-90");
    });

    it("selects turn-left-180 for +π heading change", () => {
      const result = animator.sample({ fromHeading: 0, toHeading: Math.PI, phase: 0.5 });
      expect(result.clipName).toBe("turn-left-180");
    });

    it("selects turn-right-180 for -π heading change", () => {
      const result = animator.sample({ fromHeading: 0, toHeading: -Math.PI, phase: 0.5 });
      expect(result.clipName).toBe("turn-right-180");
    });
  });

  describe("sample — phase interpolation", () => {
    it("phase 0 → yawDelta ≈ 0", () => {
      const result = animator.sample({ fromHeading: 0, toHeading: Math.PI / 2, phase: 0 });
      expect(result.yawDelta).toBeCloseTo(0, 3);
    });

    it("phase 1 → yawDelta ≈ full angle", () => {
      const result = animator.sample({ fromHeading: 0, toHeading: Math.PI / 2, phase: 1 });
      expect(result.yawDelta).toBeCloseTo(Math.PI / 2, 3);
    });

    it("phase 0.5 → yawDelta ≈ half angle", () => {
      const result = animator.sample({ fromHeading: 0, toHeading: Math.PI / 2, phase: 0.5 });
      expect(result.yawDelta).toBeCloseTo(Math.PI / 4, 3);
    });

    it("phase < 0 clamps to 0", () => {
      const atNeg = animator.sample({ fromHeading: 0, toHeading: Math.PI / 2, phase: -1 });
      const atZero = animator.sample({ fromHeading: 0, toHeading: Math.PI / 2, phase: 0 });
      expect(atNeg.yawDelta).toBeCloseTo(atZero.yawDelta, 5);
    });

    it("phase > 1 clamps to 1", () => {
      const atOver = animator.sample({ fromHeading: 0, toHeading: Math.PI / 2, phase: 2 });
      const atOne = animator.sample({ fromHeading: 0, toHeading: Math.PI / 2, phase: 1 });
      expect(atOver.yawDelta).toBeCloseTo(atOne.yawDelta, 5);
    });
  });

  describe("sample — bone rotations", () => {
    it("includes Hips rotation at sampled phase with correct Z euler", () => {
      const result = animator.sample({ fromHeading: 0, toHeading: Math.PI / 2, phase: 0.5 });
      const hips = result.boneRotations.get("Hips");
      expect(hips).toBeDefined();
      if (hips) {
        const yaw = yawFromQuat(hips);
        expect(yaw).toBeCloseTo(Math.PI / 4, 2);
      }
    });

    it("includes all leg bones in the boneRotations map", () => {
      const result = animator.sample({ fromHeading: 0, toHeading: Math.PI / 2, phase: 0.5 });
      const legBones = ["LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot"];
      for (const bone of legBones) {
        expect(result.boneRotations.has(bone)).toBe(true);
      }
    });
  });

  describe("sample — contact curves", () => {
    it("phase 0.25 → left foot planted, right foot not", () => {
      const result = animator.sample({ fromHeading: 0, toHeading: Math.PI / 2, phase: 0.25 });
      expect(result.leftFootContact).toBeGreaterThan(0.5);
      expect(result.rightFootContact).toBeLessThan(0.5);
    });

    it("phase 0.75 → right foot planted, left foot not", () => {
      const result = animator.sample({ fromHeading: 0, toHeading: Math.PI / 2, phase: 0.75 });
      expect(result.rightFootContact).toBeGreaterThan(0.5);
      expect(result.leftFootContact).toBeLessThan(0.5);
    });
  });

  describe("sample — linear fallback", () => {
    it("45° change → returns linear yawDelta, empty clipName, empty boneRotations", () => {
      const angleDeg = 45;
      const angleRad = (angleDeg * Math.PI) / 180;
      const result = animator.sample({ fromHeading: 0, toHeading: angleRad, phase: 0.5 });

      expect(result.yawDelta).toBeCloseTo(angleRad * 0.5, 3);
      expect(result.clipName).toBe("");
      expect(result.boneRotations.size).toBe(0);
    });

    it("135° change → returns linear yawDelta, empty clipName, empty boneRotations", () => {
      const angleDeg = 135;
      const angleRad = (angleDeg * Math.PI) / 180;
      const result = animator.sample({ fromHeading: 0, toHeading: angleRad, phase: 0.7 });

      expect(result.yawDelta).toBeCloseTo(angleRad * 0.7, 3);
      expect(result.clipName).toBe("");
      expect(result.boneRotations.size).toBe(0);
    });
  });

  describe("isReady", () => {
    it("returns true after initializeFromData", () => {
      expect(animator.isReady()).toBe(true);
    });

    it("returns false before initialization", () => {
      const fresh = new ClipBasedTurnAnimator();
      expect(fresh.isReady()).toBe(false);
    });
  });
});
