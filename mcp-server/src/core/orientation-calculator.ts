/**
 * Orientation Calculator - Port from browser OrientationCalculator
 *
 * Calculates end orientation based on motion type, turns, rotation direction,
 * and start orientation. This is foundational for valid pictograph generation.
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum Orientation {
  IN = "in",
  OUT = "out",
  CLOCK = "clock",
  COUNTER = "counter",
}

export enum HandPath {
  CLOCKWISE = "cw",
  COUNTER_CLOCKWISE = "ccw",
  DASH = "dash",
  STATIC = "static",
}

// ============================================================================
// HANDPATH CALCULATOR
// ============================================================================

const CLOCKWISE_PAIRS = [
  ["s", "w"], ["w", "n"], ["n", "e"], ["e", "s"],
  ["ne", "se"], ["se", "sw"], ["sw", "nw"], ["nw", "ne"],
];

const COUNTER_CLOCKWISE_PAIRS = [
  ["w", "s"], ["n", "w"], ["e", "n"], ["s", "e"],
  ["ne", "nw"], ["nw", "sw"], ["sw", "se"], ["se", "ne"],
];

const DASH_PAIRS = [
  ["s", "n"], ["w", "e"], ["n", "s"], ["e", "w"],
  ["ne", "sw"], ["se", "nw"], ["sw", "ne"], ["nw", "se"],
];

const STATIC_PAIRS = [
  ["n", "n"], ["e", "e"], ["s", "s"], ["w", "w"],
  ["ne", "ne"], ["se", "se"], ["sw", "sw"], ["nw", "nw"],
];

// Build handpath map
const handpathMap = new Map<string, HandPath>();

CLOCKWISE_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, HandPath.CLOCKWISE);
});

COUNTER_CLOCKWISE_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, HandPath.COUNTER_CLOCKWISE);
});

DASH_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, HandPath.DASH);
});

STATIC_PAIRS.forEach(([start, end]) => {
  handpathMap.set(`${start}_${end}`, HandPath.STATIC);
});

/**
 * Get handpath direction from start/end locations
 */
function getHandpathDirection(startLocation: string, endLocation: string): HandPath {
  const key = `${startLocation.toLowerCase()}_${endLocation.toLowerCase()}`;
  return handpathMap.get(key) || HandPath.STATIC;
}

// ============================================================================
// ORIENTATION SWITCHING
// ============================================================================

/**
 * Switch orientation: IN↔OUT, CLOCK↔COUNTER
 */
function switchOrientation(ori: Orientation): Orientation {
  const switchMap: Record<Orientation, Orientation> = {
    [Orientation.IN]: Orientation.OUT,
    [Orientation.OUT]: Orientation.IN,
    [Orientation.CLOCK]: Orientation.COUNTER,
    [Orientation.COUNTER]: Orientation.CLOCK,
  };
  return switchMap[ori] || ori;
}

// ============================================================================
// WHOLE TURN ORIENTATION
// ============================================================================

/**
 * Calculate orientation for whole turns (0, 1, 2, 3)
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

// ============================================================================
// HALF TURN ORIENTATION
// ============================================================================

/**
 * Calculate orientation for half turns (0.5, 1.5, 2.5, 3.5)
 * Complex lookup based on startOrientation + rotationDirection + parity
 */
function calculateHalfTurnOrientation(
  motionType: string,
  turns: number,
  startOrientation: Orientation,
  rotationDirection: string
): Orientation {
  const type = motionType.toLowerCase();
  const rotDir = rotationDirection.toLowerCase();
  const isCW = rotDir === "cw" || rotDir === "clockwise";
  const isFirstHalf = turns % 2 === 0.5; // 0.5, 2.5 vs 1.5, 3.5

  // ANTI/DASH orientation map
  if (type === "anti" || type === "dash") {
    if (startOrientation === Orientation.IN) {
      return isCW
        ? (isFirstHalf ? Orientation.CLOCK : Orientation.COUNTER)
        : (isFirstHalf ? Orientation.COUNTER : Orientation.CLOCK);
    } else if (startOrientation === Orientation.OUT) {
      return isCW
        ? (isFirstHalf ? Orientation.COUNTER : Orientation.CLOCK)
        : (isFirstHalf ? Orientation.CLOCK : Orientation.COUNTER);
    } else if (startOrientation === Orientation.CLOCK) {
      return isCW
        ? (isFirstHalf ? Orientation.OUT : Orientation.IN)
        : (isFirstHalf ? Orientation.IN : Orientation.OUT);
    } else if (startOrientation === Orientation.COUNTER) {
      return isCW
        ? (isFirstHalf ? Orientation.IN : Orientation.OUT)
        : (isFirstHalf ? Orientation.OUT : Orientation.IN);
    }
  }

  // PRO/STATIC orientation map
  if (type === "pro" || type === "static") {
    if (startOrientation === Orientation.IN) {
      return isCW
        ? (isFirstHalf ? Orientation.COUNTER : Orientation.CLOCK)
        : (isFirstHalf ? Orientation.CLOCK : Orientation.COUNTER);
    } else if (startOrientation === Orientation.OUT) {
      return isCW
        ? (isFirstHalf ? Orientation.CLOCK : Orientation.COUNTER)
        : (isFirstHalf ? Orientation.COUNTER : Orientation.CLOCK);
    } else if (startOrientation === Orientation.CLOCK) {
      return isCW
        ? (isFirstHalf ? Orientation.IN : Orientation.OUT)
        : (isFirstHalf ? Orientation.OUT : Orientation.IN);
    } else if (startOrientation === Orientation.COUNTER) {
      return isCW
        ? (isFirstHalf ? Orientation.OUT : Orientation.IN)
        : (isFirstHalf ? Orientation.IN : Orientation.OUT);
    }
  }

  return startOrientation;
}

// ============================================================================
// FLOAT ORIENTATION
// ============================================================================

/**
 * Calculate float orientation based on handpath direction
 */
function calculateFloatOrientation(
  startOrientation: Orientation,
  handpathDirection: HandPath
): Orientation {
  const floatMap: Record<string, Orientation> = {
    [`${Orientation.IN}_${HandPath.CLOCKWISE}`]: Orientation.CLOCK,
    [`${Orientation.IN}_${HandPath.COUNTER_CLOCKWISE}`]: Orientation.COUNTER,
    [`${Orientation.OUT}_${HandPath.CLOCKWISE}`]: Orientation.COUNTER,
    [`${Orientation.OUT}_${HandPath.COUNTER_CLOCKWISE}`]: Orientation.CLOCK,
    [`${Orientation.CLOCK}_${HandPath.CLOCKWISE}`]: Orientation.OUT,
    [`${Orientation.CLOCK}_${HandPath.COUNTER_CLOCKWISE}`]: Orientation.IN,
    [`${Orientation.COUNTER}_${HandPath.CLOCKWISE}`]: Orientation.IN,
    [`${Orientation.COUNTER}_${HandPath.COUNTER_CLOCKWISE}`]: Orientation.OUT,
  };

  const key = `${startOrientation}_${handpathDirection}`;
  return floatMap[key] || startOrientation;
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

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
 *
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

  // Normalize start orientation
  const startOri = startOrientation?.toLowerCase() as Orientation || Orientation.IN;
  const type = motionType?.toLowerCase() || "static";

  // Normalize rotation direction (handle undefined, "noRotation", etc.)
  const rotDir = rotationDirection?.toLowerCase() || "cw";
  const effectiveRotDir = (rotDir === "norotation" || rotDir === "none") ? "cw" : rotDir;

  // FLOAT motion: use handpath-based calculation
  if (type === "float" || turns === "fl") {
    const handpath = getHandpathDirection(startLocation, endLocation);
    return calculateFloatOrientation(startOri, handpath);
  }

  // Ensure turns is a number for further calculations
  const turnsNum = typeof turns === "number" ? turns : 0;

  // Whole turns (0, 1, 2, 3)
  if (turnsNum === 0 || turnsNum === 1 || turnsNum === 2 || turnsNum === 3) {
    return calculateWholeTurnOrientation(type, turnsNum, startOri);
  }

  // Half turns (0.5, 1.5, 2.5, 3.5)
  return calculateHalfTurnOrientation(type, turnsNum, startOri, effectiveRotDir);
}

/**
 * Calculate both start and end orientations for a motion.
 * Start orientation defaults to IN (the universal starting orientation).
 *
 * @param input - Motion data
 * @returns Object with startOrientation and calculated endOrientation
 */
export function calculateOrientations(input: OrientationInput): {
  startOrientation: Orientation;
  endOrientation: Orientation;
} {
  // Default start orientation is IN
  const startOrientation = (input.startOrientation?.toLowerCase() as Orientation) || Orientation.IN;

  const endOrientation = calculateEndOrientation({
    ...input,
    startOrientation,
  });

  return { startOrientation, endOrientation };
}
