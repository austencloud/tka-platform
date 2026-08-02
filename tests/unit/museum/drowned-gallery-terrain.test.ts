import { describe, it, expect } from "vitest";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
import {
  createDrownedGalleryTerrain,
  buildDrownedGalleryLayout,
  WATERLINE_Y,
  SUMP_FLOOR_Y,
  CAUSEWAY_Y,
} from "$lib/features/museum/data/drowned-gallery-terrain";

const plan = buildVulcanCaveFloorPlan();
const terrain = createDrownedGalleryTerrain(plan.grid)!;
const layout = buildDrownedGalleryLayout(plan.grid)!;

const wing = (id: string) => plan.grid.wings.find((w) => w.id === id)!.bounds;
// world-space center of a wing's interior
const center = (b: { x: number; y: number; width: number; height: number }) => ({
  x: (b.x + b.width / 2) * 0.5,
  z: (b.y + b.height / 2) * 0.5,
});

describe("drowned gallery terrain", () => {
  it("exists for the cave plan", () => {
    expect(terrain).toBeTruthy();
    expect(terrain.waterlineY).toBe(WATERLINE_Y);
  });

  it("keeps the museum datum outside the water bay", () => {
    const squeeze = center(wing("cave-squeeze"));
    expect(terrain.elevationAt(squeeze.x, squeeze.z)).toBe(0);
  });

  it("descends monotonically through the approach (north = deeper)", () => {
    const a = wing("cave-water-approach");
    const xs = (a.x + a.width / 2) * 0.5;
    const zTop = (a.y + 1.5) * 0.5; // north interior edge
    const zBottom = (a.y + a.height - 1.5) * 0.5; // south interior edge
    let prev = terrain.elevationAt(xs, zBottom);
    expect(prev).toBeCloseTo(0, 1);
    for (let t = 1; t <= 6; t++) {
      const z = zBottom + (zTop - zBottom) * (t / 6);
      const e = terrain.elevationAt(xs, z);
      expect(e).toBeLessThanOrEqual(prev + 1e-9);
      prev = e;
    }
  });

  it("puts the sump mid-section at the sump floor depth", () => {
    const s = center(wing("cave-water-sump"));
    expect(terrain.elevationAt(s.x, s.z)).toBeCloseTo(SUMP_FLOOR_Y, 5);
  });

  it("puts the causeway at causeway height and blocks the pool", () => {
    expect(
      terrain.elevationAt(layout.causewayProbe.x, layout.causewayProbe.z)
    ).toBeCloseTo(CAUSEWAY_Y, 5);
    expect(terrain.blockedAt(layout.poolProbe.x, layout.poolProbe.z)).toBe(true);
    expect(
      terrain.blockedAt(layout.causewayProbe.x, layout.causewayProbe.z)
    ).toBe(false);
  });

  it("keeps each overlook walkable and the shore/gate blocked", () => {
    for (const o of layout.overlookProbes) {
      expect(terrain.blockedAt(o.x, o.z)).toBe(false);
    }
    expect(terrain.blockedAt(layout.shoreProbe.x, layout.shoreProbe.z)).toBe(
      true
    );
    expect(terrain.blockedAt(layout.gateProbe.x, layout.gateProbe.z)).toBe(true);
  });

  it("positions three alcove shelves on the north shore", () => {
    expect(layout.alcoves).toHaveLength(3);
    const g = wing("cave-water");
    const northZ = (g.y + g.height * 0.2) * 0.5;
    for (const a of layout.alcoves) {
      expect(a.z).toBeLessThan(northZ); // all in the north band
    }
  });
});
