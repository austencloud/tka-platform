/**
 * Terrain + layout invariants for The First Fire (the Vulcan Cave fire bay).
 *
 * The same coupling invariants the Drowned Gallery carries: one geometry
 * source, every walkable tile inside a rendered floor, no wall over a door,
 * performer anchors identical to layout anchors, a loud failure instead of a
 * silent datum-0 — plus the suppressedSpans regression that adding a second
 * tile-suppressed bay makes possible.
 */
import { describe, it, expect } from "vitest";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
import {
  buildFirstFireLayout,
  createFirstFireTerrain,
  firstFireStationOffsets,
  BRIDGE_Y,
  DOOR_Y,
  FISSURE_BED_Y,
  LAVA_BED_Y,
  SHORE_Y,
  TERRACE_Y,
} from "$lib/features/museum/data/first-fire-layout";
import {
  buildDrownedGalleryLayout,
  inRectClosed,
  tileCentredOffset,
  EYE_ABOVE_FLOOR,
  TILE_METRES,
  type WorldRect,
} from "$lib/features/museum/data/drowned-gallery-terrain";
import { SOLID_TYPES } from "$lib/features/museum/services/museum-physics-provider";
import { bucketMuseumTilesByRoom } from "$lib/features/museum/services/museum-geometry-builder";
import { tileKey } from "$lib/features/museum/domain/museum-grid-types";

const TILE = TILE_METRES;

const plan = buildVulcanCaveFloorPlan();
const grid = plan.grid;
const terrain = createFirstFireTerrain(grid)!;
const layout = buildFirstFireLayout(grid)!;
/** The composed program the game actually runs on. */
const caveTerrain = grid.terrain!;

const wing = (id: string) => grid.wings.find((w) => w.id === id)!.bounds;

function isWalkable(tx: number, ty: number): boolean {
  const tile = grid.tiles.get(tileKey(tx, ty));
  if (!tile || SOLID_TYPES.has(tile.type)) return false;
  return !caveTerrain.blockedAt(tx * TILE, ty * TILE);
}

/** Every tile whose world position lies inside the fire bay. */
function bayTiles(): { tx: number; ty: number; x: number; z: number }[] {
  const out: { tx: number; ty: number; x: number; z: number }[] = [];
  for (const key of grid.tiles.keys()) {
    const [tx, ty] = key.split(",").map(Number);
    const x = tx! * TILE;
    const z = ty! * TILE;
    if (!inRectClosed(layout.bayBounds, x, z)) continue;
    out.push({ tx: tx!, ty: ty!, x, z });
  }
  return out;
}

const walkableBayTiles = bayTiles().filter((t) => isWalkable(t.tx, t.ty));

describe("first fire terrain", () => {
  it("exists for the cave plan and owns the fire bay", () => {
    expect(terrain).toBeTruthy();
    expect(layout.terraces).toHaveLength(3);
    expect(layout.stations).toHaveLength(3);
  });

  it("keeps the museum datum outside the fire bay", () => {
    const squeeze = wing("cave-squeeze");
    const x = (squeeze.x + squeeze.width / 2) * TILE;
    const z = (squeeze.y + squeeze.height / 2) * TILE;
    expect(caveTerrain.elevationAt(x, z)).toBe(0);
  });

  it("descends from the door datum onto the bridge and down the crack", () => {
    expect(terrain.elevationAt(layout.corridor[0]!.minX + 0.25, layout.probes.bridge.z)).toBeCloseTo(DOOR_Y, 5);
    expect(
      terrain.elevationAt(layout.probes.bridge.x, layout.probes.bridge.z)
    ).toBeCloseTo(BRIDGE_Y, 5);
    // The crack only ever descends, west → east.
    const crackRun = [
      layout.crackWest,
      layout.crackBend,
      layout.crackEast,
    ].flatMap((rect) => [
      { x: rect.minX, z: (rect.minZ + rect.maxZ) / 2 },
      { x: rect.maxX, z: (rect.minZ + rect.maxZ) / 2 },
    ]);
    let previous = BRIDGE_Y + 1e-9;
    for (const point of crackRun) {
      const elevation = terrain.elevationAt(point.x, point.z);
      expect(elevation).toBeLessThanOrEqual(previous + 1e-9);
      previous = elevation;
    }
    expect(previous).toBeCloseTo(TERRACE_Y[0]!, 5);
  });

  it("puts each bench terrace on its authored datum", () => {
    layout.probes.terraces.forEach((probe, i) => {
      expect(terrain.elevationAt(probe.x, probe.z)).toBeCloseTo(TERRACE_Y[i]!, 5);
      expect(caveTerrain.blockedAt(probe.x, probe.z)).toBe(false);
    });
    // South (behind) is high, north (at the fissure) is low: an amphitheatre.
    expect(TERRACE_Y[0]).toBeGreaterThan(TERRACE_Y[1]!);
    expect(TERRACE_Y[1]).toBeGreaterThan(TERRACE_Y[2]!);
  });

  it("climbs the exit stair to the Earth door datum", () => {
    expect(
      terrain.elevationAt(layout.exitStair.maxX, layout.probes.exitStair.z)
    ).toBeCloseTo(DOOR_Y, 5);
    expect(
      terrain.elevationAt(layout.exitStair.minX, layout.probes.exitStair.z)
    ).toBeCloseTo(TERRACE_Y[0]!, 5);
  });

  it("blocks the fissure, the lava stream, the shore and the ash circle", () => {
    for (const probe of [
      layout.probes.fissure,
      layout.probes.lava,
      layout.probes.shore,
      layout.probes.ash,
      layout.probes.rock,
    ]) {
      expect(caveTerrain.blockedAt(probe.x, probe.z)).toBe(true);
    }
    expect(terrain.elevationAt(layout.probes.fissure.x, layout.probes.fissure.z)).toBeCloseTo(FISSURE_BED_Y, 5);
    expect(terrain.elevationAt(layout.probes.lava.x, layout.probes.lava.z)).toBeCloseTo(LAVA_BED_Y, 5);
    expect(terrain.elevationAt(layout.probes.shore.x, layout.probes.shore.z)).toBeCloseTo(SHORE_Y, 5);
  });

  it("blocks the fissure, lava, shore and ash edges at 0.25 m intervals", () => {
    const PROBE = 0.25;
    const edges: [string, WorldRect, "north" | "south" | "west" | "east"][] = [
      ["fissure", layout.fissure, "south"],
      ["fissure", layout.fissure, "north"],
      ["shore", layout.shore, "south"],
      ["ash", layout.ashCircle, "north"],
      ["ash", layout.ashCircle, "south"],
      ["ash", layout.ashCircle, "west"],
      ["ash", layout.ashCircle, "east"],
      ...layout.lavaStream.flatMap(
        (rect) =>
          [
            ["lava", rect, "west"],
            ["lava", rect, "east"],
          ] as [string, WorldRect, "west" | "east"][]
      ),
    ];
    for (const [name, rect, side] of edges) {
      const horizontal = side === "north" || side === "south";
      const from = horizontal ? rect.minX : rect.minZ;
      const to = horizontal ? rect.maxX : rect.maxZ;
      for (let v = from + PROBE; v < to - PROBE; v += PROBE) {
        const inside =
          side === "north"
            ? { x: v, z: rect.minZ + 0.05 }
            : side === "south"
              ? { x: v, z: rect.maxZ - 0.05 }
              : side === "west"
                ? { x: rect.minX + 0.05, z: v }
                : { x: rect.maxX - 0.05, z: v };
        expect(
          caveTerrain.blockedAt(inside.x, inside.z),
          `${name} ${side} inside (${inside.x.toFixed(2)}, ${inside.z.toFixed(2)})`
        ).toBe(true);
      }
    }
  });

  it("stages performers on exactly the layout's station anchors", () => {
    const performers = grid.performers
      .filter((p) => p.id.startsWith("cave-fire-automaton-"))
      .sort((a, b) => a.tileX - b.tileX);
    expect(performers.map((p) => p.id)).toEqual([
      "cave-fire-automaton-dj",
      "cave-fire-automaton-ek",
      "cave-fire-automaton-fl",
    ]);
    performers.forEach((performer, i) => {
      const anchor = layout.stations[i]!;
      expect(Math.abs(performer.tileX * TILE - anchor.x)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(performer.tileY * TILE - anchor.z)).toBeLessThanOrEqual(0.05);
      expect(performer.elevation).toBe(SHORE_Y);
    });
  });

  it("derives the station anchors from the one shared expression", () => {
    const interiorWidth = layout.fire.maxX - layout.fire.minX;
    firstFireStationOffsets(interiorWidth).forEach((offset, i) => {
      expect(layout.stations[i]!.x).toBeCloseTo(
        layout.fire.minX + tileCentredOffset(offset.xMetres),
        5
      );
      expect(layout.stations[i]!.z).toBeCloseTo(
        layout.fire.minZ + tileCentredOffset(offset.zMetres),
        5
      );
    });
    // Every station stands on the blocked shore, north of the fissure.
    for (const station of layout.stations) {
      expect(station.z).toBeLessThan(layout.fissure.minZ);
      expect(caveTerrain.blockedAt(station.x, station.z)).toBe(true);
    }
  });

  it("sees the performers over the fissure from the front bench (eye = floor + 1.60)", () => {
    const front = layout.probes.terraces[2]!;
    const eye = terrain.elevationAt(front.x, front.z) + EYE_ABOVE_FLOOR;
    expect(eye).toBeCloseTo(TERRACE_Y[2]! + 1.6, 5);
    // The stations stand above the bed of the fissure between them, and below
    // the visitor's eye — the performance reads across the barrier, not up a
    // wall.
    expect(SHORE_Y).toBeGreaterThan(FISSURE_BED_Y);
    expect(eye).toBeGreaterThan(SHORE_Y);
  });

  it("covers every walkable fire-bay tile with a rendered floor rect", () => {
    expect(walkableBayTiles.length).toBeGreaterThan(500);
    const uncovered = walkableBayTiles.filter(
      (t) => !layout.floorRects.some((f) => inRectClosed(f.rect, t.x, t.z))
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

  it("leaves every fire door tile clear of every rendered wall", () => {
    const b = wing("cave-fire");
    const doors: { id: string; rect: WorldRect }[] = [];
    for (let ty = b.y; ty < b.y + b.height; ty++) {
      for (const tx of [b.x, b.x + b.width - 1]) {
        if (grid.tiles.get(tileKey(tx, ty))?.type !== "door") continue;
        doors.push({
          id: `cave-fire:${tx},${ty}`,
          rect: {
            minX: tx * TILE - TILE / 2,
            maxX: tx * TILE + TILE / 2,
            minZ: ty * TILE - TILE / 2,
            maxZ: ty * TILE + TILE / 2,
          },
        });
      }
    }
    expect(doors.length).toBeGreaterThanOrEqual(4);

    const EPS = 1e-6;
    const clashes: string[] = [];
    for (const door of doors) {
      for (const wall of layout.wallRects) {
        const overlaps =
          wall.rect.minX < door.rect.maxX - EPS &&
          wall.rect.maxX > door.rect.minX + EPS &&
          wall.rect.minZ < door.rect.maxZ - EPS &&
          wall.rect.maxZ > door.rect.minZ + EPS;
        if (overlaps) clashes.push(`${wall.id} over door ${door.id}`);
      }
    }
    expect(clashes.slice(0, 6)).toEqual([]);
  });

  it("throws instead of silently dropping to the datum inside the bay", () => {
    const rock = layout.probes.rock;
    expect(inRectClosed(layout.bayBounds, rock.x, rock.z)).toBe(true);
    expect(() => terrain.elevationAt(rock.x, rock.z)).toThrow(/no elevation zone/);
  });

  it("keeps every walkable tile rendered when cave-fire joins the suppressed set", () => {
    // suppressedSpans (museum-geometry-builder) routes corridor tiles inside
    // the bounding box of a PAIR of tile-suppressed wings into that wing's
    // bucket, which builds no tile geometry. Adding a second suppressed bay
    // grows those boxes; anything they swallow must be covered by an authored
    // layout instead, or the player walks on an invisible floor.
    const buckets = bucketMuseumTilesByRoom(grid);
    const rendered = new Set<string>();
    const collect = (dry: { floorBuckets: Map<string, { positions: { x: number; z: number }[] }> }) => {
      for (const bucket of dry.floorBuckets.values()) {
        for (const position of bucket.positions) {
          rendered.add(`${position.x.toFixed(3)},${position.z.toFixed(3)}`);
        }
      }
    };
    collect(buckets.corridorBucket);
    for (const dry of buckets.roomBuckets.values()) collect(dry);

    const waterLayout = buildDrownedGalleryLayout(grid)!;
    const authored = [...waterLayout.floorRects, ...layout.floorRects];
    const suppressed = grid.wings.filter(
      (w) => w.roomPresentation?.suppressTileGeometry
    );
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
