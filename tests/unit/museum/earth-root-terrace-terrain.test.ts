/**
 * Terrain + layout invariants for the Earth wing (the Root Terrace).
 *
 * The same coupling invariants Water and Fire carry — one geometry source,
 * every walkable tile inside a rendered floor, the 0.6 m step rule, performer
 * anchors identical to layout anchors, the suppressedSpans regression — plus
 * the ones the terrace adds: the bed is blocked everywhere, the visitor is
 * always at least a storey above the performers, and the ensemble landing
 * sees all three cases on one axis.
 */
import { describe, it, expect } from "vitest";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
import {
  BED_Y,
  DOOR_Y,
  EYE_ABOVE_FLOOR,
  LANDING_Y,
  PROP_CENTRE_ABOVE_FEET,
  TERRACE_Y,
  buildEarthRootTerraceLayout,
  createEarthRootTerraceTerrain,
  earthRootTerraceStationOffsets,
  ribbonElevationAt,
} from "$lib/features/museum/data/earth-root-terrace-terrain";
import { buildFirstFireProcessionBay } from "$lib/features/museum/data/first-fire-procession-terrain";
import {
  buildDrownedGalleryLayout,
  inRectClosed,
  TILE_METRES,
  type WorldRect,
} from "$lib/features/museum/data/drowned-gallery-terrain";
import { SOLID_TYPES } from "$lib/features/museum/services/museum-physics-provider";
import { bucketMuseumTilesByRoom } from "$lib/features/museum/services/museum-geometry-builder";
import { tileKey } from "$lib/features/museum/domain/museum-grid-types";

const TILE = TILE_METRES;

const plan = buildVulcanCaveFloorPlan();
const grid = plan.grid;
const terrain = createEarthRootTerraceTerrain(grid)!;
const layout = buildEarthRootTerraceLayout(grid)!;
/** The composed program the game actually runs on. */
const caveTerrain = grid.terrain!;

const wing = (id: string) => grid.wings.find((w) => w.id === id)!.bounds;
const centre = (r: WorldRect) => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 });

function isWalkable(tx: number, ty: number): boolean {
  const tile = grid.tiles.get(tileKey(tx, ty));
  if (!tile || SOLID_TYPES.has(tile.type)) return false;
  return !caveTerrain.blockedAt(tx * TILE, ty * TILE);
}

/** Every tile whose world position lies inside the earth bay. */
function bayTiles(): { tx: number; ty: number; x: number; z: number }[] {
  const out: { tx: number; ty: number; x: number; z: number }[] = [];
  for (const key of grid.tiles.keys()) {
    const [tx, ty] = key.split(",").map(Number);
    const x = tx! * TILE;
    const z = ty! * TILE;
    if (!layout.bayFootprint.some((rect) => inRectClosed(rect, x, z))) continue;
    out.push({ tx: tx!, ty: ty!, x, z });
  }
  return out;
}

const walkableBayTiles = bayTiles().filter((t) => isWalkable(t.tx, t.ty));

describe("earth root terrace terrain", () => {
  it("exists for the cave plan and owns the earth bay", () => {
    expect(terrain).toBeTruthy();
    expect(layout.stations.map((s) => s.letter)).toEqual(["G", "H", "I"]);
    expect(layout.floorRects.map((f) => f.id)).toEqual([
      "vestibule",
      "terrace",
      "landing",
      "door-approach",
      "ramp",
      "descent-a",
      "descent-b",
    ]);
  });

  it("keeps the museum datum outside the earth bay", () => {
    const squeeze = wing("cave-squeeze");
    const x = (squeeze.x + squeeze.width / 2) * TILE;
    const z = (squeeze.y + squeeze.height / 2) * TILE;
    expect(caveTerrain.elevationAt(x, z)).toBe(0);
  });

  it("holds both doors on the datum and climbs the ramp east from 0 to the terrace", () => {
    const west = centre(layout.vestibule);
    expect(terrain.elevationAt(layout.earth.minX + 0.3, west.z)).toBeCloseTo(DOOR_Y, 5);
    const rampZ = centre(layout.ramp).z;
    expect(terrain.elevationAt(layout.ramp.minX, rampZ)).toBeCloseTo(DOOR_Y, 5);
    expect(terrain.elevationAt(centre(layout.ramp).x, rampZ)).toBeCloseTo(TERRACE_Y / 2, 5);
    expect(terrain.elevationAt(layout.ramp.maxX, rampZ)).toBeCloseTo(TERRACE_Y, 5);
    // The ramp only ever climbs, west → east.
    let previous = DOOR_Y - 1e-9;
    for (let x = layout.ramp.minX; x <= layout.ramp.maxX; x += 0.25) {
      const here = terrain.elevationAt(x, rampZ);
      expect(here).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = here;
    }
    const south = centre(layout.doorApproach);
    expect(terrain.elevationAt(south.x, layout.earth.maxZ - 0.01)).toBeCloseTo(DOOR_Y, 5);
  });

  it("holds the whole terrace on one datum and drops to the landing and the door", () => {
    const z = centre(layout.terrace).z;
    for (let x = layout.terrace.minX; x <= layout.terrace.maxX; x += 0.5) {
      expect(terrain.elevationAt(x, z), `terrace x=${x}`).toBeCloseTo(TERRACE_Y, 5);
      expect(caveTerrain.blockedAt(x, z)).toBe(false);
    }
    const landing = centre(layout.landing);
    expect(terrain.elevationAt(landing.x, landing.z)).toBeCloseTo(LANDING_Y, 5);
    expect(terrain.elevationAt(landing.x, layout.descentA.minZ)).toBeCloseTo(TERRACE_Y, 5);
    expect(terrain.elevationAt(landing.x, layout.descentB.maxZ)).toBeCloseTo(DOOR_Y, 5);
    // The east route only ever descends, north → south.
    let previous = TERRACE_Y + 1e-9;
    for (let z = layout.descentA.minZ; z <= layout.doorApproach.maxZ; z += 0.25) {
      const here = terrain.elevationAt(landing.x, z);
      expect(here).toBeLessThanOrEqual(previous + 1e-9);
      previous = here;
    }
  });

  it("blocks the bed and the cleft everywhere, at 0.25 m intervals", () => {
    const offenders: string[] = [];
    for (const rect of [layout.bed, layout.cleft]) {
      for (let x = rect.minX + 0.3; x <= rect.maxX - 0.3; x += 0.25) {
        for (let z = rect.minZ + 0.3; z <= rect.maxZ - 0.3; z += 0.25) {
          if (!caveTerrain.blockedAt(x, z)) offenders.push(`${x.toFixed(2)},${z.toFixed(2)}`);
        }
      }
    }
    expect(offenders.slice(0, 8)).toEqual([]);
    for (const station of layout.stations) {
      expect(caveTerrain.blockedAt(station.centre.x, station.centre.z)).toBe(true);
      expect(terrain.elevationAt(station.centre.x, station.centre.z)).toBeCloseTo(BED_Y, 5);
    }
    const cleft = centre(layout.cleft);
    expect(terrain.elevationAt(cleft.x, cleft.z)).toBeLessThan(BED_Y);
  });

  it("blocks the rock beside the ribbon, so the bed rail is the only edge", () => {
    // North of the terrace (the rock behind the rail wall), south of the
    // vestibule, and the room's south-west corner beyond the bed.
    const z0 = layout.earth.minZ + 0.5;
    expect(caveTerrain.blockedAt(centre(layout.terrace).x, z0)).toBe(true);
    expect(caveTerrain.blockedAt(centre(layout.vestibule).x, layout.earth.maxZ - 0.5)).toBe(true);
    expect(caveTerrain.blockedAt(layout.bed.minX - 1, layout.bed.maxZ + 1)).toBe(true);
    expect(ribbonElevationAt(layout, layout.bed.minX - 1, layout.bed.maxZ + 1)).toBeNull();
  });

  it("keeps the visitor at least a storey above the performers from every deck", () => {
    for (const floor of layout.floorRects) {
      const c = centre(floor.rect);
      const eye = terrain.elevationAt(c.x, c.z) + EYE_ABOVE_FLOOR;
      expect(eye - (BED_Y + PROP_CENTRE_ABOVE_FEET), floor.id).toBeGreaterThanOrEqual(1.5);
    }
    expect(TERRACE_Y - BED_Y).toBeCloseTo(5.2, 5);
  });

  it("stages performers on exactly the layout's station anchors", () => {
    const performers = grid.performers.filter((p) => p.id.startsWith("cave-earth-"));
    expect(performers).toHaveLength(3);
    for (const station of layout.stations) {
      const performer = performers.find((p) => p.id === station.performerId);
      expect(performer, station.performerId).toBeTruthy();
      // Tile-snapped by the grid builder: within half a tile of the anchor.
      expect(Math.abs(performer!.tileX * TILE - station.centre.x)).toBeLessThanOrEqual(0.26);
      expect(Math.abs(performer!.tileY * TILE - station.centre.z)).toBeLessThanOrEqual(0.26);
      expect(performer!.elevation).toBeCloseTo(BED_Y, 5);
      expect(performer!.sequenceId).toBe(station.sequenceId);
    }
  });

  it("derives the station anchors from the one shared expression", () => {
    const offsets = earthRootTerraceStationOffsets();
    expect(offsets).toHaveLength(3);
    layout.stations.forEach((station, index) => {
      expect(station.centre.x).toBeCloseTo(layout.earth.minX + offsets[index]!.xMetres, 6);
      expect(station.centre.z).toBeCloseTo(layout.earth.minZ + offsets[index]!.zMetres, 6);
    });
    // One row: every case on the same z, in G/H/I order west → east.
    const zs = new Set(layout.stations.map((s) => s.centre.z.toFixed(3)));
    expect(zs.size).toBe(1);
    expect(layout.stations[0]!.centre.x).toBeLessThan(layout.stations[1]!.centre.x);
    expect(layout.stations[1]!.centre.x).toBeLessThan(layout.stations[2]!.centre.x);
  });

  it("looks down on every case from the terrace rail at 35° or steeper", () => {
    const eyeY = TERRACE_Y + EYE_ABOVE_FLOOR;
    const railZ = layout.terrace.maxZ - 0.6;
    for (const station of layout.stations) {
      const run = Math.hypot(0, station.centre.z - railZ);
      const drop = eyeY - (BED_Y + PROP_CENTRE_ABOVE_FEET);
      const depression = (Math.atan2(drop, run) * 180) / Math.PI;
      expect(depression, station.letter).toBeGreaterThanOrEqual(35);
    }
  });

  it("aligns all three cases on one axis from the ensemble landing", () => {
    const { eye, eyeY } = layout.ensemble;
    expect(inRectClosed(layout.landing, eye.x, eye.z)).toBe(true);
    expect(caveTerrain.blockedAt(eye.x, eye.z)).toBe(false);
    expect(eyeY).toBeCloseTo(LANDING_Y + EYE_ABOVE_FLOOR, 5);
    const bearings = layout.stations.map((s) => Math.atan2(s.centre.z - eye.z, s.centre.x - eye.x));
    for (const bearing of bearings) expect(Math.abs(bearing - bearings[0]!)).toBeLessThan(1e-6);
    const targetY = BED_Y + PROP_CENTRE_ABOVE_FEET;
    const depressions = layout.stations.map((s) => {
      const run = Math.hypot(s.centre.x - eye.x, s.centre.z - eye.z);
      return (Math.atan2(eyeY - targetY, run) * 180) / Math.PI;
    });
    // Nearest case steepest, farthest shallowest, none below 10°.
    expect(depressions[2]).toBeGreaterThan(depressions[1]!);
    expect(depressions[1]).toBeGreaterThan(depressions[0]!);
    expect(depressions[0]).toBeGreaterThan(10);
  });

  it("covers every walkable earth-bay tile with a rendered floor rect", () => {
    expect(walkableBayTiles.length).toBeGreaterThan(300);
    const uncovered = walkableBayTiles.filter(
      (t) =>
        inRectClosed(layout.earth, t.x, t.z) &&
        !layout.floorRects.some((f) => inRectClosed(f.rect, t.x, t.z))
    );
    expect(
      uncovered.slice(0, 10).map((t) => `${t.x},${t.z}`),
      `${uncovered.length} walkable tiles have no rendered floor under them`
    ).toEqual([]);
  });

  it("never steps more than 0.6 m between neighbouring walkable tiles", () => {
    const walkable = new Set(walkableBayTiles.map((t) => `${t.tx},${t.ty}`));
    const offenders: string[] = [];
    for (const tile of walkableBayTiles) {
      const here = caveTerrain.elevationAt(tile.x, tile.z);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = tile.tx + dx;
        const ny = tile.ty + dy;
        if (!walkable.has(`${nx},${ny}`)) continue;
        const there = caveTerrain.elevationAt(nx * TILE, ny * TILE);
        if (Math.abs(there - here) > 0.6) {
          offenders.push(
            `(${tile.x},${tile.z})=${here.toFixed(2)} -> (${nx * TILE},${ny * TILE})=${there.toFixed(2)}`
          );
        }
      }
    }
    expect(offenders.slice(0, 6)).toEqual([]);
  });

  it("keeps both door tiles walkable and level with the room beyond them", () => {
    const b = wing("cave-earth");
    const doors: { tx: number; ty: number }[] = [];
    for (let ty = b.y; ty < b.y + b.height; ty++) {
      for (let tx = b.x; tx < b.x + b.width; tx++) {
        if (grid.tiles.get(tileKey(tx, ty))?.type === "door") doors.push({ tx, ty });
      }
    }
    expect(doors.length).toBeGreaterThanOrEqual(4);
    for (const door of doors) {
      expect(isWalkable(door.tx, door.ty), `${door.tx},${door.ty}`).toBe(true);
      expect(caveTerrain.elevationAt(door.tx * TILE, door.ty * TILE)).toBeCloseTo(DOOR_Y, 5);
    }
  });

  it("answers off the ribbon without throwing, at the datum", () => {
    expect(terrain.elevationAt(layout.earth.minX - 40, layout.earth.minZ - 40)).toBe(DOOR_Y);
    expect(terrain.blockedAt(layout.earth.minX - 40, layout.earth.minZ - 40)).toBe(false);
  });

  it("keeps every walkable tile rendered when cave-earth joins the suppressed set", () => {
    const suppressed = grid.wings.filter((w) => w.roomPresentation?.suppressTileGeometry);
    expect(suppressed.map((w) => w.id)).toContain("cave-earth");
    expect(suppressed.length).toBeGreaterThanOrEqual(3);

    const buckets = bucketMuseumTilesByRoom(grid);
    const rendered = new Set<string>();
    const collect = (dry: {
      floorBuckets: Map<string, { positions: { x: number; z: number }[] }>;
    }) => {
      for (const bucket of dry.floorBuckets.values()) {
        for (const position of bucket.positions) {
          rendered.add(`${position.x.toFixed(3)},${position.z.toFixed(3)}`);
        }
      }
    };
    collect(buckets.corridorBucket);
    for (const dry of buckets.roomBuckets.values()) collect(dry);

    const authored = [
      ...buildDrownedGalleryLayout(grid)!.floorRects,
      ...buildFirstFireProcessionBay(grid)!.floorRects,
      ...layout.floorRects,
    ];
    const insideSuppressedWing = (tx: number, ty: number) =>
      suppressed.some(
        (w) =>
          tx >= w.bounds.x &&
          tx < w.bounds.x + w.bounds.width &&
          ty >= w.bounds.y &&
          ty < w.bounds.y + w.bounds.height
      );

    const orphans: string[] = [];
    for (const key of grid.tiles.keys()) {
      const [tx, ty] = key.split(",").map(Number);
      if (!isWalkable(tx!, ty!)) continue;
      if (insideSuppressedWing(tx!, ty!)) continue;
      const x = tx! * TILE;
      const z = ty! * TILE;
      if (rendered.has(`${x.toFixed(3)},${z.toFixed(3)}`)) continue;
      if (authored.some((f) => inRectClosed(f.rect, x, z))) continue;
      orphans.push(`${tx},${ty}`);
    }
    expect(
      orphans.slice(0, 10),
      `${orphans.length} walkable tiles outside the suppressed wings render no floor`
    ).toEqual([]);
  });
});
