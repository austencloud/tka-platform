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

const HASH_OUT_PAIRS = [
  ["c", "n"], ["c", "e"], ["c", "s"], ["c", "w"],
  ["c", "ne"], ["c", "se"], ["c", "sw"], ["c", "nw"],
];

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

/**
 * The shift-arc orbital direction for a hand path, or null when the path is not
 * a shift (static / dash / hash geometry). Built on the canonical getHandpathDirection.
 */
export function deriveHandOrbitalDirection(
  startLocation: string,
  endLocation: string
): "cw" | "ccw" | null {
  const hp = getHandpathDirection(startLocation, endLocation);
  return hp === "cw" || hp === "ccw" ? hp : null;
}

/**
 * Full motion-type classifier from the irreducible stored fields. Unlike the
 * partial create-module copies, this resolves ALL five MotionType values with no
 * stored-type fallback, so the codec can derive motionType on decode.
 *
 * rotationDirection accepts enum string values ("cw"/"ccw"/"noRotation") OR the
 * codec single-char form ("c"/"u"/"x").
 */
export function deriveMotionType(
  startLocation: string,
  endLocation: string,
  rotationDirection: string,
  turns: number | "fl"
): "pro" | "anti" | "float" | "dash" | "static" {
  if (turns === "fl") return "float";

  const orbit = deriveHandOrbitalDirection(startLocation, endLocation);
  if (orbit !== null) {
    const rot = rotationDirection.toLowerCase();
    const rotIsCw = rot === "cw" || rot === "c";
    const motionDir = rotIsCw ? "cw" : "ccw";
    return motionDir === orbit ? "pro" : "anti";
  }

  if (startLocation.toLowerCase() === endLocation.toLowerCase()) return "static";
  return "dash";
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

const CENTER_CW_CYCLE: Orientation[] = [
  "centerN", "centerNE", "centerE", "centerSE",
  "centerS", "centerSW", "centerW", "centerNW",
];

const RADIAL_CW_CYCLE: Orientation[] = [
  "in", "clockIn", "clock", "clockOut",
  "out", "counterOut", "counter", "counterIn",
];

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
  const effectiveCW = isAntiLike ? isCW : !isCW;

  const direction = effectiveCW ? 1 : -1;
  const newIdx = ((startIdx + direction * steps) % 8 + 8) % 8;
  return RADIAL_CW_CYCLE[newIdx]!;
}

function calculateFloatOrientation(startOrientation: Orientation, handpathDirection: HandPath): Orientation {
  if (handpathDirection !== "cw" && handpathDirection !== "ccw") {
    return startOrientation;
  }

  const startIdx = RADIAL_CW_CYCLE.indexOf(startOrientation);
  if (startIdx === -1) return startOrientation;

  const direction = handpathDirection === "cw" ? 1 : -1;
  const steps = 2; 
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

export function calculateEndOrientation(input: OrientationInput): Orientation {
  const {
    motionType,
    turns = 0,
    rotationDirection = "cw",
    startLocation,
    endLocation,
    startOrientation = "in",
  } = input;

  const startOri = (startOrientation?.toLowerCase() as Orientation) || "in";
  const type = motionType?.toLowerCase() || "static";

  const rotDir = rotationDirection?.toLowerCase() || "cw";
  const effectiveRotDir = rotDir === "norotation" || rotDir === "none" || rotDir === "no_rot" ? "cw" : rotDir;

  if (isCenterOrientation(startOri)) {
    const turnsNum = typeof turns === "number" ? turns : 0;
    if (Number.isInteger(turnsNum)) {
      return calculateWholeTurnOrientation(type, turnsNum, startOri);
    }
    return calculateCenterFractionalTurnOrientation(type, turnsNum, startOri, effectiveRotDir);
  }

  if (type === "float" || turns === "fl") {
    const handpath = getHandpathDirection(startLocation, endLocation);
    return calculateFloatOrientation(startOri, handpath);
  }

  const turnsNum = typeof turns === "number" ? turns : 0;

  if (Number.isInteger(turnsNum)) {
    return calculateWholeTurnOrientation(type, turnsNum, startOri);
  }

  return calculateRadialFractionalTurnOrientation(type, turnsNum, startOri, effectiveRotDir);
}

export function calculateOrientations(input: OrientationInput): {
  startOrientation: Orientation;
  endOrientation: Orientation;
} {
  const startOrientation = (input.startOrientation?.toLowerCase() as Orientation) || "in";

  const endOrientation = calculateEndOrientation({
    ...input,
    startOrientation,
  });

  return { startOrientation, endOrientation };
}
