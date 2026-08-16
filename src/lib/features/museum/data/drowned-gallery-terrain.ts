/**
 * Drowned Gallery terrain program — "The Ring" (v2).
 *
 * Pure geometry: given the compiled cave grid, derives world-space elevation
 * zones, blocked regions, and EVERY rect the graybox renders for the Water
 * bay. The physics provider consumes elevationAt/blockedAt; the graybox visual
 * layer consumes the same rect lists. One geometry source — a rect the graybox
 * draws that the terrain does not know about is a bug by construction.
 *
 * Route: flooded approach → the flooded gallery (a rock-roofed S-path walked on
 * the bottom, ceiling BELOW the waterline so no air is visible) → a surfacing
 * stair that breaks the water at a mid-stair landing → the grotto ring
 * (apron → west walkway → procession → east walkway → apron).
 *
 * Everything below derives from compiled room bounds and real door tiles.
 * There are no absolute world coordinates in this file and none in the
 * graybox: offsets are metres measured from a bound or a door span.
 *
 * Datum: default museum floor = 0. See
 * docs/superpowers/specs/2026-08-03-drowned-gallery-ring-flow-design.md.
 */
import { tileKey } from "../domain/museum-grid-types";
import type {
  MuseumGrid,
  MuseumTerrainProgram,
} from "../domain/museum-grid-types";

/** One museum tile = 0.5 m. */
export const TILE_METRES = 0.5;
const TILE = TILE_METRES;
/**
 * Half a tile. The engine addresses a tile by its CENTRE (`world = tile * TILE`)
 * and the physics provider looks a position up with `Math.round(world / TILE)`,
 * so a tile physically occupies `[centre - HALF, centre + HALF]`. Every rect in
 * this module is built on that convention: rect edges land on cell boundaries,
 * never on a tile centre. Getting this wrong puts a walkable tile's centre
 * exactly on a blocked rect's edge, and a hair of floating-point drift then
 * wedges the player against an invisible wall.
 */
const HALF = TILE / 2;

/**
 * Snaps "n metres in from a room's interior edge" onto a tile centre. The
 * interior edge sits half a tile outside the first tile's centre, so a centred
 * offset is that half tile plus a whole number of tiles.
 */
export function tileCentredOffset(metresFromInteriorMin: number): number {
  return HALF + Math.round((metresFromInteriorMin - HALF) / TILE) * TILE;
}

/**
 * Player eye height above the local floor: the physics provider's STANDING_Y
 * (0.85) plus UCC's first-person offset (0.75). The submersion trigger in
 * Museum3DScene compares `position.y + 0.75` against the waterline, and
 * `position.y` is `floor + 0.85` — so the eye is always `floor + 1.6`.
 */
export const EYE_ABOVE_FLOOR = 1.6;

// ── Datums ──────────────────────────────────────────────────────────────────

export const WATERLINE_Y = -1.5;
/**
 * Wading depth at the approach's north end and along the approach↔gallery
 * corridor. A hair below the waterline so the water plane is not coplanar with
 * the floor it covers (that reads as z-fighting, not as shallow water).
 */
export const SHALLOWS_Y = WATERLINE_Y - 0.12;
export const GALLERY_FLOOR_Y = -4.5;
/** Rock roof over the gallery path — deliberately BELOW the waterline. */
export const GALLERY_ROOF_Y = -1.9;
/**
 * The flat mid-stair landing on the surfacing stair. DERIVED, not authored:
 * standing here puts the eye exactly on the waterline, so the surface break —
 * the first breath and the doubled-firelight money shot — happens ON the
 * landing rather than somewhere on the ramp below it.
 */
export const LANDING_Y = WATERLINE_Y - EYE_ABOVE_FLOOR;
export const CAUSEWAY_Y = -0.3;
/**
 * The GROTTO's own waterline — brimming, 0.15 m under the causeway lip.
 *
 * The grotto is not the submerged gallery and must not borrow its datum. The
 * gallery's WATERLINE_Y (-1.5) is correct there because you walk its bottom at
 * -4.5 under a roof at -1.9. Applied to the grotto, whose decks sit at
 * CAUSEWAY_Y (-0.3), it sank the channel and the pool into 1.2 m trenches:
 * two disconnected slabs of water with a dry lip all round, in a room whose
 * whole subject is one flooded system. Austen, walking it 2026-08-09: "the
 * water is disconnected from the floor and from the rest of the water."
 *
 * Brimming at -0.45 fixes both complaints with one number. The water meets the
 * floor at a curb reveal instead of a pit, and because the channel and the
 * pool now share a level either side of a low causeway, they read as one body
 * crossed by a path rather than two holes. It also puts the reflecting surface
 * up at eye-relevant height, which is the whole point of the room: A, B and C
 * stand on the north shore and double in the channel directly in front of them.
 *
 * Keep the 0.15 m reveal. Coplanar water reads as z-fighting, and a visible
 * lip is what tells the eye where the walkable floor ends.
 */
export const GROTTO_WATERLINE_Y = CAUSEWAY_Y - 0.15;
export const SHELF_Y = -1.0;
export const CHANNEL_BED_Y = -2.7;
export const POOL_BOTTOM_Y = -5.0;
export const DOME_APEX_Y = 9.5;
/** Ceiling over the two open shafts and the connecting corridors. */
export const SHAFT_CEILING_Y = 2.6;
/**
 * Clearance the rock roof needs over the floor. The walker's eye sits at
 * floor + 1.6, so a roof any tighter than this is a roof the player's head
 * passes through — which is where each stair's rock has to give way to an
 * open shaft.
 */
export const ROOF_HEADROOM = 2.0;
/** Deepest floor the rock roof can still cover. */
export const ROOF_SPLIT_Y = GALLERY_ROOF_Y - ROOF_HEADROOM;

// ── Shared anchors (the floor plan's performer stations read these) ──────────

/** Alcove centres as fractions of the grotto's interior width, west → east. */
export const ALCOVE_X_FRACTIONS = [0.22, 0.5, 0.78] as const;
/** Alcove shelf centre, metres south of the grotto's north interior edge. */
export const ALCOVE_Z_OFFSET_M = 2.0;

// ── Room ids ────────────────────────────────────────────────────────────────

export const APPROACH_ROOM_ID = "cave-water-approach";
export const GALLERY_ROOM_ID = "cave-water-gallery";
export const GROTTO_ROOM_ID = "cave-water";

// ── Grotto band proportions ─────────────────────────────────────────────────
// Fractions of the compiled interior, authored against the design spec's
// 25 × 22 m grotto so the bands keep their proportions if the room resizes.

const BAND_Z = {
  shoreEnd: 3.5 / 22,
  channelEnd: 7.5 / 22,
  processionEnd: 10 / 22,
  poolEnd: 17.5 / 22,
  thresholdStart: 14 / 22,
  thresholdEnd: 15 / 22,
} as const;

const BAND_X = {
  waterStart: 2.5 / 25,
  waterfallEnd: 4 / 25,
  waterEnd: 21.5 / 25,
} as const;

// ── Gallery path metrics (metres; a corridor width does not scale with a room)

const PATH_WIDTH = 2.5;
/** Gap between the west wall and the long north-running leg. */
const PATH_INSET = 1.5;
const DESCENT_RUN = 5.5;
const SURFACING_RUN = 8.0;
const LANDING_DEPTH = 1.4;
/** Thickness of every rendered wall slab. */
export const WALL_THICKNESS = 0.6;
/** See elevationAt: how far tile rounding lets the player drift past a rect edge. */
const TILE_ROUNDING_SLOP = TILE / 2;
/** Depth of the grotto's exit ramp up to the museum datum at the Fire door. */
const EXIT_RAMP_RUN = 2.0;

// ── Types ───────────────────────────────────────────────────────────────────

export interface WorldRect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export type FloorKind = "flat" | "ramp-z" | "ramp-x";

export interface FloorRect {
  id: string;
  rect: WorldRect;
  kind: FloorKind;
  /** Elevation at the rect's minimum edge along its axis (equal to `toY` when flat). */
  fromY: number;
  /** Elevation at the rect's maximum edge along its axis. */
  toY: number;
}

export interface WallRect {
  id: string;
  rect: WorldRect;
  baseY: number;
  topY: number;
}

export interface CeilingRect {
  id: string;
  rect: WorldRect;
  y: number;
}

export interface WaterVolume {
  id: string;
  rect: WorldRect;
  floorY: number;
  /**
   * Top of this body of water. Explicit per volume: the submerged gallery and
   * the brimming grotto are at different levels, and a renderer that assumes
   * one global waterline sinks the grotto into a trench (see
   * GROTTO_WATERLINE_Y).
   */
  surfaceY: number;
}

/**
 * A rendered water surface. Carries its own elevation for the same reason
 * WaterVolume does — never render these at a single global waterline.
 */
export interface WaterPlane extends WorldRect {
  surfaceY: number;
}

export interface Span {
  min: number;
  max: number;
}

export interface Point2 {
  x: number;
  z: number;
}

/**
 * A piece of exhibit furniture the wing needs, placed by the same pass that
 * places the room. Kept here rather than in the scene component so the boards,
 * the graybox and the tests all read one source for where things stand.
 *
 * Every placement below is derived from a room rect, never typed in by eye.
 */
export interface ExhibitFixture {
  id: string;
  kind:
    | "opener-dais"
    | "opener-plinth"
    | "case-showcase"
    | "case-screen"
    | "case-card";
  /** Expanded word for case furniture; absent on the opener. */
  caseWord?: string;
  centre: Point2;
  /** Footprint in metres, x by z. */
  size: { x: number; z: number };
  /** The floor datum the object stands on. */
  baseY: number;
  /** Metres above baseY. */
  height: number;
  /** Facing in radians about +Y. 0 looks toward +z. */
  facing: number;
}

export interface DrownedGalleryLayout {
  /** Interior world rects of the three rooms on the water route. */
  approach: WorldRect;
  gallery: WorldRect;
  grotto: WorldRect;

  // ── gallery ──
  /** Descent stair at the gallery's south door: SHALLOWS_Y → GALLERY_FLOOR_Y. */
  descentStair: WorldRect;
  /** The part of the descent stair above the landing datum — an open shaft. */
  descentOpen: WorldRect;
  /** The part of the descent stair the rock roof covers. */
  descentRoofed: WorldRect;
  /** The leg that runs west off the bottom of the descent stair. */
  westRun: WorldRect;
  /** The long leg that runs north up the gallery's west side. The bloom sits at its midpoint. */
  northRun: WorldRect;
  /** The leg that bends east toward the surfacing stair. */
  eastBend: WorldRect;
  surfacingUpper: WorldRect;
  surfacingLanding: WorldRect;
  surfacingLower: WorldRect;
  /** Whole surfacing stair footprint (upper + landing + lower). */
  surfacingStair: WorldRect;
  /** The part of the surfacing stair the rock roof covers. */
  surfacingRoofed: WorldRect;
  /** The part of the surfacing stair that rises through an open shaft. */
  surfacingOpen: WorldRect;
  /** Every gallery interior tile that is not path or stair, merged into rects. */
  rockFill: WorldRect[];
  /** The two places the rock roof opens and a water surface is visible. */
  openShafts: WorldRect[];
  bloomAnchor: Point2;

  // ── grotto ──
  shore: WorldRect;
  channel: WorldRect;
  procession: WorldRect;
  pool: WorldRect;
  apron: WorldRect;
  westWalkway: WorldRect;
  eastWalkway: WorldRect;
  exitRamp: WorldRect;
  waterfall: WorldRect;
  /** Carved threshold on the east walkway: the frame's footprint. */
  threshold: WorldRect;
  /** The two blocked jambs the threshold stands on. */
  thresholdJambs: WorldRect[];
  /** The walk-through gap between the jambs. */
  thresholdOpening: WorldRect;
  /** Shelf centres for A, B, C, west → east. Performer stations read the same expression. */
  alcoves: Point2[];
  /** Rails along every walkway edge that faces water. */
  balustrades: WorldRect[];
  /** The wing's exhibit furniture: the opener pair and the three case triptychs. */
  exhibitFixtures: ExhibitFixture[];

  // ── corridors ──
  approachCorridor: WorldRect[];
  galleryCorridor: WorldRect[];

  // ── everything the graybox renders ──
  floorRects: FloorRect[];
  wallRects: WallRect[];
  ceilingRects: CeilingRect[];
  roofRects: WorldRect[];
  waterPlanes: WaterPlane[];
  waterVolumes: WaterVolume[];

  /** Union bbox of the water bay. elevationAt throws inside it when nothing matches. */
  bayBounds: WorldRect;

  // ── probes for tests ──
  probes: {
    apron: Point2;
    procession: Point2;
    westWalkway: Point2;
    eastWalkway: Point2;
    pool: Point2;
    channel: Point2;
    shore: Point2;
    thresholdOpening: Point2;
    bloom: Point2;
    /** A point inside the gallery's rock fill — no floor covers it. */
    rock: Point2;
  };
}

// ── Small helpers ───────────────────────────────────────────────────────────

/** The room's interior as the union of its interior tiles' cells. */
export function interiorWorldRect(b: {
  x: number;
  y: number;
  width: number;
  height: number;
}): WorldRect {
  return {
    minX: (b.x + 1) * TILE - HALF,
    minZ: (b.y + 1) * TILE - HALF,
    maxX: (b.x + b.width - 2) * TILE + HALF,
    maxZ: (b.y + b.height - 2) * TILE + HALF,
  };
}

/** Closed containment — used for elevation lookups so no boundary is orphaned. */
export function inRectClosed(r: WorldRect, x: number, z: number): boolean {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

/**
 * Half-open containment — used for blocking. A tile's world position is its
 * minimum corner, so `[min, max)` puts every tile on exactly one side of a
 * shared edge: the tile at a rect's `max` belongs to the NEXT rect.
 */
function inRectHalfOpen(r: WorldRect, x: number, z: number): boolean {
  return x >= r.minX && x < r.maxX && z >= r.minZ && z < r.maxZ;
}

const cx = (r: WorldRect) => (r.minX + r.maxX) / 2;
const cz = (r: WorldRect) => (r.minZ + r.maxZ) / 2;
const centre = (r: WorldRect): Point2 => ({ x: cx(r), z: cz(r) });

/**
 * World-space extent of a room's door tiles on one wall, as the FULL tile
 * extent (`[firstTile, lastTile + 1] * TILE`) rather than the tile origins —
 * a rendered wall must clear the whole doorway, not stop half a tile short.
 * Rooms are placed by the layout engine and doors by the wall stamper, so this
 * scan is the only honest source for where a doorway actually is.
 */
export function doorSpan(
  grid: MuseumGrid,
  roomId: string,
  wall: "north" | "south" | "east" | "west"
): Span | null {
  const wing = grid.wings.find((w) => w.id === roomId);
  if (!wing) return null;
  const { x, y, width, height } = wing.bounds;
  let minTile = Infinity;
  let maxTile = -Infinity;
  if (wall === "north" || wall === "south") {
    const wallY = wall === "north" ? y : y + height - 1;
    for (let tx = x; tx < x + width; tx++) {
      if (grid.tiles.get(tileKey(tx, wallY))?.type === "door") {
        minTile = Math.min(minTile, tx);
        maxTile = Math.max(maxTile, tx);
      }
    }
  } else {
    const wallX = wall === "west" ? x : x + width - 1;
    for (let ty = y; ty < y + height; ty++) {
      if (grid.tiles.get(tileKey(wallX, ty))?.type === "door") {
        minTile = Math.min(minTile, ty);
        maxTile = Math.max(maxTile, ty);
      }
    }
  }
  if (!Number.isFinite(minTile)) return null;
  return { min: minTile * TILE - HALF, max: maxTile * TILE + HALF };
}

/** Widen `span` to `width`, keeping it centred and inside `[lo, hi]`. */
export function widenSpan(span: Span, width: number, lo: number, hi: number): Span {
  const half = width / 2;
  const c = (span.min + span.max) / 2;
  let min = c - half;
  let max = c + half;
  if (min < lo) {
    max += lo - min;
    min = lo;
  }
  if (max > hi) {
    min -= max - hi;
    max = hi;
  }
  return { min: Math.min(min, span.min), max: Math.max(max, span.max) };
}

/**
 * Scan a tile band for a tile-type family and decompose the hits into world
 * rects: contiguous x-runs per row, with consecutive rows merged when their
 * run lists match exactly. Rects cover the hit tiles' cells.
 */
export function bandRects(
  grid: MuseumGrid,
  txMin: number,
  txMax: number,
  tyMin: number,
  tyMax: number,
  matches: (type: string) => boolean
): WorldRect[] {
  type Run = { x0: number; x1: number };
  const rows: { ty: number; runs: Run[] }[] = [];
  for (let ty = tyMin; ty <= tyMax; ty++) {
    const runs: Run[] = [];
    let cur: Run | null = null;
    for (let tx = txMin; tx <= txMax; tx++) {
      const tile = grid.tiles.get(tileKey(tx, ty));
      if (tile && matches(tile.type)) {
        if (cur && cur.x1 === tx - 1) cur.x1 = tx;
        else runs.push((cur = { x0: tx, x1: tx }));
      } else {
        cur = null;
      }
    }
    if (runs.length > 0) rows.push({ ty, runs });
  }
  const rects: WorldRect[] = [];
  let openKey = "";
  let openTyEnd = -Infinity;
  let open: WorldRect[] = [];
  for (const { ty, runs } of rows) {
    const key = runs.map((r) => `${r.x0}-${r.x1}`).join(",");
    if (key === openKey && openTyEnd === ty - 1) {
      for (const rect of open) rect.maxZ = ty * TILE + HALF;
      openTyEnd = ty;
      continue;
    }
    open = runs.map((r) => ({
      minX: r.x0 * TILE - HALF,
      minZ: ty * TILE - HALF,
      maxX: r.x1 * TILE + HALF,
      maxZ: ty * TILE + HALF,
    }));
    rects.push(...open);
    openKey = key;
    openTyEnd = ty;
  }
  return rects;
}

/**
 * Tile-rasterised set difference: every interior tile of `bounds` whose cell is
 * NOT inside one of `holes`, merged into rects with the same row-run algorithm
 * as `bandRects`. Used to shape the gallery's rock fill around the S-path, so
 * rock and path abut exactly and neither can leave a seam.
 */
export function subtractTiles(bounds: WorldRect, holes: WorldRect[]): WorldRect[] {
  const EPS = 1e-6;
  const txMin = Math.round((bounds.minX + HALF) / TILE);
  const txMax = Math.round((bounds.maxX - HALF) / TILE);
  const tyMin = Math.round((bounds.minZ + HALF) / TILE);
  const tyMax = Math.round((bounds.maxZ - HALF) / TILE);
  const covered = (tx: number, ty: number) =>
    holes.some(
      (h) =>
        tx * TILE - HALF >= h.minX - EPS &&
        tx * TILE + HALF <= h.maxX + EPS &&
        ty * TILE - HALF >= h.minZ - EPS &&
        ty * TILE + HALF <= h.maxZ + EPS
    );

  type Run = { x0: number; x1: number };
  const rows: { ty: number; runs: Run[] }[] = [];
  for (let ty = tyMin; ty <= tyMax; ty++) {
    const runs: Run[] = [];
    let cur: Run | null = null;
    for (let tx = txMin; tx <= txMax; tx++) {
      if (!covered(tx, ty)) {
        if (cur && cur.x1 === tx - 1) cur.x1 = tx;
        else runs.push((cur = { x0: tx, x1: tx }));
      } else {
        cur = null;
      }
    }
    if (runs.length > 0) rows.push({ ty, runs });
  }
  const rects: WorldRect[] = [];
  let openKey = "";
  let openTyEnd = -Infinity;
  let open: WorldRect[] = [];
  for (const { ty, runs } of rows) {
    const key = runs.map((r) => `${r.x0}-${r.x1}`).join(",");
    if (key === openKey && openTyEnd === ty - 1) {
      for (const rect of open) rect.maxZ = ty * TILE + HALF;
      openTyEnd = ty;
      continue;
    }
    open = runs.map((r) => ({
      minX: r.x0 * TILE - HALF,
      minZ: ty * TILE - HALF,
      maxX: r.x1 * TILE + HALF,
      maxZ: ty * TILE + HALF,
    }));
    rects.push(...open);
    openKey = key;
    openTyEnd = ty;
  }
  return rects;
}

/** Split `[from, to]` around excluded spans, returning the remainder. */
export function spansExcluding(
  from: number,
  to: number,
  holes: Span[]
): [number, number][] {
  const sorted = [...holes].sort((a, b) => a.min - b.min);
  const out: [number, number][] = [];
  let cursor = from;
  for (const hole of sorted) {
    if (hole.min > cursor) out.push([cursor, Math.min(hole.min, to)]);
    cursor = Math.max(cursor, hole.max);
  }
  if (cursor < to) out.push([cursor, to]);
  return out.filter(([a, b]) => b - a > 0.01);
}

export function unionRect(rects: WorldRect[]): WorldRect {
  return {
    minX: Math.min(...rects.map((r) => r.minX)),
    minZ: Math.min(...rects.map((r) => r.minZ)),
    maxX: Math.max(...rects.map((r) => r.maxX)),
    maxZ: Math.max(...rects.map((r) => r.maxZ)),
  };
}

// ── Layout ──────────────────────────────────────────────────────────────────

export function buildDrownedGalleryLayout(
  grid: MuseumGrid
): DrownedGalleryLayout | null {
  const approachWing = grid.wings.find((w) => w.id === APPROACH_ROOM_ID);
  const galleryWing = grid.wings.find((w) => w.id === GALLERY_ROOM_ID);
  const grottoWing = grid.wings.find((w) => w.id === GROTTO_ROOM_ID);
  if (!approachWing || !galleryWing || !grottoWing) return null;

  const approach = interiorWorldRect(approachWing.bounds);
  const gallery = interiorWorldRect(galleryWing.bounds);
  const grotto = interiorWorldRect(grottoWing.bounds);

  const gallerySouthDoor = doorSpan(grid, GALLERY_ROOM_ID, "south");
  const galleryNorthDoor = doorSpan(grid, GALLERY_ROOM_ID, "north");
  const grottoSouthDoor = doorSpan(grid, GROTTO_ROOM_ID, "south");
  const grottoEastDoor = doorSpan(grid, GROTTO_ROOM_ID, "east");
  const approachNorthDoor = doorSpan(grid, APPROACH_ROOM_ID, "north");
  if (
    !gallerySouthDoor ||
    !galleryNorthDoor ||
    !grottoSouthDoor ||
    !grottoEastDoor ||
    !approachNorthDoor
  ) {
    throw new Error(
      "Drowned gallery layout: a door on the water route is missing from the compiled grid"
    );
  }

  // ── Gallery S-path ────────────────────────────────────────────────────────
  const descentX = widenSpan(
    gallerySouthDoor,
    PATH_WIDTH,
    gallery.minX,
    gallery.maxX
  );
  const stairX = galleryNorthDoor;

  const descentStair: WorldRect = {
    minX: descentX.min,
    maxX: descentX.max,
    minZ: gallery.maxZ - DESCENT_RUN,
    maxZ: gallery.maxZ,
  };
  // The descent is a straight ramp, so the roof can only close over it once the
  // floor has dropped far enough to leave headroom. Above that the shaft is
  // open — which is exactly the beat: you walk down into open water and the
  // rock closes over your head.
  const descentSplitZ =
    descentStair.minZ +
    DESCENT_RUN *
      ((ROOF_SPLIT_Y - GALLERY_FLOOR_Y) / (SHALLOWS_Y - GALLERY_FLOOR_Y));
  const descentRoofed: WorldRect = { ...descentStair, maxZ: descentSplitZ };
  const descentOpen: WorldRect = { ...descentStair, minZ: descentSplitZ };

  const surfacingRise = CAUSEWAY_Y - GALLERY_FLOOR_Y;
  const rampTotal = SURFACING_RUN - LANDING_DEPTH;
  const upperRun = (rampTotal * (CAUSEWAY_Y - LANDING_Y)) / surfacingRise;
  const lowerRun = rampTotal - upperRun;

  const surfacingUpper: WorldRect = {
    minX: stairX.min,
    maxX: stairX.max,
    minZ: gallery.minZ,
    maxZ: gallery.minZ + upperRun,
  };
  const surfacingLanding: WorldRect = {
    minX: stairX.min,
    maxX: stairX.max,
    minZ: surfacingUpper.maxZ,
    maxZ: surfacingUpper.maxZ + LANDING_DEPTH,
  };
  const surfacingLower: WorldRect = {
    minX: stairX.min,
    maxX: stairX.max,
    minZ: surfacingLanding.maxZ,
    maxZ: surfacingLanding.maxZ + lowerRun,
  };
  const surfacingStair: WorldRect = {
    minX: stairX.min,
    maxX: stairX.max,
    minZ: gallery.minZ,
    maxZ: surfacingLower.maxZ,
  };

  const westRun: WorldRect = {
    minX: gallery.minX + PATH_INSET,
    maxX: descentStair.maxX,
    minZ: descentStair.minZ - PATH_WIDTH,
    maxZ: descentStair.minZ,
  };
  const eastBend: WorldRect = {
    minX: gallery.minX + PATH_INSET,
    maxX: surfacingStair.maxX,
    minZ: surfacingStair.maxZ,
    maxZ: surfacingStair.maxZ + PATH_WIDTH,
  };
  const northRun: WorldRect = {
    minX: gallery.minX + PATH_INSET,
    maxX: gallery.minX + PATH_INSET + PATH_WIDTH,
    minZ: eastBend.maxZ,
    maxZ: westRun.minZ,
  };
  if (northRun.maxZ - northRun.minZ < PATH_WIDTH) {
    throw new Error(
      "Drowned gallery layout: the flooded gallery is too shallow for its S-path — " +
        "the descent stair and the surfacing stair have eaten the north run"
    );
  }

  // Mirror of the descent: the rock roof runs out partway up the lower flight,
  // so the last stretch under the surface is an open shaft and the player sees
  // the underside of the water before breaking it on the landing.
  const surfacingSplitZ =
    surfacingLower.minZ +
    lowerRun * ((ROOF_SPLIT_Y - LANDING_Y) / (GALLERY_FLOOR_Y - LANDING_Y));
  const surfacingRoofed: WorldRect = {
    ...surfacingLower,
    minZ: surfacingSplitZ,
  };
  const surfacingOpen: WorldRect = { ...surfacingStair, maxZ: surfacingSplitZ };

  const galleryPath = [
    descentStair,
    westRun,
    northRun,
    eastBend,
    surfacingStair,
  ];
  const rockFill = subtractTiles(gallery, galleryPath);
  const openShafts = [descentOpen, surfacingOpen];
  const bloomAnchor = centre(northRun);

  // ── Grotto ring ───────────────────────────────────────────────────────────
  const gw = grotto.maxX - grotto.minX;
  const gd = grotto.maxZ - grotto.minZ;
  const zAt = (f: number) => grotto.minZ + gd * f;
  const xAt = (f: number) => grotto.minX + gw * f;

  const shore: WorldRect = {
    minX: grotto.minX,
    maxX: grotto.maxX,
    minZ: grotto.minZ,
    maxZ: zAt(BAND_Z.shoreEnd),
  };
  const channel: WorldRect = {
    minX: xAt(BAND_X.waterStart),
    maxX: xAt(BAND_X.waterEnd),
    minZ: shore.maxZ,
    maxZ: zAt(BAND_Z.channelEnd),
  };
  const procession: WorldRect = {
    minX: channel.minX,
    maxX: channel.maxX,
    minZ: channel.maxZ,
    maxZ: zAt(BAND_Z.processionEnd),
  };
  const pool: WorldRect = {
    minX: channel.minX,
    maxX: channel.maxX,
    minZ: procession.maxZ,
    maxZ: zAt(BAND_Z.poolEnd),
  };
  const westWalkway: WorldRect = {
    minX: grotto.minX,
    maxX: channel.minX,
    minZ: shore.maxZ,
    maxZ: pool.maxZ,
  };
  const eastWalkway: WorldRect = {
    minX: channel.maxX,
    maxX: grotto.maxX,
    minZ: shore.maxZ,
    maxZ: grotto.maxZ,
  };
  const apron: WorldRect = {
    minX: grotto.minX,
    maxX: channel.maxX,
    minZ: pool.maxZ,
    maxZ: grotto.maxZ,
  };
  const exitRamp: WorldRect = {
    minX: grotto.maxX - EXIT_RAMP_RUN,
    maxX: grotto.maxX,
    minZ: grottoEastDoor.min - 1,
    maxZ: Math.min(grotto.maxZ, grottoEastDoor.max + 1),
  };
  const eastWalkwayPieces: WorldRect[] = [
    { ...eastWalkway, maxX: exitRamp.minX },
    { ...eastWalkway, minX: exitRamp.minX, maxZ: exitRamp.minZ },
    { ...eastWalkway, minX: exitRamp.minX, minZ: exitRamp.maxZ },
  ].filter((r) => r.maxX - r.minX > 0.01 && r.maxZ - r.minZ > 0.01);
  const waterfall: WorldRect = {
    minX: channel.minX,
    maxX: xAt(BAND_X.waterfallEnd),
    minZ: channel.minZ + (channel.maxZ - channel.minZ) * 0.25,
    maxZ: channel.maxZ - (channel.maxZ - channel.minZ) * 0.25,
  };

  const threshold: WorldRect = {
    minX: eastWalkway.minX,
    maxX: eastWalkway.maxX,
    minZ: zAt(BAND_Z.thresholdStart),
    maxZ: zAt(BAND_Z.thresholdEnd),
  };
  // The frame must not narrow the walkway below the walk-through minimum, and
  // its jambs stand a whole number of tiles wide so their faces land on cell
  // boundaries rather than on a walkable tile's centre.
  const walkwayWidth = threshold.maxX - threshold.minX;
  const jambWidth = Math.max(
    TILE,
    Math.floor((walkwayWidth - 2.2) / 2 / TILE) * TILE
  );
  const thresholdJambs: WorldRect[] = [
    { ...threshold, maxX: threshold.minX + jambWidth },
    { ...threshold, minX: threshold.maxX - jambWidth },
  ];
  const thresholdOpening: WorldRect = {
    ...threshold,
    minX: threshold.minX + jambWidth,
    maxX: threshold.maxX - jambWidth,
  };

  // Anchors sit on tile centres so the compiled performer stations can land on
  // exactly the same point — see interiorOffsetFraction in the floor plan.
  const alcoves: Point2[] = ALCOVE_X_FRACTIONS.map((f) => ({
    x: grotto.minX + tileCentredOffset(gw * f),
    z: grotto.minZ + tileCentredOffset(ALCOVE_Z_OFFSET_M),
  }));

  // Rails on every walkway edge that faces water. The procession has water on
  // BOTH sides, so it gets two.
  const RAIL_T = 0.25;
  const balustrades: WorldRect[] = [
    // pool perimeter
    { ...pool, maxZ: pool.minZ, minZ: pool.minZ - RAIL_T },
    { ...pool, minZ: pool.maxZ, maxZ: pool.maxZ + RAIL_T },
    { ...pool, maxX: pool.minX, minX: pool.minX - RAIL_T },
    { ...pool, minX: pool.maxX, maxX: pool.maxX + RAIL_T },
    // channel perimeter, walkway-facing edges only (its north edge is the
    // alcove shore's rock face, which needs no rail)
    { ...channel, minZ: channel.maxZ, maxZ: channel.maxZ + RAIL_T },
    { ...channel, maxX: channel.minX, minX: channel.minX - RAIL_T },
    { ...channel, minX: channel.maxX, maxX: channel.maxX + RAIL_T },
  ];

  // ── Exhibit furniture ─────────────────────────────────────────────────────
  // The visitor enters at the apron, walks the procession west→east facing the
  // cases across the channel, and leaves through the east threshold. So the
  // opener meets them on arrival, the showcases sit on the shelf, the screens
  // go on the shore wall behind each showcase, and the card signs sit on the
  // near bank at the visitor's own eye level.
  const CASE_WORDS = ["AAAA", "BBBB", "CCCC"] as const;

  const SHOWCASE_FOOTPRINT = { x: 2.0, z: 2.0 };
  const SCREEN_FOOTPRINT = { x: 2.2, z: 0.2 };
  const CARD_FOOTPRINT = { x: 0.9, z: 0.45 };
  const OPENER_DAIS_FOOTPRINT = { x: 2.4, z: 2.4 };
  const OPENER_PLINTH_FOOTPRINT = { x: 0.9, z: 0.45 };

  /** Facing +z: presenting itself to a visitor who stands north of it. */
  const FACE_NORTH = 0;

  const caseFixtures: ExhibitFixture[] = alcoves.flatMap((anchor, index) => {
    const word = CASE_WORDS[index];
    return [
      {
        id: `case-showcase-${word}`,
        kind: "case-showcase" as const,
        caseWord: word,
        centre: { x: anchor.x, z: anchor.z },
        size: SHOWCASE_FOOTPRINT,
        baseY: SHELF_Y,
        height: 2.0,
        // The performer faces the visitor across the channel.
        facing: FACE_NORTH,
      },
      {
        id: `case-screen-${word}`,
        kind: "case-screen" as const,
        caseWord: word,
        // Flat against the shore's back wall, directly behind the showcase.
        centre: { x: anchor.x, z: shore.minZ + SCREEN_FOOTPRINT.z / 2 + 0.1 },
        size: SCREEN_FOOTPRINT,
        baseY: SHELF_Y,
        height: 2.6,
        facing: FACE_NORTH,
      },
      {
        id: `case-card-${word}`,
        kind: "case-card" as const,
        caseWord: word,
        // A lectern on the near bank, at the channel's edge, in line with its case.
        centre: {
          x: anchor.x,
          z: procession.minZ + CARD_FOOTPRINT.z / 2 + 0.35,
        },
        size: CARD_FOOTPRINT,
        baseY: CAUSEWAY_Y,
        height: 1.05,
        // Tilted to a visitor standing south of it, who then looks past it.
        facing: FACE_NORTH,
      },
    ];
  });

  // The corridor arrives on the apron's east half, so the opener stands in the
  // west half: seen on entry, walked past rather than walked around.
  const openerX = apron.minX + (apron.maxX - apron.minX) * 0.3;

  // The visitor arrives from +z, so the label plinth stands between them and the
  // dais and both face them. The pool's south rail eats the apron's first
  // RAIL_T of depth; the group centres in what is left rather than being shoved
  // against either edge.
  const OPENER_GAP = 0.85;
  const openerGroupDepth =
    OPENER_DAIS_FOOTPRINT.z + OPENER_GAP + OPENER_PLINTH_FOOTPRINT.z;
  const openerBandMinZ = apron.minZ + RAIL_T;
  const openerMargin = (apron.maxZ - openerBandMinZ - openerGroupDepth) / 2;
  const openerDaisZ =
    openerBandMinZ + openerMargin + OPENER_DAIS_FOOTPRINT.z / 2;
  const openerPlinthZ =
    openerDaisZ +
    OPENER_DAIS_FOOTPRINT.z / 2 +
    OPENER_GAP +
    OPENER_PLINTH_FOOTPRINT.z / 2;

  const openerFixtures: ExhibitFixture[] = [
    {
      id: "opener-dais",
      kind: "opener-dais",
      centre: { x: openerX, z: openerDaisZ },
      size: OPENER_DAIS_FOOTPRINT,
      baseY: CAUSEWAY_Y,
      height: 0.25,
      facing: FACE_NORTH,
    },
    {
      id: "opener-plinth",
      kind: "opener-plinth",
      centre: { x: openerX, z: openerPlinthZ },
      size: OPENER_PLINTH_FOOTPRINT,
      baseY: CAUSEWAY_Y,
      height: 1.05,
      facing: FACE_NORTH,
    },
  ];

  const exhibitFixtures: ExhibitFixture[] = [
    ...openerFixtures,
    ...caseFixtures,
  ];

  // ── Corridors ─────────────────────────────────────────────────────────────
  const ab = approachWing.bounds;
  const lb = galleryWing.bounds;
  const rb = grottoWing.bounds;

  const agTxMin = Math.min(ab.x, lb.x) - 2;
  const agTxMax = Math.max(ab.x + ab.width, lb.x + lb.width) + 2;
  const approachCorridor = bandRects(
    grid,
    agTxMin,
    agTxMax,
    lb.y + lb.height - 1,
    ab.y,
    (t) => t === "corridor" || t === "door"
  );
  const approachCorridorWalls = bandRects(
    grid,
    agTxMin,
    agTxMax,
    lb.y + lb.height,
    ab.y - 1,
    (t) => t === "wall"
  );

  const lgTxMin = Math.min(lb.x, rb.x) - 2;
  const lgTxMax = Math.max(lb.x + lb.width, rb.x + rb.width) + 2;
  const galleryCorridor = bandRects(
    grid,
    lgTxMin,
    lgTxMax,
    rb.y + rb.height - 1,
    lb.y,
    (t) => t === "corridor" || t === "door"
  );
  const galleryCorridorWalls = bandRects(
    grid,
    lgTxMin,
    lgTxMax,
    rb.y + rb.height,
    lb.y - 1,
    (t) => t === "wall"
  );

  // ── Floor rects: the single list physics and the graybox both read ────────
  const floorRects: FloorRect[] = [
    // approach + shallows
    {
      id: "approach-ramp",
      rect: approach,
      kind: "ramp-z",
      fromY: SHALLOWS_Y,
      toY: 0,
    },
    ...approachCorridor.map((rect, i) => ({
      id: `approach-corridor-${i}`,
      rect,
      kind: "flat" as const,
      fromY: SHALLOWS_Y,
      toY: SHALLOWS_Y,
    })),
    // gallery
    {
      id: "descent-stair",
      rect: descentStair,
      kind: "ramp-z",
      fromY: GALLERY_FLOOR_Y,
      toY: SHALLOWS_Y,
    },
    {
      id: "west-run",
      rect: westRun,
      kind: "flat",
      fromY: GALLERY_FLOOR_Y,
      toY: GALLERY_FLOOR_Y,
    },
    {
      id: "north-run",
      rect: northRun,
      kind: "flat",
      fromY: GALLERY_FLOOR_Y,
      toY: GALLERY_FLOOR_Y,
    },
    {
      id: "east-bend",
      rect: eastBend,
      kind: "flat",
      fromY: GALLERY_FLOOR_Y,
      toY: GALLERY_FLOOR_Y,
    },
    {
      id: "surfacing-lower",
      rect: surfacingLower,
      kind: "ramp-z",
      fromY: LANDING_Y,
      toY: GALLERY_FLOOR_Y,
    },
    {
      id: "surfacing-landing",
      rect: surfacingLanding,
      kind: "flat",
      fromY: LANDING_Y,
      toY: LANDING_Y,
    },
    {
      id: "surfacing-upper",
      rect: surfacingUpper,
      kind: "ramp-z",
      fromY: CAUSEWAY_Y,
      toY: LANDING_Y,
    },
    ...galleryCorridor.map((rect, i) => ({
      id: `gallery-corridor-${i}`,
      rect,
      kind: "flat" as const,
      fromY: CAUSEWAY_Y,
      toY: CAUSEWAY_Y,
    })),
    // grotto ring
    {
      id: "exit-ramp",
      rect: exitRamp,
      kind: "ramp-x",
      fromY: CAUSEWAY_Y,
      toY: 0,
    },
    { id: "apron", rect: apron, kind: "flat", fromY: CAUSEWAY_Y, toY: CAUSEWAY_Y },
    {
      id: "west-walkway",
      rect: westWalkway,
      kind: "flat",
      fromY: CAUSEWAY_Y,
      toY: CAUSEWAY_Y,
    },
    // The east walkway is split around the exit ramp so no two rendered floor
    // slabs ever share a footprint (coplanar slabs read as z-fighting).
    ...eastWalkwayPieces.map((rect, i) => ({
      id: `east-walkway-${i}`,
      rect,
      kind: "flat" as const,
      fromY: CAUSEWAY_Y,
      toY: CAUSEWAY_Y,
    })),
    {
      id: "procession",
      rect: procession,
      kind: "flat",
      fromY: CAUSEWAY_Y,
      toY: CAUSEWAY_Y,
    },
    // basins + shelf: rendered, never walked (all three are blocked)
    {
      id: "pool-bottom",
      rect: pool,
      kind: "flat",
      fromY: POOL_BOTTOM_Y,
      toY: POOL_BOTTOM_Y,
    },
    {
      id: "channel-bed",
      rect: channel,
      kind: "flat",
      fromY: CHANNEL_BED_Y,
      toY: CHANNEL_BED_Y,
    },
    { id: "shore-shelf", rect: shore, kind: "flat", fromY: SHELF_Y, toY: SHELF_Y },
  ];

  // ── Wall rects: envelopes with gaps derived from real door tiles ──────────
  const galleryBase = GALLERY_FLOOR_Y - 0.5;
  const grottoBase = POOL_BOTTOM_Y - 0.5;
  const wallRects: WallRect[] = [];

  const pushWall = (
    id: string,
    rect: WorldRect,
    baseY: number,
    topY: number
  ) => {
    if (rect.maxX - rect.minX > 0.01 && rect.maxZ - rect.minZ > 0.01) {
      wallRects.push({ id, rect, baseY, topY });
    }
  };

  // approach envelope — the room is tile-suppressed, so nothing else draws it
  const approachSouthDoor = doorSpan(grid, APPROACH_ROOM_ID, "south");
  pushWall(
    "approach-west",
    {
      minX: approach.minX - WALL_THICKNESS,
      maxX: approach.minX,
      minZ: approach.minZ - WALL_THICKNESS,
      maxZ: approach.maxZ + WALL_THICKNESS,
    },
    galleryBase,
    SHAFT_CEILING_Y
  );
  pushWall(
    "approach-east",
    {
      minX: approach.maxX,
      maxX: approach.maxX + WALL_THICKNESS,
      minZ: approach.minZ - WALL_THICKNESS,
      maxZ: approach.maxZ + WALL_THICKNESS,
    },
    galleryBase,
    SHAFT_CEILING_Y
  );
  for (const [x0, x1] of spansExcluding(approach.minX, approach.maxX, [
    approachNorthDoor,
  ])) {
    pushWall(
      `approach-north-${x0.toFixed(2)}`,
      {
        minX: x0,
        maxX: x1,
        minZ: approach.minZ - WALL_THICKNESS,
        maxZ: approach.minZ,
      },
      galleryBase,
      SHAFT_CEILING_Y
    );
  }
  if (approachSouthDoor) {
    for (const [x0, x1] of spansExcluding(approach.minX, approach.maxX, [
      approachSouthDoor,
    ])) {
      pushWall(
        `approach-south-${x0.toFixed(2)}`,
        {
          minX: x0,
          maxX: x1,
          minZ: approach.maxZ,
          maxZ: approach.maxZ + WALL_THICKNESS,
        },
        galleryBase,
        SHAFT_CEILING_Y
      );
    }
  }

  // gallery envelope
  pushWall(
    "gallery-west",
    {
      minX: gallery.minX - WALL_THICKNESS,
      maxX: gallery.minX,
      minZ: gallery.minZ - WALL_THICKNESS,
      maxZ: gallery.maxZ + WALL_THICKNESS,
    },
    galleryBase,
    SHAFT_CEILING_Y
  );
  pushWall(
    "gallery-east",
    {
      minX: gallery.maxX,
      maxX: gallery.maxX + WALL_THICKNESS,
      minZ: gallery.minZ - WALL_THICKNESS,
      maxZ: gallery.maxZ + WALL_THICKNESS,
    },
    galleryBase,
    SHAFT_CEILING_Y
  );
  for (const [x0, x1] of spansExcluding(gallery.minX, gallery.maxX, [
    galleryNorthDoor,
  ])) {
    pushWall(
      `gallery-north-${x0.toFixed(2)}`,
      {
        minX: x0,
        maxX: x1,
        minZ: gallery.minZ - WALL_THICKNESS,
        maxZ: gallery.minZ,
      },
      galleryBase,
      SHAFT_CEILING_Y
    );
  }
  for (const [x0, x1] of spansExcluding(gallery.minX, gallery.maxX, [
    gallerySouthDoor,
  ])) {
    pushWall(
      `gallery-south-${x0.toFixed(2)}`,
      {
        minX: x0,
        maxX: x1,
        minZ: gallery.maxZ,
        maxZ: gallery.maxZ + WALL_THICKNESS,
      },
      galleryBase,
      SHAFT_CEILING_Y
    );
  }

  // grotto envelope
  pushWall(
    "grotto-north",
    {
      minX: grotto.minX - WALL_THICKNESS,
      maxX: grotto.maxX + WALL_THICKNESS,
      minZ: grotto.minZ - WALL_THICKNESS,
      maxZ: grotto.minZ,
    },
    grottoBase,
    DOME_APEX_Y
  );
  pushWall(
    "grotto-west",
    {
      minX: grotto.minX - WALL_THICKNESS,
      maxX: grotto.minX,
      minZ: grotto.minZ,
      maxZ: grotto.maxZ + WALL_THICKNESS,
    },
    grottoBase,
    DOME_APEX_Y
  );
  for (const [z0, z1] of spansExcluding(grotto.minZ, grotto.maxZ, [
    grottoEastDoor,
  ])) {
    pushWall(
      `grotto-east-${z0.toFixed(2)}`,
      {
        minX: grotto.maxX,
        maxX: grotto.maxX + WALL_THICKNESS,
        minZ: z0,
        maxZ: z1,
      },
      grottoBase,
      DOME_APEX_Y
    );
  }
  for (const [x0, x1] of spansExcluding(grotto.minX, grotto.maxX, [
    grottoSouthDoor,
  ])) {
    pushWall(
      `grotto-south-${x0.toFixed(2)}`,
      {
        minX: x0,
        maxX: x1,
        minZ: grotto.maxZ,
        maxZ: grotto.maxZ + WALL_THICKNESS,
      },
      grottoBase,
      DOME_APEX_Y
    );
  }

  // corridor enclosures (the rooms' own wall rows are skipped by the scan)
  approachCorridorWalls.forEach((rect, i) =>
    pushWall(`approach-corridor-wall-${i}`, rect, galleryBase, SHAFT_CEILING_Y)
  );
  galleryCorridorWalls.forEach((rect, i) =>
    pushWall(`gallery-corridor-wall-${i}`, rect, galleryBase, SHAFT_CEILING_Y)
  );

  // Shaft collars: the rock fill stops at the roof, so each open shaft needs
  // its own walls from the roof up to the shaft ceiling. The side a shaft's
  // doorway is on is left open, and a side flush with the room envelope is
  // skipped — the envelope already stands there.
  const collar = (id: string, shaft: WorldRect, openSide: "north" | "south") => {
    const T = WALL_THICKNESS;
    const north = openSide !== "north";
    const south = openSide !== "south";
    const minZ = north ? shaft.minZ - T : shaft.minZ;
    const maxZ = south ? shaft.maxZ + T : shaft.maxZ;
    if (shaft.minX > gallery.minX + 0.01) {
      pushWall(
        `${id}-west`,
        { minX: shaft.minX - T, maxX: shaft.minX, minZ, maxZ },
        GALLERY_ROOF_Y,
        SHAFT_CEILING_Y
      );
    }
    if (shaft.maxX < gallery.maxX - 0.01) {
      pushWall(
        `${id}-east`,
        { minX: shaft.maxX, maxX: shaft.maxX + T, minZ, maxZ },
        GALLERY_ROOF_Y,
        SHAFT_CEILING_Y
      );
    }
    if (north) {
      pushWall(
        `${id}-north`,
        { minX: shaft.minX - T, maxX: shaft.maxX + T, minZ, maxZ: shaft.minZ },
        GALLERY_ROOF_Y,
        SHAFT_CEILING_Y
      );
    }
    if (south) {
      pushWall(
        `${id}-south`,
        { minX: shaft.minX - T, maxX: shaft.maxX + T, minZ: shaft.maxZ, maxZ },
        GALLERY_ROOF_Y,
        SHAFT_CEILING_Y
      );
    }
  };
  collar("descent-collar", descentOpen, "south");
  collar("surfacing-collar", surfacingOpen, "north");

  // ── Ceilings ──────────────────────────────────────────────────────────────
  const ceilingRects: CeilingRect[] = [
    { id: "grotto-dome", rect: grotto, y: DOME_APEX_Y },
    ...openShafts.map((rect, i) => ({
      id: `shaft-ceiling-${i}`,
      rect,
      y: SHAFT_CEILING_Y,
    })),
    ...approachCorridor.map((rect, i) => ({
      id: `approach-corridor-ceiling-${i}`,
      rect,
      y: SHAFT_CEILING_Y,
    })),
    ...galleryCorridor.map((rect, i) => ({
      id: `gallery-corridor-ceiling-${i}`,
      rect,
      y: SHAFT_CEILING_Y,
    })),
    { id: "approach-ceiling", rect: approach, y: SHAFT_CEILING_Y },
  ];

  // The rock roof: over every gallery path tile deep enough to carry it.
  const roofRects: WorldRect[] = [
    descentRoofed,
    westRun,
    northRun,
    eastBend,
    surfacingRoofed,
  ];

  // ── Water ─────────────────────────────────────────────────────────────────
  // A visible surface exists only where a shaft opens: the descent mouth and
  // the landing cut. Everywhere else the gallery's water reads as body, not
  // surface — that is the whole point of a roof below the waterline.
  const surfaceBreakZ =
    surfacingUpper.minZ +
    upperRun * ((CAUSEWAY_Y - WATERLINE_Y) / (CAUSEWAY_Y - LANDING_Y));
  // The approach ramp meets the water partway down; the plane stops exactly
  // where the ramp crosses the waterline rather than riding up onto dry rock.
  const approachRun = approach.maxZ - approach.minZ;
  const approachWadeZ =
    approach.minZ + approachRun * ((WATERLINE_Y - SHALLOWS_Y) / (0 - SHALLOWS_Y));
  // The submerged gallery sits at WATERLINE_Y; the grotto brims at its own,
  // much higher GROTTO_WATERLINE_Y. Two datums, never one.
  const submerged = (rect: WorldRect): WaterPlane => ({
    ...rect,
    surfaceY: WATERLINE_Y,
  });
  const brimming = (rect: WorldRect): WaterPlane => ({
    ...rect,
    surfaceY: GROTTO_WATERLINE_Y,
  });
  const waterPlanes: WaterPlane[] = [
    ...approachCorridor.map(submerged),
    submerged({ ...approach, maxZ: approachWadeZ }),
    submerged(descentOpen),
    submerged({ ...surfacingOpen, minZ: surfaceBreakZ }),
    brimming(channel),
    brimming(pool),
  ];

  const waterVolumes: WaterVolume[] = [
    {
      id: "vol-descent",
      rect: descentStair,
      floorY: GALLERY_FLOOR_Y,
      surfaceY: WATERLINE_Y,
    },
    {
      id: "vol-west-run",
      rect: westRun,
      floorY: GALLERY_FLOOR_Y,
      surfaceY: WATERLINE_Y,
    },
    {
      id: "vol-north-run",
      rect: northRun,
      floorY: GALLERY_FLOOR_Y,
      surfaceY: WATERLINE_Y,
    },
    {
      id: "vol-east-bend",
      rect: eastBend,
      floorY: GALLERY_FLOOR_Y,
      surfaceY: WATERLINE_Y,
    },
    {
      id: "vol-surfacing",
      rect: { ...surfacingLower, minZ: surfaceBreakZ },
      floorY: GALLERY_FLOOR_Y,
      surfaceY: WATERLINE_Y,
    },
    // Grotto: brimming, so these are deep bodies read from just under the lip.
    {
      id: "vol-channel",
      rect: channel,
      floorY: CHANNEL_BED_Y,
      surfaceY: GROTTO_WATERLINE_Y,
    },
    {
      id: "vol-pool",
      rect: pool,
      floorY: POOL_BOTTOM_Y,
      surfaceY: GROTTO_WATERLINE_Y,
    },
  ];

  const bayBounds = unionRect([
    approach,
    gallery,
    grotto,
    ...approachCorridor,
    ...galleryCorridor,
  ]);

  const rockProbe = rockFill.reduce((widest, r) =>
    (r.maxX - r.minX) * (r.maxZ - r.minZ) >
    (widest.maxX - widest.minX) * (widest.maxZ - widest.minZ)
      ? r
      : widest
  );

  return {
    approach,
    gallery,
    grotto,
    descentStair,
    descentOpen,
    descentRoofed,
    westRun,
    northRun,
    eastBend,
    surfacingUpper,
    surfacingLanding,
    surfacingLower,
    surfacingStair,
    surfacingRoofed,
    surfacingOpen,
    rockFill,
    openShafts,
    bloomAnchor,
    shore,
    channel,
    procession,
    pool,
    apron,
    westWalkway,
    eastWalkway,
    exitRamp,
    waterfall,
    threshold,
    thresholdJambs,
    thresholdOpening,
    alcoves,
    balustrades,
    exhibitFixtures,
    approachCorridor,
    galleryCorridor,
    floorRects,
    wallRects,
    ceilingRects,
    roofRects,
    waterPlanes,
    waterVolumes,
    bayBounds,
    probes: {
      apron: { x: cx(apron), z: cz(apron) },
      procession: centre(procession),
      westWalkway: centre(westWalkway),
      eastWalkway: { x: cx(eastWalkway), z: cz(procession) },
      pool: centre(pool),
      channel: centre(channel),
      shore: centre(shore),
      thresholdOpening: centre(thresholdOpening),
      bloom: bloomAnchor,
      rock: centre(rockProbe),
    },
  };
}

// ── Terrain program ─────────────────────────────────────────────────────────

export function createDrownedGalleryTerrain(
  grid: MuseumGrid
): MuseumTerrainProgram | null {
  const layout = buildDrownedGalleryLayout(grid);
  if (!layout) return null;

  const { floorRects, bayBounds } = layout;
  const blocked: WorldRect[] = [
    layout.shore,
    layout.channel,
    layout.pool,
    ...layout.rockFill,
    ...layout.thresholdJambs,
  ];

  /** Elevation on a floor rect, with the ramp parameter clamped to the rect. */
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
      // The physics provider rounds a world position to the nearest tile, so a
      // tile whose origin is `t` is walkable across `[t - TILE/2, t + TILE/2)`,
      // while rect geometry uses `[t, t + TILE]`. In a corridor — the one place
      // nothing else blocks the player — that lets them legally stand up to a
      // quarter tile past a floor rect's edge. Absorb exactly that slop, and no
      // more: a real hole is still wider than this and still throws.
      for (const floor of floorRects) {
        const grown: WorldRect = {
          minX: floor.rect.minX - TILE_ROUNDING_SLOP,
          maxX: floor.rect.maxX + TILE_ROUNDING_SLOP,
          minZ: floor.rect.minZ - TILE_ROUNDING_SLOP,
          maxZ: floor.rect.maxZ + TILE_ROUNDING_SLOP,
        };
        if (inRectClosed(grown, x, z)) return heightOn(floor, x, z);
      }
      // No silent datum-0 inside the bay: a walkable point with no floor under
      // it is the "walking on top of the water" bug, and it must be loud.
      if (import.meta.env.DEV && inRectClosed(bayBounds, x, z)) {
        throw new Error(
          `Drowned gallery: no elevation zone covers (${x.toFixed(2)}, ${z.toFixed(2)}) ` +
            "inside the water bay — the layout and the walkable grid disagree"
        );
      }
      return 0;
    },
    blockedAt(x, z) {
      for (const rect of blocked) if (inRectHalfOpen(rect, x, z)) return true;
      return false;
    },
  };
}
