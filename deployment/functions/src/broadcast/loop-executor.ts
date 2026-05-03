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

function cloneStep(beat: StepBeatData): StepBeatData {
  return JSON.parse(JSON.stringify(beat));
}

function validateSequence(
  sequence: StepBeatData[],
  period: PeriodValue,
  loopType: LOOPTypeValue
): void {
  if (sequence.length < 2) {
    throw new Error(
      "Sequence must have at least 2 beats (start position + 1 beat)"
    );
  }

  const startPos = sequence[0]!.startPosition;
  const endPos = sequence[sequence.length - 1]!.endPosition;

  if (!startPos || !endPos) {
    throw new Error("Sequence beats must have valid start and end positions");
  }

  const isRotatedLoop = [
    LOOPType.ROTATED,
    LOOPType.ROTATED_SWAPPED,
    LOOPType.ROTATED_INVERTED,
    LOOPType.MIRRORED_ROTATED,
    LOOPType.MIRRORED_INVERTED_ROTATED,
  ].includes(loopType as any);

  if (isRotatedLoop) {
    const key = `${startPos},${endPos}`;
    const validationSet =
      period === Period.HALVED ? HALVED_LOOPS : QUARTERED_LOOPS;

    if (!validationSet.has(key)) {
      throw new Error(
        `Invalid position pair for ${period} ${loopType}: ${startPos} → ${endPos}`
      );
    }
  }
}

function calculateEntriesToAdd(
  sequenceLength: number,
  period: PeriodValue
): number {
  if (period === Period.HALVED) {
    return sequenceLength; // Double the sequence
  }
  return sequenceLength * 3; // Quadruple the sequence
}

function getIndexMap(
  period: PeriodValue,
  length: number
): Record<number, number> {
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

function transformMotionForRotation(
  matchingMotion: MotionData,
  previousMotion: MotionData
): MotionData {
  const handRotDir = getHandRotationDirection(
    matchingMotion.startLocation,
    matchingMotion.endLocation
  );

  const locationMap = getLocationMapForHandRotation(handRotDir);

  const newEndLocation =
    locationMap[previousMotion.endLocation] ?? previousMotion.endLocation;

  return {
    ...matchingMotion,
    startLocation: previousMotion.endLocation,
    endLocation: newEndLocation,
  };
}

function applyMirrorToMotion(motion: MotionData): MotionData {
  const mirrored: MotionData = {
    ...motion,
    startLocation:
      LOCATION_MAP_MIRROR[motion.startLocation] ?? motion.startLocation,
    endLocation: LOCATION_MAP_MIRROR[motion.endLocation] ?? motion.endLocation,
  };

  if (mirrored.rotationDirection === "cw") {
    mirrored.rotationDirection = "ccw";
  } else if (mirrored.rotationDirection === "ccw") {
    mirrored.rotationDirection = "cw";
  }

  return mirrored;
}

function applySwapToBeat(beat: StepBeatData): StepBeatData {
  const swapped = cloneStep(beat);
  const tempBlue = { ...beat.blue };
  swapped.blue = { ...beat.red };
  swapped.red = tempBlue;
  return swapped;
}

function applyInvertToMotion(motion: MotionData): MotionData {
  const inverted: MotionData = { ...motion };

  if (inverted.motionType === "pro") {
    inverted.motionType = "anti";
  } else if (inverted.motionType === "anti") {
    inverted.motionType = "pro";
  }

  if (inverted.rotationDirection === "cw") {
    inverted.rotationDirection = "ccw";
  } else if (inverted.rotationDirection === "ccw") {
    inverted.rotationDirection = "cw";
  }

  return inverted;
}

function calculateEndPosition(
  blueEndLoc: string,
  redEndLoc: string
): string | null {
  return getGridPositionFromLocations(blueEndLoc, redEndLoc);
}

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

    const newBlue = transformMotionForRotation(matchingBeat.blue, lastStep.blue);
    const newRed = transformMotionForRotation(matchingBeat.red, lastStep.red);

    const newEndPosition = calculateEndPosition(
      newBlue.endLocation,
      newRed.endLocation
    );

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

function executeStrictMirrored(
  sequence: StepBeatData[],
  period: PeriodValue
): StepBeatData[] {
  const startPosition = sequence.shift()!;
  const sequenceLength = sequence.length;
  const entriesToAdd = calculateEntriesToAdd(sequenceLength, period);

  let lastStep = sequence[sequence.length - 1]!;
  let nextStepNumber = lastStep.stepNumber + 1;

  for (let i = sequenceLength - 1; i >= 0; i--) {
    const matchingBeat = sequence[i];
    if (!matchingBeat) continue;

    const newBlue = applyMirrorToMotion(matchingBeat.blue);
    const newRed = applyMirrorToMotion(matchingBeat.red);

    newBlue.startLocation = lastStep.blue.endLocation;
    newRed.startLocation = lastStep.red.endLocation;

    newBlue.endLocation =
      LOCATION_MAP_MIRROR[matchingBeat.blue.startLocation] ??
      matchingBeat.blue.startLocation;
    newRed.endLocation =
      LOCATION_MAP_MIRROR[matchingBeat.red.startLocation] ??
      matchingBeat.red.startLocation;

    const newEndPosition = calculateEndPosition(
      newBlue.endLocation,
      newRed.endLocation
    );

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

    const swappedBeat = applySwapToBeat(matchingBeat);

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

    const newBlue = applyInvertToMotion(matchingBeat.blue);
    const newRed = applyInvertToMotion(matchingBeat.red);

    newBlue.startLocation = lastStep.blue.endLocation;
    newRed.startLocation = lastStep.red.endLocation;

    const newEndPosition = calculateEndPosition(
      newBlue.endLocation,
      newRed.endLocation
    );

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
    const matchingBeatIndex =
      matchingBeatNumber !== undefined
        ? matchingBeatNumber - 1
        : i % sequenceLength;
    const matchingBeat = sequence[matchingBeatIndex];
    if (!matchingBeat) continue;

    let newBlue = { ...matchingBeat.blue };
    let newRed = { ...matchingBeat.red };

    switch (loopType) {
      case LOOPType.ROTATED_SWAPPED:
        newBlue = transformMotionForRotation(matchingBeat.blue, lastStep.blue);
        newRed = transformMotionForRotation(matchingBeat.red, lastStep.red);
        const tempRS = newBlue;
        newBlue = newRed;
        newRed = tempRS;
        break;

      case LOOPType.MIRRORED_SWAPPED:
        newBlue = applyMirrorToMotion(matchingBeat.blue);
        newRed = applyMirrorToMotion(matchingBeat.red);
        const tempMS = newBlue;
        newBlue = newRed;
        newRed = tempMS;
        break;

      case LOOPType.ROTATED_INVERTED:
        newBlue = transformMotionForRotation(matchingBeat.blue, lastStep.blue);
        newRed = transformMotionForRotation(matchingBeat.red, lastStep.red);
        newBlue = applyInvertToMotion(newBlue);
        newRed = applyInvertToMotion(newRed);
        break;

      case LOOPType.MIRRORED_INVERTED:
        newBlue = applyMirrorToMotion(matchingBeat.blue);
        newRed = applyMirrorToMotion(matchingBeat.red);
        newBlue = applyInvertToMotion(newBlue);
        newRed = applyInvertToMotion(newRed);
        break;

      case LOOPType.MIRRORED_ROTATED:
        newBlue = applyMirrorToMotion(matchingBeat.blue);
        newRed = applyMirrorToMotion(matchingBeat.red);
        newBlue = transformMotionForRotation(newBlue, lastStep.blue);
        newRed = transformMotionForRotation(newRed, lastStep.red);
        break;

      case LOOPType.SWAPPED_INVERTED:
        const tempSI = matchingBeat.blue;
        newBlue = applyInvertToMotion(matchingBeat.red);
        newRed = applyInvertToMotion(tempSI);
        break;

      case LOOPType.MIRRORED_INVERTED_ROTATED:
        newBlue = applyMirrorToMotion(matchingBeat.blue);
        newRed = applyMirrorToMotion(matchingBeat.red);
        newBlue = applyInvertToMotion(newBlue);
        newRed = applyInvertToMotion(newRed);
        newBlue = transformMotionForRotation(newBlue, lastStep.blue);
        newRed = transformMotionForRotation(newRed, lastStep.red);
        break;

      default:
        newBlue = transformMotionForRotation(matchingBeat.blue, lastStep.blue);
        newRed = transformMotionForRotation(matchingBeat.red, lastStep.red);
    }

    newBlue.startLocation = lastStep.blue.endLocation;
    newRed.startLocation = lastStep.red.endLocation;

    const newEndPosition = calculateEndPosition(
      newBlue.endLocation,
      newRed.endLocation
    );

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

export function executeLOOP(
  partialBeats: StepBeatData[],
  loopType: LOOPTypeValue,
  period: PeriodValue
): StepBeatData[] {
  const sequence = partialBeats.map(cloneStep);

  validateSequence(sequence, period, loopType);

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
      console.warn(`Unknown LOOP type: ${loopType}, using ROTATED`);
      return executeStrictRotated(sequence, period);
  }
}

export function determineEndPosition(
  loopType: LOOPTypeValue,
  startPosition: string,
  period: PeriodValue
): string {
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
      return QUARTER_POSITION_MAP_CW[startPosition] ?? startPosition;
    }
  }

  return startPosition;
}
