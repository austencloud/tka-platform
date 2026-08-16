/**
 * Orientation calculator
 *
 * Calculates end orientation based on motion type, turns, rotation direction,
 * and start orientation. This is foundational for valid pictograph generation.
 *
 * Inlined from @tka/render-core to remove that dependency.
 */

import type { HandPath, Orientation } from "../types/sequence-engine-types.js";

export type { Orientation } from "../types/sequence-engine-types.js";
export type { OrientationInput } from "../types/sequence-engine-types.js";


const CLOCKWISE_PAIRS = [
  ["s", "w"],
  ["w", "n"],
  ["n", "e"],
  ["e", "s"],
  ["ne", "se"],
  ["se", "sw"],
  ["sw", "nw"],
  ["nw", "ne"],
];

const COUNTER_CLOCKWISE_PAIRS = [
  ["w", "s"],
  ["n", "w"],
  ["e", "n"],
  ["s", "e"],
  ["ne", "nw"],
  ["nw", "sw"],
  ["sw", "se"],
  ["se", "ne"],
];

const DASH_PAIRS = [
  ["s", "n"],
  ["w", "e"],
  ["n", "s"],
  ["e", "w"],
  ["ne", "sw"],
  ["se", "nw"],
  ["sw", "ne"],
  ["nw", "se"],
];

const STATIC_PAIRS = [
  ["n", "n"],
  ["e", "e"],
  ["s", "s"],
  ["w", "w"],
  ["ne", "ne"],
  ["se", "se"],
  ["sw", "sw"],
  ["nw", "nw"],
  ["c", "c"],
];

// Center → perimeter (hash-out): hand moves away from center
const HASH_OUT_PAIRS = [
  ["c", "n"], ["c", "e"], ["c", "s"], ["c", "w"],
  ["c", "ne"], ["c", "se"], ["c", "sw"], ["c", "nw"],
];

// Perimeter → center (hash-in): hand moves toward center
const HASH_IN_PAIRS = [
  ["n", "c"], ["e", "c"], ["s", "c"], ["w", "c"],
  ["ne", "c"], ["se", "c"], ["sw", "c"], ["nw", "c"],
];

// Build handpath map
const handpathMap = new Map<string, HandPath>();

CLOCKWISE_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, "cw");
});

COUNTER_CLOCKWISE_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, "ccw");
});

DASH_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, "dash");
});

STATIC_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, "static");
});

HASH_OUT_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, "hashOut");
});

HASH_IN_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, "hashIn");
});

export function getHandpathDirection(startLocation: string, endLocation: string): HandPath {
  const key = `${startLocation.toLowerCase()}_${endLocation.toLowerCase()}`;
  return handpathMap.get(key) || "static";
}


export function switchOrientation(ori: Orientation): Orientation {
  const switchMap: Record<string, Orientation> = {
    in: "out",
    out: "in",
    clock: "counter",
    counter: "clock",
    clockIn: "counterOut",
    counterOut: "clockIn",
    clockOut: "counterIn",
    counterIn: "clockOut",
    // Center orientations switch to opposite compass direction
    centerN: "centerS",
    centerS: "centerN",
    centerNE: "centerSW",
    centerSW: "centerNE",
    centerE: "centerW",
    centerW: "centerE",
    centerSE: "centerNW",
    centerNW: "centerSE",
  };
  return (switchMap[ori] as Orientation) || ori;
}

function isCenterOrientation(ori: string): boolean {
  return ori.startsWith("center");
}

/**
 * 8-point clockwise compass cycle for center orientation fractional-turn calculation.
 */
const CENTER_CW_CYCLE: Orientation[] = [
  "centerN", "centerNE", "centerE", "centerSE",
  "centerS", "centerSW", "centerW", "centerNW",
];

/**
 * 8-point clockwise radial cycle for fractional-turn calculation.
 * Each step = 45 degrees of prop rotation.
 * Covers all 4 cardinal + 4 interradial orientations.
 */
export const RADIAL_CW_CYCLE: Orientation[] = [
  "in", "clockIn", "clock", "clockOut",
  "out", "counterOut", "counter", "counterIn",
];

const ORIENTATION_BY_LOWERCASE = new Map<string, Orientation>(
  [
    ...RADIAL_CW_CYCLE,
    ...CENTER_CW_CYCLE,
  ].map((orientation) => [orientation.toLowerCase(), orientation])
);

function normalizeOrientation(orientation: string | undefined): Orientation {
  return ORIENTATION_BY_LOWERCASE.get(orientation?.toLowerCase() ?? "") ?? "in";
}

/**
 * Each 0.25 turn = 1 compass step (45 degrees). Each 0.5 turn = 2 steps (90 degrees).
 * Center rule: PRO/STATIC step SAME as rotation, ANTI/DASH step OPPOSITE.
 */
function calculateCenterFractionalTurnOrientation(
  motionType: string,
  turns: number,
  startOrientation: Orientation,
  rotationDirection: string
): Orientation {
  const startIdx = CENTER_CW_CYCLE.indexOf(startOrientation);
  if (startIdx === -1) return startOrientation;

  const steps = Math.round(turns * 4);

  const rotDir = rotationDirection.toLowerCase();
  const isCW = rotDir === "cw" || rotDir === "clockwise";
  const type = motionType.toLowerCase();
  const isProLike = type === "pro" || type === "static";
  const effectiveCW = isProLike ? isCW : !isCW;

  const direction = effectiveCW ? 1 : -1;
  const newIdx = ((startIdx + direction * steps) % 8 + 8) % 8;
  return CENTER_CW_CYCLE[newIdx]!;
}


/**
 *
 * PRO/STATIC: even turns = same, odd turns = switch
 * ANTI/DASH: even turns = switch, odd turns = same
 */
function calculateWholeTurnOrientation(
  motionType: string,
  turns: number,
  startOrientation: Orientation
): Orientation {
  const type = motionType.toLowerCase();
  const isEvenTurns = turns % 2 === 0;

  if (type === "pro" || type === "static") {
    return isEvenTurns ? startOrientation : switchOrientation(startOrientation);
  } else if (type === "anti" || type === "dash") {
    return isEvenTurns ? switchOrientation(startOrientation) : startOrientation;
  }

  return startOrientation;
}


/**
 * Handles 0.25, 0.5, 0.75, 1.25, 1.5, 1.75, 2.25, 2.5, etc.
 * Uses the 8-point radial cycle: in → clockIn → clock → clockOut → out → counterOut → counter → counterIn
 *
 * Radial rule: ANTI/DASH step SAME direction as rotation, PRO/STATIC step OPPOSITE.
 */
function calculateRadialFractionalTurnOrientation(
  motionType: string,
  turns: number,
  startOrientation: Orientation,
  rotationDirection: string
): Orientation {
  const startIdx = RADIAL_CW_CYCLE.indexOf(startOrientation);
  if (startIdx === -1) return startOrientation;

  const steps = Math.round(turns * 4);

  const rotDir = rotationDirection.toLowerCase();
  const isCW = rotDir === "cw" || rotDir === "clockwise";
  const type = motionType.toLowerCase();

  // Radial rule: ANTI/DASH step same direction, PRO/STATIC step opposite
  const isAntiLike = type === "anti" || type === "dash";
  const effectiveCW = isAntiLike ? isCW : !isCW;

  const direction = effectiveCW ? 1 : -1;
  const newIdx = ((startIdx + direction * steps) % 8 + 8) % 8;
  return RADIAL_CW_CYCLE[newIdx]!;
}


/**
 * Float uses ANTI/DASH rule: step same direction as handpath, 2 steps (0.5 turns equivalent).
 * Only changes orientation for CW/CCW handpaths; dash/static handpaths preserve orientation.
 * Works for all 8 radial orientations (cardinal + interradial).
 */
function calculateFloatOrientation(startOrientation: Orientation, handpathDirection: HandPath): Orientation {
  if (handpathDirection !== "cw" && handpathDirection !== "ccw") {
    // dash, static, hashIn, hashOut all preserve orientation for float
    return startOrientation;
  }

  const startIdx = RADIAL_CW_CYCLE.indexOf(startOrientation);
  if (startIdx === -1) return startOrientation;

  // Float uses ANTI/DASH rule: step same direction as handpath
  const direction = handpathDirection === "cw" ? 1 : -1;
  const steps = 2; // Float = 0.5 turns equivalent
  const newIdx = ((startIdx + direction * steps) % 8 + 8) % 8;
  return RADIAL_CW_CYCLE[newIdx]!;
}


/**
 * Calculate end orientation from motion data.
 * @param input - Motion data including type, turns, rotation direction, locations
 * @returns Calculated end orientation
 */
export function calculateEndOrientation(input: {
  motionType: string;
  turns?: number | "fl";
  rotationDirection: string;
  startLocation: string;
  endLocation: string;
  startOrientation?: string;
}): Orientation {
  const {
    motionType,
    turns = 0,
    rotationDirection = "cw",
    startLocation,
    endLocation,
    startOrientation = "in",
  } = input;

  // Normalize start orientation
  const startOri = normalizeOrientation(startOrientation);
  const type = motionType?.toLowerCase() || "static";

  // Normalize rotation direction (handle undefined, "noRotation", etc.)
  const rotDir = rotationDirection?.toLowerCase() || "cw";
  const effectiveRotDir = rotDir === "norotation" || rotDir === "none" || rotDir === "no_rot" ? "cw" : rotDir;

  // Center orientations: whole turns use switch logic, fractional turns use compass cycle
  if (isCenterOrientation(startOri)) {
    const turnsNum = typeof turns === "number" ? turns : 0;
    if (Number.isInteger(turnsNum)) {
      return calculateWholeTurnOrientation(type, turnsNum, startOri);
    }
    return calculateCenterFractionalTurnOrientation(type, turnsNum, startOri, effectiveRotDir);
  }

  // FLOAT motion: use handpath-based calculation
  if (type === "float" || turns === "fl") {
    const handpath = getHandpathDirection(startLocation, endLocation);
    return calculateFloatOrientation(startOri, handpath);
  }

  // Ensure turns is a number for further calculations
  const turnsNum = typeof turns === "number" ? turns : 0;

  // Whole turns (0, 1, 2, 3, ...)
  if (Number.isInteger(turnsNum)) {
    return calculateWholeTurnOrientation(type, turnsNum, startOri);
  }

  // Fractional turns (0.25, 0.5, 0.75, 1.25, 1.5, 1.75, ...)
  return calculateRadialFractionalTurnOrientation(type, turnsNum, startOri, effectiveRotDir);
}

/**
 * Calculate both start and end orientations for a motion.
 * Start orientation defaults to IN (the universal starting orientation).
 * @param input - Motion data
 * @returns Object with startOrientation and calculated endOrientation
 */
export function calculateOrientations(input: {
  motionType: string;
  turns?: number | "fl";
  rotationDirection: string;
  startLocation: string;
  endLocation: string;
  startOrientation?: string;
}): {
  startOrientation: Orientation;
  endOrientation: Orientation;
} {
  // Default start orientation is IN
  const startOrientation = normalizeOrientation(input.startOrientation);

  const endOrientation = calculateEndOrientation({
    ...input,
    startOrientation,
  });

  return { startOrientation, endOrientation };
}
