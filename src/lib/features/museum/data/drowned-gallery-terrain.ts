/**
 * Drowned Gallery terrain program.
 *
 * Pure geometry: given the compiled cave grid, derives world-space elevation
 * zones, water-blocked regions, and graybox layout anchors for the Water bay.
 * The physics provider consumes elevationAt/blockedAt; the graybox visual
 * layer consumes the layout rects. Single source of truth for both.
 *
 * Datum: default museum floor = 0. See the design spec for the section.
 */
import type {
  MuseumGrid,
  MuseumTerrainProgram,
} from "../domain/museum-grid-types";

export const WATERLINE_Y = -1.5;
export const SUMP_FLOOR_Y = -4.1;
export const SUMP_CEILING_Y = -1.9;
export const CAUSEWAY_Y = -0.3;
export const SHELF_Y = -1.0;
export const POOL_BOTTOM_Y = -5.0;
export const DOME_APEX_Y = 9.5;

/** Elevation of the corridor stubs that bridge approach → sump → grotto. */
const CORRIDOR_SURFACING_Y = -2.2;

const TILE = 0.5;

export interface WorldRect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

interface ElevationZone {
  rect: WorldRect;
  /** Elevation at the minimum edge of `axis` */
  from: number;
  /** Elevation at the maximum edge of `axis` */
  to: number;
  axis: "x" | "z";
}

export interface DrownedGalleryLayout {
  approach: WorldRect; // interior, world units
  sump: WorldRect;
  grotto: WorldRect;
  pool: WorldRect;
  shore: WorldRect;
  overlooks: WorldRect[]; // walkable carve-outs inside the pool rect
  gate: WorldRect; // blocked strip on the east leg
  alcoves: { x: number; z: number }[]; // shelf centers for A, B, C (west→east)
  waterPlanes: WorldRect[]; // where to render water surface at WATERLINE_Y
  // probe points for tests
  causewayProbe: { x: number; z: number };
  poolProbe: { x: number; z: number };
  shoreProbe: { x: number; z: number };
  gateProbe: { x: number; z: number };
  overlookProbes: { x: number; z: number }[];
}

function interiorWorldRect(b: {
  x: number;
  y: number;
  width: number;
  height: number;
}): WorldRect {
  return {
    minX: (b.x + 1) * TILE,
    minZ: (b.y + 1) * TILE,
    maxX: (b.x + b.width - 1) * TILE,
    maxZ: (b.y + b.height - 1) * TILE,
  };
}

const inRect = (r: WorldRect, x: number, z: number) =>
  x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

export function buildDrownedGalleryLayout(
  grid: MuseumGrid
): DrownedGalleryLayout | null {
  const approachWing = grid.wings.find((w) => w.id === "cave-water-approach");
  const sumpWing = grid.wings.find((w) => w.id === "cave-water-sump");
  const grottoWing = grid.wings.find((w) => w.id === "cave-water");
  if (!approachWing || !sumpWing || !grottoWing) return null;

  const approach = interiorWorldRect(approachWing.bounds);
  const sump = interiorWorldRect(sumpWing.bounds);
  const grotto = interiorWorldRect(grottoWing.bounds);
  const gw = grotto.maxX - grotto.minX; // ≈ 25

  // North shore strip (alcoves + habitat): top 3.5 m
  const shore: WorldRect = {
    minX: grotto.minX,
    minZ: grotto.minZ,
    maxX: grotto.maxX,
    maxZ: grotto.minZ + 3.5,
  };
  // Pool: from shore edge down to 4.5 m short of the south wall, inset 2 m
  // on the west (waterfall margin) and 3 m on the east (gate leg walkway).
  const pool: WorldRect = {
    minX: grotto.minX + 2,
    minZ: shore.maxZ,
    maxX: grotto.maxX - 3,
    maxZ: grotto.maxZ - 4.5,
  };
  // Three overlooks: 3 m wide, biting 1.5 m into the pool's south edge,
  // centered under each alcove.
  const alcoveXs = [0.22, 0.5, 0.78].map((f) => grotto.minX + gw * f);
  const overlooks: WorldRect[] = alcoveXs.map((cx) => ({
    minX: cx - 1.5,
    minZ: pool.maxZ - 1.5,
    maxX: cx + 1.5,
    maxZ: pool.maxZ,
  }));
  // Gate: blocked strip across the east walkway, level with the shore edge
  const gate: WorldRect = {
    minX: pool.maxX,
    minZ: shore.maxZ + 1.0,
    maxX: grotto.maxX,
    maxZ: shore.maxZ + 1.6,
  };

  const alcoves = alcoveXs.map((x) => ({ x, z: shore.minZ + 1.6 }));

  return {
    approach,
    sump,
    grotto,
    pool,
    shore,
    overlooks,
    gate,
    alcoves,
    waterPlanes: [
      pool,
      // sump water: covers sump + the corridor gaps north and south of it
      {
        minX: sump.minX - 1,
        minZ: approach.minZ - 1.5,
        maxX: sump.maxX + 1,
        maxZ: grotto.minZ + 0.5,
      },
    ],
    causewayProbe: { x: grotto.minX + gw * 0.5, z: pool.maxZ + 2.0 },
    poolProbe: { x: grotto.minX + gw * 0.5, z: (pool.minZ + pool.maxZ) / 2 },
    shoreProbe: { x: grotto.minX + gw * 0.5, z: shore.minZ + 1.0 },
    gateProbe: { x: (gate.minX + gate.maxX) / 2, z: (gate.minZ + gate.maxZ) / 2 },
    overlookProbes: overlooks.map((o) => ({
      x: (o.minX + o.maxX) / 2,
      z: (o.minZ + o.maxZ) / 2,
    })),
  };
}

export function createDrownedGalleryTerrain(
  grid: MuseumGrid
): MuseumTerrainProgram | null {
  const layout = buildDrownedGalleryLayout(grid);
  if (!layout) return null;
  const { approach, sump, grotto } = layout;

  // Zones are evaluated in order; first hit wins. Gradients run along z
  // (north = minZ = deeper into the bay).
  const zones: ElevationZone[] = [
    // approach: 0 at south door → WATERLINE at north end
    { rect: approach, from: WATERLINE_Y, to: 0, axis: "z" },
    // corridor between approach and sump: flat at waterline depth
    {
      rect: {
        minX: sump.minX - 1,
        minZ: sump.maxZ,
        maxX: sump.maxX + 1,
        maxZ: approach.minZ,
      },
      from: WATERLINE_Y,
      to: WATERLINE_Y,
      axis: "z",
    },
    // sump south ramp: first 2 m descend WATERLINE → SUMP_FLOOR
    {
      rect: {
        minX: sump.minX,
        minZ: sump.maxZ - 2,
        maxX: sump.maxX,
        maxZ: sump.maxZ,
      },
      from: SUMP_FLOOR_Y,
      to: WATERLINE_Y,
      axis: "z",
    },
    // sump north ramp: last 3 m rise SUMP_FLOOR → CORRIDOR_SURFACING_Y
    {
      rect: {
        minX: sump.minX,
        minZ: sump.minZ,
        maxX: sump.maxX,
        maxZ: sump.minZ + 3,
      },
      from: CORRIDOR_SURFACING_Y,
      to: SUMP_FLOOR_Y,
      axis: "z",
    },
    // sump middle: flat floor
    { rect: sump, from: SUMP_FLOOR_Y, to: SUMP_FLOOR_Y, axis: "z" },
    // corridor between sump and grotto: flat at CORRIDOR_SURFACING_Y
    {
      rect: {
        minX: sump.minX - 1,
        minZ: grotto.maxZ,
        maxX: sump.maxX + 1,
        maxZ: sump.minZ,
      },
      from: CORRIDOR_SURFACING_Y,
      to: CORRIDOR_SURFACING_Y,
      axis: "z",
    },
    // grotto surfacing steps: the south-west entry strip rises to CAUSEWAY
    {
      rect: {
        minX: grotto.minX,
        minZ: grotto.maxZ - 3,
        maxX: grotto.minX + 6,
        maxZ: grotto.maxZ,
      },
      from: CAUSEWAY_Y,
      to: CORRIDOR_SURFACING_Y,
      axis: "z",
    },
    // grotto east exit ramp: last 2 m before the fire door rise CAUSEWAY → 0
    {
      rect: {
        minX: grotto.maxX - 2,
        minZ: grotto.maxZ - 6,
        maxX: grotto.maxX,
        maxZ: grotto.maxZ,
      },
      from: CAUSEWAY_Y,
      to: 0,
      axis: "x",
    },
    // grotto everywhere else: causeway level
    { rect: grotto, from: CAUSEWAY_Y, to: CAUSEWAY_Y, axis: "z" },
  ];

  const blocked: WorldRect[] = [layout.shore, layout.pool, layout.gate];
  const allowed: WorldRect[] = layout.overlooks;

  return {
    waterlineY: WATERLINE_Y,
    elevationAt(x, z) {
      for (const zone of zones) {
        if (!inRect(zone.rect, x, z)) continue;
        if (zone.from === zone.to) return zone.from;
        const min = zone.axis === "z" ? zone.rect.minZ : zone.rect.minX;
        const max = zone.axis === "z" ? zone.rect.maxZ : zone.rect.maxX;
        const v = zone.axis === "z" ? z : x;
        const t = max === min ? 0 : (v - min) / (max - min);
        return zone.from + (zone.to - zone.from) * t;
      }
      return 0;
    },
    blockedAt(x, z) {
      for (const a of allowed) if (inRect(a, x, z)) return false;
      for (const b of blocked) if (inRect(b, x, z)) return true;
      return false;
    },
  };
}
