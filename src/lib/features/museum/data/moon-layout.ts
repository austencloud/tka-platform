/**
 * The Moon — Vulcan Cave moon bay, and the last room in the wing.
 *
 * Same contract as the other five: pure geometry that, given the compiled cave
 * grid, derives world-space elevation, blocked regions and every shape the
 * graybox renders. One geometry source.
 *
 * ── What this room is ───────────────────────────────────────────────────────
 *
 * The Sun's pair, and its inversion in every axis the wing cares about.
 *
 * VTG says so before the art does. Sun is quarter-time / SAME-direction; Moon
 * is quarter-time / OPPOSITE-direction. The ornament grammar
 * (2026-08-05-vulcan-cave-ornament-grammar.md) turns that into a rule: phase
 * offset sets rotational order, direction sets whether a mirror exists — so Sun
 * is four-fold CHIRAL, it turns, and Moon is four-fold MIRRORED, it cannot. The
 * Sun's spiral winds; the Moon's plan reflects. Nothing in this room spirals,
 * and that is the point rather than an omission.
 *
 * The architecture inverts too. The Sun is a pit you climb out of, lit warm,
 * with a sky you only glimpse. The Moon is a flat plain under an open black
 * sky, and you arrive by coming UP through its floor: the Sun's eye lifts you
 * out of that chamber's ceiling and through a round hole in this one's
 * regolith. Austen (2026-08-05): *"you burst out of the surface of the sun's
 * ceiling out into the floor of the moon."*
 *
 * ── The light ───────────────────────────────────────────────────────────────
 *
 * One hard white key and almost no fill, because there is no atmosphere here to
 * scatter it. Shadows go to near-black. That is not a mood choice borrowed from
 * the Sun room's palette — it is the physical difference between standing in
 * air and standing in vacuum, and it makes the two rooms read as opposites at a
 * glance rather than as the same room in a different colour.
 *
 * ── The gravity ────────────────────────────────────────────────────────────
 *
 * Low, and it starts on the first step OFF the arrival plinth, not on arrival.
 * The plinth is the Sun's stone and still behaves like it; the regolith is the
 * Moon's. Stepping across that seam is the moment the room announces itself.
 *
 * There is not one absolute world coordinate in this file: every offset is
 * metres measured from a compiled room bound or a real door tile span.
 */
import type {
  MuseumGrid,
  MuseumTerrainProgram,
} from "../domain/museum-grid-types";
import {
  TILE_METRES,
  WALL_THICKNESS,
  WATERLINE_Y,
  doorSpan,
  inRectClosed,
  spansExcluding,
  tileCentredOffset,
  type CeilingRect,
  type Point2,
  type WallRect,
  type WorldRect,
} from "./drowned-gallery-terrain";

const TILE = TILE_METRES;
const HALF = TILE / 2;

export const MOON_ROOM_ID = "cave-moon";

// ── Chamber metrics (metres) ────────────────────────────────────────────────

/** The plain is ⌀20 — smaller than the Sun's ⌀24, and deliberately emptier. */
export const MOON_CHAMBER_RADIUS_M = 10;
/** The mirrored stations stand on this circle. */
export const MOON_STATION_RADIUS_M = 6;
/** A station mound is low: the Moon has no pillars, because nothing rises here. */
export const MOON_MOUND_RADIUS_M = 1.2;
export const MOON_MOUND_TOP_Y = 0.35;

/** The regolith. The museum datum, so the Egypt door needs no ramp. */
export const MOON_FLOOR_Y = 0;

/**
 * The hole you arrive through, and the plinth that fills it. Sized off the
 * Sun's eye so the two rooms agree about the shaft they share: a hole narrower
 * than the plinth would clip it, and a much wider one would read as a pit the
 * visitor is standing in rather than a floor they have just come through.
 */
export const MOON_ARRIVAL_RADIUS_M = 1.0;
export const MOON_ARRIVAL_HOLE_RADIUS_M = 1.35;

/** How far the arrival hole sits from the chamber centre. */
const ARRIVAL_FROM_CENTRE_M = 6.5;

export const MOON_SKY_Y = 22.0;
export const MOON_CORRIDOR_CEILING_Y = 2.6;

/**
 * Museum gravity is scaled by this inside the chamber. The Moon's real figure
 * is 0.165 g, which in a room this size makes a single step take long enough to
 * feel broken rather than light. 0.32 keeps the arc obviously lunar while a
 * stride still lands when the visitor expects it to.
 */
export const MOON_GRAVITY_SCALE = 0.32;

/**
 * The stations, and the one place their count is decided.
 *
 * The grammar asks for a four-fold MIRRORED figure and the plan delivers the
 * mirror; it does not deliver four occupied points, because the Quarter-
 * Opposite data does not have four pairs in it. MPMP, NQNQ and OROR are the
 * three that close (5 steps, gamma3 → gamma3, score 1.00) across the six
 * letters M–R, so three is what stands here. Do not invent a fourth to fill
 * the west point — the west point is the ARRIVAL, and leaving it empty is what
 * puts the room's mirror axis along the axis the visitor comes up on: N and S
 * reflect into each other across it, E sits on it, and the visitor stands at
 * its far end. A fourth station would have to stand on the hole.
 *
 * Facings are inward at the plain's centre.
 */
export const MOON_STATIONS = [
  { suffix: "mp", dx: 0, dz: -MOON_STATION_RADIUS_M, facing: "south" },
  { suffix: "nq", dx: MOON_STATION_RADIUS_M, dz: 0, facing: "west" },
  { suffix: "or", dx: 0, dz: MOON_STATION_RADIUS_M, facing: "north" },
] as const;

// ── Types ───────────────────────────────────────────────────────────────────

export interface MoonMound {
  id: string;
  centre: Point2;
  radius: number;
  topY: number;
}

export interface MoonLayout {
  shell: WorldRect;
  interior: WorldRect;
  centre: Point2;
  chamberRadius: number;

  /** Where the Sun's lift delivers, and the disc of Sun-stone it delivers onto. */
  arrival: Point2;
  arrivalRadius: number;
  arrivalHoleRadius: number;

  /** The mirrored stations — one per Quarter-Opposite pair the data supports. */
  mounds: MoonMound[];

  /**
   * The z band the two door approaches cross the rock in — the ONE exception
   * to the round plain, and the only rectangle the graybox is allowed to draw
   * as floor. Exported rather than re-derived so what is drawn and what
   * `blockedAt` permits are the same band by construction.
   */
  doorBand: { minZ: number; maxZ: number };

  wallRects: WallRect[];
  ceilingRects: CeilingRect[];
  bayBounds: WorldRect;

  blockedAt(x: number, z: number): boolean;
  elevationAt(x: number, z: number, fromY?: number): number;
  /**
   * True once the visitor is standing on regolith rather than on the arrival
   * plinth — which is exactly when the low gravity takes hold.
   */
  isLowGravityAt(x: number, z: number): boolean;

  probes: {
    arrival: Point2;
    /** One step off the plinth: the seam where the room changes. */
    firstStep: Point2;
    centre: Point2;
    exit: Point2;
  };
}

const cx = (r: WorldRect) => (r.minX + r.maxX) / 2;
const cz = (r: WorldRect) => (r.minZ + r.maxZ) / 2;

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

/**
 * The chamber centre in INTERIOR metres. Tile-centred for the same reason the
 * Sundial's is: the stations land on 0.5 m tile centres, and a centre on a tile
 * BOUNDARY makes the four radii unequal — which in a room whose whole subject
 * is mirror symmetry would be visible.
 */
export function moonCentreMetres(
  roomWidthTiles: number,
  roomHeightTiles: number
): { xMetres: number; zMetres: number } {
  return {
    xMetres: tileCentredOffset(((roomWidthTiles - 2) * TILE) / 2),
    zMetres: tileCentredOffset(((roomHeightTiles - 2) * TILE) / 2),
  };
}

export function buildMoonLayout(grid: MuseumGrid): MoonLayout | null {
  const wing = grid.wings.find((w) => w.id === MOON_ROOM_ID);
  if (!wing) return null;

  const shell = outerWorldRect(wing.bounds);
  const interior: WorldRect = {
    minX: shell.minX + TILE,
    maxX: shell.maxX - TILE,
    minZ: shell.minZ + TILE,
    maxZ: shell.maxZ - TILE,
  };

  const westDoor = doorSpan(grid, MOON_ROOM_ID, "west");
  const eastDoor = doorSpan(grid, MOON_ROOM_ID, "east");
  if (!westDoor || !eastDoor) {
    throw new Error(
      "Moon layout: a door on the moon route is missing from the compiled grid"
    );
  }

  const centreMetres = moonCentreMetres(wing.bounds.width, wing.bounds.height);
  const centre: Point2 = {
    x: interior.minX + centreMetres.xMetres,
    z: interior.minZ + centreMetres.zMetres,
  };

  const chamberRadius = MOON_CHAMBER_RADIUS_M;
  if (
    centre.x - chamberRadius < interior.minX - 0.01 ||
    centre.x + chamberRadius > interior.maxX + 0.01 ||
    centre.z - chamberRadius < interior.minZ - 0.01 ||
    centre.z + chamberRadius > interior.maxZ + 0.01
  ) {
    throw new Error(
      "Moon layout: the ⌀20 m plain overruns the moon bay — enlarge cave-moon"
    );
  }

  // The arrival sits WEST of centre, on the Sun side, so the visitor surfaces
  // facing into the room with the four stations ahead of them rather than
  // behind. Placed on the axis, because this room mirrors and an off-axis
  // arrival would be the one asymmetric thing in it.
  const arrival: Point2 = {
    x: centre.x - ARRIVAL_FROM_CENTRE_M,
    z: centre.z,
  };

  const mounds: MoonMound[] = MOON_STATIONS.map(({ suffix, dx, dz }) => ({
    id: `moon-mound-${suffix}`,
    centre: { x: centre.x + dx, z: centre.z + dz },
    radius: MOON_MOUND_RADIUS_M,
    topY: MOON_MOUND_TOP_Y,
  }));

  // The west mound would sit on top of the arrival. Nothing stands where the
  // visitor surfaces.
  const arrivalClash = mounds.find(
    (m) =>
      Math.hypot(m.centre.x - arrival.x, m.centre.z - arrival.z) <
      m.radius + MOON_ARRIVAL_HOLE_RADIUS_M + 0.5
  );
  if (arrivalClash) {
    throw new Error(
      `Moon layout: ${arrivalClash.id} stands on the arrival hole — the visitor would surface inside a performer`
    );
  }

  const baseY = MOON_FLOOR_Y - 4.0;
  const wallRects: WallRect[] = [];
  const pushWall = (id: string, rect: WorldRect, top: number) => {
    if (rect.maxX - rect.minX > 0.01 && rect.maxZ - rect.minZ > 0.01) {
      wallRects.push({ id, rect, baseY, topY: top });
    }
  };
  for (const [z0, z1] of spansExcluding(shell.minZ, shell.maxZ, [westDoor])) {
    pushWall(
      `moon-west-${z0.toFixed(2)}`,
      { minX: shell.minX - WALL_THICKNESS, maxX: shell.minX, minZ: z0, maxZ: z1 },
      MOON_SKY_Y
    );
  }
  for (const [z0, z1] of spansExcluding(shell.minZ, shell.maxZ, [eastDoor])) {
    pushWall(
      `moon-east-${z0.toFixed(2)}`,
      { minX: shell.maxX, maxX: shell.maxX + WALL_THICKNESS, minZ: z0, maxZ: z1 },
      MOON_SKY_Y
    );
  }
  pushWall(
    "moon-north",
    {
      minX: shell.minX - WALL_THICKNESS,
      maxX: shell.maxX + WALL_THICKNESS,
      minZ: shell.minZ - WALL_THICKNESS,
      maxZ: shell.minZ,
    },
    MOON_SKY_Y
  );
  pushWall(
    "moon-south",
    {
      minX: shell.minX - WALL_THICKNESS,
      maxX: shell.maxX + WALL_THICKNESS,
      minZ: shell.maxZ,
      maxZ: shell.maxZ + WALL_THICKNESS,
    },
    MOON_SKY_Y
  );

  // No ceiling over the chamber. The sky is the exhibit's other half, and a lid
  // would make this the sixth cave room instead of the one that is outside.
  const ceilingRects: CeilingRect[] = [];

  const polarR = (x: number, z: number) =>
    Math.hypot(x - centre.x, z - centre.z);
  const arrivalR = (x: number, z: number) =>
    Math.hypot(x - arrival.x, z - arrival.z);

  const doorBand = {
    minZ: Math.min(westDoor.min, eastDoor.min) - 0.5,
    maxZ: Math.max(westDoor.max, eastDoor.max) + 0.5,
  };

  function blockedAt(x: number, z: number): boolean {
    // The plain is round; the corners of the rectangular bay are rock. The
    // doors are the exception — their approaches cross that band.
    if (polarR(x, z) <= chamberRadius) return false;
    return !inRectClosed(
      { minX: interior.minX, maxX: interior.maxX, ...doorBand },
      x,
      z
    );
  }

  function elevationAt(x: number, z: number, fromY?: number): number {
    for (const mound of mounds) {
      const r = Math.hypot(x - mound.centre.x, z - mound.centre.z);
      if (r <= mound.radius) {
        if (fromY === undefined || fromY >= mound.topY - 0.6) return mound.topY;
      }
    }
    return MOON_FLOOR_Y;
  }

  function isLowGravityAt(x: number, z: number): boolean {
    // Everything except the Sun's own stone. Standing ON the plinth you are
    // still on the lift; one step off it and you are on the Moon.
    return arrivalR(x, z) > MOON_ARRIVAL_RADIUS_M;
  }

  return {
    shell,
    interior,
    centre,
    chamberRadius,
    arrival,
    arrivalRadius: MOON_ARRIVAL_RADIUS_M,
    arrivalHoleRadius: MOON_ARRIVAL_HOLE_RADIUS_M,
    mounds,
    doorBand,
    wallRects,
    ceilingRects,
    bayBounds: shell,
    blockedAt,
    elevationAt,
    isLowGravityAt,
    probes: {
      arrival: { ...arrival },
      firstStep: { x: arrival.x + MOON_ARRIVAL_RADIUS_M + 0.6, z: arrival.z },
      centre: { ...centre },
      exit: { x: interior.maxX - 1.0, z: cz(interior) },
    },
  };
}

export function createMoonTerrain(grid: MuseumGrid): MuseumTerrainProgram | null {
  const layout = buildMoonLayout(grid);
  if (!layout) return null;
  return {
    waterlineY: WATERLINE_Y,
    elevationAt: (x, z, fromY) => layout.elevationAt(x, z, fromY),
    blockedAt: (x, z) => layout.blockedAt(x, z),
  };
}

/** Exported for the graybox's own centring maths. */
export const moonInteriorCentre = (r: WorldRect): Point2 => ({
  x: cx(r),
  z: cz(r),
});
