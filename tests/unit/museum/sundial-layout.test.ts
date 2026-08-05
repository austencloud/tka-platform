import { describe, it, expect } from "vitest";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
import {
  buildSundialLayout,
  EYE_RADIUS_M,
  SUN_MEDALLION_RADIUS_M,
  SUN_PILLAR_RADIUS_M,
} from "$lib/features/museum/data/sundial-layout";

const plan = buildVulcanCaveFloorPlan();
const layout = buildSundialLayout(plan.grid)!;

/** Point at radius r, bearing theta, in world space. */
function at(r: number, theta: number) {
  return {
    x: layout.centre.x + Math.sin(theta) * r,
    z: layout.centre.z + Math.cos(theta) * r,
  };
}

describe("sundial layout", () => {
  it("builds", () => expect(layout).toBeTruthy());

  it("blocks the collapse ring everywhere except the crossing", () => {
    let blocked = 0;
    let open = 0;
    for (let i = 0; i < 720; i++) {
      const theta = (i / 720) * Math.PI * 2;
      const p = at(6.5, theta);
      layout.blockedAt(p.x, p.z) ? blocked++ : open++;
    }
    expect(open).toBeGreaterThan(0); // the crossing exists
    expect(blocked / 720).toBeGreaterThan(0.9); // and it is a slot, not a gap
  });

  it("lets you walk the whole rim", () => {
    for (let i = 0; i < 360; i++) {
      const theta = (i / 360) * Math.PI * 2;
      const p = at(10.5, theta);
      expect(layout.blockedAt(p.x, p.z)).toBe(false);
    }
  });

  it("puts the centre disc at -0.2 and the rim at -0.4", () => {
    expect(layout.elevationAt(layout.centre.x, layout.centre.z)).toBeCloseTo(
      -0.2,
      2
    );
    const rim = at(10.5, 0);
    expect(layout.elevationAt(rim.x, rim.z)).toBeCloseTo(-0.4, 2);
  });

  it("sweeps exactly 90 degrees from rim to disc", () => {
    const d = layout.crossingEndTheta - layout.crossingStartTheta;
    expect(Math.abs(d)).toBeCloseTo(Math.PI / 2, 5);
  });

  it("puts the sun overhead at the centre and low at the rim", () => {
    expect(
      layout.sunElevationDeg(layout.centre.x, layout.centre.z)
    ).toBeCloseTo(90, 1);
    const rim = at(12, 0);
    expect(layout.sunElevationDeg(rim.x, rim.z)).toBeCloseTo(8, 1);
  });

  it("keeps the sun on the visitor's own bearing", () => {
    for (const theta of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const p = at(10, theta);
      const az = layout.sunAzimuth(p.x, p.z);
      const d = Math.atan2(Math.sin(az - theta), Math.cos(az - theta));
      expect(Math.abs(d)).toBeLessThan(1e-6);
    }
  });

  it("puts all four performers on the pillar circle, about the same centre", () => {
    const performers = plan.grid.performers.filter((p) =>
      p.id.startsWith("cave-sun-automaton-")
    );
    expect(performers).toHaveLength(4);
    for (const performer of performers) {
      const r = Math.hypot(
        performer.tileX * 0.5 - layout.centre.x,
        performer.tileY * 0.5 - layout.centre.z
      );
      expect(r).toBeCloseTo(SUN_PILLAR_RADIUS_M, 5);
    }
  });

  it("stands each performer on a pillar cap, not in the collapse", () => {
    for (const pillar of layout.pillars) {
      expect(
        layout.elevationAt(pillar.centre.x, pillar.centre.z, pillar.topY)
      ).toBeCloseTo(pillar.topY, 5);
      // ...and the ring immediately beside the cap is still the collapse.
      expect(
        layout.elevationAt(
          pillar.centre.x + pillar.radius + 0.4,
          pillar.centre.z,
          pillar.topY
        )
      ).toBeCloseTo(-4.0, 5);
    }
  });

  it("keeps the eye under solid ceiling", () => {
    expect(SUN_MEDALLION_RADIUS_M).toBeGreaterThanOrEqual(EYE_RADIUS_M + 1.5);
  });

  it("walks a continuous route from the north door to the centre", () => {
    // Entry, the rim, both ends of the crossing and the disc must all be open,
    // and the ring opposite the crossing must not be.
    const { entry, rim, crossingStart, crossingMid, centre, ringGap, exit } =
      layout.probes;
    for (const p of [entry, rim, crossingStart, crossingMid, centre, exit]) {
      expect(layout.blockedAt(p.x, p.z)).toBe(false);
    }
    expect(layout.blockedAt(ringGap.x, ringGap.z)).toBe(true);
  });
});
