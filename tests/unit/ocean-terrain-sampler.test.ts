/**
 * The JS sampler must agree with the Python height function it bakes from.
 * These are the points where disagreement would be most expensive: the flat
 * performer clearing every inner placement depends on, the shelf where most
 * objects land, the upstage wall, and the abyss past the lip.
 *
 * Expected values come from scripts/ocean_terrain_profile.py, which
 * scripts/test_ocean_terrain_profile.py already asserts independently.
 */
import { createRequire } from "module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { createTerrainSampler } = require("../../scripts/ocean-terrain-sampler.cjs");

const terrain = createTerrainSampler();

describe("ocean terrain sampler", () => {
  it("reports the performer clearing as exactly flat", () => {
    // The stage, the torches and every inner placement depend on this being 0.
    for (const [x, y] of [
      [0, 0],
      [3, 2],
      [-5, 4],
      [0, 7.5],
    ]) {
      expect(terrain.sample(x, y).height).toBeCloseTo(0, 3);
    }
  });

  it("calls the clearing sand and gives it no slope", () => {
    const s = terrain.sample(2, 2);
    expect(s.substrate).toBe("sand");
    expect(s.slopeDegrees).toBeCloseTo(0, 3);
  });

  it("keeps the shelf within the authored relief cap", () => {
    // shelf_relief is capped at +/- 0.6 m deliberately, so re-run ground snaps
    // never tilt coral that was authored flat.
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const r = 16;
      const s = terrain.sample(Math.cos(angle) * r, Math.sin(angle) * r);
      expect(Math.abs(s.height)).toBeLessThan(0.7);
    }
  });

  it("climbs upstage and plunges downstage at the same radius", () => {
    const upstage = terrain.sample(0, 30); // +y is north, behind the arch
    const downstage = terrain.sample(0, -30);
    expect(upstage.height).toBeGreaterThan(5);
    expect(downstage.height).toBeLessThan(-20);
  });

  it("breaks the water plane at the wall crest", () => {
    expect(terrain.sample(0, 40).height).toBeGreaterThan(terrain.profile.WATER_PLANE_Z);
  });

  it("reports the abyss face as rock, not sand", () => {
    const face = terrain.sample(0, -28);
    expect(face.slopeDegrees).toBeGreaterThan(terrain.ROCK_SLOPE_DEGREES);
    expect(face.substrate).toBe("rock");
  });

  it("measures depth from the water plane, not from world zero", () => {
    const s = terrain.sample(0, 0);
    expect(s.depth).toBeCloseTo(terrain.profile.WATER_PLANE_Z, 3);
  });

  it("returns a unit-length upward normal", () => {
    const { normal } = terrain.sample(-12, 6);
    expect(Math.hypot(...normal)).toBeCloseTo(1, 6);
    expect(normal[2]).toBeGreaterThan(0);
  });

  it("refuses a heightmap baked from different terrain constants", () => {
    expect(() => terrain.assertProfile({ ABYSS_DEPTH: 999 })).toThrow(/Stale heightmap/);
    expect(() => terrain.assertProfile({ ABYSS_DEPTH: 45 })).not.toThrow();
  });
});
