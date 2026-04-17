import { describe, it, expect } from "vitest";
import {
  computeAutoOrbitShot,
  computePlaneShot,
  computeGroupBounds,
} from "../../../src/lib/shared/sequence-viewer/camera-choreography/presets/shots";

// Minimal stand-in for AvatarInstanceState — shots.ts only reads `position`.
function fakePerformer(x: number, z: number) {
  return { position: { x, y: 0, z } } as any;
}

describe("camera-choreography shot helpers", () => {
  it("computes group bounds centered on the mean XZ position", () => {
    const bounds = computeGroupBounds([
      fakePerformer(1, 0),
      fakePerformer(-1, 0),
    ]);
    expect(bounds.center.x).toBeCloseTo(0);
    expect(bounds.center.z).toBeCloseTo(0);
    expect(bounds.radius).toBeGreaterThan(1);
  });

  it("auto-orbit shot sits a positive distance from the performer", () => {
    const shot = computeAutoOrbitShot([fakePerformer(0, 0)], 0);
    const dx = shot.eye.x - shot.target.x;
    const dy = shot.eye.y - shot.target.y;
    const dz = shot.eye.z - shot.target.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    expect(dist).toBeGreaterThan(1);
    // Polar 65° means eye is above target.
    expect(shot.eye.y).toBeGreaterThan(shot.target.y);
  });

  it("wall shot puts the camera along -Z from the centroid", () => {
    const shot = computePlaneShot("wall", [fakePerformer(0, 0)]);
    expect(shot.target.x).toBeCloseTo(0);
    expect(shot.eye.x).toBeCloseTo(0);
    expect(shot.eye.y).toBeCloseTo(shot.target.y);
    expect(shot.eye.z).toBeLessThan(shot.target.z);
  });

  it("wheel shot puts the camera along +X from the centroid", () => {
    const shot = computePlaneShot("wheel", [fakePerformer(0, 0)]);
    expect(shot.eye.x).toBeGreaterThan(shot.target.x);
    expect(shot.eye.y).toBeCloseTo(shot.target.y);
    expect(shot.eye.z).toBeCloseTo(shot.target.z);
  });

  it("floor shot puts the camera above the centroid", () => {
    const shot = computePlaneShot("floor", [fakePerformer(0, 0)]);
    expect(shot.eye.x).toBeCloseTo(shot.target.x);
    expect(shot.eye.y).toBeGreaterThan(shot.target.y);
    expect(shot.eye.z).toBeCloseTo(shot.target.z);
  });
});
