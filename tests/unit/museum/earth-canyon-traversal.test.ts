/**
 * Headless playtest of the Earth Room: Fire's east door → the corridor → the
 * grass gully and its bend → the north ledge → the full rim circuit, clockwise
 * and back → the slab overlook's viewing apron → the exit ramp → the Air door.
 *
 * Drives the REAL stack (buildVulcanCaveFloorPlan + MuseumPhysicsProvider) with
 * repeated movePlayer calls, exactly like the in-game controller does, walking a
 * line-hugging path over the actual tile grid (honouring solid tiles AND
 * terrain.blockedAt, with a BFS detour only around a real obstruction).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
import {
  MuseumPhysicsProvider,
  SOLID_TYPES,
} from "$lib/features/museum/services/museum-physics-provider";
import { tileKey } from "$lib/features/museum/domain/museum-grid-types";
import { TILE_METRES } from "$lib/features/museum/data/drowned-gallery-terrain";
import {
  buildEarthCanyonLayout,
  RIM_Y,
  SLAB_Y,
} from "$lib/features/museum/data/earth-canyon-layout";

const TILE = TILE_METRES;
const STANDING_Y = 0.85;

const plan = buildVulcanCaveFloorPlan();
const grid = plan.grid;
const terrain = grid.terrain!;
const layout = buildEarthCanyonLayout(grid)!;

type TileCoord = { x: number; y: number };
type WorldPoint = { x: number; z: number };

function wingBounds(id: string) {
  const w = grid.wings.find((wing) => wing.id === id);
  if (!w) throw new Error(`missing wing "${id}"`);
  return w.bounds;
}

function doorCenterTile(
  roomId: string,
  wall: "north" | "south" | "east" | "west"
): TileCoord {
  const { x, y, width, height } = wingBounds(roomId);
  const tiles: TileCoord[] = [];
  if (wall === "north" || wall === "south") {
    const wallY = wall === "north" ? y : y + height - 1;
    for (let wx = x; wx < x + width; wx++) {
      if (grid.tiles.get(tileKey(wx, wallY))?.type === "door")
        tiles.push({ x: wx, y: wallY });
    }
  } else {
    const wallX = wall === "west" ? x : x + width - 1;
    for (let wy = y; wy < y + height; wy++) {
      if (grid.tiles.get(tileKey(wallX, wy))?.type === "door")
        tiles.push({ x: wallX, y: wy });
    }
  }
  if (tiles.length === 0)
    throw new Error(`No ${wall} door in cave room "${roomId}"`);
  return tiles[Math.floor(tiles.length / 2)]!;
}

function worldOfTile(t: TileCoord): WorldPoint {
  return { x: t.x * TILE, z: t.y * TILE };
}

function tileOfWorld(p: WorldPoint): TileCoord {
  return { x: Math.round(p.x / TILE), y: Math.round(p.z / TILE) };
}

function isWalkableTile(tx: number, ty: number): boolean {
  const tile = grid.tiles.get(tileKey(tx, ty));
  if (!tile || SOLID_TYPES.has(tile.type)) return false;
  const w = worldOfTile({ x: tx, y: ty });
  return !terrain.blockedAt(w.x, w.z);
}

/** Shortest walkable path (4-directional) honouring solids AND terrain.blockedAt. */
function bfsPath(from: TileCoord, to: TileCoord): TileCoord[] {
  if (!isWalkableTile(from.x, from.y))
    throw new Error(`BFS start (${from.x},${from.y}) is not walkable`);
  if (!isWalkableTile(to.x, to.y))
    throw new Error(`BFS target (${to.x},${to.y}) is not walkable`);
  const key = (p: TileCoord) => `${p.x},${p.y}`;
  const visited = new Set<string>([key(from)]);
  const prev = new Map<string, TileCoord>();
  const queue: TileCoord[] = [from];
  let head = 0;
  const DIRS: TileCoord[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  while (head < queue.length) {
    const cur = queue[head++]!;
    if (cur.x === to.x && cur.y === to.y) {
      const path: TileCoord[] = [];
      let node: TileCoord | undefined = cur;
      while (node) {
        path.unshift(node);
        node = prev.get(key(node));
      }
      return path;
    }
    for (const d of DIRS) {
      const nxt = { x: cur.x + d.x, y: cur.y + d.y };
      const k = key(nxt);
      if (visited.has(k) || !isWalkableTile(nxt.x, nxt.y)) continue;
      visited.add(k);
      prev.set(k, cur);
      queue.push(nxt);
    }
  }
  throw new Error(
    `No walkable path from (${from.x},${from.y}) to (${to.x},${to.y}) — the route is physically severed`
  );
}

function greedyPath(from: TileCoord, to: TileCoord): TileCoord[] {
  const path: TileCoord[] = [from];
  let cur = from;
  let guard = 0;
  while ((cur.x !== to.x || cur.y !== to.y) && guard++ < 20000) {
    const dx = to.x - cur.x;
    const dy = to.y - cur.y;
    const stepX: TileCoord = { x: cur.x + Math.sign(dx), y: cur.y };
    const stepY: TileCoord = { x: cur.x, y: cur.y + Math.sign(dy) };
    const primary = Math.abs(dx) >= Math.abs(dy) ? stepX : stepY;
    const secondary = primary === stepX ? stepY : stepX;
    let next: TileCoord | null = null;
    if (primary.x !== cur.x || primary.y !== cur.y) {
      if (isWalkableTile(primary.x, primary.y)) next = primary;
    }
    if (!next && (secondary.x !== cur.x || secondary.y !== cur.y)) {
      if (isWalkableTile(secondary.x, secondary.y)) next = secondary;
    }
    if (!next) {
      const detour = bfsPath(cur, to);
      path.push(...detour.slice(1));
      cur = to;
      break;
    }
    cur = next;
    path.push(cur);
  }
  if (cur.x !== to.x || cur.y !== to.y)
    throw new Error(`greedyPath stalled short of (${to.x},${to.y})`);
  return path;
}

interface Sample {
  x: number;
  z: number;
  y: number;
  elevation: number;
}

function walkWaypoints(
  physics: MuseumPhysicsProvider,
  waypoints: WorldPoint[]
): Sample[] {
  const samples: Sample[] = [];
  for (const wp of waypoints) {
    let guard = 0;
    while (guard++ < 200) {
      const pos = physics.getPlayerPosition();
      const dx = wp.x - pos.x;
      const dz = wp.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.06) break;
      const step = Math.min(0.05, dist);
      physics.movePlayer(
        { x: (dx / dist) * step, y: -0.2, z: (dz / dist) * step },
        1 / 60
      );
      const p = physics.getPlayerPosition();
      samples.push({
        x: p.x,
        z: p.z,
        y: p.y,
        elevation: terrain.elevationAt(p.x, p.z),
      });
    }
    const finalPos = physics.getPlayerPosition();
    const finalDist = Math.hypot(wp.x - finalPos.x, wp.z - finalPos.z);
    if (finalDist >= 0.06) {
      throw new Error(
        `Stalled short of waypoint (${wp.x.toFixed(2)}, ${wp.z.toFixed(2)}): ` +
          `stuck at (${finalPos.x.toFixed(2)}, ${finalPos.y.toFixed(2)}, ${finalPos.z.toFixed(2)}), ` +
          `elevationAt(stuck point)=${terrain.elevationAt(finalPos.x, finalPos.z).toFixed(2)}`
      );
    }
  }
  return samples;
}

function walk(waypoints: TileCoord[]): Sample[] {
  const tilePath: TileCoord[] = [waypoints[0]!];
  for (let i = 0; i < waypoints.length - 1; i++) {
    tilePath.push(...greedyPath(waypoints[i]!, waypoints[i + 1]!).slice(1));
  }
  const start = worldOfTile(tilePath[0]!);
  const physics = new MuseumPhysicsProvider(grid, TILE, {
    x: start.x,
    y: 0,
    z: start.z,
  });
  return walkWaypoints(physics, tilePath.slice(1).map(worldOfTile));
}

// ── Route waypoints, in walk order ──────────────────────────────────────────
const fireEastDoor = doorCenterTile("cave-fire", "east");
const earthWestDoor = doorCenterTile("cave-earth", "west");
const earthSouthDoor = doorCenterTile("cave-earth", "south");

const ledge = tileOfWorld(layout.probes.northLedge);
const westRim = tileOfWorld(layout.probes.westRim);
const southRim = tileOfWorld(layout.probes.southRim);
const eastRim = tileOfWorld(layout.probes.eastRim);
/**
 * The apron is a 4 m tongue hanging inside the void, so it is entered and left
 * straight up its ramp — sidling onto it along the drop edge is exactly what
 * the void is there to prevent.
 */
const slabRamp = tileOfWorld({
  x: (layout.slabRamp.minX + layout.slabRamp.maxX) / 2,
  z: (layout.slabRamp.minZ + layout.slabRamp.maxZ) / 2,
});
/** The rim tile the ramp comes off, a metre back from the drop. */
const slabFoot = tileOfWorld({
  x: (layout.slabRamp.minX + layout.slabRamp.maxX) / 2,
  z: layout.slabRamp.maxZ + 1.0,
});

const ROUTE: TileCoord[] = [
  fireEastDoor,
  earthWestDoor,
  tileOfWorld(layout.probes.gullyMouth),
  tileOfWorld(layout.probes.gullyBend),
  ledge,
  // Clockwise round the rim (west → south → east) and back the other way.
  westRim,
  southRim,
  eastRim,
  ledge,
  eastRim,
  southRim,
  slabFoot,
  slabRamp,
  tileOfWorld(layout.probes.slabApron),
  slabRamp,
  slabFoot,
  southRim,
  tileOfWorld(layout.probes.exitRamp),
  earthSouthDoor,
];

describe("earth canyon traversal (headless playtest)", () => {
  let samples: Sample[];

  beforeAll(() => {
    samples = walk(ROUTE);
  });

  it("walks the whole route from Fire's door to the Air door", () => {
    expect(samples.length).toBeGreaterThan(300);
    const target = worldOfTile(earthSouthDoor);
    const last = samples.at(-1)!;
    expect(Math.hypot(last.x - target.x, last.z - target.z)).toBeLessThan(0.1);
  });

  it("holds the rim datum all the way round the circuit", () => {
    const onLedge = samples.filter(
      (s) =>
        s.x >= layout.northLedge.minX &&
        s.x <= layout.northLedge.maxX &&
        s.z >= layout.northLedge.minZ &&
        s.z <= layout.northLedge.maxZ
    );
    expect(onLedge.length).toBeGreaterThan(10);
    for (const s of onLedge) {
      expect(s.elevation).toBeCloseTo(RIM_Y, 5);
      expect(s.y).toBeCloseTo(RIM_Y + STANDING_Y, 5);
    }
    for (const rim of [layout.westRim, layout.eastRim]) {
      const on = samples.filter(
        (s) =>
          s.x >= rim.minX &&
          s.x <= rim.maxX &&
          s.z >= rim.minZ &&
          s.z <= rim.maxZ &&
          s.z < layout.exitKerb.minZ
      );
      expect(on.length).toBeGreaterThan(5);
      for (const s of on) expect(s.elevation).toBeCloseTo(RIM_Y, 5);
    }
  });

  it("stands on the slab's viewing apron, 0.3 m above the rim", () => {
    const onApron = samples.filter(
      (s) =>
        s.x >= layout.slabApron.minX &&
        s.x <= layout.slabApron.maxX &&
        s.z >= layout.slabApron.minZ &&
        s.z <= layout.slabApron.maxZ
    );
    expect(onApron.length).toBeGreaterThan(3);
    for (const s of onApron) expect(s.elevation).toBeCloseTo(SLAB_Y, 5);
  });

  it("never pops the floor more than 0.6 m between successive steps", () => {
    for (let i = 1; i < samples.length; i++) {
      const jump = Math.abs(samples[i]!.elevation - samples[i - 1]!.elevation);
      if (jump > 0.6) {
        throw new Error(
          `Elevation cliff of ${jump.toFixed(2)} m between ` +
            `(${samples[i - 1]!.x.toFixed(2)}, ${samples[i - 1]!.z.toFixed(2)}) elev=${samples[i - 1]!.elevation.toFixed(2)} and ` +
            `(${samples[i]!.x.toFixed(2)}, ${samples[i]!.z.toFixed(2)}) elev=${samples[i]!.elevation.toFixed(2)}`
        );
      }
    }
  });

  it("never walks into the void, the parapet or the slab's fractured nose", () => {
    for (const s of samples) {
      expect(terrain.blockedAt(s.x, s.z)).toBe(false);
    }
  });

  it("reaches the Air door at museum datum elevation (~0)", () => {
    const exit = worldOfTile(earthSouthDoor);
    expect(terrain.elevationAt(exit.x, exit.z)).toBeCloseTo(0, 1);
  });

  it("keeps the void a barrier: walking at the performers stops at the rim", () => {
    const start = layout.probes.northLedge;
    const physics = new MuseumPhysicsProvider(grid, TILE, {
      x: start.x,
      y: 0,
      z: start.z,
    });
    const target = layout.stations[1]!;
    for (let i = 0; i < 600; i++) {
      const pos = physics.getPlayerPosition();
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.1) break;
      const step = Math.min(0.05, dist);
      physics.movePlayer(
        { x: (dx / dist) * step, y: -0.2, z: (dz / dist) * step },
        1 / 60
      );
      const p = physics.getPlayerPosition();
      expect(terrain.blockedAt(p.x, p.z)).toBe(false);
    }
    const end = physics.getPlayerPosition();
    expect(
      Math.hypot(end.x - layout.void_.center.x, end.z - layout.void_.center.z)
    ).toBeGreaterThan(layout.void_.radius - 0.6);
  });

  it("keeps every performer unreachable from the rim — there is no stair", () => {
    const from = tileOfWorld(layout.probes.northLedge);
    for (const station of layout.stations) {
      expect(() => bfsPath(from, tileOfWorld(station))).toThrow();
    }
  });

  it("closes the rim circuit: every rim probe reaches every other", () => {
    const probes = [ledge, westRim, southRim, eastRim];
    for (const a of probes) {
      for (const b of probes) {
        expect(() => bfsPath(a, b)).not.toThrow();
      }
    }
  });

  it("reaches the exit ramp and the slab apron from the arrival ledge", () => {
    for (const target of [
      tileOfWorld(layout.probes.exitRamp),
      tileOfWorld(layout.probes.slabApron),
    ]) {
      expect(() => bfsPath(ledge, target)).not.toThrow();
    }
  });
});
