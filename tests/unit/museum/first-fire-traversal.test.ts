/**
 * Headless playtest of The First Fire: the grotto's east door → the corridor →
 * the ember bridge over the lava stream → the bent darkening crack → all three
 * bench terraces → the exit stair → the Earth door.
 *
 * Drives the REAL stack (buildVulcanCaveFloorPlan + MuseumPhysicsProvider) with
 * repeated movePlayer calls, exactly like the in-game controller does, walking
 * a line-hugging path over the actual tile grid (honouring solid tiles AND
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
  buildFirstFireLayout,
  BRIDGE_Y,
  TERRACE_Y,
} from "$lib/features/museum/data/first-fire-layout";

const TILE = TILE_METRES;
const STANDING_Y = 0.85;

const plan = buildVulcanCaveFloorPlan();
const grid = plan.grid;
const terrain = grid.terrain!;
const layout = buildFirstFireLayout(grid)!;

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
const grottoEastDoor = doorCenterTile("cave-water", "east");
const fireWestDoor = doorCenterTile("cave-fire", "west");
const fireEastDoor = doorCenterTile("cave-fire", "east");

const ROUTE: TileCoord[] = [
  grottoEastDoor,
  fireWestDoor,
  tileOfWorld(layout.probes.bridge),
  tileOfWorld({
    x: (layout.crackWest.minX + layout.crackWest.maxX) / 2,
    z: (layout.crackWest.minZ + layout.crackWest.maxZ) / 2,
  }),
  tileOfWorld({
    x: (layout.crackEast.minX + layout.crackEast.maxX) / 2,
    z: (layout.crackEast.minZ + layout.crackEast.maxZ) / 2,
  }),
  tileOfWorld(layout.probes.terraces[0]!),
  tileOfWorld(layout.probes.terraces[1]!),
  tileOfWorld(layout.probes.terraces[2]!),
  tileOfWorld(layout.probes.terraces[0]!),
  tileOfWorld(layout.probes.exitStair),
  fireEastDoor,
];

describe("first fire traversal (headless playtest)", () => {
  let samples: Sample[];

  beforeAll(() => {
    samples = walk(ROUTE);
  });

  it("walks the whole route from the grotto door to the Earth door", () => {
    expect(samples.length).toBeGreaterThan(100);
    const target = worldOfTile(fireEastDoor);
    const last = samples.at(-1)!;
    expect(Math.hypot(last.x - target.x, last.z - target.z)).toBeLessThan(0.1);
  });

  it("crosses the ember bridge at the bridge datum", () => {
    const onBridge = samples.filter(
      (s) =>
        s.x >= layout.bridge.minX &&
        s.x <= layout.bridge.maxX &&
        s.z >= layout.bridge.minZ &&
        s.z <= layout.bridge.maxZ
    );
    expect(onBridge.length).toBeGreaterThan(10);
    for (const s of onBridge) {
      expect(s.elevation).toBeCloseTo(BRIDGE_Y, 5);
      expect(s.y).toBeCloseTo(BRIDGE_Y + STANDING_Y, 5);
    }
  });

  it("stands on all three bench terraces", () => {
    layout.terraces.forEach((terrace, i) => {
      const onTerrace = samples.filter(
        (s) =>
          s.x >= terrace.minX &&
          s.x <= terrace.maxX &&
          s.z >= terrace.minZ &&
          s.z <= terrace.maxZ
      );
      expect(onTerrace.length, `terrace ${i}`).toBeGreaterThan(5);
      for (const s of onTerrace) {
        expect(s.elevation).toBeCloseTo(TERRACE_Y[i]!, 5);
      }
    });
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

  it("never walks through the fissure, the lava or the shore", () => {
    for (const s of samples) {
      expect(terrain.blockedAt(s.x, s.z)).toBe(false);
    }
  });

  it("reaches the Earth door at museum datum elevation (~0)", () => {
    const exit = worldOfTile(fireEastDoor);
    expect(terrain.elevationAt(exit.x, exit.z)).toBeCloseTo(0, 1);
  });

  it("keeps the fissure a barrier between the front bench and the shore", () => {
    const start = layout.probes.terraces[2]!;
    const physics = new MuseumPhysicsProvider(grid, TILE, {
      x: start.x,
      y: 0,
      z: start.z,
    });
    const target = layout.probes.shore;
    for (let i = 0; i < 400; i++) {
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
    expect(physics.getPlayerPosition().z).toBeGreaterThanOrEqual(
      layout.fissure.maxZ - 0.01
    );
  });

  it("keeps every performer station unreachable from the benches", () => {
    const from = tileOfWorld(layout.probes.terraces[2]!);
    for (const station of layout.stations) {
      expect(() => bfsPath(from, tileOfWorld(station))).toThrow();
    }
  });

  it("reaches the exit stair from every terrace", () => {
    const exit = tileOfWorld(layout.probes.exitStair);
    for (const probe of layout.probes.terraces) {
      expect(() => bfsPath(tileOfWorld(probe), exit)).not.toThrow();
    }
  });
});
