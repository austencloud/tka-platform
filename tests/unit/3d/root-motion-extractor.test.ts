import { describe, expect, it } from "vitest";
import { Bone } from "three";
import { RootMotionExtractor } from "@austencloud/scene-3d";

describe("RootMotionExtractor", () => {
  it("integrates authored yaw once and removes it from the local hips pose", () => {
    const hips = new Bone();
    hips.position.set(4, 8, 12);
    hips.rotation.set(0.1, -0.2, 0.05);

    const extractor = new RootMotionExtractor();
    extractor.initialize(hips);

    hips.position.set(5, 10, 12.5);
    hips.rotation.set(0.2, -0.1, 0.25);
    expect(extractor.extract()).toEqual({ x: 0, forward: 0, yawDelta: 0 });
    expect(hips.position.x).toBe(4);
    expect(hips.position.y).toBe(8);
    expect(hips.rotation.x).toBeCloseTo(0.2, 8);
    expect(hips.rotation.y).toBeCloseTo(-0.1, 8);
    expect(hips.rotation.z).toBeCloseTo(0.05, 8);

    hips.position.set(6, 13, 13);
    hips.rotation.set(0.15, -0.05, 0.45);
    const delta = extractor.extract();

    expect(delta.x).toBeCloseTo(1, 8);
    expect(delta.forward).toBeCloseTo(3, 8);
    expect(delta.yawDelta).toBeCloseTo(0.2, 8);
    expect(hips.rotation.x).toBeCloseTo(0.15, 8);
    expect(hips.rotation.y).toBeCloseTo(-0.05, 8);
    expect(hips.rotation.z).toBeCloseTo(0.05, 8);
  });
});
