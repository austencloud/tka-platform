/**
 * Choo Choo Generator
 *
 * Algorithmically generates Choo Choo sequences for validation.
 *
 * A Choo Choo is characterized by:
 * - One prop is STATIC with rotation (stays in place, spins)
 * - Other prop is FLOAT with no rotation (orbits around the static prop)
 * - Either the pinky or thumb ends of the props appear tethered together
 * - Full Choo Choo: 4 steps (complete orbit S→W→N→E→S)
 * - Half Choo Choo: 2 steps (half orbit S→W→N)
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import {
  GridLocation,
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  RotationDirection,
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/data/data-contracts";

// Orbit path for floating prop (cardinal directions clockwise)
const CLOCKWISE_ORBIT: GridLocation[] = [
  GridLocation.SOUTH,
  GridLocation.WEST,
  GridLocation.NORTH,
  GridLocation.EAST,
];

// Counter-clockwise orbit
const COUNTER_CLOCKWISE_ORBIT: GridLocation[] = [
  GridLocation.SOUTH,
  GridLocation.EAST,
  GridLocation.NORTH,
  GridLocation.WEST,
];

// Orientation cycle for rotating prop (CW rotation)
const CW_ORIENTATION_CYCLE: Orientation[] = [
  Orientation.IN,
  Orientation.COUNTER,
  Orientation.OUT,
  Orientation.CLOCK,
];

// Orientation cycle for CCW rotation
const CCW_ORIENTATION_CYCLE: Orientation[] = [
  Orientation.IN,
  Orientation.CLOCK,
  Orientation.OUT,
  Orientation.COUNTER,
];

// Float orientation follows the orbit path
const CW_FLOAT_ORIENTATION_CYCLE: Orientation[] = [
  Orientation.IN, // S - pointing inward
  Orientation.CLOCK, // W - pointing clockwise
  Orientation.OUT, // N - pointing outward
  Orientation.COUNTER, // E - pointing counter
];

const CCW_FLOAT_ORIENTATION_CYCLE: Orientation[] = [
  Orientation.IN, // S - pointing inward
  Orientation.COUNTER, // E - pointing counter
  Orientation.OUT, // N - pointing outward
  Orientation.CLOCK, // W - pointing clockwise
];

export interface ChooChooConfig {
  /** Which prop is static (rotates in place) */
  staticProp: "blue" | "red";
  /** Rotation direction of the static prop */
  rotationDirection: "cw" | "ccw";
  /** Orbit direction of the floating prop */
  orbitDirection: "cw" | "ccw";
  /** Number of steps (2 = half, 4 = full) */
  steps: 2 | 4;
  /** Starting location for the static prop */
  staticLocation: GridLocation;
  /** Starting location for the floating prop */
  floatStartLocation: GridLocation;
  /** Turns per beat for the static prop */
  turnsPerBeat: 0.5 | 1 | 1.5 | 2;
}

export const DEFAULT_CONFIG: ChooChooConfig = {
  staticProp: "blue",
  rotationDirection: "cw",
  orbitDirection: "cw",
  steps: 4,
  staticLocation: GridLocation.SOUTH,
  floatStartLocation: GridLocation.SOUTH,
  turnsPerBeat: 0.5,
};

/**
 * Generate a Choo Choo sequence based on configuration
 * Uses the motion query handler for proper letter derivation
 */
export async function generateChooChoo(
  config: Partial<ChooChooConfig> = {},
  motionQueryHandler?: IMotionQueryHandler
): Promise<SequenceData> {
  const fullConfig: ChooChooConfig = { ...DEFAULT_CONFIG, ...config };

  const orbit =
    fullConfig.orbitDirection === "cw"
      ? CLOCKWISE_ORBIT
      : COUNTER_CLOCKWISE_ORBIT;
  const rotationCycle =
    fullConfig.rotationDirection === "cw"
      ? CW_ORIENTATION_CYCLE
      : CCW_ORIENTATION_CYCLE;
  const floatOrientationCycle =
    fullConfig.orbitDirection === "cw"
      ? CW_FLOAT_ORIENTATION_CYCLE
      : CCW_FLOAT_ORIENTATION_CYCLE;

  // Find starting index in orbit based on floatStartLocation
  const startIndex = orbit.indexOf(fullConfig.floatStartLocation);
  const actualStartIndex = startIndex >= 0 ? startIndex : 0;

  // Build start position
  const floatStartLoc = orbit[actualStartIndex] ?? GridLocation.SOUTH;
  const startPosition = createStartPosition(fullConfig, floatStartLoc);

  // Build steps with proper letter derivation
  const steps: StepData[] = [];
  for (let i = 0; i < fullConfig.steps; i++) {
    const beat = await createStep(
      fullConfig,
      i + 1,
      orbit,
      rotationCycle,
      floatOrientationCycle,
      actualStartIndex,
      i,
      motionQueryHandler
    );
    steps.push(beat);
  }

  // Generate sequence
  const sequenceId = crypto.randomUUID();
  const word = steps.map((b) => b.letter || "?").join("");

  return {
    id: sequenceId,
    name: `Choo Choo (${fullConfig.steps === 4 ? "Full" : "Half"}, ${fullConfig.staticProp} static, ${fullConfig.rotationDirection} rotation)`,
    word,
    steps,
    startPosition,
    thumbnails: [],
    isFavorite: false,
    isCircular: fullConfig.steps === 4,
    tags: [
      "choo-choo",
      fullConfig.steps === 4 ? "full-choo-choo" : "half-choo-choo",
    ],
    metadata: { generatedBy: "ChooChooGenerator", config: fullConfig },
    gridMode: GridMode.DIAMOND,
    // propType removed - prop type is viewer preference, not sequence data
  };
}

function createStartPosition(
  config: ChooChooConfig,
  floatLocation: GridLocation
): StartPositionData {
  const staticMotion = createMotionData({
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    startLocation: config.staticLocation,
    endLocation: config.staticLocation,
    turns: 0,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    color: config.staticProp === "blue" ? MotionColor.BLUE : MotionColor.RED,
    gridMode: GridMode.DIAMOND,
    propType: PropType.STAFF,
    isVisible: true,
  });

  const floatMotion = createMotionData({
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    startLocation: floatLocation,
    endLocation: floatLocation,
    turns: 0,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    color: config.staticProp === "blue" ? MotionColor.RED : MotionColor.BLUE,
    gridMode: GridMode.DIAMOND,
    propType: PropType.STAFF,
    isVisible: true,
  });

  return {
    id: crypto.randomUUID(),
    isStartPosition: true,
    letter: Letter.BETA,
    startPosition: GridPosition.BETA5,
    endPosition: GridPosition.BETA5,
    motions: {
      [MotionColor.BLUE]:
        config.staticProp === "blue" ? staticMotion : floatMotion,
      [MotionColor.RED]:
        config.staticProp === "red" ? staticMotion : floatMotion,
    },
  };
}

async function createStep(
  config: ChooChooConfig,
  stepNumber: number,
  orbit: GridLocation[],
  rotationCycle: Orientation[],
  floatOrientationCycle: Orientation[],
  orbitStartIndex: number,
  stepIndex: number,
  motionQueryHandler?: IMotionQueryHandler
): Promise<StepData> {
  // Calculate positions in the cycles
  const orbitIndex = (orbitStartIndex + stepIndex) % orbit.length;
  const nextOrbitIndex = (orbitStartIndex + stepIndex + 1) % orbit.length;

  const floatStart = orbit[orbitIndex] ?? GridLocation.SOUTH;
  const floatEnd = orbit[nextOrbitIndex] ?? GridLocation.WEST;

  // Calculate orientations
  const staticStartOri =
    rotationCycle[stepIndex % rotationCycle.length] ?? Orientation.IN;
  const staticEndOri =
    rotationCycle[(stepIndex + 1) % rotationCycle.length] ??
    Orientation.COUNTER;

  const floatStartOri = floatOrientationCycle[orbitIndex] ?? Orientation.IN;
  const floatEndOri =
    floatOrientationCycle[nextOrbitIndex] ?? Orientation.CLOCK;

  // Create static motion (rotates in place)
  const staticMotion = createMotionData({
    motionType: MotionType.STATIC,
    rotationDirection:
      config.rotationDirection === "cw"
        ? RotationDirection.CLOCKWISE
        : RotationDirection.COUNTER_CLOCKWISE,
    startLocation: config.staticLocation,
    endLocation: config.staticLocation,
    turns: config.turnsPerBeat,
    startOrientation: staticStartOri,
    endOrientation: staticEndOri,
    color: config.staticProp === "blue" ? MotionColor.BLUE : MotionColor.RED,
    gridMode: GridMode.DIAMOND,
    propType: PropType.STAFF,
    isVisible: true,
  });

  // Create float motion (orbits around)
  const floatMotion = createMotionData({
    motionType: MotionType.FLOAT,
    rotationDirection: RotationDirection.NO_ROTATION,
    startLocation: floatStart,
    endLocation: floatEnd,
    turns: "fl" as unknown as number, // Float marker
    startOrientation: floatStartOri,
    endOrientation: floatEndOri,
    color: config.staticProp === "blue" ? MotionColor.RED : MotionColor.BLUE,
    gridMode: GridMode.DIAMOND,
    propType: PropType.STAFF,
    isVisible: true,
    prefloatMotionType: MotionType.STATIC,
    prefloatRotationDirection: RotationDirection.NO_ROTATION,
  });

  // Assign motions based on config
  const blueMotion = config.staticProp === "blue" ? staticMotion : floatMotion;
  const redMotion = config.staticProp === "red" ? staticMotion : floatMotion;

  // Derive letter using the motion query handler (if available)
  let letter: Letter = Letter.THETA; // Fallback
  if (motionQueryHandler) {
    try {
      const derivedLetter =
        await motionQueryHandler.findLetterByMotionConfiguration(
          blueMotion,
          redMotion,
          GridMode.DIAMOND
        );
      if (derivedLetter) {
        // Convert string to Letter enum
        letter = derivedLetter as Letter;
      } else {
        console.warn(
          `⚠️ No letter found for beat ${stepNumber}, using fallback`
        );
      }
    } catch (error) {
      console.warn(`⚠️ Error deriving letter for beat ${stepNumber}:`, error);
    }
  }

  // Calculate grid positions
  const startGridPos = getGridPosition(floatStart, config.staticLocation);
  const endGridPos = getGridPosition(floatEnd, config.staticLocation);

  return {
    id: crypto.randomUUID(),
    isStep: true,
    stepNumber,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    letter,
    startPosition: startGridPos,
    endPosition: endGridPos,
    motions: {
      [MotionColor.BLUE]: blueMotion,
      [MotionColor.RED]: redMotion,
    },
  };
}

/**
 * Get grid position based on float location and static location
 * This is a simplified mapping - real implementation would be more complex
 */
function getGridPosition(
  floatLoc: GridLocation,
  staticLoc: GridLocation
): GridPosition {
  // Simplified mapping for demonstration
  const positionMap: Record<string, GridPosition> = {
    [`${GridLocation.SOUTH}_${GridLocation.SOUTH}`]: GridPosition.BETA5,
    [`${GridLocation.WEST}_${GridLocation.SOUTH}`]: GridPosition.GAMMA7,
    [`${GridLocation.NORTH}_${GridLocation.SOUTH}`]: GridPosition.ALPHA1,
    [`${GridLocation.EAST}_${GridLocation.SOUTH}`]: GridPosition.GAMMA11,
  };

  return positionMap[`${floatLoc}_${staticLoc}`] || GridPosition.BETA5;
}

/**
 * Generate multiple Choo Choo variations for testing
 */
export async function generateChooChooVariations(
  motionQueryHandler?: IMotionQueryHandler
): Promise<SequenceData[]> {
  const variations: SequenceData[] = [];

  // Full Choo Choo - Blue static, CW rotation, CW orbit
  variations.push(
    await generateChooChoo(
      {
        staticProp: "blue",
        rotationDirection: "cw",
        orbitDirection: "cw",
        steps: 4,
      },
      motionQueryHandler
    )
  );

  // Full Choo Choo - Red static, CW rotation, CW orbit
  variations.push(
    await generateChooChoo(
      {
        staticProp: "red",
        rotationDirection: "cw",
        orbitDirection: "cw",
        steps: 4,
      },
      motionQueryHandler
    )
  );

  // Full Choo Choo - Blue static, CCW rotation, CCW orbit
  variations.push(
    await generateChooChoo(
      {
        staticProp: "blue",
        rotationDirection: "ccw",
        orbitDirection: "ccw",
        steps: 4,
      },
      motionQueryHandler
    )
  );

  // Half Choo Choo - Blue static, CW rotation, CW orbit
  variations.push(
    await generateChooChoo(
      {
        staticProp: "blue",
        rotationDirection: "cw",
        orbitDirection: "cw",
        steps: 2,
      },
      motionQueryHandler
    )
  );

  // Half Choo Choo - Red static, CCW rotation, CW orbit
  variations.push(
    await generateChooChoo(
      {
        staticProp: "red",
        rotationDirection: "ccw",
        orbitDirection: "cw",
        steps: 2,
      },
      motionQueryHandler
    )
  );

  // Full Choo Choo with 1 turn per beat
  variations.push(
    await generateChooChoo(
      {
        staticProp: "blue",
        rotationDirection: "cw",
        orbitDirection: "cw",
        steps: 4,
        turnsPerBeat: 1,
      },
      motionQueryHandler
    )
  );

  return variations;
}

/**
 * Detect if a sequence contains a Choo Choo pattern
 */
export function detectChooChoo(sequence: SequenceData): {
  hasChooChoo: boolean;
  type: "full" | "half" | "none";
  startStep?: number;
  endStep?: number;
  staticProp?: "blue" | "red";
} {
  if (!sequence.steps || sequence.steps.length < 2) {
    return { hasChooChoo: false, type: "none" };
  }

  // Look for consecutive steps that match Choo Choo pattern
  for (let i = 0; i <= sequence.steps.length - 2; i++) {
    const result = checkChooChooStartingAt(sequence.steps as StepData[], i);
    if (result.hasChooChoo) {
      return result;
    }
  }

  return { hasChooChoo: false, type: "none" };
}

function checkChooChooStartingAt(
  steps: StepData[],
  startIndex: number
): {
  hasChooChoo: boolean;
  type: "full" | "half" | "none";
  startStep?: number;
  endStep?: number;
  staticProp?: "blue" | "red";
} {
  // Need at least 2 steps for a half Choo Choo
  if (startIndex + 2 > steps.length) {
    return { hasChooChoo: false, type: "none" };
  }

  const firstStep = steps[startIndex];
  if (!firstStep) {
    return { hasChooChoo: false, type: "none" };
  }
  const blueMotion = firstStep.motions?.[MotionColor.BLUE];
  const redMotion = firstStep.motions?.[MotionColor.RED];

  if (!blueMotion || !redMotion) {
    return { hasChooChoo: false, type: "none" };
  }

  // Determine which prop is static (with rotation) and which is float
  let staticProp: "blue" | "red" | null = null;

  if (
    blueMotion.motionType === MotionType.STATIC &&
    typeof blueMotion.turns === "number" &&
    blueMotion.turns > 0 &&
    redMotion.motionType === MotionType.FLOAT
  ) {
    staticProp = "blue";
  } else if (
    redMotion.motionType === MotionType.STATIC &&
    typeof redMotion.turns === "number" &&
    redMotion.turns > 0 &&
    blueMotion.motionType === MotionType.FLOAT
  ) {
    staticProp = "red";
  }

  if (!staticProp) {
    return { hasChooChoo: false, type: "none" };
  }

  // Check subsequent steps maintain the pattern
  let consecutiveBeats = 1;
  const floatLocations: GridLocation[] = [
    staticProp === "blue" ? redMotion.startLocation : blueMotion.startLocation,
  ];

  for (let i = startIndex + 1; i < steps.length && i < startIndex + 4; i++) {
    const beat = steps[i];
    if (!beat) break;

    const bMotion = beat.motions?.[MotionColor.BLUE];
    const rMotion = beat.motions?.[MotionColor.RED];

    if (!bMotion || !rMotion) break;

    const staticM = staticProp === "blue" ? bMotion : rMotion;
    const floatM = staticProp === "blue" ? rMotion : bMotion;

    // Verify static prop stays static with rotation
    if (
      staticM.motionType !== MotionType.STATIC ||
      typeof staticM.turns !== "number" ||
      staticM.turns <= 0
    ) {
      break;
    }

    // Verify float prop remains float
    if (floatM.motionType !== MotionType.FLOAT) {
      break;
    }

    consecutiveBeats++;
    floatLocations.push(floatM.startLocation);
  }

  // Check if float locations form a valid orbit path
  if (consecutiveBeats >= 4 && isValidOrbitPath(floatLocations)) {
    return {
      hasChooChoo: true,
      type: "full",
      startStep: startIndex + 1,
      endStep: startIndex + 4,
      staticProp,
    };
  } else if (consecutiveBeats >= 2) {
    return {
      hasChooChoo: true,
      type: "half",
      startStep: startIndex + 1,
      endStep: startIndex + consecutiveBeats,
      staticProp,
    };
  }

  return { hasChooChoo: false, type: "none" };
}

function isValidOrbitPath(locations: GridLocation[]): boolean {
  if (locations.length < 4) return false;

  // Check if locations follow clockwise or counter-clockwise pattern
  const cwValid = locations
    .slice(0, 4)
    .every((loc, i) => loc === CLOCKWISE_ORBIT[i]);
  const ccwValid = locations
    .slice(0, 4)
    .every((loc, i) => loc === COUNTER_CLOCKWISE_ORBIT[i]);

  return cwValid || ccwValid;
}
