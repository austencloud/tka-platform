/**
 * LOOP Executor
 *
 * Transforms partial sequences into complete LOOPs by applying transformations.
 * EXACT PORT of client-side LOOP executor logic.
 *
 * Each LOOP type has specific transformation rules that must be followed
 * precisely to produce valid circular sequences.
 */

import {
  LOOPType,
  LOOPTypeValue,
  Period,
  PeriodValue,
  StepBeatData,
  MotionData,
} from "./types";
import {
  HALVED_LOOPS,
  QUARTERED_LOOPS,
  HALF_POSITION_MAP,
  QUARTER_POSITION_MAP_CW,
  LOCATION_MAP_MIRROR,
  getHandRotationDirection,
  getLocationMapForHandRotation,
  getGridPositionFromLocations,
} from "./circular-position-maps";

/**
 * Deep clone a beat
 */
function cloneStep(beat: StepBeatData): StepBeatData {
  return JSON.parse(JSON.stringify(beat));
}

/**
 * Validate that the sequence can perform the requested LOOP
 */
function validateSequence(
  sequence: StepBeatData[],
  period: PeriodValue,
  loopType: LOOPTypeValue
): void {
  if (sequence.length < 2) {
    throw new Error("Sequence must have at least 2 beats (start position + 1 beat)");
  }

  const startPos = sequence[0]!.startPosition;
  const endPos = sequence[sequence.length - 1]!.endPosition;

  if (!startPos || !endPos) {
    throw new Error("Sequence beats must have valid start and end positions");
  }

  // For non-rotated LOOPs (mirror, swap, invert), end position should equal start position
  const isRotatedLoop = [
    LOOPType.ROTATED,
    LOOPType.ROTATED_SWAPPED,
    LOOPType.ROTATED_INVERTED,
    LOOPType.MIRRORED_ROTATED,
    LOOPType.MIRRORED_INVERTED_ROTATED,
  ].includes(loopType as any);

  if (isRotatedLoop) {
    const key = `${startPos},${endPos}`;
    const validationSet = period === Period.HALVED ? HALVED_LOOPS : QUARTERED_LOOPS;

    if (!validationSet.has(key)) {
      throw new Error(
        `Invalid position pair for ${period} ${loopType}: ${startPos} → ${endPos}`
      );
    }
  }
}

/**
 * Calculate how many beats to add based on slice size
 */
function calculateEntriesToAdd(sequenceLength: number, period: PeriodValue): number {
  if (period === Period.HALVED) {
    return sequenceLength; // Double the sequence
  }
  return sequenceLength * 3; // Quadruple the sequence
}

/**
 * Get index mapping for retrieving corresponding beats from first section
 */
function getIndexMap(period: PeriodValue, length: number): Record<number, number> {
  const map: Record<number, number> = {};

  if (period === Period.QUARTERED) {
    const quarterLength = Math.floor(length / 4);
    for (let i = quarterLength + 1; i <= length; i++) {
      map[i] = i - quarterLength;
    }
  } else {
    const halfLength = Math.floor(length / 2);
    for (let i = halfLength + 1; i <= length; i++) {
      map[i] = i - halfLength;
    }
  }

  return map;
}

/**
 * Transform motion locations based on hand rotation direction
 */
function transformMotionForRotation(
  matchingMotion: MotionData,
  previousMotion: MotionData
): MotionData {
  // Get hand rotation direction from the matching beat's motion
  const handRotDir = getHandRotationDirection(
    matchingMotion.startLocation,
    matchingMotion.endLocation
  );

  // Get the appropriate location map
  const locationMap = getLocationMapForHandRotation(handRotDir);

  // Calculate new end location by rotating the previous motion's end location
  const newEndLocation = locationMap[previousMotion.endLocation] ?? previousMotion.endLocation;

  return {
    ...matchingMotion,
    startLocation: previousMotion.endLocation,
    endLocation: newEndLocation,
  };
}

/**
 * Apply mirror transformation to a motion
 */
function applyMirrorToMotion(motion: MotionData): MotionData {
  const mirrored: MotionData = {
    ...motion,
    startLocation: LOCATION_MAP_MIRROR[motion.startLocation] ?? motion.startLocation,
    endLocation: LOCATION_MAP_MIRROR[motion.endLocation] ?? motion.endLocation,
  };

  // Swap rotation directions for mirror
  if (mirrored.rotationDirection === "cw") {
    mirrored.rotationDirection = "ccw";
  } else if (mirrored.rotationDirection === "ccw") {
    mirrored.rotationDirection = "cw";
  }

  return mirrored;
}

/**
 * Apply swap transformation (swap blue and red)
 */
function applySwapToBeat(beat: StepBeatData): StepBeatData {
  const swapped = cloneStep(beat);
  const tempBlue = { ...beat.blue };
  swapped.blue = { ...beat.red };
  swapped.red = tempBlue;
  return swapped;
}

/**
 * Apply invert transformation (pro <-> anti, reverse rotation)
 */
function applyInvertToMotion(motion: MotionData): MotionData {
  const inverted: MotionData = { ...motion };

  // Invert motion types
  if (inverted.motionType === "pro") {
    inverted.motionType = "anti";
  } else if (inverted.motionType === "anti") {
    inverted.motionType = "pro";
  }

  // Reverse rotation directions
  if (inverted.rotationDirection === "cw") {
    inverted.rotationDirection = "ccw";
  } else if (inverted.rotationDirection === "ccw") {
    inverted.rotationDirection = "cw";
  }

  return inverted;
}

/**
 * Calculate new end position from transformed locations
 */
function calculateEndPosition(blueEndLoc: string, redEndLoc: string): string | null {
  return getGridPositionFromLocations(blueEndLoc, redEndLoc);
}

// ============================================================================
// LOOP Type Executors
// ============================================================================

/**
 * Execute Strict Rotated LOOP
 * Each subsequent section is rotated 90° (quartered) or 180° (halved)
 */
function executeStrictRotated(
  sequence: StepBeatData[],
  period: PeriodValue
): StepBeatData[] {
  const startPosition = sequence.shift()!;
  const sequenceLength = sequence.length;
  const entriesToAdd = calculateEntriesToAdd(sequenceLength, period);
  const finalLength = sequenceLength + entriesToAdd;
  const indexMap = getIndexMap(period, finalLength);

  let lastStep = sequence[sequence.length - 1]!;
  let nextStepNumber = lastStep.stepNumber + 1;

  for (let i = 0; i < entriesToAdd; i++) {
    const matchingBeatNumber = indexMap[nextStepNumber];
    if (matchingBeatNumber === undefined) continue;

    const matchingBeat = sequence[matchingBeatNumber - 1];
    if (!matchingBeat) continue;

    // Transform motions based on hand rotation
    const newBlue = transformMotionForRotation(matchingBeat.blue, lastStep.blue);
    const newRed = transformMotionForRotation(matchingBeat.red, lastStep.red);

    // Calculate new end position
    const newEndPosition = calculateEndPosition(newBlue.endLocation, newRed.endLocation);

    const newStep: StepBeatData = {
      ...matchingBeat,
      id: `beat-${nextStepNumber}-${Date.now()}`,
      stepNumber: nextStepNumber,
      startPosition: lastStep.endPosition,
      endPosition: newEndPosition ?? lastStep.endPosition,
      blue: newBlue,
      red: newRed,
    };

    sequence.push(newStep);
    lastStep = newStep;
    nextStepNumber++;
  }

  sequence.unshift(startPosition);
  return sequence;
}

/**
 * Execute Strict Mirrored LOOP
 * Second half is horizontally mirrored
 */
function executeStrictMirrored(
  sequence: StepBeatData[],
  period: PeriodValue
): StepBeatData[] {
  const startPosition = sequence.shift()!;
  const sequenceLength = sequence.length;
  const entriesToAdd = calculateEntriesToAdd(sequenceLength, period);

  let lastStep = sequence[sequence.length - 1]!;
  let nextStepNumber = lastStep.stepNumber + 1;

  // For mirrored, we iterate through the original sequence in reverse
  for (let i = sequenceLength - 1; i >= 0; i--) {
    const matchingBeat = sequence[i];
    if (!matchingBeat) continue;

    // Apply mirror transformation
    const newBlue = applyMirrorToMotion(matchingBeat.blue);
    const newRed = applyMirrorToMotion(matchingBeat.red);

    // Update locations to chain from previous beat
    newBlue.startLocation = lastStep.blue.endLocation;
    newRed.startLocation = lastStep.red.endLocation;

    // For mirror, the end location is the mirrored version of the start location
    newBlue.endLocation = LOCATION_MAP_MIRROR[matchingBeat.blue.startLocation] ?? matchingBeat.blue.startLocation;
    newRed.endLocation = LOCATION_MAP_MIRROR[matchingBeat.red.startLocation] ?? matchingBeat.red.startLocation;

    const newEndPosition = calculateEndPosition(newBlue.endLocation, newRed.endLocation);

    const newStep: StepBeatData = {
      ...matchingBeat,
      id: `beat-${nextStepNumber}-${Date.now()}`,
      stepNumber: nextStepNumber,
      startPosition: lastStep.endPosition,
      endPosition: newEndPosition ?? startPosition.startPosition,
      blue: newBlue,
      red: newRed,
    };

    sequence.push(newStep);
    lastStep = newStep;
    nextStepNumber++;

    if (sequence.length >= sequenceLength + entriesToAdd) break;
  }

  sequence.unshift(startPosition);
  return sequence;
}

/**
 * Execute Strict Swapped LOOP
 * Second half has blue and red swapped
 */
function executeStrictSwapped(
  sequence: StepBeatData[],
  period: PeriodValue
): StepBeatData[] {
  const startPosition = sequence.shift()!;
  const sequenceLength = sequence.length;
  const entriesToAdd = calculateEntriesToAdd(sequenceLength, period);

  let lastStep = sequence[sequence.length - 1]!;
  let nextStepNumber = lastStep.stepNumber + 1;

  for (let i = 0; i < Math.min(entriesToAdd, sequenceLength); i++) {
    const matchingBeat = sequence[i];
    if (!matchingBeat) continue;

    // Swap blue and red
    const swappedBeat = applySwapToBeat(matchingBeat);

    // Chain from previous beat
    swappedBeat.blue.startLocation = lastStep.blue.endLocation;
    swappedBeat.red.startLocation = lastStep.red.endLocation;

    const newEndPosition = calculateEndPosition(
      swappedBeat.blue.endLocation,
      swappedBeat.red.endLocation
    );

    const newStep: StepBeatData = {
      ...swappedBeat,
      id: `beat-${nextStepNumber}-${Date.now()}`,
      stepNumber: nextStepNumber,
      startPosition: lastStep.endPosition,
      endPosition: newEndPosition ?? lastStep.endPosition,
    };

    sequence.push(newStep);
    lastStep = newStep;
    nextStepNumber++;
  }

  sequence.unshift(startPosition);
  return sequence;
}

/**
 * Execute Strict Inverted LOOP
 * Second half has pro/anti inverted and rotation reversed
 */
function executeStrictInverted(
  sequence: StepBeatData[],
  period: PeriodValue
): StepBeatData[] {
  const startPosition = sequence.shift()!;
  const sequenceLength = sequence.length;
  const entriesToAdd = calculateEntriesToAdd(sequenceLength, period);

  let lastStep = sequence[sequence.length - 1]!;
  let nextStepNumber = lastStep.stepNumber + 1;

  for (let i = 0; i < Math.min(entriesToAdd, sequenceLength); i++) {
    const matchingBeat = sequence[i];
    if (!matchingBeat) continue;

    // Apply invert transformation
    const newBlue = applyInvertToMotion(matchingBeat.blue);
    const newRed = applyInvertToMotion(matchingBeat.red);

    // Chain from previous beat
    newBlue.startLocation = lastStep.blue.endLocation;
    newRed.startLocation = lastStep.red.endLocation;

    const newEndPosition = calculateEndPosition(newBlue.endLocation, newRed.endLocation);

    const newStep: StepBeatData = {
      ...matchingBeat,
      id: `beat-${nextStepNumber}-${Date.now()}`,
      stepNumber: nextStepNumber,
      startPosition: lastStep.endPosition,
      endPosition: newEndPosition ?? lastStep.endPosition,
      blue: newBlue,
      red: newRed,
    };

    sequence.push(newStep);
    lastStep = newStep;
    nextStepNumber++;
  }

  sequence.unshift(startPosition);
  return sequence;
}

/**
 * Execute compound LOOP types by combining transformations
 */
function executeCompoundLoop(
  sequence: StepBeatData[],
  period: PeriodValue,
  loopType: LOOPTypeValue
): StepBeatData[] {
  const startPosition = sequence.shift()!;
  const sequenceLength = sequence.length;
  const entriesToAdd = calculateEntriesToAdd(sequenceLength, period);
  const finalLength = sequenceLength + entriesToAdd;
  const indexMap = getIndexMap(period, finalLength);

  let lastStep = sequence[sequence.length - 1]!;
  let nextStepNumber = lastStep.stepNumber + 1;

  for (let i = 0; i < entriesToAdd; i++) {
    const matchingBeatNumber = indexMap[nextStepNumber];
    const matchingBeatIndex = matchingBeatNumber !== undefined ? matchingBeatNumber - 1 : i % sequenceLength;
    const matchingBeat = sequence[matchingBeatIndex];
    if (!matchingBeat) continue;

    let newBlue = { ...matchingBeat.blue };
    let newRed = { ...matchingBeat.red };

    // Apply transformations based on LOOP type
    switch (loopType) {
      case LOOPType.ROTATED_SWAPPED:
        // Rotation then swap
        newBlue = transformMotionForRotation(matchingBeat.blue, lastStep.blue);
        newRed = transformMotionForRotation(matchingBeat.red, lastStep.red);
        const tempRS = newBlue;
        newBlue = newRed;
        newRed = tempRS;
        break;

      case LOOPType.MIRRORED_SWAPPED:
        // Mirror then swap
        newBlue = applyMirrorToMotion(matchingBeat.blue);
        newRed = applyMirrorToMotion(matchingBeat.red);
        const tempMS = newBlue;
        newBlue = newRed;
        newRed = tempMS;
        break;

      case LOOPType.ROTATED_INVERTED:
        // Rotation then invert
        newBlue = transformMotionForRotation(matchingBeat.blue, lastStep.blue);
        newRed = transformMotionForRotation(matchingBeat.red, lastStep.red);
        newBlue = applyInvertToMotion(newBlue);
        newRed = applyInvertToMotion(newRed);
        break;

      case LOOPType.MIRRORED_INVERTED:
        // Mirror then invert
        newBlue = applyMirrorToMotion(matchingBeat.blue);
        newRed = applyMirrorToMotion(matchingBeat.red);
        newBlue = applyInvertToMotion(newBlue);
        newRed = applyInvertToMotion(newRed);
        break;

      case LOOPType.MIRRORED_ROTATED:
        // Mirror then rotation
        newBlue = applyMirrorToMotion(matchingBeat.blue);
        newRed = applyMirrorToMotion(matchingBeat.red);
        newBlue = transformMotionForRotation(newBlue, lastStep.blue);
        newRed = transformMotionForRotation(newRed, lastStep.red);
        break;

      case LOOPType.SWAPPED_INVERTED:
        // Swap then invert
        const tempSI = matchingBeat.blue;
        newBlue = applyInvertToMotion(matchingBeat.red);
        newRed = applyInvertToMotion(tempSI);
        break;

      case LOOPType.MIRRORED_INVERTED_ROTATED:
        // Mirror, then invert, then rotation
        newBlue = applyMirrorToMotion(matchingBeat.blue);
        newRed = applyMirrorToMotion(matchingBeat.red);
        newBlue = applyInvertToMotion(newBlue);
        newRed = applyInvertToMotion(newRed);
        newBlue = transformMotionForRotation(newBlue, lastStep.blue);
        newRed = transformMotionForRotation(newRed, lastStep.red);
        break;

      default:
        // Fallback to rotation
        newBlue = transformMotionForRotation(matchingBeat.blue, lastStep.blue);
        newRed = transformMotionForRotation(matchingBeat.red, lastStep.red);
    }

    // Ensure chaining from previous beat
    newBlue.startLocation = lastStep.blue.endLocation;
    newRed.startLocation = lastStep.red.endLocation;

    const newEndPosition = calculateEndPosition(newBlue.endLocation, newRed.endLocation);

    const newStep: StepBeatData = {
      ...matchingBeat,
      id: `beat-${nextStepNumber}-${Date.now()}`,
      stepNumber: nextStepNumber,
      startPosition: lastStep.endPosition,
      endPosition: newEndPosition ?? lastStep.endPosition,
      blue: newBlue,
      red: newRed,
    };

    sequence.push(newStep);
    lastStep = newStep;
    nextStepNumber++;
  }

  sequence.unshift(startPosition);
  return sequence;
}

/**
 * Execute LOOP transformation on a partial sequence
 */
export function executeLOOP(
  partialBeats: StepBeatData[],
  loopType: LOOPTypeValue,
  period: PeriodValue
): StepBeatData[] {
  // Clone the beats to avoid mutation
  const sequence = partialBeats.map(cloneStep);

  // Validate sequence
  validateSequence(sequence, period, loopType);

  // Execute appropriate LOOP type
  switch (loopType) {
    case LOOPType.ROTATED:
      return executeStrictRotated(sequence, period);

    case LOOPType.MIRRORED:
      return executeStrictMirrored(sequence, period);

    case LOOPType.SWAPPED:
      return executeStrictSwapped(sequence, period);

    case LOOPType.INVERTED:
      return executeStrictInverted(sequence, period);

    case LOOPType.ROTATED_SWAPPED:
    case LOOPType.MIRRORED_SWAPPED:
    case LOOPType.ROTATED_INVERTED:
    case LOOPType.MIRRORED_INVERTED:
    case LOOPType.MIRRORED_ROTATED:
    case LOOPType.SWAPPED_INVERTED:
    case LOOPType.MIRRORED_INVERTED_ROTATED:
      return executeCompoundLoop(sequence, period, loopType);

    default:
      // Fallback to strict rotated
      console.warn(`Unknown LOOP type: ${loopType}, using ROTATED`);
      return executeStrictRotated(sequence, period);
  }
}

/**
 * Determine the required end position for a partial sequence
 * based on LOOP type and slice size
 */
export function determineEndPosition(
  loopType: LOOPTypeValue,
  startPosition: string,
  period: PeriodValue
): string {
  // For rotated LOOPs, end position is rotated from start
  const isRotatedLoop = [
    LOOPType.ROTATED,
    LOOPType.ROTATED_SWAPPED,
    LOOPType.ROTATED_INVERTED,
    LOOPType.MIRRORED_ROTATED,
    LOOPType.MIRRORED_INVERTED_ROTATED,
  ].includes(loopType as any);

  if (isRotatedLoop) {
    if (period === Period.HALVED) {
      return HALF_POSITION_MAP[startPosition] ?? startPosition;
    } else {
      // For quartered, use clockwise quarter rotation
      return QUARTER_POSITION_MAP_CW[startPosition] ?? startPosition;
    }
  }

  // For non-rotated LOOPs, end position equals start position
  return startPosition;
}
