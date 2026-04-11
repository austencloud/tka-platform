import { describe, it, expect, beforeEach } from "vitest";
import { Bone } from "three";
import { RootMotionExtractor } from "$lib/shared/3d/services/implementations/RootMotionExtractor";

describe("RootMotionExtractor yaw delta", () => {
  let bone: Bone;
  let extractor: RootMotionExtractor;

  beforeEach(() => {
    bone = new Bone();
    bone.position.set(0, 0, -100); // Mixamo rest hip height
    bone.rotation.set(0, 0, 0);
    extractor = new RootMotionExtractor();
    extractor.initialize(bone);
  });

  it("returns zero yaw on first frame", () => {
    const delta = extractor.extract();
    expect(delta.yawDelta).toBe(0);
  });

  it("detects a yaw rotation applied to the Hips bone between frames", () => {
    extractor.extract();
    bone.rotation.z = 0.1;

    const delta = extractor.extract();
    expect(delta.yawDelta).toBeCloseTo(0.1, 3);
  });

  it("detects a negative yaw rotation", () => {
    extractor.extract();
    bone.rotation.z = -0.25;

    const delta = extractor.extract();
    expect(delta.yawDelta).toBeCloseTo(-0.25, 3);
  });

  it("clamps absurd yaw deltas (loop boundary)", () => {
    extractor.extract();
    // Simulate a clip loop: Hips snaps from end-of-clip to start
    bone.rotation.z = 3.0;

    const delta = extractor.extract();
    expect(Math.abs(delta.yawDelta)).toBeLessThan(0.6);
  });
});
