/**
 * Drowned Gallery terrain program — "Three Channels" (v3).
 *
 * Pure geometry: given the compiled cave grid, derives world-space elevation
 * zones, blocked regions, and EVERY rect the graybox renders for the Water
 * bay. The physics provider consumes elevationAt/blockedAt; the graybox visual
 * layer consumes the same rect lists. One geometry source — a rect the graybox
 * draws that the terrain does not know about is a bug by construction.
 *
 * Route: flooded approach → descent stair under the rock roof → the drowned
 * hub (one open shaft overhead: light = the way back up) → any of three roofed
 * channels (A ≈ 6 m, B ≈ 9 m, C ≈ 12 m, one per letter) → a surfacing stair
 * into that channel's air-bell grotto, where ONE performer plays at close read
 * distance → dive back, choose again → the hub's fifth opening: a drowned
 * passage under the north door to the buoyant shaft, a water column rising
 * through a hole in the grotto ring's apron → the ring (mirror pool, waterfall,
 * gilded threshold) → east exit toward Fire.
 *
 * The buoyant shaft's reduced-gravity seam is Gate 2 (runtime); this module
 * owns only its geometry: the column's floor is gallery depth, the rim is a
 * rendered curb, and falling in from the apron is geometrically possible
 * (safe-and-floaty is the recommended Gate 2 answer to design open question 4).
 *
 * Everything below derives from compiled room bounds and real door tiles.
 * There are no absolute world coordinates in this file and none in the
 * graybox: offsets are metres measured from a bound or a door span.
 *
 * Datum: default museum floor = 0. See
 * docs/superpowers/specs/2026-08-09-drowned-gallery-channels-design.md.
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
/** Rock roof over the hub, channels and passage — deliberately BELOW the waterline. */
export const GALLERY_ROOF_Y = -1.9;
/**
 * The eye crosses the waterline where the floor passes this height. On each
 * bell's surfacing stair this is the first-breath moment.
 */
export const LANDING_Y = WATERLINE_Y - EYE_ABOVE_FLOOR;
export const CAUSEWAY_Y = -0.3;
export const SHELF_Y = -1.0;
export const CHANNEL_BED_Y = -2.7;
export const POOL_BOTTOM_Y = -5.0;
export const DOME_APEX_Y = 9.5;
/** Ceiling over the descent/oculus shafts and the approach-side corridors. */
export const SHAFT_CEILING_Y = 2.6;
/**
 * Air-bell deck: dry (above the waterline) and low enough that surfacing puts
 * the eye barely above the water — the bell should feel held, not vaulted.
 * New datum introduced by the three-channels revision (design spec, layout
 * requirements).
 */
export const BELL_FLOOR_Y = -1.2;
/** Bell ceiling ≈ 3 m over the deck — the deliberate opposite of the dome. */
export const BELL_CEILING_Y = BELL_FLOOR_Y + 3.0;
/**
 * Clearance the rock roof needs over the floor. The walker's eye sits at
 * floor + 1.6, so a roof any tighter than this is a roof the player's head
 * passes through — which is where each stair's rock has to give way to an
 * open shaft (or, in a bell, to the bell's own air volume).
 */
export const ROOF_HEADROOM = 2.0;
/** Deepest floor the rock roof can still cover. */
export const ROOF_SPLIT_Y = GALLERY_ROOF_Y - ROOF_HEADROOM;

// ── Shared anchors ──────────────────────────────────────────────────────────

/**
 * Ring niche centres as fractions of the grotto's interior width, west → east.
 * The niches carry forward from the v2 shore alcoves; performers now stage in
 * the bells, and the niches are the ring's proposed finale restaging (Gate 1
 * open question 2 — the doubled-in-the-mirror-pool frame).
 */
export const ALCOVE_X_FRACTIONS = [0.22, 0.5, 0.78] as const;
/** Niche shelf centre, metres south of the grotto's north interior edge. */
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

// ── Gallery metrics (metres; corridor widths do not scale with the room) ────

const PATH_WIDTH = 2.5;
const DESCENT_RUN = 5.5;
/** Thickness of every rendered wall slab. */
export const WALL_THICKNESS = 0.6;
/** See elevationAt: how far tile rounding lets the player drift past a rect edge. */
const TILE_ROUNDING_SLOP = TILE / 2;
/** Depth of the grotto's exit ramp up to the museum datum at the Fire door. */
const EXIT_RAMP_RUN = 2.0;

/**
 * Surfacing stairs climb the bell rise (3.3 m) over 5.5 m — grade 0.60, gentler
 * than the v2 surfacing stair that proved walkable (4.2 m over 6.6 m ≈ 0.64),
 * and a whole number of tiles so the rock rasterises cleanly around it.
 */
const BELL_STAIR_RUN = 5.5;

/** Drowned hub: one readable room, five openings (A/B/C, return, shaft passage). */
const HUB_W = 7.5;
const HUB_D = 7.5;
/** Open shaft over the hub centre — the visible water surface overhead. */
const OCULUS_SIZE = 2.5;
/** The buoyant shaft column and the hole it cuts in the grotto apron. */
export const BUOYANT_SHAFT_SIZE = 2.5;
/** North-wall jog depth where the shaft passage lines up with the door span. */
const PASSAGE_JOG_D = 2.5;
/** Rendered curb thickness around the buoyant shaft's apron rim. */
const SHAFT_RIM_T = 0.25;

// ── Air-bell authoring (metres from the gallery's interior min corner) ──────

export type BellId = "a" | "b" | "c";
export const BELL_IDS = ["a", "b", "c"] as const;

/**
 * Interior band depths inside a bell, entry side → back wall. All are whole
 * numbers of tiles: every authored rect edge in this section must land on a
 * 0.5 m cell boundary, or subtractTiles leaves a blocked rock sliver across
 * the seam between two abutting voids.
 */
const BELL_DECK_D = 2.5;
const BELL_MARGIN_D = 1.5;
const BELL_SHELF_D = 1.0;
/** Full bell depth along its entry axis. */
const BELL_D = BELL_DECK_D + BELL_MARGIN_D + BELL_SHELF_D;
/** Bell width across its entry axis. */
const BELL_W = 6;

/**
 * Authored bell placement, metres from the gallery interior's MIN corner
 * (west/north). `entry` names the side the surfacing stair arrives on; the
 * performer shelf hugs the opposite wall and the performer faces the entry.
 * The floor plan's performer stations consume BELL_SHELF_ANCHORS_M below, so a
 * performer can never drift off the shelf the graybox renders under it.
 */
const BELLS_M: Record<
  BellId,
  { minX: number; minZ: number; entry: "east" | "south" }
> = {
  // A — west of the hub, entered from the east. Shortest dive.
  a: { minX: 0.5, minZ: 18.5, entry: "east" },
  // B — north-west, entered from the south.
  b: { minX: 8.5, minZ: 3.0, entry: "south" },
  // C — north-east (the hybrid letter earns the longest dive), entered from
  // the south after the channel's single east-then-north bend.
  c: { minX: 20.5, minZ: 6.0, entry: "south" },
};

/** Channel corridor centrelines/widths, metres from the interior min corner. */
const CHANNEL_A_Z = { min: 19.5, max: 22.0 };
const CHANNEL_B_X = { min: 12.0, max: 14.5 };
const CHANNEL_C1_Z = { min: 17.5, max: 20.0 };
const CHANNEL_C2_X = { min: 22.0, max: 24.5 };

/** Hub placement, metres from the interior min corner (x) and derived (z). */
const HUB_MIN_X = 11.5;

/**
 * Bell shelf-centre anchors in metres from the gallery interior's min corner,
 * snapped to tile centres — the floor plan's `interiorOffsetFraction` lands a
 * performer station on exactly this tile. `facing` is the direction the
 * performer looks: toward the deck.
 */
export const BELL_SHELF_ANCHORS_M: Record<
  BellId,
  { x: number; z: number; facing: "east" | "south" }
> = {
  a: {
    x: tileCentredOffset(BELLS_M.a.minX + BELL_SHELF_D / 2),
    z: tileCentredOffset(BELLS_M.a.minZ + BELL_W / 2),
    facing: "east",
  },
  b: {
    x: tileCentredOffset(BELLS_M.b.minX + BELL_W / 2),
    z: tileCentredOffset(BELLS_M.b.minZ + BELL_SHELF_D / 2),
    facing: "south",
  },
  c: {
    x: tileCentredOffset(BELLS_M.c.minX + BELL_W / 2),
    z: tileCentredOffset(BELLS_M.c.minZ + BELL_SHELF_D / 2),
    facing: "south",
  },
};

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
}

export interface Span {
  min: number;
  max: number;
}

export interface Point2 {
  x: number;
  z: number;
}

export interface AirBell {
  id: BellId;
  /** Full bell footprint (deck + water margin + shelf). */
  rect: WorldRect;
  /** Dry deck at BELL_FLOOR_Y — where the player stands. */
  deck: WorldRect;
  /** Narrow water strip between deck and shelf (bed at CHANNEL_BED_Y, blocked). */
  margin: WorldRect;
  /** Performer shelf at SHELF_Y (blocked to the player). */
  shelf: WorldRect;
  /** Which side of the bell the surfacing stair arrives on. */
  entry: "east" | "south";
  /** Performer anchor: shelf centre, snapped to a tile centre. */
  shelfAnchor: Point2;
  facing: "east" | "south";
}

export interface BellChannel {
  id: BellId;
  /** Flat roofed runs at GALLERY_FLOOR_Y, hub mouth first. */
  legs: WorldRect[];
  /** The surfacing stair footprint (GALLERY_FLOOR_Y → BELL_FLOOR_Y). */
  stair: WorldRect;
  /** The part of the stair still deep enough for the rock roof. */
  stairRoofed: WorldRect;
  /** The part of the stair rising through the bell's air volume. */
  stairOpen: WorldRect;
  /** Where the stair floor crosses eye-at-waterline depth — the first breath. */
  breathPoint: Point2;
  /** Mouth centre on the hub wall (for glow dressing and the plan board). */
  mouth: Point2;
  /** Walked distance, hub mouth → deck centre. */
  runMetres: number;
  bell: AirBell;
}

export interface DrownedGalleryLayout {
  /** Interior world rects of the three rooms on the water route. */
  approach: WorldRect;
  gallery: WorldRect;
  grotto: WorldRect;

  // ── gallery: hub and channels ──
  /** Descent stair at the gallery's south door: SHALLOWS_Y → GALLERY_FLOOR_Y. */
  descentStair: WorldRect;
  /** The part of the descent stair above the roof-split datum — an open shaft. */
  descentOpen: WorldRect;
  /** The part of the descent stair the rock roof covers. */
  descentRoofed: WorldRect;
  /** Flat leg from the descent's foot west to the hub's east wall. */
  returnLeg: WorldRect;
  /** The drowned hub: one room, five openings. */
  hub: WorldRect;
  /** Open shaft over the hub centre — visible water surface overhead. */
  hubOculus: WorldRect;
  /** The three letter channels, A/B/C. */
  channels: [BellChannel, BellChannel, BellChannel];
  /** Drowned passage from the hub's fifth opening to the north door. */
  shaftPassageLeg: WorldRect;
  /** North-wall jog aligning the passage with the door span. */
  shaftPassageJog: WorldRect;
  /** The buoyant shaft column: a hole in the grotto apron down to gallery depth. */
  buoyantShaft: WorldRect;
  /** Rendered curb around the shaft's apron rim (west/north/east). NOT a blocker. */
  shaftRim: WorldRect[];
  /** Every gallery interior tile that is not hub/channel/bell/passage, merged. */
  rockFill: WorldRect[];
  /** The places the rock roof opens and a water surface is visible overhead. */
  openShafts: WorldRect[];
  /** Cave-life bloom, relocated to the hub centre (visible from every mouth). */
  bloomAnchor: Point2;

  // ── grotto ──
  shore: WorldRect;
  channel: WorldRect;
  procession: WorldRect;
  pool: WorldRect;
  /** Full apron band (the walkable floors are apronPieces, minus the shaft). */
  apron: WorldRect;
  /** Apron floor pieces around the buoyant shaft's hole. */
  apronPieces: WorldRect[];
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
  /**
   * Ring niche centres, west → east — the v2 alcoves, kept as geometry. The
   * proposed finale restaging (doubled in the mirror pool) stands here;
   * performers themselves now anchor in the bells.
   */
  alcoves: Point2[];
  /** Rails along every walkway edge that faces water. */
  balustrades: WorldRect[];

  // ── corridors ──
  approachCorridor: WorldRect[];
  /** Gallery↔grotto corridor tiles — now the drowned passage under the door. */
  galleryCorridor: WorldRect[];

  // ── everything the graybox renders ──
  floorRects: FloorRect[];
  wallRects: WallRect[];
  ceilingRects: CeilingRect[];
  roofRects: WorldRect[];
  waterPlanes: WorldRect[];
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
    hub: Point2;
    shaftBottom: Point2;
    bellDecks: Record<BellId, Point2>;
    bellShelves: Record<BellId, Point2>;
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
 * as `bandRects`. Used to shape the gallery's rock fill around the hub, the
 * channels, the bells and the shaft passage, so rock and path abut exactly and
 * neither can leave a seam.
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

  const galleryW = gallery.maxX - gallery.minX;
  const galleryD = gallery.maxZ - gallery.minZ;
  if (galleryW < 29.5 || galleryD < 29.5) {
    throw new Error(
      `Drowned gallery layout: the flooded gallery compiled to ${galleryW.toFixed(1)} × ${galleryD.toFixed(1)} m — ` +
        "the three-channels revision needs ≈30 × 30 m for the hub, three channels, three air-bells " +
        "and the shaft passage (raise cave-water-gallery's min interior in vulcan-cave-floor-plan.ts)"
    );
  }

  /** Metres from the gallery interior's min corner → world. */
  const gx = (m: number) => gallery.minX + m;
  const gz = (m: number) => gallery.minZ + m;

  // ── Descent (kept from v2) ────────────────────────────────────────────────
  const descentX = widenSpan(
    gallerySouthDoor,
    PATH_WIDTH,
    gallery.minX,
    gallery.maxX
  );
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

  // ── Hub and return leg ────────────────────────────────────────────────────
  // The hub's south edge lines up with the descent's foot; the return leg runs
  // between them at gallery depth, under the rock roof.
  const hub: WorldRect = {
    minX: gx(HUB_MIN_X),
    maxX: gx(HUB_MIN_X + HUB_W),
    minZ: descentStair.minZ - HUB_D,
    maxZ: descentStair.minZ,
  };
  const returnLeg: WorldRect = {
    minX: hub.maxX,
    maxX: descentStair.maxX,
    minZ: descentStair.minZ - PATH_WIDTH,
    maxZ: descentStair.minZ,
  };
  if (returnLeg.maxX - returnLeg.minX < PATH_WIDTH) {
    throw new Error(
      "Drowned gallery layout: the hub has collided with the descent stair — no room for the return leg"
    );
  }
  const oculusCx = cx(hub);
  const oculusCz = cz(hub);
  const hubOculus: WorldRect = {
    minX: oculusCx - OCULUS_SIZE / 2,
    maxX: oculusCx + OCULUS_SIZE / 2,
    minZ: oculusCz - OCULUS_SIZE / 2,
    maxZ: oculusCz + OCULUS_SIZE / 2,
  };

  // ── Bells ─────────────────────────────────────────────────────────────────
  const makeBell = (id: BellId): AirBell => {
    const spec = BELLS_M[id];
    const anchor = BELL_SHELF_ANCHORS_M[id];
    if (spec.entry === "east") {
      const rect: WorldRect = {
        minX: gx(spec.minX),
        maxX: gx(spec.minX + BELL_D),
        minZ: gz(spec.minZ),
        maxZ: gz(spec.minZ + BELL_W),
      };
      const shelf: WorldRect = { ...rect, maxX: rect.minX + BELL_SHELF_D };
      const margin: WorldRect = {
        ...rect,
        minX: shelf.maxX,
        maxX: shelf.maxX + BELL_MARGIN_D,
      };
      const deck: WorldRect = { ...rect, minX: margin.maxX };
      return {
        id,
        rect,
        deck,
        margin,
        shelf,
        entry: "east",
        shelfAnchor: { x: gx(anchor.x), z: gz(anchor.z) },
        facing: anchor.facing,
      };
    }
    const rect: WorldRect = {
      minX: gx(spec.minX),
      maxX: gx(spec.minX + BELL_W),
      minZ: gz(spec.minZ),
      maxZ: gz(spec.minZ + BELL_D),
    };
    const shelf: WorldRect = { ...rect, maxZ: rect.minZ + BELL_SHELF_D };
    const margin: WorldRect = {
      ...rect,
      minZ: shelf.maxZ,
      maxZ: shelf.maxZ + BELL_MARGIN_D,
    };
    const deck: WorldRect = { ...rect, minZ: margin.maxZ };
    return {
      id,
      rect,
      deck,
      margin,
      shelf,
      entry: "south",
      shelfAnchor: { x: gx(anchor.x), z: gz(anchor.z) },
      facing: anchor.facing,
    };
  };

  const bellA = makeBell("a");
  const bellB = makeBell("b");
  const bellC = makeBell("c");

  // ── Channels ──────────────────────────────────────────────────────────────
  const bellRise = BELL_FLOOR_Y - GALLERY_FLOOR_Y;
  /** Stair-run fraction (from the deep end) where the floor reaches `y`. */
  const stairFraction = (y: number) => (y - GALLERY_FLOOR_Y) / bellRise;

  // A: hub west wall → straight west → bell A entered from the east.
  const chanAFlat: WorldRect = {
    minX: bellA.rect.maxX + BELL_STAIR_RUN,
    maxX: hub.minX,
    minZ: gz(CHANNEL_A_Z.min),
    maxZ: gz(CHANNEL_A_Z.max),
  };
  const chanAStair: WorldRect = {
    minX: bellA.rect.maxX,
    maxX: chanAFlat.minX,
    minZ: chanAFlat.minZ,
    maxZ: chanAFlat.maxZ,
  };
  if (chanAFlat.maxX - chanAFlat.minX < 0.5) {
    throw new Error(
      "Drowned gallery layout: channel A has no flat run — bell A and the hub have collided"
    );
  }
  // Rising WESTWARD: deep end at maxX.
  const chanAStairRoofed: WorldRect = {
    ...chanAStair,
    minX: chanAStair.maxX - BELL_STAIR_RUN * stairFraction(ROOF_SPLIT_Y),
  };
  const chanAStairOpen: WorldRect = {
    ...chanAStair,
    maxX: chanAStairRoofed.minX,
  };
  const chanABreathX =
    chanAStair.maxX - BELL_STAIR_RUN * stairFraction(LANDING_Y);
  const channelA: BellChannel = {
    id: "a",
    legs: [chanAFlat],
    stair: chanAStair,
    stairRoofed: chanAStairRoofed,
    stairOpen: chanAStairOpen,
    breathPoint: { x: chanABreathX, z: cz(chanAStair) },
    mouth: { x: hub.minX, z: cz(chanAFlat) },
    runMetres:
      hub.minX -
      (bellA.deck.minX + (bellA.deck.maxX - bellA.deck.minX) / 2),
    bell: bellA,
  };

  // B: hub north wall (west of the oculus) → straight north → bell B.
  const chanBStair: WorldRect = {
    minX: gx(CHANNEL_B_X.min),
    maxX: gx(CHANNEL_B_X.max),
    minZ: bellB.rect.maxZ,
    maxZ: bellB.rect.maxZ + BELL_STAIR_RUN,
  };
  const chanBFlat: WorldRect = {
    minX: chanBStair.minX,
    maxX: chanBStair.maxX,
    minZ: chanBStair.maxZ,
    maxZ: hub.minZ,
  };
  if (chanBFlat.maxZ - chanBFlat.minZ < 0.5) {
    throw new Error(
      "Drowned gallery layout: channel B has no flat run — bell B and the hub have collided"
    );
  }
  // Rising NORTHWARD: deep end at maxZ.
  const chanBStairRoofed: WorldRect = {
    ...chanBStair,
    minZ: chanBStair.maxZ - BELL_STAIR_RUN * stairFraction(ROOF_SPLIT_Y),
  };
  const chanBStairOpen: WorldRect = {
    ...chanBStair,
    maxZ: chanBStairRoofed.minZ,
  };
  const chanBBreathZ =
    chanBStair.maxZ - BELL_STAIR_RUN * stairFraction(LANDING_Y);
  const channelB: BellChannel = {
    id: "b",
    legs: [chanBFlat],
    stair: chanBStair,
    stairRoofed: chanBStairRoofed,
    stairOpen: chanBStairOpen,
    breathPoint: { x: cx(chanBStair), z: chanBBreathZ },
    mouth: { x: cx(chanBFlat), z: hub.minZ },
    runMetres:
      hub.minZ -
      (bellB.deck.minZ + (bellB.deck.maxZ - bellB.deck.minZ) / 2),
    bell: bellB,
  };

  // C: hub east wall → east, one bend north → bell C. The hybrid letter earns
  // the longest dive.
  const chanC1: WorldRect = {
    minX: hub.maxX,
    maxX: gx(CHANNEL_C2_X.max),
    minZ: gz(CHANNEL_C1_Z.min),
    maxZ: gz(CHANNEL_C1_Z.max),
  };
  const chanCStair: WorldRect = {
    minX: gx(CHANNEL_C2_X.min),
    maxX: gx(CHANNEL_C2_X.max),
    minZ: bellC.rect.maxZ,
    maxZ: bellC.rect.maxZ + BELL_STAIR_RUN,
  };
  const chanC2: WorldRect = {
    minX: chanCStair.minX,
    maxX: chanCStair.maxX,
    minZ: chanCStair.maxZ,
    maxZ: chanC1.minZ,
  };
  if (chanC2.maxZ - chanC2.minZ < 0.5) {
    throw new Error(
      "Drowned gallery layout: channel C's north leg has no flat run — bell C and the east leg have collided"
    );
  }
  const chanCStairRoofed: WorldRect = {
    ...chanCStair,
    minZ: chanCStair.maxZ - BELL_STAIR_RUN * stairFraction(ROOF_SPLIT_Y),
  };
  const chanCStairOpen: WorldRect = {
    ...chanCStair,
    maxZ: chanCStairRoofed.minZ,
  };
  const chanCBreathZ =
    chanCStair.maxZ - BELL_STAIR_RUN * stairFraction(LANDING_Y);
  // Walked distance for the bent run: east along leg 1 to the bend's centre,
  // then north up leg 2 and the stair to the deck centre.
  const chanCRun =
    (cx(chanC2) - hub.maxX) + (cz(chanC1) - cz(bellC.deck));
  const channelC: BellChannel = {
    id: "c",
    legs: [chanC1, chanC2],
    stair: chanCStair,
    stairRoofed: chanCStairRoofed,
    stairOpen: chanCStairOpen,
    breathPoint: { x: cx(chanCStair), z: chanCBreathZ },
    mouth: { x: hub.maxX, z: cz(chanC1) },
    runMetres: chanCRun,
    bell: bellC,
  };

  const channels: [BellChannel, BellChannel, BellChannel] = [
    channelA,
    channelB,
    channelC,
  ];

  // ── Shaft passage: the hub's fifth opening ────────────────────────────────
  // Gate 1 resolution of design open question 1: the buoyant shaft connects to
  // the HUB (not to individual bells) — a single junction keeps any-order bell
  // choice and full backtracking legible, and the hub's overhead light stays
  // the honest "way back up" anchor.
  const shaftPassageLeg: WorldRect = {
    minX: galleryNorthDoor.max,
    maxX: galleryNorthDoor.max + PATH_WIDTH,
    minZ: gallery.minZ + PASSAGE_JOG_D,
    maxZ: hub.minZ,
  };
  const shaftPassageJog: WorldRect = {
    minX: galleryNorthDoor.min,
    maxX: galleryNorthDoor.max + PATH_WIDTH,
    minZ: gallery.minZ,
    maxZ: gallery.minZ + PASSAGE_JOG_D,
  };
  if (
    shaftPassageLeg.maxX > hub.maxX + 0.01 ||
    shaftPassageLeg.minX < hub.minX - 0.01
  ) {
    throw new Error(
      "Drowned gallery layout: the shaft passage does not land on the hub's north wall — " +
        "the north door span and the hub have drifted apart"
    );
  }

  // ── Buoyant shaft: a hole in the grotto apron down to gallery depth ───────
  const shaftCx = (grottoSouthDoor.min + grottoSouthDoor.max) / 2;
  const buoyantShaft: WorldRect = {
    minX: shaftCx - BUOYANT_SHAFT_SIZE / 2,
    maxX: shaftCx + BUOYANT_SHAFT_SIZE / 2,
    minZ: grotto.maxZ - BUOYANT_SHAFT_SIZE,
    maxZ: grotto.maxZ,
  };
  const shaftRim: WorldRect[] = [
    { ...buoyantShaft, maxX: buoyantShaft.minX, minX: buoyantShaft.minX - SHAFT_RIM_T },
    { ...buoyantShaft, minX: buoyantShaft.maxX, maxX: buoyantShaft.maxX + SHAFT_RIM_T },
    { ...buoyantShaft, maxZ: buoyantShaft.minZ, minZ: buoyantShaft.minZ - SHAFT_RIM_T },
  ];

  // ── Rock fill and open shafts ─────────────────────────────────────────────
  const galleryVoids = [
    descentStair,
    returnLeg,
    hub,
    chanAFlat,
    chanAStair,
    bellA.rect,
    chanBFlat,
    chanBStair,
    bellB.rect,
    chanC1,
    chanC2,
    chanCStair,
    bellC.rect,
    shaftPassageLeg,
    shaftPassageJog,
  ];
  const rockFill = subtractTiles(gallery, galleryVoids);
  const openShafts = [descentOpen, hubOculus];
  const bloomAnchor = centre(hub);

  // ── Grotto ring (kept from v2) ────────────────────────────────────────────
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
  // The buoyant shaft cuts a hole in the apron; the walkable apron is what
  // remains around it (west, east and a north strip toward the pool rail).
  const apronPieces: WorldRect[] = [
    { ...apron, maxX: buoyantShaft.minX },
    { ...apron, minX: buoyantShaft.maxX },
    {
      ...apron,
      minX: buoyantShaft.minX,
      maxX: buoyantShaft.maxX,
      maxZ: buoyantShaft.minZ,
    },
  ].filter((r) => r.maxX - r.minX > 0.01 && r.maxZ - r.minZ > 0.01);
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

  // Ring niches sit on tile centres — the proposed finale restaging (Gate 1
  // open question 2) reads the same expression the v2 performer stations did.
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
    // shore's rock face, which needs no rail)
    { ...channel, minZ: channel.maxZ, maxZ: channel.maxZ + RAIL_T },
    { ...channel, maxX: channel.minX, minX: channel.minX - RAIL_T },
    { ...channel, minX: channel.maxX, maxX: channel.maxX + RAIL_T },
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

  // The grotto→Fire corridor sits at the museum datum. With the gallery grown
  // to 30 × 30 m the bay's bbox now reaches over it, so it needs explicit
  // datum-0 floors or elevationAt throws on its tiles.
  const fireWing = grid.wings.find((w) => w.id === "cave-fire");
  let fireCorridor: WorldRect[] = [];
  if (fireWing) {
    const fb = fireWing.bounds;
    fireCorridor = bandRects(
      grid,
      rb.x + rb.width - 1,
      fb.x,
      Math.min(rb.y, fb.y) - 2,
      Math.max(rb.y + rb.height, fb.y + fb.height) + 2,
      (t) => t === "corridor" || t === "door"
    );
  }

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
    // gallery: descent, hub, channels
    {
      id: "descent-stair",
      rect: descentStair,
      kind: "ramp-z",
      fromY: GALLERY_FLOOR_Y,
      toY: SHALLOWS_Y,
    },
    {
      id: "return-leg",
      rect: returnLeg,
      kind: "flat",
      fromY: GALLERY_FLOOR_Y,
      toY: GALLERY_FLOOR_Y,
    },
    { id: "hub", rect: hub, kind: "flat", fromY: GALLERY_FLOOR_Y, toY: GALLERY_FLOOR_Y },
    // channel A (stair rises westward: minX edge is the bell/deck end)
    {
      id: "channel-a-flat",
      rect: chanAFlat,
      kind: "flat",
      fromY: GALLERY_FLOOR_Y,
      toY: GALLERY_FLOOR_Y,
    },
    {
      id: "channel-a-stair",
      rect: chanAStair,
      kind: "ramp-x",
      fromY: BELL_FLOOR_Y,
      toY: GALLERY_FLOOR_Y,
    },
    // channel B (stair rises northward: minZ edge is the bell end)
    {
      id: "channel-b-flat",
      rect: chanBFlat,
      kind: "flat",
      fromY: GALLERY_FLOOR_Y,
      toY: GALLERY_FLOOR_Y,
    },
    {
      id: "channel-b-stair",
      rect: chanBStair,
      kind: "ramp-z",
      fromY: BELL_FLOOR_Y,
      toY: GALLERY_FLOOR_Y,
    },
    // channel C
    {
      id: "channel-c-east",
      rect: chanC1,
      kind: "flat",
      fromY: GALLERY_FLOOR_Y,
      toY: GALLERY_FLOOR_Y,
    },
    {
      id: "channel-c-north",
      rect: chanC2,
      kind: "flat",
      fromY: GALLERY_FLOOR_Y,
      toY: GALLERY_FLOOR_Y,
    },
    {
      id: "channel-c-stair",
      rect: chanCStair,
      kind: "ramp-z",
      fromY: BELL_FLOOR_Y,
      toY: GALLERY_FLOOR_Y,
    },
    // bells: dry decks walked, margins and shelves rendered but blocked
    ...channels.flatMap((chan) => [
      {
        id: `bell-${chan.id}-deck`,
        rect: chan.bell.deck,
        kind: "flat" as const,
        fromY: BELL_FLOOR_Y,
        toY: BELL_FLOOR_Y,
      },
      {
        id: `bell-${chan.id}-margin`,
        rect: chan.bell.margin,
        kind: "flat" as const,
        fromY: CHANNEL_BED_Y,
        toY: CHANNEL_BED_Y,
      },
      {
        id: `bell-${chan.id}-shelf`,
        rect: chan.bell.shelf,
        kind: "flat" as const,
        fromY: SHELF_Y,
        toY: SHELF_Y,
      },
    ]),
    // shaft passage and the drowned corridor under the north door
    {
      id: "shaft-passage-leg",
      rect: shaftPassageLeg,
      kind: "flat",
      fromY: GALLERY_FLOOR_Y,
      toY: GALLERY_FLOOR_Y,
    },
    {
      id: "shaft-passage-jog",
      rect: shaftPassageJog,
      kind: "flat",
      fromY: GALLERY_FLOOR_Y,
      toY: GALLERY_FLOOR_Y,
    },
    ...galleryCorridor.map((rect, i) => ({
      id: `gallery-corridor-${i}`,
      rect,
      kind: "flat" as const,
      fromY: GALLERY_FLOOR_Y,
      toY: GALLERY_FLOOR_Y,
    })),
    // the buoyant shaft's bottom — the column's own floor
    {
      id: "buoyant-shaft",
      rect: buoyantShaft,
      kind: "flat",
      fromY: GALLERY_FLOOR_Y,
      toY: GALLERY_FLOOR_Y,
    },
    // grotto ring
    {
      id: "exit-ramp",
      rect: exitRamp,
      kind: "ramp-x",
      fromY: CAUSEWAY_Y,
      toY: 0,
    },
    // The apron is split around the shaft hole so no floor covers the column.
    ...apronPieces.map((rect, i) => ({
      id: `apron-${i}`,
      rect,
      kind: "flat" as const,
      fromY: CAUSEWAY_Y,
      toY: CAUSEWAY_Y,
    })),
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
    // basins + shore: rendered, never walked (all three are blocked)
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
    // grotto → Fire corridor at museum datum
    ...fireCorridor.map((rect, i) => ({
      id: `fire-corridor-${i}`,
      rect,
      kind: "flat" as const,
      fromY: 0,
      toY: 0,
    })),
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
  const collar = (
    id: string,
    shaft: WorldRect,
    openSide: "north" | "south" | "none"
  ) => {
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
  collar("oculus-collar", hubOculus, "none");

  // ── Ceilings ──────────────────────────────────────────────────────────────
  const ceilingRects: CeilingRect[] = [
    { id: "grotto-dome", rect: grotto, y: DOME_APEX_Y },
    ...openShafts.map((rect, i) => ({
      id: `shaft-ceiling-${i}`,
      rect,
      y: SHAFT_CEILING_Y,
    })),
    // Each bell's low held ceiling covers the bell and its stair's open rise.
    ...channels.map((chan) => ({
      id: `bell-${chan.id}-ceiling`,
      rect: unionRect([chan.bell.rect, chan.stairOpen]),
      y: BELL_CEILING_Y,
    })),
    ...approachCorridor.map((rect, i) => ({
      id: `approach-corridor-ceiling-${i}`,
      rect,
      y: SHAFT_CEILING_Y,
    })),
    { id: "approach-ceiling", rect: approach, y: SHAFT_CEILING_Y },
  ];

  // The rock roof: over every gallery region deep enough to carry it, plus the
  // drowned passage and its corridor (the passage IS the drowned door).
  const roofRects: WorldRect[] = [
    descentRoofed,
    returnLeg,
    // hub minus the oculus, split into four strips
    { ...hub, maxZ: hubOculus.minZ },
    { ...hub, minZ: hubOculus.maxZ },
    { ...hub, minZ: hubOculus.minZ, maxZ: hubOculus.maxZ, maxX: hubOculus.minX },
    { ...hub, minZ: hubOculus.minZ, maxZ: hubOculus.maxZ, minX: hubOculus.maxX },
    chanAFlat,
    chanAStairRoofed,
    chanBFlat,
    chanBStairRoofed,
    chanC1,
    chanC2,
    chanCStairRoofed,
    shaftPassageLeg,
    shaftPassageJog,
    ...galleryCorridor,
  ];

  // ── Water ─────────────────────────────────────────────────────────────────
  // A visible surface exists only where air meets water: the descent mouth,
  // the hub oculus, each bell (over its margin and the wet part of its stair),
  // the buoyant shaft's hole in the apron, and the grotto basins. Everywhere
  // else the gallery's water reads as body, not surface — that is the whole
  // point of a roof below the waterline.
  const approachRun = approach.maxZ - approach.minZ;
  const approachWadeZ =
    approach.minZ + approachRun * ((WATERLINE_Y - SHALLOWS_Y) / (0 - SHALLOWS_Y));
  // On each bell stair the water plane stops where the floor crosses the
  // waterline rather than riding up onto the dry deck end of the ramp. The
  // stair's deep end is at max along its axis, so the wet stretch hangs off it.
  const bellStairPlane = (chan: BellChannel): WorldRect => {
    const wetRun = BELL_STAIR_RUN * stairFraction(WATERLINE_Y);
    return chan.bell.entry === "east"
      ? { ...chan.stair, minX: chan.stair.maxX - wetRun }
      : { ...chan.stair, minZ: chan.stair.maxZ - wetRun };
  };
  const waterPlanes: WorldRect[] = [
    ...approachCorridor,
    { ...approach, maxZ: approachWadeZ },
    descentOpen,
    hubOculus,
    ...channels.map((chan) => chan.bell.margin),
    ...channels.map(bellStairPlane),
    buoyantShaft,
    channel,
    pool,
  ];

  const waterVolumes: WaterVolume[] = [
    { id: "vol-descent", rect: descentStair, floorY: GALLERY_FLOOR_Y },
    { id: "vol-return-leg", rect: returnLeg, floorY: GALLERY_FLOOR_Y },
    { id: "vol-hub", rect: hub, floorY: GALLERY_FLOOR_Y },
    ...channels.flatMap((chan) => [
      ...chan.legs.map((rect, i) => ({
        id: `vol-channel-${chan.id}-${i}`,
        rect,
        floorY: GALLERY_FLOOR_Y,
      })),
      { id: `vol-channel-${chan.id}-stair`, rect: chan.stair, floorY: GALLERY_FLOOR_Y },
      { id: `vol-bell-${chan.id}-margin`, rect: chan.bell.margin, floorY: CHANNEL_BED_Y },
    ]),
    { id: "vol-shaft-passage", rect: shaftPassageLeg, floorY: GALLERY_FLOOR_Y },
    { id: "vol-shaft-jog", rect: shaftPassageJog, floorY: GALLERY_FLOOR_Y },
    { id: "vol-buoyant-shaft", rect: buoyantShaft, floorY: GALLERY_FLOOR_Y },
    { id: "vol-channel", rect: channel, floorY: CHANNEL_BED_Y },
    { id: "vol-pool", rect: pool, floorY: POOL_BOTTOM_Y },
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
    returnLeg,
    hub,
    hubOculus,
    channels,
    shaftPassageLeg,
    shaftPassageJog,
    buoyantShaft,
    shaftRim,
    rockFill,
    openShafts,
    bloomAnchor,
    shore,
    channel,
    procession,
    pool,
    apron,
    apronPieces,
    westWalkway,
    eastWalkway,
    exitRamp,
    waterfall,
    threshold,
    thresholdJambs,
    thresholdOpening,
    alcoves,
    balustrades,
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
      apron: { x: cx(apronPieces[0]!), z: cz(apronPieces[0]!) },
      procession: centre(procession),
      westWalkway: centre(westWalkway),
      eastWalkway: { x: cx(eastWalkway), z: cz(procession) },
      pool: centre(pool),
      channel: centre(channel),
      shore: centre(shore),
      thresholdOpening: centre(thresholdOpening),
      bloom: bloomAnchor,
      hub: centre(hub),
      shaftBottom: centre(buoyantShaft),
      bellDecks: {
        a: centre(bellA.deck),
        b: centre(bellB.deck),
        c: centre(bellC.deck),
      },
      bellShelves: {
        a: bellA.shelfAnchor,
        b: bellB.shelfAnchor,
        c: bellC.shelfAnchor,
      },
      rock: centre(rockProbe),
    },
  };
}

// ── Sightlines (Earth Gate 1.1 standard: moving route-sampled windows) ──────

export interface ViewingSample extends Point2 {
  elevation: number;
  fraction: number;
}

/**
 * Moving sightline window for one bell: samples along the surfacing route from
 * the first-breath point (eye crosses the waterline on the stair) to the front
 * of the deck, each aimed at that bell's performer.
 */
export function bellViewingSamples(
  chan: BellChannel,
  sampleCount = 7
): ViewingSample[] {
  if (sampleCount < 2) {
    throw new Error("A moving sightline window needs at least two samples");
  }
  const from = chan.breathPoint;
  const to =
    chan.bell.entry === "east"
      ? { x: chan.bell.deck.minX + 0.4, z: (chan.bell.deck.minZ + chan.bell.deck.maxZ) / 2 }
      : { x: (chan.bell.deck.minX + chan.bell.deck.maxX) / 2, z: chan.bell.deck.minZ + 0.4 };
  const fromElevation = LANDING_Y;
  const toElevation = BELL_FLOOR_Y;
  return Array.from({ length: sampleCount }, (_, index) => {
    const fraction = index / (sampleCount - 1);
    return {
      x: from.x + (to.x - from.x) * fraction,
      z: from.z + (to.z - from.z) * fraction,
      elevation: fromElevation + (toElevation - fromElevation) * fraction,
      fraction,
    };
  });
}

/**
 * How far above the viewer's floor the sightline to the performer's floor sits
 * at the deck's water edge — positive means the shelf's base is visible over
 * the deck lip, aimed at the performer FLOOR per the Earth Gate 1.1 standard.
 */
export function bellFloorSightlineMargin(
  chan: BellChannel,
  viewer: ViewingSample
): number {
  const performer = chan.bell.shelfAnchor;
  const distance = Math.hypot(performer.x - viewer.x, performer.z - viewer.z);
  const edgeDistance =
    chan.bell.entry === "east"
      ? Math.max(0.2, viewer.x - chan.bell.deck.minX)
      : Math.max(0.2, viewer.z - chan.bell.deck.minZ);
  if (distance <= edgeDistance) return Number.POSITIVE_INFINITY;
  const eye = viewer.elevation + EYE_ABOVE_FLOOR;
  // Height of the eye→shelf-floor line where it passes over the deck's water
  // edge (t = edgeDistance / distance along the way to the performer).
  const sightlineAtEdge = eye + (SHELF_Y - eye) * (edgeDistance / distance);
  // The deck lip is the highest thing between viewer and shelf.
  return sightlineAtEdge - BELL_FLOOR_Y;
}

/** Does the segment cross any rect in the list (2-D, conservative)? */
export function segmentCrossesRects(
  from: Point2,
  to: Point2,
  rects: WorldRect[]
): boolean {
  const STEPS = 64;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    if (rects.some((r) => inRectClosed(r, x, z))) return true;
  }
  return false;
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
    // Bell water margins and performer shelves: rendered, never walked.
    ...layout.channels.flatMap((chan) => [chan.bell.margin, chan.bell.shelf]),
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
