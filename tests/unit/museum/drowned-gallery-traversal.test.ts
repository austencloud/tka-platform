/**
 * Headless playtest of the Vulcan Cave water route: spawn → squeeze north
 * door → flooded approach → sump → drowned gallery (grotto) → cave-fire west
 * door. Drives the REAL stack (buildVulcanCaveFloorPlan + MuseumPhysicsProvider)
 * with repeated movePlayer calls, exactly like the in-game controller does.
 *
 * A line-hugging walk over the actual tile grid (honoring both solid tiles
 * AND terrain.blockedAt, falling back to BFS only to detour around a real
 * obstruction) finds the walkable route between door tiles - this mirrors
 * what a real player walks, including any corridor jog the layout/
 * corridor-router introduces between misaligned doors. If the walked path
 * exits every elevation zone, elevationAt falls back to the museum datum (0)
 * and the player gets clamped up onto "dry land" mid-water - exactly the bug
 * Austen hit.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
import { MuseumPhysicsProvider, SOLID_TYPES } from "$lib/features/museum/services/museum-physics-provider";
import { tileKey } from "$lib/features/museum/domain/museum-grid-types";
import {
  buildDrownedGalleryLayout,
  SUMP_FLOOR_Y,
} from "$lib/features/museum/data/drowned-gallery-terrain";

const TILE = 0.5;
const STANDING_Y = 0.85;

const plan = buildVulcanCaveFloorPlan();
const grid = plan.grid;
const terrain = grid.terrain!;
const layout = buildDrownedGalleryLayout(grid)!;

type TileCoord = { x: number; y: number };
type WorldPoint = { x: number; z: number };

function wingBounds(id: string) {
  const w = grid.wings.find((wing) => wing.id === id);
  if (!w) throw new Error(`missing wing "${id}"`);
  return w.bounds;
}

/** Door tiles on a room wall - same scan as vulcan-cave-floor-plan's findDoorCenter. */
function doorTiles(
  roomId: string,
  wall: "north" | "south" | "east" | "west"
): TileCoord[] {
  const { x, y, width, height } = wingBounds(roomId);
  const tiles: TileCoord[] = [];
  if (wall === "north" || wall === "south") {
    const wallY = wall === "north" ? y : y + height - 1;
    for (let wx = x; wx < x + width; wx++) {
      if (grid.tiles.get(tileKey(wx, wallY))?.type === "door") tiles.push({ x: wx, y: wallY });
    }
  } else {
    const wallX = wall === "west" ? x : x + width - 1;
    for (let wy = y; wy < y + height; wy++) {
      if (grid.tiles.get(tileKey(wallX, wy))?.type === "door") tiles.push({ x: wallX, y: wy });
    }
  }
  if (tiles.length === 0) throw new Error(`No ${wall} door in cave room "${roomId}"`);
  return tiles;
}

function doorCenterTile(roomId: string, wall: "north" | "south" | "east" | "west"): TileCoord {
  const tiles = doorTiles(roomId, wall);
  return tiles[Math.floor(tiles.length / 2)]!;
}

// World conversion matches the REAL engine's convention (Museum3DScene.svelte,
// museum-player-controller.ts, museum-physics-provider.ts, and
// drowned-gallery-terrain.ts's interiorWorldRect): worldCoord = tileIndex * TILE,
// no half-tile centering offset. (vulcan-cave-floor-plan.ts's findDoorCenter
// uses a +0.5 offset, but that's for the 2D floor-plan minimap overlay only -
// not the 3D world/physics space this test drives.)
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
  if (terrain.blockedAt(w.x, w.z)) return false;
  return true;
}

/** Shortest walkable path (4-directional) honoring solids AND terrain.blockedAt. */
function bfsPath(from: TileCoord, to: TileCoord): TileCoord[] {
  if (!isWalkableTile(from.x, from.y)) {
    throw new Error(`BFS start (${from.x},${from.y}) is not walkable`);
  }
  if (!isWalkableTile(to.x, to.y)) {
    throw new Error(`BFS target (${to.x},${to.y}) is not walkable`);
  }
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
    `No walkable path from (${from.x},${from.y}) to (${to.x},${to.y}) - the route is physically severed`
  );
}

/**
 * Line-hugging walk toward a target: each step advances whichever axis (x or
 * y) is currently furthest from the target, falling back to the other axis
 * on a block, and to a full BFS detour only when both are blocked. This
 * mirrors how a real player (or movePlayer's own wall-slide) actually
 * crosses the room - hugging the direct line - unlike plain BFS, which is
 * free to return a degenerate path that sweeps one axis fully before the
 * other (physically unrealistic, and prone to clipping a zone edge that a
 * real player's route would never touch).
 */
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
      // Genuinely blocked on both preferred axes - detour around it.
      const detour = bfsPath(cur, to);
      path.push(...detour.slice(1));
      cur = to;
      break;
    }
    cur = next;
    path.push(cur);
  }
  if (cur.x !== to.x || cur.y !== to.y) {
    throw new Error(`greedyPath stalled short of (${to.x},${to.y})`);
  }
  return path;
}

interface Sample {
  x: number;
  z: number;
  y: number;
  elevation: number;
}

/** Drives movePlayer toward each waypoint in turn. Throws with diagnostics on stall. */
function walkWaypoints(physics: MuseumPhysicsProvider, waypoints: WorldPoint[]): Sample[] {
  const samples: Sample[] = [];
  for (const wp of waypoints) {
    let guard = 0;
    const maxSteps = 200;
    while (guard++ < maxSteps) {
      const pos = physics.getPlayerPosition();
      const dx = wp.x - pos.x;
      const dz = wp.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.06) break;
      const step = Math.min(0.05, dist);
      physics.movePlayer({ x: (dx / dist) * step, y: -0.2, z: (dz / dist) * step }, 1 / 60);
      const p = physics.getPlayerPosition();
      samples.push({ x: p.x, z: p.z, y: p.y, elevation: terrain.elevationAt(p.x, p.z) });
    }
    const finalPos = physics.getPlayerPosition();
    const finalDist = Math.hypot(wp.x - finalPos.x, wp.z - finalPos.z);
    if (finalDist >= 0.06) {
      const nearby = terrain.elevationAt(finalPos.x, finalPos.z);
      throw new Error(
        `Stalled short of waypoint (${wp.x.toFixed(2)}, ${wp.z.toFixed(2)}): ` +
          `stuck at (${finalPos.x.toFixed(2)}, ${finalPos.y.toFixed(2)}, ${finalPos.z.toFixed(2)}), ` +
          `elevationAt(stuck point)=${nearby.toFixed(2)}`
      );
    }
  }
  return samples;
}

// Door waypoints, in walk order: squeeze -> approach -> sump -> grotto -> fire.
const squeezeNorthDoor = doorCenterTile("cave-squeeze", "north"); // squeeze->approach
const approachSouthDoor = doorCenterTile("cave-water-approach", "south"); // squeeze->approach
const approachNorthDoor = doorCenterTile("cave-water-approach", "north"); // approach->sump
const sumpSouthDoor = doorCenterTile("cave-water-sump", "south"); // approach->sump
const sumpNorthDoor = doorCenterTile("cave-water-sump", "north"); // sump->grotto
const grottoSouthDoor = doorCenterTile("cave-water", "south"); // sump->grotto
const grottoEastDoor = doorCenterTile("cave-water", "east"); // grotto->fire
const fireWestDoor = doorCenterTile("cave-fire", "west"); // grotto->fire

// Grotto is wide open past the door. The surfacing-steps ramp is a narrow
// strip directly ahead of the door (see drowned-gallery-terrain.ts) with the
// flat causeway starting further west (causewayProbe) - so the route climbs
// straight out of the door first (staying on the steps until level with the
// causeway), THEN turns west along the causeway toward the east exit. Cutting
// diagonally across the steps immediately would clip the narrow ramp's edge.
const doorWorldX = worldOfTile(grottoSouthDoor).x;
const topOfSteps = tileOfWorld({ x: doorWorldX, z: layout.grotto.maxZ - 4 });
const causewayTile = tileOfWorld(layout.causewayProbe);

const ROUTE_DOORS: TileCoord[] = [
  squeezeNorthDoor,
  approachSouthDoor,
  approachNorthDoor,
  sumpSouthDoor,
  sumpNorthDoor,
  grottoSouthDoor,
  topOfSteps,
  causewayTile,
  grottoEastDoor,
  fireWestDoor,
];

function fullTilePath(): TileCoord[] {
  const path: TileCoord[] = [ROUTE_DOORS[0]!];
  for (let i = 0; i < ROUTE_DOORS.length - 1; i++) {
    const leg = greedyPath(ROUTE_DOORS[i]!, ROUTE_DOORS[i + 1]!);
    path.push(...leg.slice(1));
  }
  return path;
}

describe("drowned gallery traversal (headless playtest)", () => {
  let tilePath: TileCoord[];
  let samples: Sample[];

  beforeAll(() => {
    tilePath = fullTilePath();
    const start = worldOfTile(tilePath[0]!);
    const physics = new MuseumPhysicsProvider(grid, TILE, { x: start.x, y: 0, z: start.z });
    const waypoints = tilePath.slice(1).map(worldOfTile);
    samples = walkWaypoints(physics, waypoints);
  });

  it("finds a walkable tile path spawn -> fire door (no severed corridor)", () => {
    expect(tilePath.length).toBeGreaterThan(1);
  });

  it("arrives at the cave-fire west door", () => {
    const target = worldOfTile(fireWestDoor);
    const last = samples.at(-1)!;
    expect(Math.hypot(last.x - target.x, last.z - target.z)).toBeLessThan(0.1);
  });

  it("is genuinely underwater in the sump's flat middle (not floating at datum)", () => {
    const sump = layout.sump;
    // Exclude the ramps at each end - only the flat middle band.
    const flatSamples = samples.filter(
      (s) => s.x >= sump.minX && s.x <= sump.maxX && s.z >= sump.minZ + 3.5 && s.z <= sump.maxZ - 2.5
    );
    expect(flatSamples.length).toBeGreaterThan(0);
    for (const s of flatSamples) {
      expect(s.y).toBeGreaterThanOrEqual(SUMP_FLOOR_Y + 0.85 - 0.15);
      expect(s.y).toBeLessThanOrEqual(SUMP_FLOOR_Y + 0.85 + 0.15);
    }
  });

  it("never pops the floor more than 0.6m between successive steps", () => {
    for (let i = 1; i < samples.length; i++) {
      const jump = Math.abs(samples[i]!.elevation - samples[i - 1]!.elevation);
      if (jump > 0.6) {
        throw new Error(
          `Elevation cliff of ${jump.toFixed(2)}m between ` +
            `(${samples[i - 1]!.x.toFixed(2)}, ${samples[i - 1]!.z.toFixed(2)}) elev=${samples[i - 1]!.elevation.toFixed(2)} and ` +
            `(${samples[i]!.x.toFixed(2)}, ${samples[i]!.z.toFixed(2)}) elev=${samples[i]!.elevation.toFixed(2)}`
        );
      }
    }
  });

  it("reaches the exit at museum datum elevation (~0)", () => {
    const exitWorld = worldOfTile(grottoEastDoor);
    expect(terrain.elevationAt(exitWorld.x, exitWorld.z)).toBeCloseTo(0, 0);
  });

  it("keeps the pool blocked from the causeway (barrier is by design)", () => {
    const start = layout.causewayProbe;
    const physics = new MuseumPhysicsProvider(grid, TILE, { x: start.x, y: 0, z: start.z });
    // Walk straight toward the pool center for a long time; it must never
    // cross into a blocked (pool) tile.
    const poolTarget = layout.poolProbe;
    for (let i = 0; i < 400; i++) {
      const pos = physics.getPlayerPosition();
      const dx = poolTarget.x - pos.x;
      const dz = poolTarget.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.1) break;
      const step = Math.min(0.05, dist);
      physics.movePlayer({ x: (dx / dist) * step, y: -0.2, z: (dz / dist) * step }, 1 / 60);
      const p = physics.getPlayerPosition();
      expect(terrain.blockedAt(p.x, p.z)).toBe(false);
    }
  });

  it("keeps all three overlooks reachable from the grotto entry", () => {
    for (const probe of layout.overlookProbes) {
      const target = tileOfWorld(probe);
      expect(() => bfsPath(grottoSouthDoor, target)).not.toThrow();
    }
  });
});
