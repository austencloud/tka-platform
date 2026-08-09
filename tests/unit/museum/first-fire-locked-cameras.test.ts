import { describe, expect, it } from "vitest";
import { buildFirstFireBlenderContract } from "$lib/features/museum/data/first-fire-blender-contract";
import {
  FIRST_FIRE_LOCKED_CAMERAS,
  buildFirstFireLockedCameraViews,
} from "$lib/features/museum/data/first-fire-locked-cameras";

const contract = buildFirstFireBlenderContract();

describe("First Fire contract cameras", () => {
  it("carries a dj-cooling camera at the DJ exit mouth looking back at the court", () => {
    const camera = contract.cameras.find((entry) => entry.id === "dj-cooling");
    expect(camera).toBeDefined();
    const dj = contract.shrines.find((entry) => entry.id === "dj")!;
    // The camera stands at the exit mouth the visitor actually leaves through.
    expect(camera!.position.x).toBeCloseTo(dj.blenderExit.x, 3);
    expect(camera!.position.y).toBeCloseTo(dj.blenderExit.y, 3);
    // And it faces the court centre, not the next court.
    expect(camera!.target.x).toBeCloseTo(dj.blenderCentre.x, 3);
    expect(camera!.target.y).toBeCloseTo(dj.blenderCentre.y, 3);
  });
});

describe("First Fire locked camera set", () => {
  it("binds exactly the seven approved Gate 2 walk frames", () => {
    expect(FIRST_FIRE_LOCKED_CAMERAS).toHaveLength(7);
    expect(FIRST_FIRE_LOCKED_CAMERAS.map((entry) => entry.frame)).toEqual([
      "walk-01-ember-bridge.webp",
      "walk-02-dj-mouth.webp",
      "walk-03-dj-cooling.webp",
      "walk-04-ek-mouth.webp",
      "walk-05-fl-mouth.webp",
      "walk-06-blackout.webp",
      "walk-07-earth-growth.webp",
    ]);
  });

  it("resolves every locked camera against the contract", () => {
    const views = buildFirstFireLockedCameraViews(contract);
    expect(views).toHaveLength(7);
    for (const view of views) {
      expect(Number.isFinite(view.position.x)).toBe(true);
      expect(Number.isFinite(view.position.y)).toBe(true);
      expect(Number.isFinite(view.position.z)).toBe(true);
      expect(view.horizontalFovDegrees).toBeGreaterThan(0);
    }
  });

  it("converts blender space to runtime space with the exporter transform", () => {
    const views = buildFirstFireLockedCameraViews(contract);
    const bridge = views.find((view) => view.id === "ember-bridge")!;
    const source = contract.cameras.find((entry) => entry.id === "ember-bridge")!;
    expect(bridge.position.x).toBeCloseTo(source.position.x, 6);
    expect(bridge.position.y).toBeCloseTo(source.position.z, 6);
    expect(bridge.position.z).toBeCloseTo(-source.position.y, 6);
  });

  it("faces each camera at its authored target", () => {
    const views = buildFirstFireLockedCameraViews(contract);
    for (const view of views) {
      const dx = view.target.x - view.position.x;
      const dz = view.target.z - view.position.z;
      // A camera pointed at its own position has no facing and cannot register.
      expect(Math.hypot(dx, dz)).toBeGreaterThan(0.5);
      expect(view.yaw).toBeCloseTo(Math.atan2(dx, dz), 6);
    }
  });
});
