/**
 * Orientation calculator
 *
 * Calculates end orientation based on motion type, turns, rotation direction,
 * and start orientation. This is foundational for valid pictograph generation.
 */

import type { HandPath, Orientation } from "../types.js";


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
const RADIAL_CW_CYCLE: Orientation[] = [
  "in", "clockIn", "clock", "clockOut",
  "out", "counterOut", "counter", "counterIn",
];

const ORIENTATION_BY_LOWER: Record<string, Orientation> = (() => {
  const map: Record<string, Orientation> = {};
  for (const o of [...RADIAL_CW_CYCLE, ...CENTER_CW_CYCLE]) {
    map[o.toLowerCase()] = o;
  }
  return map;
})();

/**
 * Normalize any-case orientation input to its canonical camelCase form.
 * Blanket .toLowerCase() breaks interradial (clockIn) / center (centerN)
 * orientations because switchOrientation + the cycles are keyed camelCase — a
 * lowercased key misses every lookup, so the turn silently no-ops and an
 * invalid token ("centern") escapes into stored data and the rotation maps.
 * An unrecognized non-empty value is a data-integrity problem upstream — warn
 * rather than coerce it to "in" silently.
 */
export function canonicalOrientation(raw: string | undefined): Orientation {
  if (!raw) return "in";
  const canonical = ORIENTATION_BY_LOWER[raw.toLowerCase()];
  if (!canonical) {
    console.warn(`[orientation] Unknown orientation "${raw}", defaulting to "in"`);
    return "in";
  }
  return canonical;
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
 * Fractional turns keep the same whole-turn base as integer turns, then add
 * the prop's physical quarter-turn rotation. ANTI/DASH therefore begin from
 * the reversed orientation; PRO/STATIC begin from the supplied orientation.
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
  const isAntiLike = type === "anti" || type === "dash";

  // A zero-turn ANTI/DASH motion reverses orientation. Fractional turns must
  // retain that four-step base or the result jumps discontinuously when, for
  // example, 0.75 becomes 1 turn. The radial cycle runs opposite the SVG
  // angle convention, so a physical clockwise prop rotation subtracts steps.
  const baseSteps = isAntiLike ? 4 : 0;
  const turnSteps = isCW ? -steps : steps;
  const newIdx = ((startIdx + baseSteps + turnSteps) % 8 + 8) % 8;
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


export interface OrientationInput {
  motionType: string;
  turns?: number | "fl";
  rotationDirection: string;
  startLocation: string;
  endLocation: string;
  startOrientation?: string;
}


/**
 * Calculate end orientation from motion data.
 * @param input - Motion data including type, turns, rotation direction, locations
 * @returns Calculated end orientation
 */
export function calculateEndOrientation(input: OrientationInput): Orientation {
  const {
    motionType,
    turns = 0,
    rotationDirection = "cw",
    startLocation,
    endLocation,
    startOrientation = "in",
  } = input;

  const startOri = canonicalOrientation(startOrientation);
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
export function calculateOrientations(input: OrientationInput): {
  startOrientation: Orientation;
  endOrientation: Orientation;
} {
  const startOrientation = canonicalOrientation(input.startOrientation);

  const endOrientation = calculateEndOrientation({
    ...input,
    startOrientation,
  });

  return { startOrientation, endOrientation };
}
