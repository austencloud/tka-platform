/**
 * The Air chimney — Vulcan Cave air bay, updraft feel-prototype.
 *
 * Same contract as the fire and water bays: pure geometry that, given the
 * compiled cave grid, derives world-space elevation zones, blocked regions and
 * EVERY rect the graybox renders for the air bay. The physics provider consumes
 * elevationAt/blockedAt/updraftAt; the graybox reads the same rect lists. One
 * geometry source — a rect the graybox draws that this module does not know
 * about is a bug by construction.
 *
 * This is a BARE SHAFT, not the Air room. Plan B ("The Last Lift") ends with a
 * visible updraft column carrying the visitor +4.6 → +8.4 to an overlook, and
 * the ~4 s rise IS the room's reveal. Everything here exists to answer one
 * question — does that lift feel right — so the ramp is a plain straight run
 * standing in for the real switchback, and the only other content is three
 * height-marker posts so the rise reads against something.
 *
 * There is not one absolute world coordinate in this file: every offset is
 * metres measured from a compiled room bound or a real door tile span.
 *
 * Plan: docs/superpowers/plans/2026-08-05-air-updraft-prototype.md
 */
import type {
  MuseumGrid,
  MuseumTerrainProgram,
} from "../domain/museum-grid-types";
import { STANDING_Y } from "../services/museum-physics-provider";
import {
  TILE_METRES,
  WALL_THICKNESS,
  WATERLINE_Y,
  bandRects,
  doorSpan,
  inRectClosed,
  spansExcluding,
  unionRect,
  type CeilingRect,
  type FloorRect,
  type Point2,
  type WallRect,
  type WorldRect,
} from "./drowned-gallery-terrain";

const TILE = TILE_METRES;
const HALF = TILE / 2;

// ── Room ids ────────────────────────────────────────────────────────────────

export const AIR_ROOM_ID = "cave-air";
export const EARTH_ROOM_ID = "cave-earth";

// ── Datums (metres; museum floor = 0) ───────────────────────────────────────

/** Both doors and the whole approach floor sit on the museum datum. */
export const AIR_FLOOR_Y = 0;
/** Plan B's landing A — the first height marker only, nothing is built on it. */
export const LANDING_A_Y = 1.6;
/** Plan B's landing B: the top of the ramp, the shaft base, the lift's start. */
export const LANDING_B_Y = 4.6;
/** Plan B's overlook: the lip the column delivers you onto. */
export const OVERLOOK_Y = 8.4;
/** Third height marker, one metre below the lip, so the crest reads. */
export const MARKER_C_Y = 7.6;
export const AIR_CEILING_Y = 12.0;
export const CORRIDOR_CEILING_Y = 2.6;

/** The rise the prototype exists to measure: +4.6 → +8.4. */
export const UPDRAFT_RISE_METRES = OVERLOOK_Y - LANDING_B_Y;

/**
 * Steady-state lift speed inside the column. 1.0 m/s over a 3.8 m rise is the
 * ~4 s reveal Plan B is built around; the UCC's ease-in costs about 0.17 m of
 * that, so the measured duration lands just under 4 s.
 */
export const UPDRAFT_SPEED = 1.0;

/**
 * Ceiling of the lift, expressed in PLAYER position (feet + STANDING_Y) because
 * that is what the physics provider hands to updraftAt. Above it the column is
 * still air and ordinary gravity settles the player — there is no hovering
 * past the lip by standing still.
 */
export const UPDRAFT_CEILING_PLAYER_Y = OVERLOOK_Y + STANDING_Y;

// ── Programme metrics (metres) ──────────────────────────────────────────────

/** Clear margin from the interior's north edge to the foot of the ramp. */
const RAMP_ENTRY_MARGIN = 2.0;
const RAMP_WIDTH = 3.0;
/** 4.6 m over 18 m is 26% — the same grade family as the fire bay's exit run. */
const RAMP_RUN = 18.0;
/** Flat pad at the top of the ramp, the last still ground before the column. */
const PLATFORM_DEPTH = 3.0;
/** The shaft's square footprint; the lift itself is the inscribed circle. */
const COLUMN_SIDE = 3.0;
/** The overlook lip east of the column. */
const LIP_RUN = 4.0;
const LIP_DEPTH = 4.0;
/** Rock rim that stops a 3.8 m or 8.4 m ledge being walked up from below. */
const RIM = 0.5;
/** Height-marker post footprint. */
const MARKER_HALF = 0.3;
/** Metres east of the ramp the marker posts stand, so the rise reads past them. */
const MARKER_X_OFFSET = 12.0;

// ── Types ───────────────────────────────────────────────────────────────────

export interface AirChimneyLayout {
  /** Interior world rect of the air chamber. */
  air: WorldRect;
  /** Full wing footprint including its wall ring — the rendered floor slab. */
  shell: WorldRect;
  /** Corridor tiles between the Earth south door and the air north door. */
  corridor: WorldRect[];

  /** Plain straight ramp, datum → +4.6. Stand-in for Plan B's ramp 2. */
  ramp: WorldRect;
  /** Flat pad at +4.6 at the head of the ramp. */
  platform: WorldRect;
  /** The updraft column's footprint at +4.6. */
  column: WorldRect;
  /** Centre and radius of the lift itself (inscribed in `column`). */
  columnCentre: Point2;
  columnRadius: number;
  /** The +8.4 overlook lip the column delivers you onto. */
  lip: WorldRect;
  /**
   * Blocked rock rims: the only reason the ledges cannot be walked up. `topY`
   * is the height the graybox draws each one to — a rim guarding the +8.4 lip
   * has to be visible from the lip, not from the platform.
   */
  rims: { id: string; rect: WorldRect; topY: number }[];
  /** Height-marker posts at +1.6 / +4.6 / +7.6, north → south. */
  markers: { id: string; rect: WorldRect; topY: number }[];

  // ── everything the graybox renders ──
  floorRects: FloorRect[];
  wallRects: WallRect[];
  ceilingRects: CeilingRect[];

  /** Union bbox of the air bay. The terrain answers only inside it. */
  bayBounds: WorldRect;

  probes: {
    entry: Point2;
    rampFoot: Point2;
    rampHead: Point2;
    platform: Point2;
    column: Point2;
    lip: Point2;
    /** A point on the datum floor beside the ramp — the safe landing below. */
    floor: Point2;
    /** A point inside a blocked rim. */
    rim: Point2;
  };
}

// ── Small helpers ───────────────────────────────────────────────────────────

const cx = (r: WorldRect) => (r.minX + r.maxX) / 2;
const cz = (r: WorldRect) => (r.minZ + r.maxZ) / 2;
const centre = (r: WorldRect): Point2 => ({ x: cx(r), z: cz(r) });

/** Half-open containment — used for blocking, matching the water/fire bays. */
function inRectHalfOpen(r: WorldRect, x: number, z: number): boolean {
  return x >= r.minX && x < r.maxX && z >= r.minZ && z < r.maxZ;
}

/** World rect of a wing's FULL tile footprint, wall ring included. */
function outerWorldRect(b: {
  x: number;
  y: number;
  width: number;
  height: number;
}): WorldRect {
  return {
    minX: b.x * TILE - HALF,
    minZ: b.y * TILE - HALF,
    maxX: (b.x + b.width - 1) * TILE + HALF,
    maxZ: (b.y + b.height - 1) * TILE + HALF,
  };
}

/** The four RIM-wide strips around `r`, minus the sides named in `open`. */
function rimAround(
  r: WorldRect,
  open: ("north" | "south" | "east" | "west")[]
): WorldRect[] {
  const out: WorldRect[] = [];
  if (!open.includes("north")) {
    out.push({ minX: r.minX, maxX: r.maxX, minZ: r.minZ - RIM, maxZ: r.minZ });
  }
  if (!open.includes("south")) {
    out.push({ minX: r.minX, maxX: r.maxX, minZ: r.maxZ, maxZ: r.maxZ + RIM });
  }
  if (!open.includes("west")) {
    out.push({ minX: r.minX - RIM, maxX: r.minX, minZ: r.minZ, maxZ: r.maxZ });
  }
  if (!open.includes("east")) {
    out.push({ minX: r.maxX, maxX: r.maxX + RIM, minZ: r.minZ, maxZ: r.maxZ });
  }
  return out;
}

// ── Layout ──────────────────────────────────────────────────────────────────

export function buildAirChimneyLayout(grid: MuseumGrid): AirChimneyLayout | null {
  const airWing = grid.wings.find((w) => w.id === AIR_ROOM_ID);
  const earthWing = grid.wings.find((w) => w.id === EARTH_ROOM_ID);
  if (!airWing || !earthWing) return null;

  const shell = outerWorldRect(airWing.bounds);
  const air: WorldRect = {
    minX: shell.minX + TILE,
    maxX: shell.maxX - TILE,
    minZ: shell.minZ + TILE,
    maxZ: shell.maxZ - TILE,
  };
  const northDoor = doorSpan(grid, AIR_ROOM_ID, "north");
  const southDoor = doorSpan(grid, AIR_ROOM_ID, "south");
  if (!northDoor || !southDoor) {
    throw new Error(
      "Air chimney layout: a door on the air route is missing from the compiled grid"
    );
  }

  // ── The climb, north → south along the interior's west edge. Hugging the
  // wall means the ramp has exactly one open side, which the rim then closes.
  const rampMinZ = air.minZ + RAMP_ENTRY_MARGIN;
  const ramp: WorldRect = {
    minX: air.minX,
    maxX: air.minX + RAMP_WIDTH,
    minZ: rampMinZ,
    maxZ: rampMinZ + RAMP_RUN,
  };
  const platform: WorldRect = {
    minX: ramp.minX,
    maxX: ramp.maxX,
    minZ: ramp.maxZ,
    maxZ: ramp.maxZ + PLATFORM_DEPTH,
  };
  if (platform.maxZ > air.maxZ) {
    throw new Error(
      "Air chimney layout: the ramp and its platform overrun the air chamber — deepen cave-air"
    );
  }
  const column: WorldRect = {
    minX: platform.maxX,
    maxX: platform.maxX + COLUMN_SIDE,
    minZ: platform.maxZ - COLUMN_SIDE,
    maxZ: platform.maxZ,
  };
  const lip: WorldRect = {
    minX: column.maxX,
    maxX: column.maxX + LIP_RUN,
    minZ: cz(column) - LIP_DEPTH / 2,
    maxZ: cz(column) + LIP_DEPTH / 2,
  };
  if (lip.maxX > air.maxX) {
    throw new Error(
      "Air chimney layout: the shaft and its overlook overrun the air chamber — widen cave-air"
    );
  }

  // ── Rims. Without these, a 2D elevation map lets the player walk straight
  // onto a ledge 3.8 m or 8.4 m above their feet (the floor clamp is a minimum,
  // so it SNAPS them up). The rims make the updraft the only way onto the lip
  // and the ramp the only way onto the platform.
  const rimRail = 0.9;
  const rims = [
    // The ramp's open (east) flank, from one metre past its foot upward.
    {
      rect: {
        minX: ramp.maxX,
        maxX: ramp.maxX + RIM,
        minZ: ramp.minZ + 1.0,
        maxZ: ramp.maxZ,
      },
      topY: LANDING_B_Y + rimRail,
    },
    ...rimAround(platform, ["north", "east"]).map((rect) => ({
      rect,
      topY: LANDING_B_Y + rimRail,
    })),
    ...rimAround(column, ["west", "east"]).map((rect) => ({
      rect,
      topY: OVERLOOK_Y + rimRail,
    })),
    // The lip's rim is a PARAPET, not a wall. Blocking is height-independent
    // (blockedAt is 2D), so a knee-high rock still stops the ledge being walked
    // up from the floor — and unlike a full rim it does not wall in the view
    // the overlook exists to give (verification pass, 2026-08-05).
    ...rimAround(lip, ["west"]).map((rect) => ({
      rect,
      topY: OVERLOOK_Y + 0.35,
    })),
  ].map((rim, i) => ({ id: `air-rim-${i}`, ...rim }));

  // ── Height markers: plain posts, nothing to stand on.
  const markerX = air.minX + MARKER_X_OFFSET;
  const markerHeights = [LANDING_A_Y, LANDING_B_Y, MARKER_C_Y];
  const markers = markerHeights.map((topY, i) => {
    const z = air.minZ + RAMP_ENTRY_MARGIN + (RAMP_RUN * (i + 1)) / 4;
    return {
      id: `air-marker-${i}`,
      rect: {
        minX: markerX - MARKER_HALF,
        maxX: markerX + MARKER_HALF,
        minZ: z - MARKER_HALF,
        maxZ: z + MARKER_HALF,
      },
      topY,
    };
  });

  // ── Corridor from Earth. Earth and Air both suppress their tile geometry, so
  // the corridor between them is suppressed too and this module owns it.
  const eb = earthWing.bounds;
  const ab = airWing.bounds;
  const corridorTxMin = Math.min(eb.x, ab.x) - 2;
  const corridorTxMax = Math.max(eb.x + eb.width, ab.x + ab.width) + 2;
  const corridor = bandRects(
    grid,
    corridorTxMin,
    corridorTxMax,
    eb.y + eb.height,
    ab.y,
    (t) => t === "corridor" || t === "door"
  );
  const corridorWalls = bandRects(
    grid,
    corridorTxMin,
    corridorTxMax,
    eb.y + eb.height,
    ab.y - 1,
    (t) => t === "wall"
  );

  // ── Floor rects: the single list physics and the graybox both read. Order
  // matters — the shell slab is last, so it is the fallback under everything.
  const floorRects: FloorRect[] = [
    {
      id: "air-ramp",
      rect: ramp,
      kind: "ramp-z",
      fromY: AIR_FLOOR_Y,
      toY: LANDING_B_Y,
    },
    {
      id: "air-platform",
      rect: platform,
      kind: "flat",
      fromY: LANDING_B_Y,
      toY: LANDING_B_Y,
    },
    {
      id: "air-column-base",
      rect: column,
      kind: "flat",
      fromY: LANDING_B_Y,
      toY: LANDING_B_Y,
    },
    { id: "air-lip", rect: lip, kind: "flat", fromY: OVERLOOK_Y, toY: OVERLOOK_Y },
    ...corridor.map((rect, i) => ({
      id: `air-corridor-${i}`,
      rect,
      kind: "flat" as const,
      fromY: AIR_FLOOR_Y,
      toY: AIR_FLOOR_Y,
    })),
    // The datum floor under everything: the approach, the walk to the Sun door,
    // and the safe landing for anyone who steps out of the column mid-rise.
    {
      id: "air-shell-floor",
      rect: shell,
      kind: "flat",
      fromY: AIR_FLOOR_Y,
      toY: AIR_FLOOR_Y,
    },
  ];

  // ── Wall rects: envelope with gaps derived from real door tiles ───────────
  const baseY = AIR_FLOOR_Y - 1.0;
  const wallRects: WallRect[] = [];
  const pushWall = (id: string, rect: WorldRect, top: number) => {
    if (rect.maxX - rect.minX > 0.01 && rect.maxZ - rect.minZ > 0.01) {
      wallRects.push({ id, rect, baseY, topY: top });
    }
  };

  for (const [x0, x1] of spansExcluding(shell.minX, shell.maxX, [northDoor])) {
    pushWall(
      `air-north-${x0.toFixed(2)}`,
      { minX: x0, maxX: x1, minZ: shell.minZ - WALL_THICKNESS, maxZ: shell.minZ },
      AIR_CEILING_Y
    );
  }
  for (const [x0, x1] of spansExcluding(shell.minX, shell.maxX, [southDoor])) {
    pushWall(
      `air-south-${x0.toFixed(2)}`,
      { minX: x0, maxX: x1, minZ: shell.maxZ, maxZ: shell.maxZ + WALL_THICKNESS },
      AIR_CEILING_Y
    );
  }
  pushWall(
    "air-west",
    {
      minX: shell.minX - WALL_THICKNESS,
      maxX: shell.minX,
      minZ: shell.minZ - WALL_THICKNESS,
      maxZ: shell.maxZ + WALL_THICKNESS,
    },
    AIR_CEILING_Y
  );
  pushWall(
    "air-east",
    {
      minX: shell.maxX,
      maxX: shell.maxX + WALL_THICKNESS,
      minZ: shell.minZ - WALL_THICKNESS,
      maxZ: shell.maxZ + WALL_THICKNESS,
    },
    AIR_CEILING_Y
  );
  corridorWalls.forEach((rect, i) =>
    pushWall(`air-corridor-wall-${i}`, rect, CORRIDOR_CEILING_Y)
  );

  const ceilingRects: CeilingRect[] = [
    { id: "air-ceiling", rect: shell, y: AIR_CEILING_Y },
    ...corridor.map((rect, i) => ({
      id: `air-corridor-ceiling-${i}`,
      rect,
      y: CORRIDOR_CEILING_Y,
    })),
  ];

  const bayBounds = unionRect([shell, ...corridor]);

  return {
    air,
    shell,
    corridor,
    ramp,
    platform,
    column,
    columnCentre: centre(column),
    columnRadius: COLUMN_SIDE / 2,
    lip,
    rims,
    markers,
    floorRects,
    wallRects,
    ceilingRects,
    bayBounds,
    probes: {
      entry: { x: cx(shell), z: shell.minZ + 1.0 },
      rampFoot: { x: cx(ramp), z: ramp.minZ + 0.5 },
      rampHead: { x: cx(ramp), z: ramp.maxZ - 0.25 },
      platform: centre(platform),
      column: centre(column),
      lip: centre(lip),
      floor: { x: cx(shell), z: cz(shell) },
      rim: centre(rims[0]!.rect),
    },
  };
}

// ── Terrain program ─────────────────────────────────────────────────────────

export function createAirChimneyTerrain(
  grid: MuseumGrid
): MuseumTerrainProgram | null {
  const layout = buildAirChimneyLayout(grid);
  if (!layout) return null;

  const { floorRects, bayBounds, columnCentre, columnRadius } = layout;
  const blocked: WorldRect[] = [
    ...layout.rims.map((r) => r.rect),
    ...layout.markers.map((m) => m.rect),
  ];
  const radiusSq = columnRadius * columnRadius;

  const heightOn = (floor: FloorRect, x: number, z: number): number => {
    if (floor.kind === "flat") return floor.fromY;
    const alongZ = floor.kind === "ramp-z";
    const min = alongZ ? floor.rect.minZ : floor.rect.minX;
    const max = alongZ ? floor.rect.maxZ : floor.rect.maxX;
    const v = alongZ ? z : x;
    const t = max === min ? 0 : Math.min(1, Math.max(0, (v - min) / (max - min)));
    return floor.fromY + (floor.toY - floor.fromY) * t;
  };

  return {
    waterlineY: WATERLINE_Y,
    elevationAt(x, z) {
      for (const floor of floorRects) {
        if (inRectClosed(floor.rect, x, z)) return heightOn(floor, x, z);
      }
      // The shell slab covers the whole wing, so nothing inside the bay can
      // miss — anything that does is outside every rect this module owns and
      // belongs to the museum datum.
      return AIR_FLOOR_Y;
    },
    blockedAt(x, z) {
      for (const rect of blocked) if (inRectHalfOpen(rect, x, z)) return true;
      return false;
    },
    updraftAt(x, z, y) {
      if (y >= UPDRAFT_CEILING_PLAYER_Y) return 0;
      const dx = x - columnCentre.x;
      const dz = z - columnCentre.z;
      if (dx * dx + dz * dz > radiusSq) return 0;
      return UPDRAFT_SPEED;
    },
  };
}
