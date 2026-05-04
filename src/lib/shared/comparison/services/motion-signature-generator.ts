/**
 * Motion Signature Generator
 *
 * Creates rotation-invariant signatures for individual motions.
 * The signature captures the geometric essence independent of grid position.
 */

import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type {
  MotionSignature,
  MotionComparisonResult,
  LocationDelta,
  OrientationTransition,
} from "../domain/models/signatures";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { HandPath, MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/**
 * Scoring weights for motion similarity calculation.
 */
const SCORING_WEIGHTS = {
  motionType: 0.35,
  rotationDirection: 0.20,
  turns: 0.20,
  orientationTransition: 0.15,
  locationDelta: 0.10,
} as const;

/**
 * Map of grid locations to their angular position (in 45° steps from north).
 */
const LOCATION_TO_ANGLE: Record<GridLocation, number> = {
  [GridLocation.NORTH]: 0,
  [GridLocation.NORTHEAST]: 1,
  [GridLocation.EAST]: 2,
  [GridLocation.SOUTHEAST]: 3,
  [GridLocation.SOUTH]: 4,
  [GridLocation.SOUTHWEST]: 5,
  [GridLocation.WEST]: 6,
  [GridLocation.NORTHWEST]: 7,
  [GridLocation.CENTER]: 0,
};

function extractOrientationTransition(motion: MotionData): OrientationTransition {
  return {
    from: motion.startOrientation,
    to: motion.endOrientation,
  };
}

function extractLocationDelta(motion: MotionData): LocationDelta {
  const startLoc = motion.startLocation;
  const endLoc = motion.endLocation;

  const startIsCenter = startLoc === GridLocation.CENTER;
  const endIsCenter = endLoc === GridLocation.CENTER;

  if (startIsCenter && endIsCenter) {
    return { steps: 0, direction: HandPath.STATIC };
  }
  if (startIsCenter && !endIsCenter) {
    return { steps: 2, direction: HandPath.HASH_OUT };
  }
  if (!startIsCenter && endIsCenter) {
    return { steps: 2, direction: HandPath.HASH_IN };
  }

  const startAngle = LOCATION_TO_ANGLE[startLoc];
  const endAngle = LOCATION_TO_ANGLE[endLoc];

  let steps = (endAngle - startAngle + 8) % 8;
  let direction: HandPath;

  if (steps === 0) {
    direction = HandPath.STATIC;
  } else if (steps === 4) {
    direction = HandPath.DASH;
  } else if (steps < 4) {
    direction = HandPath.CLOCKWISE;
  } else {
    steps = 8 - steps;
    direction = HandPath.COUNTER_CLOCKWISE;
  }

  if (motion.handPath && motion.motionType !== MotionType.STATIC) {
    direction = motion.handPath;
  }

  return { steps, direction };
}

function orientationTransitionsMatch(
  a: OrientationTransition,
  b: OrientationTransition
): boolean {
  return a.from === b.from && a.to === b.to;
}

function locationDeltasMatch(a: LocationDelta, b: LocationDelta): boolean {
  return a.steps === b.steps && a.direction === b.direction;
}

export function generateSignature(motion: MotionData): MotionSignature {
  return {
    motionType: motion.motionType,
    rotationDirection: motion.rotationDirection,
    turns: motion.turns,
    orientationTransition: extractOrientationTransition(motion),
    locationDelta: extractLocationDelta(motion),
    skewSteps: motion.skewSteps ?? 0,
    skewDir: motion.skewDir ?? null,
  };
}

export function signaturesMatch(a: MotionSignature, b: MotionSignature): boolean {
  return (
    a.motionType === b.motionType &&
    a.rotationDirection === b.rotationDirection &&
    a.turns === b.turns &&
    orientationTransitionsMatch(a.orientationTransition, b.orientationTransition) &&
    locationDeltasMatch(a.locationDelta, b.locationDelta) &&
    a.skewSteps === b.skewSteps &&
    a.skewDir === b.skewDir
  );
}

export function compareSignatures(a: MotionSignature, b: MotionSignature): MotionComparisonResult {
  const breakdown = {
    motionTypeMatch: a.motionType === b.motionType,
    rotationDirectionMatch: a.rotationDirection === b.rotationDirection,
    turnsMatch: a.turns === b.turns,
    orientationTransitionMatch: orientationTransitionsMatch(
      a.orientationTransition,
      b.orientationTransition
    ),
    locationDeltaMatch: locationDeltasMatch(a.locationDelta, b.locationDelta),
  };

  let score = 0;

  if (breakdown.motionTypeMatch) {
    score += SCORING_WEIGHTS.motionType;
  }

  if (breakdown.rotationDirectionMatch) {
    score += SCORING_WEIGHTS.rotationDirection;
  } else if (
    a.rotationDirection === "noRotation" ||
    b.rotationDirection === "noRotation"
  ) {
    score += SCORING_WEIGHTS.rotationDirection * 0.5;
  }

  if (breakdown.turnsMatch) {
    score += SCORING_WEIGHTS.turns;
  } else {
    const turnsA = typeof a.turns === "number" ? a.turns : 0;
    const turnsB = typeof b.turns === "number" ? b.turns : 0;
    const maxTurns = Math.max(turnsA, turnsB, 1);
    const turnsSimilarity = 1 - Math.abs(turnsA - turnsB) / maxTurns;
    score += SCORING_WEIGHTS.turns * turnsSimilarity;
  }

  if (breakdown.orientationTransitionMatch) {
    score += SCORING_WEIGHTS.orientationTransition;
  }

  if (breakdown.locationDeltaMatch) {
    score += SCORING_WEIGHTS.locationDelta;
  }

  return {
    isExactMatch: Object.values(breakdown).every(Boolean),
    similarity: Math.min(1, Math.max(0, score)),
    breakdown,
  };
}

export function hashSignature(signature: MotionSignature): string {
  const parts = [
    signature.motionType,
    signature.rotationDirection,
    String(signature.turns),
    `${signature.orientationTransition.from}-${signature.orientationTransition.to}`,
    `${signature.locationDelta.steps}:${signature.locationDelta.direction}`,
    signature.skewSteps > 0 ? `sk${signature.skewSteps}${signature.skewDir ?? ""}` : "",
  ];
  return parts.filter(Boolean).join("|");
}
