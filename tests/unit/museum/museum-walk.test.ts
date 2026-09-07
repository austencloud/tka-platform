/**
 * One walk, one grid.
 *
 * The museum used to be three grids on three routes — the 16-room graph with
 * the whole Vulcan Cave collapsed into a single placeholder room, the eleven
 * authored cave rooms on a review route, and a lobby plan on a third. This
 * suite is the guard on the composition that joined them: not "the edge list
 * looks right" but "walk it and you get everywhere", which is a different
 * claim and the only one that matters.
 */
import { describe, expect, it } from "vitest";
import { buildMuseumGrid } from "../../../src/lib/features/museum/services/museum-grid-builder";
import { GRID_CONFIG } from "../../../src/lib/features/museum/data/museum-room-graph";
import {
  MUSEUM_WALK_ROOMS,
  MUSEUM_WALK_EDGES,
  attachMuseumWalkTerrain,
} from "../../../src/lib/features/museum/data/museum-walk";
import { isWalkable } from "../../../src/lib/features/museum/domain/tile-registry";
import { bucketMuseumTilesByRoom } from "../../../src/lib/features/museum/services/museum-geometry-builder";
import { tileKey } from "../../../src/lib/features/museum/domain/museum-grid-types";
import type { MuseumGrid } from "../../../src/lib/features/museum/domain/museum-grid-types";
import { buildMoonLayout } from "../../../src/lib/features/museum/data/moon-layout";

const build = buildMuseumGrid(
  MUSEUM_WALK_ROOMS,
  MUSEUM_WALK_EDGES,
  GRID_CONFIG
);
const grid = build.grid;
attachMuseumWalkTerrain(grid);

/**
 * Every tile the visitor can stand on, reachable from the spawn by walking.
 *
 * Four-connected on purpose: a diagonal squeeze between two wall corners is not
 * a doorway, and counting it as one would let this suite pass on a museum the
 * character controller cannot actually cross.
 */
function reachableFromSpawn(g: MuseumGrid): Set<string> {
  const scale = g.tileScale;
  const open = (x: number, y: number): boolean => {
    const tile = g.tiles.get(tileKey(x, y));
    if (!tile || !isWalkable(tile.type)) return false;
    // An authored bay can block floor the tile map calls open — the Sundial's
    // collapse ring, the Moon's rock corners, the drowned gallery's deep water.
    return !g.terrain?.blockedAt(x * scale, y * scale);
  };

  const seen = new Set<string>();
  const queue: [number, number][] = [[g.spawn.x, g.spawn.y]];
  if (!open(g.spawn.x, g.spawn.y)) {
    throw new Error(`spawn (${g.spawn.x}, ${g.spawn.y}) is not walkable`);
  }
  seen.add(tileKey(g.spawn.x, g.spawn.y));
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const key = tileKey(nx, ny);
      if (seen.has(key) || !open(nx, ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

describe("the museum as one walk", () => {
  it("lays out without validation errors", () => {
    expect(build.validation.errors).toEqual([]);
    expect(build.validation.valid).toBe(true);
  });

  it("contains every authored room, cave chambers included", () => {
    const ids = new Set(grid.wings.map((w) => w.id));
    for (const id of [
      "entrance",
      "cave-threshold",
      "cave-squeeze",
      "cave-water-approach",
      "cave-water-gallery",
      "cave-water",
      "cave-fire",
      "cave-earth",
      "cave-air",
      "cave-sun",
      "cave-moon",
      "egypt-threshold",
      "egyptian",
      "renaissance",
      "victorian",
      "digital",
      "suppression",
      "cross-reference",
      "crumble",
      "gallery",
      "fear",
      "isolation",
      "collaboration",
      "gift-shop",
      "vtg-wing",
      "construction-zone",
      "janitor",
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
    // The placeholder that stood for the whole cave must be gone: leave it in
    // and the museum has two Vulcan Caves, one of them empty.
    expect(ids.has("vulcan-cave")).toBe(false);
  });

  it("leaves no door without a corridor to walk through", () => {
    // A door segment whose edgeId has no matching edge is stamped into the wall
    // and never routed — the exact defect this composition was built to fix at
    // the cave threshold and the Egypt threshold.
    const edgeIds = new Set(
      MUSEUM_WALK_EDGES.map((edge) => `${edge.from}->${edge.to}`)
    );
    for (const room of MUSEUM_WALK_ROOMS) {
      for (const [wall, definition] of Object.entries(room.walls ?? {})) {
        for (const segment of definition?.segments ?? []) {
          if (segment.type !== "door") continue;
          expect(
            edgeIds.has(segment.edgeId),
            `${room.id}.${wall} door "${segment.edgeId}"`
          ).toBe(true);
        }
      }
    }
  });

  it("reaches every room on foot from the spawn", () => {
    const reachable = reachableFromSpawn(grid);
    for (const wing of grid.wings) {
      const { x, y, width, height } = wing.bounds;
      let hit = 0;
      for (let ty = y; ty < y + height; ty++) {
        for (let tx = x; tx < x + width; tx++) {
          if (reachable.has(tileKey(tx, ty))) hit++;
        }
      }
      // Not "one tile touched" — a corridor clipping a corner would pass that.
      // 20 tiles is 5 m² of floor actually stood on inside the room.
      expect(hit, `${wing.id} reachable tiles`).toBeGreaterThan(20);
    }
  });

  it("draws the hallways instead of leaving them as void", () => {
    // Corridor tiles belong to no wing, so they go to the always-loaded corridor
    // chunk — UNLESS a suppressed-wing span steals them, and a stolen tile draws
    // nothing at all. Eight cave rooms suppress their tile geometry, and the
    // pairwise union boxes of all eight blanketed the museum: every hallway in
    // the building, cave or not, was routed into a bucket that renders nothing.
    // The visitor walked hallways with no floor, no walls, no ceiling.
    // Measured: 1906 corridor tiles reach the chunk now. Under the old spans
    // 1518 of them — slightly more than half of everything outside a room —
    // were stolen and drawn as nothing, leaving 1495. The threshold sits above
    // that number on purpose, so a regression cannot squeak past it.
    const buckets = bucketMuseumTilesByRoom(grid);
    expect(buckets.corridorBucket.totalTiles).toBeGreaterThan(1800);
    expect(buckets.corridorBucket.totalFloorInstances).toBeGreaterThan(1800);
    expect(buckets.corridorBucket.totalWallInstances).toBeGreaterThan(600);
  });

  it("carries the cave's terrain, so the chambers behave as authored", () => {
    expect(grid.terrain).toBeTruthy();
    // The Moon's low-gravity plain and the Sundial's collapse ring are the two
    // loudest programs; if the composition dropped terrain they would be flat
    // floor and nothing would look wrong until you walked it.
    const moon = buildMoonLayout(grid)!;
    // Just outside the walkable plain, on a diagonal so it cannot be mistaken
    // for a door band — rock, and it has to stay rock.
    const out = (moon.walkRadius + 5) / Math.SQRT2;
    expect(
      grid.terrain!.blockedAt(moon.centre.x + out, moon.centre.z + out)
    ).toBe(true);
    // And the plain itself is not.
    expect(grid.terrain!.blockedAt(moon.centre.x, moon.centre.z)).toBe(false);
  });
});
