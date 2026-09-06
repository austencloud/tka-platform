/**
 * Terrain + layout invariants for the Earth Room (the Vulcan Cave earth bay).
 *
 * The same coupling invariants Water and Fire carry — one geometry source,
 * every walkable tile inside a rendered floor, no wall over a door, performer
 * anchors identical to layout anchors, a loud failure instead of a silent
 * datum-0 — plus the two the canyon adds: circular blocking that reads the SAME
 * Disc records the graybox renders, and the suppressedSpans regression that a
 * THIRD tile-suppressed bay makes possible.
 */
import { describe, it, expect } from "vitest";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
import {
  buildEarthCanyonLayout,
  createEarthCanyonTerrain,
  earthCanyonStationOffsets,
  inDisc,
  BOSS_RADIUS,
  BOSS_Y,
  DOOR_Y,
  FLOOR_DISC_Y,
  GULLY_MID_Y,
  PARAPET_HEIGHT,
  RIM_Y,
  SLAB_LIP_HEIGHT,
  SLAB_NOSE_OUTER_Y,
  SLAB_Y,
  VOID_RADIUS,
} from "$lib/features/museum/data/earth-canyon-layout";
import { buildFirstFireProcessionBay } from "$lib/features/museum/data/first-fire-procession-terrain";
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
const terrain = createEarthCanyonTerrain(grid)!;
const layout = buildEarthCanyonLayout(grid)!;
/** The composed program the game actually runs on. */
const caveTerrain = grid.terrain!;

const wing = (id: string) => grid.wings.find((w) => w.id === id)!.bounds;

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
    // Ownership, not the bounding box: the Fire corridor now runs 20 m south
    // of the room and a bbox grown to hold it swallows the neighbours.
    if (!layout.bayFootprint.some((rect) => inRectClosed(rect, x, z))) continue;
    out.push({ tx: tx!, ty: ty!, x, z });
  }
  return out;
}

const walkableBayTiles = bayTiles().filter((t) => isWalkable(t.tx, t.ty));

describe("earth canyon terrain", () => {
  it("exists for the cave plan and owns the earth bay", () => {
    expect(terrain).toBeTruthy();
    expect(layout.bosses).toHaveLength(3);
    expect(layout.stations).toHaveLength(3);
    expect(layout.canyonShelves).toHaveLength(4);
  });

  it("keeps the museum datum outside the earth bay", () => {
    const squeeze = wing("cave-squeeze");
    const x = (squeeze.x + squeeze.width / 2) * TILE;
    const z = (squeeze.y + squeeze.height / 2) * TILE;
    expect(caveTerrain.elevationAt(x, z)).toBe(0);
  });

  it("descends from the Fire door datum down the gully onto the rim", () => {
    expect(
      terrain.elevationAt(layout.gullyMouth.minX, layout.probes.gullyMouth.z)
    ).toBeCloseTo(DOOR_Y, 5);
    expect(
      terrain.elevationAt(layout.gullyMouth.maxX, layout.probes.gullyMouth.z)
    ).toBeCloseTo(GULLY_MID_Y, 5);
    expect(
      terrain.elevationAt(layout.gullyLower.maxX, layout.probes.gullyBend.z)
    ).toBeCloseTo(RIM_Y, 5);
    // The gully only ever descends, west → east.
    const run = [
      layout.gullyMouth,
      layout.gullyLower,
    ].flatMap((rect) => [
      { x: rect.minX, z: (rect.minZ + rect.maxZ) / 2 },
      { x: rect.maxX, z: (rect.minZ + rect.maxZ) / 2 },
    ]);
    let previous = DOOR_Y + 1e-9;
    for (const point of run) {
      const elevation = terrain.elevationAt(point.x, point.z);
      expect(elevation).toBeLessThanOrEqual(previous + 1e-9);
      previous = elevation;
    }
  });

  it("holds the whole rim ring on one datum", () => {
    for (const probe of [
      layout.probes.northLedge,
      layout.probes.westRim,
      layout.probes.southRim,
      layout.probes.eastRim,
    ]) {
      expect(
        terrain.elevationAt(probe.x, probe.z),
        `${probe.x.toFixed(2)}, ${probe.z.toFixed(2)}`
      ).toBeCloseTo(RIM_Y, 5);
      expect(caveTerrain.blockedAt(probe.x, probe.z)).toBe(false);
    }
  });

  it("lifts the slab's viewing apron 0.3 m above the rim and keeps it walkable", () => {
    const apron = layout.probes.slabApron;
    expect(terrain.elevationAt(apron.x, apron.z)).toBeCloseTo(SLAB_Y, 5);
    expect(caveTerrain.blockedAt(apron.x, apron.z)).toBe(false);
    expect(SLAB_Y - RIM_Y).toBeCloseTo(0.3, 5);
    // The apron hangs inside the void's circle — that is the whole point of it.
    expect(inDisc(layout.void_, apron.x, apron.z)).toBe(true);
  });

  it("blocks the slab's fractured nose, the parapet, the kerb and the void", () => {
    for (const probe of [
      layout.probes.slabNose,
      layout.probes.parapet,
      layout.probes.void_,
      layout.probes.boss,
      layout.probes.rock,
    ]) {
      expect(
        caveTerrain.blockedAt(probe.x, probe.z),
        `${probe.x.toFixed(2)}, ${probe.z.toFixed(2)}`
      ).toBe(true);
    }
    expect(
      caveTerrain.blockedAt(
        (layout.exitKerb.minX + layout.exitKerb.maxX) / 2,
        (layout.exitKerb.minZ + layout.exitKerb.maxZ) / 2
      )
    ).toBe(true);
    expect(terrain.elevationAt(layout.probes.boss.x, layout.probes.boss.z)).toBeCloseTo(
      BOSS_Y,
      5
    );
    expect(
      terrain.elevationAt(
        layout.void_.center.x,
        layout.void_.center.z - VOID_RADIUS * 0.6
      )
    ).toBeCloseTo(FLOOR_DISC_Y, 5);
  });

  it("blocks the parapet, the slab nose and the void edge at 0.25 m intervals", () => {
    const PROBE = 0.25;
    const edges: [string, WorldRect, "north" | "south" | "west" | "east"][] = [
      ["parapet", layout.parapet, "north"],
      ["parapet", layout.parapet, "south"],
      ["slab-nose", layout.slabNose, "north"],
      ["slab-nose", layout.slabNose, "west"],
      ["slab-nose", layout.slabNose, "east"],
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
    // The void's own circumference, walked in 0.25 m arcs: just inside the
    // circle is a drop, just outside it is the rim you stand on.
    const circumference = 2 * Math.PI * VOID_RADIUS;
    const steps = Math.ceil(circumference / PROBE);
    const insideSlab = (x: number, z: number) =>
      inRectClosed(layout.slabApron, x, z) || inRectClosed(layout.slabRamp, x, z);
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      const ix = layout.void_.center.x + dx * (VOID_RADIUS - 0.1);
      const iz = layout.void_.center.z + dz * (VOID_RADIUS - 0.1);
      if (insideSlab(ix, iz)) continue;
      expect(
        caveTerrain.blockedAt(ix, iz),
        `void interior at ${angle.toFixed(2)} rad`
      ).toBe(true);
    }
  });

  it("stages performers on exactly the layout's boss anchors", () => {
    const performers = grid.performers
      .filter((p) => p.id.startsWith("cave-earth-automaton-"))
      .sort((a, b) => a.tileX - b.tileX);
    expect(performers.map((p) => p.id)).toEqual([
      "cave-earth-automaton-g",
      "cave-earth-automaton-h",
      "cave-earth-automaton-i",
    ]);
    performers.forEach((performer, i) => {
      const anchor = layout.stations[i]!;
      expect(Math.abs(performer.tileX * TILE - anchor.x)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(performer.tileY * TILE - anchor.z)).toBeLessThanOrEqual(0.05);
      expect(performer.elevation).toBe(BOSS_Y);
    });
  });

  it("derives the boss anchors from the one shared expression", () => {
    const interiorWidth = layout.earth.maxX - layout.earth.minX;
    earthCanyonStationOffsets(interiorWidth).forEach((offset, i) => {
      expect(layout.stations[i]!.x).toBeCloseTo(
        layout.earth.minX + tileCentredOffset(offset.xMetres),
        5
      );
      expect(layout.stations[i]!.z).toBeCloseTo(
        layout.earth.minZ + tileCentredOffset(offset.zMetres),
        5
      );
    });
    // Every boss stands inside the void, on the disc six metres below the rim.
    for (const station of layout.stations) {
      expect(inDisc(layout.void_, station.x, station.z)).toBe(true);
      expect(caveTerrain.blockedAt(station.x, station.z)).toBe(true);
    }
    // Four metres apart, on one line south of the void centre.
    expect(layout.stations[1]!.x - layout.stations[0]!.x).toBeCloseTo(4.0, 1);
    expect(layout.stations[2]!.x - layout.stations[1]!.x).toBeCloseTo(4.0, 1);
    expect(layout.stations[0]!.z).toBeCloseTo(layout.stations[2]!.z, 5);
    expect(layout.stations[1]!.z).toBeGreaterThan(layout.void_.center.z);
  });

  it("sees the performers over the parapet and the lip (eye = floor + 1.60)", () => {
    // The barrier stands ~0.35 m in front of the eye and occludes everything
    // steeper than atan((1.60 - h) / 0.35). These caps are the design's.
    const STANDOFF = 0.35;
    const depression = (eyeY: number, out: number) =>
      Math.atan((eyeY - BOSS_Y) / out);
    const cap = (angle: number) => EYE_ABOVE_FLOOR - STANDOFF * Math.tan(angle);

    const rimEye = RIM_Y + EYE_ABOVE_FLOOR;
    expect(rimEye).toBeCloseTo(0.2, 5);
    const rimOut = layout.stations[1]!.z - (layout.void_.center.z - VOID_RADIUS * 0) + 0;
    expect(rimOut).toBeGreaterThan(0);
    // From the south rim: the eye is STANDOFF behind the void edge.
    const southRimOut =
      layout.void_.center.z + VOID_RADIUS - layout.stations[1]!.z + STANDOFF;
    expect(PARAPET_HEIGHT).toBeLessThan(cap(depression(rimEye, southRimOut)));

    const slabEye = SLAB_Y + EYE_ABOVE_FLOOR;
    expect(slabEye).toBeCloseTo(0.5, 5);
    const slabOut = layout.slabApron.minZ - layout.stations[1]!.z + STANDOFF;
    expect(slabOut).toBeGreaterThan(0);
    expect(SLAB_LIP_HEIGHT).toBeLessThan(cap(depression(slabEye, slabOut)));
    // And the drop is a real drop: the eye is metres above the boss tops.
    expect(rimEye - BOSS_Y).toBeGreaterThan(6.0);
  });

  it("covers every walkable earth-bay tile with a rendered floor rect", () => {
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

  it("leaves every earth door tile clear of every rendered wall", () => {
    const b = wing("cave-earth");
    const doors: { id: string; rect: WorldRect }[] = [];
    for (let ty = b.y; ty < b.y + b.height; ty++) {
      for (let tx = b.x; tx < b.x + b.width; tx++) {
        const edge =
          tx === b.x ||
          tx === b.x + b.width - 1 ||
          ty === b.y ||
          ty === b.y + b.height - 1;
        if (!edge) continue;
        if (grid.tiles.get(tileKey(tx, ty))?.type !== "door") continue;
        doors.push({
          id: `cave-earth:${tx},${ty}`,
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

  it("keeps the canyon shelves outside the terrain bay and below the rim", () => {
    for (const shelf of layout.canyonShelves) {
      expect(shelf.maxZ).toBeLessThanOrEqual(layout.earth.minZ);
    }
    // Each band recedes further north than the one before it.
    for (let i = 1; i < layout.canyonShelves.length; i++) {
      expect(layout.canyonShelves[i]!.maxZ).toBeLessThan(
        layout.canyonShelves[i - 1]!.maxZ
      );
    }
  });

  it("puts no rock fill inside the chamber — nothing stands on the rim", () => {
    // Rock fill renders from below the floor disc up to the cave roof, so a
    // single stray block on the rim is a 12 m wall. Three of them once stood
    // across the slab approach, because the slab and exit rects are derived
    // from metre offsets that do not land on tile-cell boundaries and the old
    // whole-cell carve never removed them. Rock is now the exact tile-centre
    // complement of the floor, so the chamber must contain none of it.
    const inChamber = layout.rockFill.filter(
      (rect) =>
        rect.maxX > layout.chamber.minX + 0.01 &&
        rect.maxZ > layout.chamber.minZ + 0.01
    );
    expect(
      inChamber.map((r) => `x[${r.minX},${r.maxX}] z[${r.minZ},${r.maxZ}]`)
    ).toEqual([]);
  });

  it("leaves the sightline from the slab apron to every boss unobstructed", () => {
    // The room's whole thesis is the overhead read. Walk the eye→boss segment
    // in 0.1 m steps and assert no rendered rock, wall or parapet box contains
    // any point on it: this is the test that would have caught the wall the
    // browser walk found.
    const eye = {
      x: (layout.slabApron.minX + layout.slabApron.maxX) / 2,
      y: SLAB_Y + EYE_ABOVE_FLOOR,
      z: (layout.slabApron.minZ + layout.slabApron.maxZ) / 2,
    };
    const occluders: { id: string; rect: WorldRect; minY: number; maxY: number }[] =
      [
        ...layout.rockFill.map((rect, i) => ({
          id: `rock-${i}`,
          rect,
          minY: FLOOR_DISC_Y - 1.0,
          maxY: 3.6,
        })),
        ...layout.wallRects.map((wall) => ({
          id: wall.id,
          rect: wall.rect,
          minY: wall.baseY,
          maxY: wall.topY,
        })),
        {
          id: "parapet-run",
          rect: layout.parapet,
          minY: RIM_Y,
          maxY: RIM_Y + PARAPET_HEIGHT,
        },
        {
          id: "slab-lip",
          rect: {
            minX: layout.slabApron.minX,
            maxX: layout.slabApron.maxX,
            minZ: layout.slabApron.minZ - 0.14,
            maxZ: layout.slabApron.minZ + 0.14,
          },
          minY: SLAB_Y,
          maxY: SLAB_Y + SLAB_LIP_HEIGHT,
        },
      ];

    /**
     * The nose is a tilted fracture plane, so it occludes anything BELOW its
     * surface at that z. A level nose put 2 m of stone straight across this
     * line, which is the defect this assertion exists to hold shut.
     */
    const noseTopAt = (z: number): number | null => {
      if (z < layout.slabNose.minZ || z > layout.slabNose.maxZ) return null;
      const t =
        (z - layout.slabNose.minZ) /
        (layout.slabNose.maxZ - layout.slabNose.minZ);
      return SLAB_NOSE_OUTER_Y + (SLAB_Y - SLAB_NOSE_OUTER_Y) * t;
    };

    const blockers: string[] = [];
    layout.stations.forEach((station, s) => {
      const target = { x: station.x, y: BOSS_Y + 1.35, z: station.z };
      const span = Math.hypot(target.x - eye.x, target.y - eye.y, target.z - eye.z);
      const steps = Math.ceil(span / 0.1);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = eye.x + (target.x - eye.x) * t;
        const py = eye.y + (target.y - eye.y) * t;
        const pz = eye.z + (target.z - eye.z) * t;
        for (const o of occluders) {
          if (py < o.minY || py > o.maxY) continue;
          if (!inRectClosed(o.rect, px, pz)) continue;
          blockers.push(
            `boss ${s} blocked by ${o.id} at (${px.toFixed(2)}, ${py.toFixed(2)}, ${pz.toFixed(2)})`
          );
        }
        if (px >= layout.slabNose.minX && px <= layout.slabNose.maxX) {
          const top = noseTopAt(pz);
          if (top !== null && py < top) {
            blockers.push(
              `boss ${s} blocked by slab-nose at (${px.toFixed(2)}, ${py.toFixed(2)}, ${pz.toFixed(2)}) — nose top ${top.toFixed(2)}`
            );
          }
        }
      }
    });
    expect([...new Set(blockers)].slice(0, 6)).toEqual([]);
  });

  it("keeps the daylight column clear of the slab apron", () => {
    // The column is rendered geometry the visitor can end up INSIDE, because
    // the apron hangs within the void. Sized to "contain the bosses" (r = 6) its
    // wall stood 0.4 m in front of the eye and greyed the entire performance
    // out — the room's critical defect. The radius is derived, and this is the
    // invariant it is derived to satisfy.
    const apronEyeZ =
      (layout.slabApron.minZ + layout.slabApron.maxZ) / 2 - layout.void_.center.z;
    expect(layout.avenShaftRadius).toBeLessThan(apronEyeZ - 1.0);
    expect(layout.avenShaftRadius).toBeGreaterThan(BOSS_RADIUS * 2);
    // And it must not reach the apron's nearest edge either.
    expect(layout.avenShaftRadius).toBeLessThanOrEqual(
      layout.slabApron.minZ - layout.void_.center.z - 1.5 + 1e-9
    );
  });

  it("throws instead of silently dropping to the datum inside the bay", () => {
    const rock = layout.probes.rock;
    expect(inRectClosed(layout.bayBounds, rock.x, rock.z)).toBe(true);
    expect(() => terrain.elevationAt(rock.x, rock.z)).toThrow(/no elevation zone/);
  });

  it("keeps every walkable tile rendered when cave-earth joins the suppressed set", () => {
    // suppressedSpans (museum-geometry-builder) routes corridor tiles inside the
    // bounding box of a PAIR of tile-suppressed wings into that wing's bucket,
    // which builds no tile geometry. A THIRD suppressed bay adds two more pairs
    // (water×earth and fire×earth) whose boxes are much larger than either;
    // anything they swallow must be covered by an authored layout instead, or
    // the player walks on an invisible floor.
    const suppressed = grid.wings.filter(
      (w) => w.roomPresentation?.suppressTileGeometry
    );
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
