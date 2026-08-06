import { describe, expect, it } from "vitest";
import {
  animalBodyRadiusProfile,
  animalBuildMultiplier,
  applyAnimalGravity3D,
  applyAnimalSlither3D,
  dampAnimalGravityBlend3D,
  writeAnimalRotationMinimizingFrames3D,
} from "$lib/shared/3d/effects/animal/animal-spine-3d";

function frameBuffers(count: number) {
  return {
    tangents: new Float32Array(count * 3),
    normals: new Float32Array(count * 3),
    binormals: new Float32Array(count * 3),
  };
}

describe("Animal 3D spine", () => {
  it("keeps the head pinned while slither grows toward the tail", () => {
    const points = new Float32Array([
      0, 0, 0, -1, 0, 0, -2, 0, 0, -3, 0, 0, -4, 0, 0,
    ]);
    const frames = frameBuffers(5);
    writeAnimalRotationMinimizingFrames3D(points, 5, frames);
    applyAnimalSlither3D(points, 5, frames, 0.7, 1, 0.6, 0.8);

    expect(Array.from(points.slice(0, 3))).toEqual([0, 0, 0]);
    expect(
      Math.hypot(points[12]! + 4, points[13]!, points[14]!)
    ).toBeGreaterThan(0.1);
  });

  it("hangs a stationary fixed-length spine under its tracked head", () => {
    const points = new Float32Array([
      2, 4, 1, 1, 4, 1, 0, 4, 1, -1, 4, 1, -2, 4, 1,
    ]);

    applyAnimalGravity3D(points, 5, 1, 1);

    expect(Array.from(points)).toEqual([
      2, 4, 1, 2, 3, 1, 2, 2, 1, 2, 1, 1, 2, 0, 1,
    ]);
    for (let segment = 1; segment < 5; segment++) {
      const i3 = segment * 3;
      expect(
        Math.hypot(
          points[i3]! - points[i3 - 3]!,
          points[i3 + 1]! - points[i3 - 2]!,
          points[i3 + 2]! - points[i3 - 1]!
        )
      ).toBeCloseTo(1, 6);
    }
  });

  it("does not wag the spine while its tracked endpoint is stationary", () => {
    const points = new Float32Array([
      0, 0, 0, 0, -1, 0, 0, -2, 0, 0, -3, 0, 0, -4, 0,
    ]);
    const before = points.slice();
    const frames = frameBuffers(5);
    writeAnimalRotationMinimizingFrames3D(points, 5, frames);

    applyAnimalSlither3D(points, 5, frames, 4.2, 1, 0.6, 0);

    expect(points).toEqual(before);
  });

  it("settles and releases gravity consistently across frame rates", () => {
    let at60Fps = 0;
    let at30Fps = 0;
    for (let frame = 0; frame < 60; frame++) {
      at60Fps = dampAnimalGravityBlend3D(at60Fps, 0, 1 / 60);
    }
    for (let frame = 0; frame < 30; frame++) {
      at30Fps = dampAnimalGravityBlend3D(at30Fps, 0, 1 / 30);
    }
    expect(at60Fps).toBeCloseTo(at30Fps, 6);
    expect(at60Fps).toBeGreaterThan(0.98);

    const released = dampAnimalGravityBlend3D(at60Fps, 3, 1 / 15);
    expect(released).toBeLessThan(at60Fps * 0.56);
  });

  it("keeps finite orthonormal frames through vertical runs and inflections", () => {
    const points = new Float32Array([
      0, 0, 0, 0, -1, 0, 0.5, -2, 0.2, 0, -3, 0.4, -0.5, -4, 0.2, 0, -5, 0,
    ]);
    const frames = frameBuffers(6);
    writeAnimalRotationMinimizingFrames3D(points, 6, frames);

    for (let segment = 0; segment < 6; segment++) {
      const i3 = segment * 3;
      const tangent = frames.tangents.slice(i3, i3 + 3);
      const normal = frames.normals.slice(i3, i3 + 3);
      const binormal = frames.binormals.slice(i3, i3 + 3);
      for (const value of [...tangent, ...normal, ...binormal]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(Math.hypot(...tangent)).toBeCloseTo(1, 5);
      expect(Math.hypot(...normal)).toBeCloseTo(1, 5);
      expect(Math.hypot(...binormal)).toBeCloseTo(1, 5);
      expect(
        tangent[0]! * normal[0]! +
          tangent[1]! * normal[1]! +
          tangent[2]! * normal[2]!
      ).toBeCloseTo(0, 5);
    }
  });

  it("uses distinct silhouettes for snake, dragon, and caterpillar", () => {
    expect(animalBuildMultiplier("dragon")).toBeGreaterThan(
      animalBuildMultiplier("snake")
    );
    expect(animalBuildMultiplier("caterpillar")).toBeGreaterThan(
      animalBuildMultiplier("dragon")
    );
    expect(animalBodyRadiusProfile("snake", 0.95)).toBeLessThan(
      animalBodyRadiusProfile("snake", 0.2)
    );
    expect(animalBodyRadiusProfile("caterpillar", 0.7)).toBeGreaterThan(
      animalBodyRadiusProfile("snake", 0.7)
    );
  });
});
