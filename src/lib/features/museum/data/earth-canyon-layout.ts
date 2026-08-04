/**
 * The Earth Room (Canyon Overlook) — Vulcan Cave earth bay geometry.
 *
 * Same contract as the Drowned Gallery and the First Fire: pure geometry that,
 * given the compiled cave grid, derives world-space elevation zones, blocked
 * regions and EVERY rect, ramp and disc the graybox renders for the earth bay.
 * The physics provider consumes elevationAt/blockedAt; the graybox reads the
 * same rect and disc lists; the floor plan's performer stations read the same
 * anchors. One geometry source.
 *
 * Route, west → east: a grass gully drops away from the First Fire, turns north
 * through one bend that kills Fire's light, and opens onto the north ledge of a
 * canyon overlook. A boulder parapet closes the north side; the rim runs all the
 * way round a ⌀14 m void with three performers six metres below. A fallen slab
 * cantilevers off the south rim — one walkable metre of viewing apron, two
 * fractured metres of blocked nose. The exit ramp climbs east along the south
 * rim to the Air door at the museum datum. There is no stair down.
 *
 * Circles are first-class here: the void, the performers' floor disc and the
 * three bosses are Disc records, and blockedAt and the graybox consume the SAME
 * records — there is no rect approximation of a circle anywhere in this file.
 *
 * There is not one absolute world coordinate in this file: every offset is
 * metres measured from a compiled room bound or a real door tile span.
 *
 * Design: docs/superpowers/specs/2026-08-04-earth-room-floor-plan-draft.md
 */
import type {
  MuseumGrid,
  MuseumTerrainProgram,
} from "../domain/museum-grid-types";
import {
  TILE_METRES,
  WALL_THICKNESS,
  WATERLINE_Y,
  bandRects,
  doorSpan,
  inRectClosed,
  interiorWorldRect,
  spansExcluding,
  subtractTiles,
  tileCentredOffset,
  unionRect,
  type CeilingRect,
  type FloorRect,
  type Point2,
  type Span,
  type WallRect,
  type WorldRect,
} from "./drowned-gallery-terrain";

const TILE = TILE_METRES;
const HALF = TILE / 2;
/** See elevationAt: how far tile rounding lets the player drift past a rect edge. */
const TILE_ROUNDING_SLOP = TILE / 2;

// ── Room ids ────────────────────────────────────────────────────────────────

export const EARTH_ROOM_ID = "cave-earth";
export const FIRE_ROOM_ID = "cave-fire";

// ── Datums (metres; museum floor = 0) ───────────────────────────────────────

/** Both doors sit on the museum datum — Fire's east door and Air's north door. */
export const DOOR_Y = 0;
/** Gully mid shelf, at the foot of the mouth ramp. */
export const GULLY_MID_Y = -0.7;
/** Foot of the gully's north-running bend. */
export const GULLY_LOW_Y = -0.9;
/** The rim ring, the north ledge and the whole chamber floor. */
export const RIM_Y = -1.4;
/** The slab overlook's viewing apron — 0.3 m up from the rim. */
export const SLAB_Y = -1.1;
/** Boss tops: what the performers stand on. */
export const BOSS_Y = -7.25;
/** The performers' floor disc at the bottom of the void. Blocked; never walked. */
export const FLOOR_DISC_Y = -7.4;
/** Cave roof, ≈5 m over the rim, with the aven open above the void. */
export const EARTH_CEILING_Y = 3.6;
/** The gully keeps a low green-lit roof, matching Fire's corridor. */
export const GULLY_CEILING_Y = 2.6;
/** Canyon shelves receding north of the parapet — blocked, visual only. */
export const CANYON_SHELF_Y = [-10.5, -14.5, -19.0, -25.0] as const;

// ── Programme metrics (metres) ──────────────────────────────────────────────

const GULLY_WIDTH = 4.0;
/** East–west run of the gully mouth, dropping off Fire's threshold. */
const GULLY_MOUTH_RUN = 6.0;
/** East–west thickness of the north-running bend leg. */
const GULLY_BEND_RUN = 4.0;
/** East–west run from the bend onto the north ledge. */
const GULLY_LOWER_RUN = 2.5;
/** Total east–west depth of the gully strip before the chamber begins. */
const GULLY_RUN = GULLY_MOUTH_RUN + GULLY_BEND_RUN + GULLY_LOWER_RUN;

/** Blocked boulder band just inside the compiled north wall. */
const PARAPET_DEPTH = 0.6;
/**
 * Drawn parapet height. The sightline math caps this at 1.07 m — a reflex
 * 1.1 m guard rail consumes the whole clearance and occludes the performers.
 * Do not "safety up" this number.
 */
export const PARAPET_HEIGHT = 0.9;
/** Walkable arrival ledge between the parapet and the void. */
const NORTH_LEDGE_DEPTH = 2.6;
/** Minimum walkable width the west, south and east rim must keep. */
const RIM_WIDTH = 3.2;

export const VOID_RADIUS = 7.0;
export const BOSS_RADIUS = 1.25;
/** Centre-to-centre spacing of the three bosses. */
const BOSS_SPACING = 4.0;
/** The station line sits south of the void centre, pulling the far figures in. */
const BOSS_SOUTH_OFFSET = 2.0;
/** Radius of the aven opening in the roof, centred over the bosses. */
export const AVEN_RADIUS = 5.0;

/** Slab overlook: 4 m across, cantilevered 3 m north into the void. */
const SLAB_WIDTH = 4.0;
const SLAB_RUN = 3.0;
/** Southernmost metre of the slab — the protected viewing apron. */
const SLAB_APRON_DEPTH = 1.0;
/** Ramp up from the rim onto the apron. */
const SLAB_RAMP_RUN = 1.0;
/** Lip at the viewing line. 0.96 m is the sightline cap; 0.45 leaves 12° margin. */
export const SLAB_LIP_HEIGHT = 0.45;

/** East–west run of the exit ramp up to the Air door. */
const EXIT_RUN = 6.0;
/** North–south width of the exit ramp, against the south wall. */
const EXIT_WIDTH = 3.0;
/** Blocked kerb separating the climbing ramp from the level rim beside it. */
const EXIT_KERB_DEPTH = 0.5;
/**
 * Length of the ramp's open western mouth, before the kerb starts. Short enough
 * that the rim beside it is never more than 0.6 m below the ramp deck.
 */
const EXIT_JUNCTION = 2.0;

/** Depth of the south band the rim, kerb and ramp have to share. */
const SOUTH_BAND_MIN = RIM_WIDTH + EXIT_KERB_DEPTH + EXIT_WIDTH;

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * A circle in the world plane. The shared primitive this room needed: the void,
 * the performers' floor disc and the three bosses are circles, and blocking,
 * elevation and rendering all read these same records.
 */
export interface Disc {
  id: string;
  center: Point2;
  radius: number;
}

export function inDisc(disc: Disc, x: number, z: number): boolean {
  const dx = x - disc.center.x;
  const dz = z - disc.center.z;
  return dx * dx + dz * dz <= disc.radius * disc.radius;
}

export interface EarthCanyonLayout {
  /** Interior world rect of the earth chamber (gully strip included). */
  earth: WorldRect;
  /** Corridor tiles between Fire's east door and the earth west door. */
  corridor: WorldRect[];

  // ── the gully ──
  gullyMouth: WorldRect;
  gullyBend: WorldRect;
  gullyLower: WorldRect;
  /** True when the bend leg runs north (decreasing z) from the mouth. */
  bendRunsNorth: boolean;

  // ── the overlook ──
  /** Everything east of the gully strip: the whole rim ring plus the void. */
  chamber: WorldRect;
  /** Blocked boulder band just inside the compiled north wall. */
  parapet: WorldRect;
  /** Walkable arrival ledge, between the parapet and the void. */
  northLedge: WorldRect;
  westRim: WorldRect;
  eastRim: WorldRect;
  southRim: WorldRect;
  /** Walkable rim ring: chamber floor minus the void, slab, kerb and ramp. */
  rimRects: WorldRect[];

  // ── the slab overlook ──
  /** Ramp up from the south rim onto the viewing apron. */
  slabRamp: WorldRect;
  /** The one walkable metre. */
  slabApron: WorldRect;
  /** The fractured two metres over the void. Blocked. */
  slabNose: WorldRect;

  // ── the drop ──
  void_: Disc;
  /** Same footprint as the void, at the bottom: what the performers stand on. */
  floorDisc: Disc;
  /** Three bosses, west → east. Blocked, visual. */
  bosses: Disc[];
  /** Station anchors on the boss tops, west → east. */
  stations: Point2[];

  // ── the way out ──
  exitRamp: WorldRect;
  /** Flat threshold east of the ramp, holding the Air door's corner at datum 0. */
  exitLanding: WorldRect;
  /** Blocked kerb between the climbing ramp and the level rim north of it. */
  exitKerb: WorldRect;

  /** Four blocked visual bands north of the bay, receding into haze. */
  canyonShelves: WorldRect[];

  /** Every interior tile the programme does not use. */
  rockFill: WorldRect[];

  // ── everything the graybox renders ──
  floorRects: FloorRect[];
  wallRects: WallRect[];
  ceilingRects: CeilingRect[];

  /** Union bbox of the earth bay. elevationAt throws inside it when nothing matches. */
  bayBounds: WorldRect;

  probes: {
    gullyMouth: Point2;
    gullyBend: Point2;
    northLedge: Point2;
    westRim: Point2;
    southRim: Point2;
    eastRim: Point2;
    slabApron: Point2;
    slabNose: Point2;
    exitRamp: Point2;
    parapet: Point2;
    void_: Point2;
    boss: Point2;
    /** A point inside the rock fill — no floor covers it. */
    rock: Point2;
  };
}

// ── Shared anchor expression ────────────────────────────────────────────────

/**
 * Boss offsets in metres from the earth chamber's interior minimum corner. The
 * floor plan's performer entries and this module's layout anchors are the SAME
 * expression, so a performer can never drift off the boss rendered under it.
 * `interiorWidth` is the room's interior width in metres.
 */
export function earthCanyonStationOffsets(
  interiorWidth: number
): { xMetres: number; zMetres: number }[] {
  const chamberCentreX = GULLY_RUN + (interiorWidth - GULLY_RUN) / 2;
  const zMetres =
    PARAPET_DEPTH + NORTH_LEDGE_DEPTH + VOID_RADIUS + BOSS_SOUTH_OFFSET;
  return [-BOSS_SPACING, 0, BOSS_SPACING].map((dx) => ({
    xMetres: chamberCentreX + dx,
    zMetres,
  }));
}

// ── Small helpers ───────────────────────────────────────────────────────────

const cx = (r: WorldRect) => (r.minX + r.maxX) / 2;
const cz = (r: WorldRect) => (r.minZ + r.maxZ) / 2;
const centre = (r: WorldRect): Point2 => ({ x: cx(r), z: cz(r) });
const area = (r: WorldRect) => (r.maxX - r.minX) * (r.maxZ - r.minZ);

/** Half-open containment — used for blocking, matching Water and Fire. */
function inRectHalfOpen(r: WorldRect, x: number, z: number): boolean {
  return x >= r.minX && x < r.maxX && z >= r.minZ && z < r.maxZ;
}

/** Centre a span of `width` on `centreValue`, clamped inside `[lo, hi]`. */
function spanAround(
  centreValue: number,
  width: number,
  lo: number,
  hi: number
): Span {
  let min = centreValue - width / 2;
  let max = centreValue + width / 2;
  if (min < lo) {
    max += lo - min;
    min = lo;
  }
  if (max > hi) {
    min -= max - hi;
    max = hi;
  }
  return { min, max };
}

/**
 * Tile-rasterised carve: every tile of `bounds` whose CENTRE is not swallowed by
 * `isHole`, merged into rects with the same row-run algorithm `subtractTiles`
 * uses. This is how a circular void becomes a list of rendered floor rects
 * without anyone maintaining a rect approximation of the circle by hand — the
 * predicate reads the Disc records directly.
 */
function rasterise(
  bounds: WorldRect,
  isHole: (x: number, z: number) => boolean
): WorldRect[] {
  const txMin = Math.round((bounds.minX + HALF) / TILE);
  const txMax = Math.round((bounds.maxX - HALF) / TILE);
  const tyMin = Math.round((bounds.minZ + HALF) / TILE);
  const tyMax = Math.round((bounds.maxZ - HALF) / TILE);

  type Run = { x0: number; x1: number };
  const rows: { ty: number; runs: Run[] }[] = [];
  for (let ty = tyMin; ty <= tyMax; ty++) {
    const runs: Run[] = [];
    let cur: Run | null = null;
    for (let tx = txMin; tx <= txMax; tx++) {
      if (!isHole(tx * TILE, ty * TILE)) {
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

// ── Layout ──────────────────────────────────────────────────────────────────

export function buildEarthCanyonLayout(
  grid: MuseumGrid
): EarthCanyonLayout | null {
  const earthWing = grid.wings.find((w) => w.id === EARTH_ROOM_ID);
  const fireWing = grid.wings.find((w) => w.id === FIRE_ROOM_ID);
  if (!earthWing || !fireWing) return null;

  const earth = interiorWorldRect(earthWing.bounds);
  const westDoor = doorSpan(grid, EARTH_ROOM_ID, "west");
  const southDoor = doorSpan(grid, EARTH_ROOM_ID, "south");
  if (!westDoor || !southDoor) {
    throw new Error(
      "Earth canyon layout: a door on the earth route is missing from the compiled grid"
    );
  }

  const chamberMinX = earth.minX + GULLY_RUN;
  const chamberWidth = earth.maxX - chamberMinX;
  if (chamberWidth < VOID_RADIUS * 2 + RIM_WIDTH * 2) {
    throw new Error(
      `Earth canyon layout: the chamber is ${chamberWidth.toFixed(1)} m wide, ` +
        `too narrow for a ⌀${(VOID_RADIUS * 2).toFixed(0)} m void plus its rim — widen cave-earth`
    );
  }

  const chamber: WorldRect = {
    minX: chamberMinX,
    maxX: earth.maxX,
    minZ: earth.minZ,
    maxZ: earth.maxZ,
  };

  // ── Z programme, north → south. The parapet band closes the canyon side; the
  // ledge, the void and the south band take the rest.
  const parapet: WorldRect = {
    minX: chamberMinX,
    maxX: earth.maxX,
    minZ: earth.minZ,
    maxZ: earth.minZ + PARAPET_DEPTH,
  };
  const voidCentre: Point2 = {
    x: chamberMinX + chamberWidth / 2,
    z: parapet.maxZ + NORTH_LEDGE_DEPTH + VOID_RADIUS,
  };
  const voidSouthLine = voidCentre.z + VOID_RADIUS;
  const southBandDepth = earth.maxZ - voidSouthLine;
  if (southBandDepth < SOUTH_BAND_MIN) {
    throw new Error(
      `Earth canyon layout: the south band is ${southBandDepth.toFixed(2)} m deep, ` +
        `below the ${SOUTH_BAND_MIN.toFixed(2)} m the rim, kerb and exit ramp need — ` +
        "deepen cave-earth"
    );
  }

  const northLedge: WorldRect = {
    minX: chamberMinX,
    maxX: earth.maxX,
    minZ: parapet.maxZ,
    maxZ: parapet.maxZ + NORTH_LEDGE_DEPTH,
  };
  const westRim: WorldRect = {
    minX: chamberMinX,
    maxX: chamberMinX + RIM_WIDTH,
    minZ: northLedge.maxZ,
    maxZ: earth.maxZ,
  };
  const eastRim: WorldRect = {
    minX: earth.maxX - RIM_WIDTH,
    maxX: earth.maxX,
    minZ: northLedge.maxZ,
    maxZ: earth.maxZ,
  };
  const southRim: WorldRect = {
    minX: westRim.maxX,
    maxX: eastRim.minX,
    minZ: voidSouthLine,
    maxZ: earth.maxZ,
  };

  // ── X programme for the gully, west → east. The mouth drops off Fire's
  // threshold, the bend leg turns north (killing the sightline back to Fire),
  // and the lower run delivers onto the north ledge.
  const mouthZ = spanAround(
    (westDoor.min + westDoor.max) / 2,
    GULLY_WIDTH,
    earth.minZ,
    earth.maxZ
  );
  const lowerZ = spanAround(
    parapet.maxZ + NORTH_LEDGE_DEPTH / 2,
    GULLY_WIDTH,
    earth.minZ,
    earth.maxZ
  );
  const gullyMouth: WorldRect = {
    minX: earth.minX,
    maxX: earth.minX + GULLY_MOUTH_RUN,
    minZ: mouthZ.min,
    maxZ: mouthZ.max,
  };
  const gullyBend: WorldRect = {
    minX: gullyMouth.maxX,
    maxX: gullyMouth.maxX + GULLY_BEND_RUN,
    minZ: Math.min(mouthZ.min, lowerZ.min),
    maxZ: Math.max(mouthZ.max, lowerZ.max),
  };
  const gullyLower: WorldRect = {
    minX: gullyBend.maxX,
    maxX: chamberMinX,
    minZ: lowerZ.min,
    maxZ: lowerZ.max,
  };
  /** The bend descends from the mouth end of its span toward the ledge end. */
  const bendRunsNorth = lowerZ.min < mouthZ.min;

  // ── The drop. One set of Disc records; blocking, elevation and the graybox
  // all read these, so a circle can never disagree with itself.
  const void_: Disc = { id: "void", center: voidCentre, radius: VOID_RADIUS };
  const floorDisc: Disc = {
    id: "floor-disc",
    center: voidCentre,
    radius: VOID_RADIUS,
  };
  const interiorWidth = earth.maxX - earth.minX;
  const bosses: Disc[] = earthCanyonStationOffsets(interiorWidth).map(
    (offset, i) => ({
      id: `boss-${i}`,
      center: {
        x: earth.minX + tileCentredOffset(offset.xMetres),
        z: earth.minZ + tileCentredOffset(offset.zMetres),
      },
      radius: BOSS_RADIUS,
    })
  );
  const stations: Point2[] = bosses.map((boss) => boss.center);

  // ── The slab overlook: a ramp up off the south rim, one walkable metre of
  // apron, two fractured metres of blocked nose out over the void.
  const slabX = spanAround(
    voidCentre.x,
    SLAB_WIDTH,
    southRim.minX,
    southRim.maxX
  );
  const slabApron: WorldRect = {
    minX: slabX.min,
    maxX: slabX.max,
    minZ: voidSouthLine - SLAB_APRON_DEPTH,
    maxZ: voidSouthLine,
  };
  const slabNose: WorldRect = {
    minX: slabX.min,
    maxX: slabX.max,
    minZ: voidSouthLine - SLAB_RUN,
    maxZ: slabApron.minZ,
  };
  const slabRamp: WorldRect = {
    minX: slabX.min,
    maxX: slabX.max,
    minZ: voidSouthLine,
    maxZ: voidSouthLine + SLAB_RAMP_RUN,
  };

  // ── The way out: a 6 m climb east along the south wall to the Air door,
  // walled off from the level rim beside it by a blocked kerb so the two never
  // sit at different heights across a walkable seam.
  const exitRamp: WorldRect = {
    minX: Math.max(southRim.minX, southDoor.max - EXIT_RUN),
    maxX: southDoor.max,
    minZ: earth.maxZ - EXIT_WIDTH,
    maxZ: earth.maxZ,
  };
  // The ramp tops out AT the door; the corner east of it stays on the datum so
  // no walkable seam is left between a deck at 0 and the rim at −1.4.
  const exitLanding: WorldRect = {
    minX: exitRamp.maxX,
    maxX: earth.maxX,
    minZ: exitRamp.minZ,
    maxZ: exitRamp.maxZ,
  };
  const exitKerb: WorldRect = {
    minX: exitRamp.minX + EXIT_JUNCTION,
    maxX: earth.maxX,
    minZ: exitRamp.minZ - EXIT_KERB_DEPTH,
    maxZ: exitRamp.minZ,
  };
  if (exitRamp.maxX - exitRamp.minX < EXIT_RUN - 1e-6) {
    throw new Error(
      "Earth canyon layout: the Air door sits too far west for a full exit ramp run"
    );
  }

  // ── The walkable rim ring: the chamber floor south of the parapet, minus the
  // void, the slab and the exit works. Rasterised off the SAME disc record the
  // blocker uses.
  const chamberFloor: WorldRect = {
    minX: chamberMinX,
    maxX: earth.maxX,
    minZ: parapet.maxZ,
    maxZ: earth.maxZ,
  };
  const carvedFromRim = [
    slabRamp,
    slabApron,
    slabNose,
    exitRamp,
    exitLanding,
    exitKerb,
  ];
  const rimRects = rasterise(
    chamberFloor,
    (x, z) =>
      inDisc(void_, x, z) || carvedFromRim.some((r) => inRectClosed(r, x, z))
  );

  // ── The floor of the void: the performers' disc, with the three bosses
  // standing 0.15 m proud of it.
  const voidBounds: WorldRect = {
    minX: voidCentre.x - VOID_RADIUS,
    maxX: voidCentre.x + VOID_RADIUS,
    minZ: voidCentre.z - VOID_RADIUS,
    maxZ: voidCentre.z + VOID_RADIUS,
  };
  const floorDiscRects = rasterise(
    voidBounds,
    (x, z) => !inDisc(floorDisc, x, z)
  );
  const bossRects = bosses.map((boss) =>
    rasterise(
      {
        minX: boss.center.x - BOSS_RADIUS,
        maxX: boss.center.x + BOSS_RADIUS,
        minZ: boss.center.z - BOSS_RADIUS,
        maxZ: boss.center.z + BOSS_RADIUS,
      },
      (x, z) => !inDisc(boss, x, z)
    )
  );

  // ── Canyon shelves: four blocked visual bands north of the compiled bay.
  const shelfStarts = [3.0, 9.0, 17.0, 29.0];
  const shelfDepths = [5.0, 7.0, 11.0, 16.0];
  const canyonShelves: WorldRect[] = shelfStarts.map((start, i) => ({
    minX: chamberMinX - 10 - i * 8,
    maxX: earth.maxX + 10 + i * 8,
    minZ: earth.minZ - start - shelfDepths[i]!,
    maxZ: earth.minZ - start,
  }));

  // ── Corridor from the First Fire. Both wings suppress their tile geometry,
  // so the corridor between them is suppressed too and this module owns it.
  const fb = fireWing.bounds;
  const eb = earthWing.bounds;
  const corridorTyMin = Math.min(fb.y, eb.y) - 2;
  const corridorTyMax = Math.max(fb.y + fb.height, eb.y + eb.height) + 2;
  const corridor = bandRects(
    grid,
    fb.x + fb.width - 1,
    eb.x,
    corridorTyMin,
    corridorTyMax,
    (t) => t === "corridor" || t === "door"
  );
  const corridorWalls = bandRects(
    grid,
    fb.x + fb.width,
    eb.x - 1,
    corridorTyMin,
    corridorTyMax,
    (t) => t === "wall"
  );

  // ── Rock fill: every interior tile the programme does not use.
  const carved = [
    gullyMouth,
    gullyBend,
    gullyLower,
    parapet,
    ...rimRects,
    slabRamp,
    slabApron,
    slabNose,
    exitRamp,
    exitLanding,
    exitKerb,
    ...floorDiscRects,
  ];
  const rockFill = subtractTiles(earth, carved);

  // ── Floor rects: the single list physics and the graybox both read. Order
  // matters — elevationAt takes the FIRST rect that covers a point, so the slab
  // and the bosses have to precede the surfaces they sit over.
  const bendFromY = bendRunsNorth ? GULLY_MID_Y : GULLY_LOW_Y;
  const bendToY = bendRunsNorth ? GULLY_LOW_Y : GULLY_MID_Y;
  const floorRects: FloorRect[] = [
    ...corridor.map((rect, i) => ({
      id: `earth-corridor-${i}`,
      rect,
      kind: "flat" as const,
      fromY: DOOR_Y,
      toY: DOOR_Y,
    })),
    {
      id: "gully-mouth",
      rect: gullyMouth,
      kind: "ramp-x",
      fromY: DOOR_Y,
      toY: GULLY_MID_Y,
    },
    {
      id: "gully-bend",
      rect: gullyBend,
      kind: "ramp-z",
      fromY: bendFromY,
      toY: bendToY,
    },
    {
      id: "gully-lower",
      rect: gullyLower,
      kind: "ramp-x",
      fromY: GULLY_LOW_Y,
      toY: RIM_Y,
    },
    {
      id: "slab-ramp",
      rect: slabRamp,
      kind: "ramp-z",
      // North edge is the apron, south edge is the rim.
      fromY: SLAB_Y,
      toY: RIM_Y,
    },
    { id: "slab-apron", rect: slabApron, kind: "flat", fromY: SLAB_Y, toY: SLAB_Y },
    { id: "slab-nose", rect: slabNose, kind: "flat", fromY: SLAB_Y, toY: SLAB_Y },
    {
      id: "exit-ramp",
      rect: exitRamp,
      kind: "ramp-x",
      fromY: RIM_Y,
      toY: DOOR_Y,
    },
    {
      id: "exit-landing",
      rect: exitLanding,
      kind: "flat",
      fromY: DOOR_Y,
      toY: DOOR_Y,
    },
    { id: "exit-kerb", rect: exitKerb, kind: "flat", fromY: RIM_Y, toY: RIM_Y },
    ...rimRects.map((rect, i) => ({
      id: `rim-${i}`,
      rect,
      kind: "flat" as const,
      fromY: RIM_Y,
      toY: RIM_Y,
    })),
    { id: "parapet-base", rect: parapet, kind: "flat", fromY: RIM_Y, toY: RIM_Y },
    // Blocked beds: rendered, never walked.
    ...bossRects.flatMap((rects, i) =>
      rects.map((rect, j) => ({
        id: `boss-${i}-${j}`,
        rect,
        kind: "flat" as const,
        fromY: BOSS_Y,
        toY: BOSS_Y,
      }))
    ),
    ...floorDiscRects.map((rect, i) => ({
      id: `floor-disc-${i}`,
      rect,
      kind: "flat" as const,
      fromY: FLOOR_DISC_Y,
      toY: FLOOR_DISC_Y,
    })),
  ];

  // ── Wall rects: envelope with gaps derived from real door tiles. The NORTH
  // wall is deliberately absent: its compiled collision stays, but the canyon
  // has to read as open, so the boulder parapet stands in for it visually.
  const baseY = FLOOR_DISC_Y - 1.0;
  const wallRects: WallRect[] = [];
  const pushWall = (id: string, rect: WorldRect, top: number) => {
    if (rect.maxX - rect.minX > 0.01 && rect.maxZ - rect.minZ > 0.01) {
      wallRects.push({ id, rect, baseY, topY: top });
    }
  };

  for (const [x0, x1] of spansExcluding(earth.minX, earth.maxX, [southDoor])) {
    pushWall(
      `earth-south-${x0.toFixed(2)}`,
      {
        minX: x0,
        maxX: x1,
        minZ: earth.maxZ,
        maxZ: earth.maxZ + WALL_THICKNESS,
      },
      EARTH_CEILING_Y
    );
  }
  for (const [z0, z1] of spansExcluding(earth.minZ, earth.maxZ, [westDoor])) {
    pushWall(
      `earth-west-${z0.toFixed(2)}`,
      {
        minX: earth.minX - WALL_THICKNESS,
        maxX: earth.minX,
        minZ: z0,
        maxZ: z1,
      },
      EARTH_CEILING_Y
    );
  }
  pushWall(
    "earth-east",
    {
      minX: earth.maxX,
      maxX: earth.maxX + WALL_THICKNESS,
      minZ: earth.minZ,
      maxZ: earth.maxZ,
    },
    EARTH_CEILING_Y
  );
  corridorWalls.forEach((rect, i) =>
    pushWall(`earth-corridor-wall-${i}`, rect, GULLY_CEILING_Y)
  );

  // ── Ceilings: the chamber roof with the aven cut out of it, and the gully's
  // own low roof.
  const aven: Disc = { id: "aven", center: voidCentre, radius: AVEN_RADIUS };
  const ceilingRects: CeilingRect[] = [
    ...rasterise(chamber, (x, z) => inDisc(aven, x, z)).map((rect, i) => ({
      id: `earth-ceiling-${i}`,
      rect,
      y: EARTH_CEILING_Y,
    })),
    ...[gullyMouth, gullyBend, gullyLower].map((rect, i) => ({
      id: `earth-gully-ceiling-${i}`,
      rect,
      y: GULLY_CEILING_Y,
    })),
    ...corridor.map((rect, i) => ({
      id: `earth-corridor-ceiling-${i}`,
      rect,
      y: GULLY_CEILING_Y,
    })),
  ];

  const bayBounds = unionRect([earth, ...corridor]);
  const rockProbe = rockFill.length
    ? rockFill.reduce((widest, r) => (area(r) > area(widest) ? r : widest))
    : earth;

  return {
    earth,
    corridor,
    gullyMouth,
    gullyBend,
    gullyLower,
    bendRunsNorth,
    chamber,
    parapet,
    northLedge,
    westRim,
    eastRim,
    southRim,
    rimRects,
    slabRamp,
    slabApron,
    slabNose,
    void_,
    floorDisc,
    bosses,
    stations,
    exitRamp,
    exitLanding,
    exitKerb,
    canyonShelves,
    rockFill,
    floorRects,
    wallRects,
    ceilingRects,
    bayBounds,
    probes: {
      gullyMouth: centre(gullyMouth),
      gullyBend: { x: cx(gullyBend), z: cz(gullyLower) },
      northLedge: { x: voidCentre.x, z: cz(northLedge) },
      westRim: { x: cx(westRim), z: voidCentre.z },
      southRim: {
        x: cx(westRim) + RIM_WIDTH,
        z: voidSouthLine + RIM_WIDTH / 2,
      },
      eastRim: { x: cx(eastRim), z: voidCentre.z },
      slabApron: centre(slabApron),
      slabNose: centre(slabNose),
      exitRamp: centre(exitRamp),
      parapet: centre(parapet),
      void_: voidCentre,
      boss: bosses[1]!.center,
      rock: centre(rockProbe),
    },
  };
}

// ── Terrain program ─────────────────────────────────────────────────────────

export function createEarthCanyonTerrain(
  grid: MuseumGrid
): MuseumTerrainProgram | null {
  const layout = buildEarthCanyonLayout(grid);
  if (!layout) return null;

  const { floorRects, bayBounds } = layout;
  const blockedRects: WorldRect[] = [
    layout.parapet,
    layout.slabNose,
    layout.exitKerb,
    ...layout.rockFill,
  ];
  /** The void is a circle, and so is what blocks it. */
  const blockedDiscs: Disc[] = [layout.void_];
  /**
   * The slab overlook hangs INSIDE the void's circle. It is authored floor, so
   * it wins over the disc — without this the apron the whole room is built
   * around would be blocked by the drop it looks into.
   */
  const walkableOverrides: WorldRect[] = [layout.slabApron, layout.slabRamp];

  const heightOn = (floor: FloorRect, x: number, z: number): number => {
    if (floor.kind === "flat") return floor.fromY;
    const alongZ = floor.kind === "ramp-z";
    const min = alongZ ? floor.rect.minZ : floor.rect.minX;
    const max = alongZ ? floor.rect.maxZ : floor.rect.maxX;
    const v = alongZ ? z : x;
    const t =
      max === min ? 0 : Math.min(1, Math.max(0, (v - min) / (max - min)));
    return floor.fromY + (floor.toY - floor.fromY) * t;
  };

  return {
    waterlineY: WATERLINE_Y,
    elevationAt(x, z) {
      for (const floor of floorRects) {
        if (inRectClosed(floor.rect, x, z)) return heightOn(floor, x, z);
      }
      // Absorb exactly the quarter-tile the physics provider's Math.round
      // lookup can legally drift past a rect edge, and no more.
      for (const floor of floorRects) {
        const grown: WorldRect = {
          minX: floor.rect.minX - TILE_ROUNDING_SLOP,
          maxX: floor.rect.maxX + TILE_ROUNDING_SLOP,
          minZ: floor.rect.minZ - TILE_ROUNDING_SLOP,
          maxZ: floor.rect.maxZ + TILE_ROUNDING_SLOP,
        };
        if (inRectClosed(grown, x, z)) return heightOn(floor, x, z);
      }
      if (import.meta.env.DEV && inRectClosed(bayBounds, x, z)) {
        throw new Error(
          `Earth canyon: no elevation zone covers (${x.toFixed(2)}, ${z.toFixed(2)}) ` +
            "inside the earth bay — the layout and the walkable grid disagree"
        );
      }
      return 0;
    },
    blockedAt(x, z) {
      for (const rect of walkableOverrides) {
        if (inRectHalfOpen(rect, x, z)) return false;
      }
      for (const rect of blockedRects) if (inRectHalfOpen(rect, x, z)) return true;
      for (const disc of blockedDiscs) if (inDisc(disc, x, z)) return true;
      return false;
    },
  };
}
