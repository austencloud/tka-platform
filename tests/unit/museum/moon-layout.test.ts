import { describe, expect, it } from "vitest";
import { buildVulcanCaveFloorPlan } from "../../../src/lib/features/museum/data/vulcan-cave-floor-plan";
import {
  buildMoonLayout,
  createMoonTerrain,
  MOON_ARRIVAL_HOLE_RADIUS_M,
  MOON_CHAMBER_RADIUS_M,
  MOON_STATION_RADIUS_M,
  MOON_STATIONS,
  type MoonLayout,
} from "../../../src/lib/features/museum/data/moon-layout";

const plan = buildVulcanCaveFloorPlan();
const layout = buildMoonLayout(plan.grid);

function required(value: MoonLayout | null): MoonLayout {
  if (!value) throw new Error("the moon bay is missing from the compiled grid");
  return value;
}

describe("moon layout", () => {
  it("compiles a bay wide enough for the whole plain", () => {
    const l = required(layout);
    expect(l.chamberRadius).toBe(MOON_CHAMBER_RADIUS_M);
    expect(l.centre.x - l.chamberRadius).toBeGreaterThanOrEqual(l.interior.minX);
    expect(l.centre.x + l.chamberRadius).toBeLessThanOrEqual(l.interior.maxX);
    expect(l.centre.z - l.chamberRadius).toBeGreaterThanOrEqual(l.interior.minZ);
    expect(l.centre.z + l.chamberRadius).toBeLessThanOrEqual(l.interior.maxZ);
  });

  it("is walkable across the plain, all the way to its edge", () => {
    const l = required(layout);
    // Sixty bearings × the full radius. If any of this is blocked the visitor
    // hits an invisible wall on ground the graybox has drawn as floor.
    for (let i = 0; i < 60; i++) {
      const theta = (i / 60) * Math.PI * 2;
      for (const r of [0, 2, 4, 6, 8, l.chamberRadius - 0.05]) {
        const x = l.centre.x + Math.sin(theta) * r;
        const z = l.centre.z + Math.cos(theta) * r;
        expect(
          l.blockedAt(x, z),
          `blocked at bearing ${theta.toFixed(2)}, r=${r}`
        ).toBe(false);
      }
    }
  });

  it("walks the door approaches the graybox draws as floor", () => {
    const l = required(layout);
    // The one rectangular exception: both approach slabs, end to end.
    for (const z of [l.doorBand.minZ + 0.05, l.centre.z, l.doorBand.maxZ - 0.05]) {
      for (
        let x = l.interior.minX + 0.05;
        x <= l.interior.maxX - 0.05;
        x += 0.5
      ) {
        expect(l.blockedAt(x, z), `blocked at ${x.toFixed(2)}, ${z}`).toBe(false);
      }
    }
  });

  it("blocks the rock corners the plain leaves over", () => {
    const l = required(layout);
    for (const [x, z] of [
      [l.interior.minX + 0.1, l.interior.minZ + 0.1],
      [l.interior.maxX - 0.1, l.interior.minZ + 0.1],
      [l.interior.minX + 0.1, l.interior.maxZ - 0.1],
      [l.interior.maxX - 0.1, l.interior.maxZ - 0.1],
    ]) {
      expect(l.blockedAt(x!, z!)).toBe(true);
    }
  });

  it("stands every station at exactly the station radius", () => {
    const l = required(layout);
    // Three, not four — MPMP, NQNQ and OROR are the Quarter-Opposite pairs
    // that close. The fourth compass point is the arrival hole.
    expect(l.mounds).toHaveLength(3);
    expect(l.mounds.map((m) => m.id)).toEqual(
      MOON_STATIONS.map((s) => `moon-mound-${s.suffix}`)
    );
    for (const mound of l.mounds) {
      const r = Math.hypot(
        mound.centre.x - l.centre.x,
        mound.centre.z - l.centre.z
      );
      expect(r, mound.id).toBeCloseTo(MOON_STATION_RADIUS_M, 10);
    }
  });

  it("keeps every station clear of the arrival hole", () => {
    const l = required(layout);
    for (const mound of l.mounds) {
      const gap =
        Math.hypot(
          mound.centre.x - l.arrival.x,
          mound.centre.z - l.arrival.z
        ) - mound.radius;
      expect(gap, mound.id).toBeGreaterThan(MOON_ARRIVAL_HOLE_RADIUS_M);
    }
  });

  it("holds normal gravity on the plinth and lets go one step off it", () => {
    const l = required(layout);
    expect(l.isLowGravityAt(l.probes.arrival.x, l.probes.arrival.z)).toBe(false);
    expect(l.isLowGravityAt(l.probes.firstStep.x, l.probes.firstStep.z)).toBe(
      true
    );
    expect(l.isLowGravityAt(l.probes.centre.x, l.probes.centre.z)).toBe(true);
  });

  it("stands the performers on the mounds the graybox draws", () => {
    const l = required(layout);
    const scale = plan.grid.tileScale;
    for (const station of MOON_STATIONS) {
      const performer = plan.grid.performers.find(
        (p) => p.id === `cave-moon-automaton-${station.suffix}`
      );
      expect(performer, station.suffix).toBeDefined();
      const mound = l.mounds.find(
        (m) => m.id === `moon-mound-${station.suffix}`
      )!;
      expect(performer!.tileX * scale).toBeCloseTo(mound.centre.x, 6);
      expect(performer!.tileY * scale).toBeCloseTo(mound.centre.z, 6);
      expect(performer!.elevation).toBeCloseTo(mound.topY, 6);
    }
  });

  it("exposes a terrain program that agrees with the layout", () => {
    const l = required(layout);
    const terrain = createMoonTerrain(plan.grid);
    expect(terrain).not.toBeNull();
    expect(terrain!.elevationAt(l.centre.x, l.centre.z)).toBe(0);
    const mound = l.mounds[0]!;
    expect(terrain!.elevationAt(mound.centre.x, mound.centre.z)).toBeCloseTo(
      mound.topY,
      6
    );
    expect(terrain!.blockedAt(l.centre.x, l.centre.z)).toBe(false);
  });
});
