/**
 * LOOP Validator for MCP Server
 *
 * Validates which LOOP (Linked Orbital Offset Pattern) types are available
 * for a given position pair based on position symmetry rules.
 *
 * Ported from the main app's circular-position-maps.ts and LOOPValidator.ts
 */

import {
  LOOPType,
  Period,
  LOOP_TYPE_LABELS,
  LOOP_TYPE_DESCRIPTIONS,
  ALL_LOOP_TYPES,
  type LOOPOption,
  type LOOPValidationResult,
} from "../loop-types.js";

import {
  FLIPPED_LOOP_VALIDATION_SET,
  HORIZONTAL_MIRROR_POSITION_MAP,
} from "../position-maps/strict-loop-position-maps.js";

import {
  LOOPComponent as CanonicalLOOPComponent,
  type LOOPSpec,
  allActiveComponents,
} from "../loop-spec.js";


/**
 * All valid grid positions (alpha, beta, gamma with variants)
 * These are the string position identifiers used in the dataframe
 */
const POSITION_GROUPS = ["alpha", "beta", "gamma", "zeta", "eta"] as const;

function generatePositions(group: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${group}${i + 1}`);
}

// Standard position sets (8 positions each, plus gamma has 16)
const ALPHA_POSITIONS = generatePositions("alpha", 8);
const BETA_POSITIONS = generatePositions("beta", 8);
const GAMMA_POSITIONS = generatePositions("gamma", 16);
const ZETA_POSITIONS = generatePositions("zeta", 16);
const ETA_POSITIONS = generatePositions("eta", 16);

/**
 * Half position mappings - 180° rotation
 * Maps each position to its opposite position (+4 within 8-position groups)
 */
const HALF_POSITION_MAP: Record<string, string> = {};

// Alpha positions (1↔5, 2↔6, 3↔7, 4↔8)
for (let i = 1; i <= 8; i++) {
  const opposite = ((i - 1 + 4) % 8) + 1;
  HALF_POSITION_MAP[`alpha${i}`] = `alpha${opposite}`;
}

// Beta positions (same pattern)
for (let i = 1; i <= 8; i++) {
  const opposite = ((i - 1 + 4) % 8) + 1;
  HALF_POSITION_MAP[`beta${i}`] = `beta${opposite}`;
}

// Gamma 1-8 positions (within first half)
for (let i = 1; i <= 8; i++) {
  const opposite = ((i - 1 + 4) % 8) + 1;
  HALF_POSITION_MAP[`gamma${i}`] = `gamma${opposite}`;
}

// Gamma 9-16 positions (within second half)
for (let i = 9; i <= 16; i++) {
  const opposite = ((i - 9 + 4) % 8) + 9;
  HALF_POSITION_MAP[`gamma${i}`] = `gamma${opposite}`;
}

// Zeta 1-8 positions
for (let i = 1; i <= 8; i++) {
  const opposite = ((i - 1 + 4) % 8) + 1;
  HALF_POSITION_MAP[`zeta${i}`] = `zeta${opposite}`;
}

// Zeta 9-16 positions
for (let i = 9; i <= 16; i++) {
  const opposite = ((i - 9 + 4) % 8) + 9;
  HALF_POSITION_MAP[`zeta${i}`] = `zeta${opposite}`;
}

// Eta 1-8 positions
for (let i = 1; i <= 8; i++) {
  const opposite = ((i - 1 + 4) % 8) + 1;
  HALF_POSITION_MAP[`eta${i}`] = `eta${opposite}`;
}

// Eta 9-16 positions
for (let i = 9; i <= 16; i++) {
  const opposite = ((i - 9 + 4) % 8) + 9;
  HALF_POSITION_MAP[`eta${i}`] = `eta${opposite}`;
}

/**
 * Quarter position mappings - 90° clockwise rotation
 * Maps each position to +2 positions within group
 */
const QUARTER_POSITION_MAP_CW: Record<string, string> = {};

// Alpha positions (90° CW = +2)
for (let i = 1; i <= 8; i++) {
  const next = ((i - 1 + 2) % 8) + 1;
  QUARTER_POSITION_MAP_CW[`alpha${i}`] = `alpha${next}`;
}

// Beta positions
for (let i = 1; i <= 8; i++) {
  const next = ((i - 1 + 2) % 8) + 1;
  QUARTER_POSITION_MAP_CW[`beta${i}`] = `beta${next}`;
}

// Gamma 1-8
for (let i = 1; i <= 8; i++) {
  const next = ((i - 1 + 2) % 8) + 1;
  QUARTER_POSITION_MAP_CW[`gamma${i}`] = `gamma${next}`;
}

// Gamma 9-16
for (let i = 9; i <= 16; i++) {
  const next = ((i - 9 + 2) % 8) + 9;
  QUARTER_POSITION_MAP_CW[`gamma${i}`] = `gamma${next}`;
}

/**
 * Quarter position mappings - 90° counter-clockwise rotation
 * Maps each position to -2 positions within group
 */
const QUARTER_POSITION_MAP_CCW: Record<string, string> = {};

// Alpha positions (90° CCW = -2 = +6 mod 8)
for (let i = 1; i <= 8; i++) {
  const next = ((i - 1 + 6) % 8) + 1;
  QUARTER_POSITION_MAP_CCW[`alpha${i}`] = `alpha${next}`;
}

// Beta positions
for (let i = 1; i <= 8; i++) {
  const next = ((i - 1 + 6) % 8) + 1;
  QUARTER_POSITION_MAP_CCW[`beta${i}`] = `beta${next}`;
}

// Gamma 1-8
for (let i = 1; i <= 8; i++) {
  const next = ((i - 1 + 6) % 8) + 1;
  QUARTER_POSITION_MAP_CCW[`gamma${i}`] = `gamma${next}`;
}

// Gamma 9-16
for (let i = 9; i <= 16; i++) {
  const next = ((i - 9 + 6) % 8) + 9;
  QUARTER_POSITION_MAP_CCW[`gamma${i}`] = `gamma${next}`;
}


/**
 * Halved LOOP validation set
 * Set of (start_position, end_position) tuples that are valid for halved LOOPs (180°)
 */
export const HALVED_LOOPS = new Set<string>(
  Object.entries(HALF_POSITION_MAP).map(([start, end]) => `${start},${end}`)
);

/**
 * Quartered LOOP validation set
 * Set of (start_position, end_position) tuples that are valid for quartered LOOPs (90°)
 * Includes both CW and CCW rotations
 */
export const QUARTERED_LOOPS = new Set<string>([
  ...Object.entries(QUARTER_POSITION_MAP_CW).map(([start, end]) => `${start},${end}`),
  ...Object.entries(QUARTER_POSITION_MAP_CCW).map(([start, end]) => `${start},${end}`),
]);

/**
 * Vertical Mirror Position Map
 * Mirrors positions vertically (flips east/west)
 */
const VERTICAL_MIRROR_POSITION_MAP: Record<string, string> = {
  // Alpha group - vertical axis symmetry (1,5 stay same; 2↔8, 3↔7, 4↔6)
  alpha1: "alpha1",
  alpha2: "alpha8",
  alpha3: "alpha7",
  alpha4: "alpha6",
  alpha5: "alpha5",
  alpha6: "alpha4",
  alpha7: "alpha3",
  alpha8: "alpha2",

  // Beta group
  beta1: "beta1",
  beta2: "beta8",
  beta3: "beta7",
  beta4: "beta6",
  beta5: "beta5",
  beta6: "beta4",
  beta7: "beta3",
  beta8: "beta2",

  // Gamma group - cross-mirror pattern (gamma 1-8 ↔ gamma 9-16)
  gamma1: "gamma9",
  gamma2: "gamma16",
  gamma3: "gamma15",
  gamma4: "gamma14",
  gamma5: "gamma13",
  gamma6: "gamma12",
  gamma7: "gamma11",
  gamma8: "gamma10",
  gamma9: "gamma1",
  gamma10: "gamma8",
  gamma11: "gamma7",
  gamma12: "gamma6",
  gamma13: "gamma5",
  gamma14: "gamma4",
  gamma15: "gamma3",
  gamma16: "gamma2",
};

/**
 * Swapped Position Map
 * Maps positions to their hand-swapped equivalents
 */
const SWAPPED_POSITION_MAP: Record<string, string> = {
  // Alpha group - 180° swap pattern
  alpha1: "alpha5",
  alpha2: "alpha6",
  alpha3: "alpha7",
  alpha4: "alpha8",
  alpha5: "alpha1",
  alpha6: "alpha2",
  alpha7: "alpha3",
  alpha8: "alpha4",

  // Beta group - no change (both hands same location)
  beta1: "beta1",
  beta2: "beta2",
  beta3: "beta3",
  beta4: "beta4",
  beta5: "beta5",
  beta6: "beta6",
  beta7: "beta7",
  beta8: "beta8",

  // Gamma group - cross-swap pattern
  gamma1: "gamma15",
  gamma2: "gamma16",
  gamma3: "gamma9",
  gamma4: "gamma10",
  gamma5: "gamma11",
  gamma6: "gamma12",
  gamma7: "gamma13",
  gamma8: "gamma14",
  gamma9: "gamma3",
  gamma10: "gamma4",
  gamma11: "gamma5",
  gamma12: "gamma6",
  gamma13: "gamma7",
  gamma14: "gamma8",
  gamma15: "gamma1",
  gamma16: "gamma2",
};

/**
 * Mirrored LOOP validation set
 * Valid when: vertical_mirror(start_pos) === end_pos
 */
export const MIRRORED_LOOP_VALIDATION_SET = new Set<string>(
  Object.entries(VERTICAL_MIRROR_POSITION_MAP).map(([start, end]) => `${start},${end}`)
);

/**
 * Swapped LOOP validation set
 * Valid when: swapped(start_pos) === end_pos
 */
export const SWAPPED_LOOP_VALIDATION_SET = new Set<string>(
  Object.entries(SWAPPED_POSITION_MAP).map(([start, end]) => `${start},${end}`)
);

/**
 * Mirrored-Swapped LOOP validation set
 * Valid when: swapped(vertical_mirror(start_pos)) === end_pos
 */
export const MIRRORED_SWAPPED_VALIDATION_SET = new Set<string>(
  Object.entries(VERTICAL_MIRROR_POSITION_MAP).map(([start, mirroredEnd]) => {
    const swappedMirroredEnd = SWAPPED_POSITION_MAP[mirroredEnd] || mirroredEnd;
    return `${start},${swappedMirroredEnd}`;
  })
);

/**
 * Inverted LOOP validation set
 * Valid when: start_pos === end_pos (returns to starting position)
 */
export const INVERTED_LOOP_VALIDATION_SET = new Set<string>([
  ...ALPHA_POSITIONS.map((pos) => `${pos},${pos}`),
  ...BETA_POSITIONS.map((pos) => `${pos},${pos}`),
  ...GAMMA_POSITIONS.map((pos) => `${pos},${pos}`),
]);

/**
 * Rotated-Swapped LOOP validation set (Halved - 180°)
 * Valid when: end_pos === SWAPPED(ROTATED_180(start_pos))
 */
export const ROTATED_SWAPPED_HALVED_VALIDATION_SET = new Set<string>(
  Object.entries(HALF_POSITION_MAP).map(([start, rotatedEnd]) => {
    const swappedRotatedEnd = SWAPPED_POSITION_MAP[rotatedEnd] || rotatedEnd;
    return `${start},${swappedRotatedEnd}`;
  })
);

/**
 * Rotated-Swapped LOOP validation set (Quartered - 90°)
 * Valid when: end_pos === SWAPPED(ROTATED_90(start_pos))
 */
export const ROTATED_SWAPPED_QUARTERED_VALIDATION_SET = new Set<string>([
  // Clockwise rotation then swap
  ...Object.entries(QUARTER_POSITION_MAP_CW).map(([start, rotatedEnd]) => {
    const swappedRotatedEnd = SWAPPED_POSITION_MAP[rotatedEnd] || rotatedEnd;
    return `${start},${swappedRotatedEnd}`;
  }),
  // Counter-clockwise rotation then swap
  ...Object.entries(QUARTER_POSITION_MAP_CCW).map(([start, rotatedEnd]) => {
    const swappedRotatedEnd = SWAPPED_POSITION_MAP[rotatedEnd] || rotatedEnd;
    return `${start},${swappedRotatedEnd}`;
  }),
]);


/** @deprecated Use isLOOPValidForSpec instead. */
export function isLOOPValidForPositionPair(
  loopType: LOOPType,
  positionPair: string,
  period: Period
): boolean {
  // Rotated LOOPs use rotation-based validation
  const rotationSet = period === Period.QUARTERED ? QUARTERED_LOOPS : HALVED_LOOPS;

  // Rotated+Swapped LOOPs need composed validation
  const rotatedSwappedSet =
    period === Period.QUARTERED
      ? ROTATED_SWAPPED_QUARTERED_VALIDATION_SET
      : ROTATED_SWAPPED_HALVED_VALIDATION_SET;

  switch (loopType) {
    // Pure rotation-based LOOPs
    case LOOPType.ROTATED:
    case LOOPType.ROTATED_INVERTED:
      return rotationSet.has(positionPair);

    // Rotated + Swapped
    case LOOPType.ROTATED_SWAPPED:
      return rotatedSwappedSet.has(positionPair);

    // Pure mirror-based LOOPs
    case LOOPType.MIRRORED:
    case LOOPType.MIRRORED_INVERTED:
      return MIRRORED_LOOP_VALIDATION_SET.has(positionPair);

    // Flipped (horizontal mirror)
    case LOOPType.FLIPPED:
      return FLIPPED_LOOP_VALIDATION_SET.has(positionPair);

    // Mirrored + Swapped
    case LOOPType.MIRRORED_SWAPPED:
      return MIRRORED_SWAPPED_VALIDATION_SET.has(positionPair);

    // Compound LOOPs containing ROTATED
    case LOOPType.MIRRORED_ROTATED:
    case LOOPType.MIRRORED_INVERTED_ROTATED:
    case LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED:
      return MIRRORED_LOOP_VALIDATION_SET.has(positionPair) && rotationSet.has(positionPair);

    // Swap-based LOOPs
    case LOOPType.SWAPPED:
    case LOOPType.SWAPPED_INVERTED:
      return SWAPPED_LOOP_VALIDATION_SET.has(positionPair);

    // Invert-only LOOP
    case LOOPType.INVERTED:
      return INVERTED_LOOP_VALIDATION_SET.has(positionPair);

    // Rewound LOOP - always valid (works on any sequence)
    case LOOPType.REWOUND:
      return true;

    default:
      return false;
  }
}

export function isLOOPValidForSpec(
  spec: LOOPSpec,
  positionPair: string,
): boolean {
  const active = allActiveComponents(spec);

  for (const [comp, { period }] of active) {
    switch (comp) {
      case CanonicalLOOPComponent.ROTATED: {
        const set = period === 4 ? QUARTERED_LOOPS : HALVED_LOOPS;
        if (!set.has(positionPair)) return false;
        break;
      }
      case CanonicalLOOPComponent.MIRRORED:
        if (!MIRRORED_LOOP_VALIDATION_SET.has(positionPair)) return false;
        break;
      case CanonicalLOOPComponent.FLIPPED:
        if (!FLIPPED_LOOP_VALIDATION_SET.has(positionPair)) return false;
        break;
      case CanonicalLOOPComponent.SWAPPED:
        if (!SWAPPED_LOOP_VALIDATION_SET.has(positionPair)) return false;
        break;
      case CanonicalLOOPComponent.INVERTED:
        if (!INVERTED_LOOP_VALIDATION_SET.has(positionPair)) return false;
        break;
      case CanonicalLOOPComponent.REWOUND:
        break;
    }
  }

  return true;
}

export function getLOOPOptionsForPositionPair(
  startPosition: string,
  endPosition: string,
  period: Period
): LOOPValidationResult {
  const available: LOOPOption[] = [];
  const unavailable: Array<LOOPOption & { reason?: string }> = [];
  const positionPair = `${startPosition},${endPosition}`;

  for (const loopType of ALL_LOOP_TYPES) {
    const option: LOOPOption = {
      loopType,
      name: LOOP_TYPE_LABELS[loopType],
      description: LOOP_TYPE_DESCRIPTIONS[loopType],
    };

    if (isLOOPValidForPositionPair(loopType, positionPair, period)) {
      available.push(option);
    } else {
      unavailable.push({
        ...option,
        reason: "Position pair not valid for this LOOP type",
      });
    }
  }

  return { available, unavailable };
}

export function getExpectedEndPosition(
  startPosition: string,
  loopType: LOOPType,
  period: Period
): string | null {
  switch (loopType) {
    case LOOPType.ROTATED:
    case LOOPType.ROTATED_INVERTED:
      if (period === Period.HALVED) {
        return HALF_POSITION_MAP[startPosition] || null;
      } else {
        // For quartered, could be either CW or CCW
        return QUARTER_POSITION_MAP_CW[startPosition] || null;
      }

    case LOOPType.MIRRORED:
    case LOOPType.MIRRORED_INVERTED:
      return VERTICAL_MIRROR_POSITION_MAP[startPosition] || null;

    case LOOPType.FLIPPED:
      return HORIZONTAL_MIRROR_POSITION_MAP[startPosition] || null;

    case LOOPType.SWAPPED:
    case LOOPType.SWAPPED_INVERTED:
      return SWAPPED_POSITION_MAP[startPosition] || null;

    case LOOPType.INVERTED:
      return startPosition; // Returns to same position

    case LOOPType.REWOUND:
      return startPosition; // Rewound always returns to start

    default:
      return null;
  }
}

/**
 * Find bridge letters that could transition from currentEndPosition to a
 * valid end position for the given LOOP type.
 * @param startPosition - The sequence's start position (used to determine valid LOOP end positions)
 * @param currentEndPosition - Where the sequence currently ends
 * @param loopType - The LOOP type we want to achieve
 * @param period - Halved or quartered
 * @param allPictographs - Pictograph data to find bridge letters from
 * @returns Array of bridge letter options that would make the LOOP valid, or empty if no bridge needed/possible
 */
export function findBridgeLettersForLoop(
  startPosition: string,
  currentEndPosition: string,
  loopType: LOOPType,
  period: Period,
  allPictographs: Array<{ letter: string; startPosition: string; endPosition: string }>
): string[] {
  // Get what end positions would be valid for this LOOP
  const validEndPositions = getValidEndPositionsForLoop(startPosition, loopType, period);

  // If current position is already valid, no bridge needed
  if (validEndPositions.includes(currentEndPosition)) {
    return [];
  }

  // Find letters that start at currentEndPosition and end at a valid position
  const bridgeOptions: string[] = [];
  const seenLetters = new Set<string>();

  for (const picto of allPictographs) {
    // Must start at our current end position
    if (picto.startPosition !== currentEndPosition) continue;

    // Must end at a valid LOOP position
    if (!validEndPositions.includes(picto.endPosition)) continue;

    // Avoid duplicates (same letter, different variations)
    if (seenLetters.has(picto.letter)) continue;
    seenLetters.add(picto.letter);

    bridgeOptions.push(picto.letter);
  }

  return bridgeOptions;
}

/**
 * Unlike getExpectedEndPosition which returns a single position, this returns
 * all positions that would make the LOOP valid (e.g., both CW and CCW for quartered).
 */
export function getValidEndPositionsForLoop(
  startPosition: string,
  loopType: LOOPType,
  period: Period
): string[] {
  const validPositions: string[] = [];

  switch (loopType) {
    case LOOPType.ROTATED:
    case LOOPType.ROTATED_INVERTED:
      if (period === Period.HALVED) {
        const halved = HALF_POSITION_MAP[startPosition];
        if (halved) validPositions.push(halved);
      } else {
        // Quartered: both CW and CCW are valid
        const cw = QUARTER_POSITION_MAP_CW[startPosition];
        const ccw = QUARTER_POSITION_MAP_CCW[startPosition];
        if (cw) validPositions.push(cw);
        if (ccw && ccw !== cw) validPositions.push(ccw);
      }
      break;

    case LOOPType.MIRRORED:
    case LOOPType.MIRRORED_INVERTED: {
      const mirrored = VERTICAL_MIRROR_POSITION_MAP[startPosition];
      if (mirrored) validPositions.push(mirrored);
      break;
    }

    case LOOPType.FLIPPED: {
      const flipped = HORIZONTAL_MIRROR_POSITION_MAP[startPosition];
      if (flipped) validPositions.push(flipped);
      break;
    }

    case LOOPType.SWAPPED:
    case LOOPType.SWAPPED_INVERTED: {
      const swapped = SWAPPED_POSITION_MAP[startPosition];
      if (swapped) validPositions.push(swapped);
      break;
    }

    case LOOPType.INVERTED:
      validPositions.push(startPosition); // Returns to same position
      break;

    case LOOPType.REWOUND:
      // Rewound works with any end position - return null to indicate "no constraint"
      // But for API consistency, we return the start (since it will end there after rewound)
      validPositions.push(startPosition);
      break;
  }

  return validPositions;
}
