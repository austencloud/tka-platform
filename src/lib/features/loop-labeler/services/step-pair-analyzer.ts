import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  INVERTED_LETTER_MAP,
  COMPOUND_LETTER_MAP,
  ALPHA_BETA_COUNTERPART_LETTER_MAP,
} from "$lib/features/create/generate/circular/domain/constants/strict-loop-position-maps";
import type { StepPairRelationship, LetterRelationshipInfo } from "./types";

/**
 * Analyze the relationship between two steps.
 */
export function analyzeBeatPair(step1: StepData, step2: StepData): StepPairRelationship {
  const transformations: string[] = [];

  // Check IDENTICAL first (no transformation)
  if (isIdentical(step1, step2)) {
    transformations.push("SAME");
  }

  // Check ROTATED (180° or 90°)
  if (isRotated(step1, step2)) {
    transformations.push("ROTATED");
  }

  // Check SWAPPED (blue/red swap)
  if (isSwapped(step1, step2)) {
    transformations.push("SWAPPED");
  }

  // Check MIRRORED (vertical flip n↔s)
  if (isMirrored(step1, step2)) {
    transformations.push("MIRRORED");
  }

  // Check FLIPPED (horizontal flip e↔w)
  if (isFlipped(step1, step2)) {
    transformations.push("FLIPPED");
  }

  // Check INVERTED (pro↔anti)
  if (isInverted(step1, step2)) {
    transformations.push("INVERTED");
  }

  // Check actual combined transformations (apply in sequence, verify result)
  // Only add combination if applying both transformations in sequence matches step2
  if (isRotatedThenSwapped(step1, step2)) {
    transformations.push("ROTATED + SWAPPED");
  }
  if (isRotatedThenInverted(step1, step2)) {
    transformations.push("ROTATED + INVERTED");
  }
  if (isMirroredThenFlipped(step1, step2)) {
    transformations.push("MIRRORED + FLIPPED");
  }
  if (isMirroredThenSwapped(step1, step2)) {
    transformations.push("MIRRORED + SWAPPED");
  }
  if (isFlippedThenSwapped(step1, step2)) {
    transformations.push("FLIPPED + SWAPPED");
  }

  // Analyze letter relationship
  const letterRelationship = analyzeLetterRelationship(step1, step2);

  return {
    keyStep: step1.stepNumber,
    correspondingStep: step2.stepNumber,
    detectedTransformations:
      transformations.length > 0 ? transformations : ["UNKNOWN/COMPLEX"],
    letterRelationship,
  };
}

/**
 * Analyze the letter-based relationship between two steps
 */
function analyzeLetterRelationship(
  step1: StepData,
  step2: StepData
): LetterRelationshipInfo | undefined {
  const letter1 = step1.letter;
  const letter2 = step2.letter;

  if (!letter1 || !letter2) {
    return undefined;
  }

  // Check each type of letter relationship
  const isInvertedRel = INVERTED_LETTER_MAP[letter1] === letter2;
  const isCompound = COMPOUND_LETTER_MAP[letter1] === letter2;
  const isAlphaBetaCounterpart =
    ALPHA_BETA_COUNTERPART_LETTER_MAP[letter1] === letter2;

  // Build summary
  const relationshipNames: string[] = [];
  if (isInvertedRel) relationshipNames.push("Inverted");
  if (isCompound) relationshipNames.push("Compound");
  if (isAlphaBetaCounterpart) relationshipNames.push("α↔β Counterpart");

  const summary =
    relationshipNames.length > 0
      ? `${letter1}↔${letter2}: ${relationshipNames.join(", ")}`
      : `${letter1}↔${letter2}: No formal relationship`;

  return {
    letter1,
    letter2,
    relationships: {
      isInverted: isInvertedRel,
      isCompound,
      isAlphaBetaCounterpart,
    },
    summary,
  };
}

function isIdentical(step1: StepData, step2: StepData): boolean {
  const blue1 = step1.motions.blue;
  const blue2 = step2.motions.blue;
  const red1 = step1.motions.red;
  const red2 = step2.motions.red;

  if (!blue1 || !blue2 || !red1 || !red2) {
    return false;
  }

  return (
    blue1.startLocation === blue2.startLocation &&
    blue1.endLocation === blue2.endLocation &&
    blue1.motionType === blue2.motionType &&
    red1.startLocation === red2.startLocation &&
    red1.endLocation === red2.endLocation &&
    red1.motionType === red2.motionType
  );
}

function isRotated(step1: StepData, step2: StepData): boolean {
  // Simplified check: locations should be rotated 180°
  const rotate180 = (loc: string) => {
    const map: Record<string, string> = {
      n: "s",
      s: "n",
      e: "w",
      w: "e",
      ne: "sw",
      sw: "ne",
      nw: "se",
      se: "nw",
    };
    return map[loc.toLowerCase()] || loc;
  };

  const blue1 = step1.motions.blue;
  const blue2 = step2.motions.blue;
  const red1 = step1.motions.red;
  const red2 = step2.motions.red;

  if (!blue1 || !blue2 || !red1 || !red2) {
    return false;
  }

  return (
    rotate180(blue1.startLocation) === blue2.startLocation.toLowerCase() &&
    rotate180(blue1.endLocation) === blue2.endLocation.toLowerCase() &&
    rotate180(red1.startLocation) === red2.startLocation.toLowerCase() &&
    rotate180(red1.endLocation) === red2.endLocation.toLowerCase()
  );
}

function isSwapped(step1: StepData, step2: StepData): boolean {
  const blue1 = step1.motions.blue;
  const blue2 = step2.motions.blue;
  const red1 = step1.motions.red;
  const red2 = step2.motions.red;

  if (!blue1 || !blue2 || !red1 || !red2) {
    return false;
  }

  // Swapped means blue↔red swap - locations AND motion types must match
  return (
    blue1.startLocation === red2.startLocation &&
    blue1.endLocation === red2.endLocation &&
    blue1.motionType === red2.motionType &&
    red1.startLocation === blue2.startLocation &&
    red1.endLocation === blue2.endLocation &&
    red1.motionType === blue2.motionType
  );
}

function isMirrored(step1: StepData, step2: StepData): boolean {
  // Mirror vertically (left↔right) = reflect across vertical axis = e↔w swap
  const mirrorVertical = (loc: string) => {
    const map: Record<string, string> = {
      n: "n",
      s: "s",
      e: "w",
      w: "e",
      ne: "nw",
      nw: "ne",
      se: "sw",
      sw: "se",
    };
    return map[loc.toLowerCase()] || loc;
  };

  const blue1 = step1.motions.blue;
  const blue2 = step2.motions.blue;
  const red1 = step1.motions.red;
  const red2 = step2.motions.red;

  if (!blue1 || !blue2 || !red1 || !red2) {
    return false;
  }

  return (
    mirrorVertical(blue1.startLocation) ===
      blue2.startLocation.toLowerCase() &&
    mirrorVertical(blue1.endLocation) === blue2.endLocation.toLowerCase() &&
    mirrorVertical(red1.startLocation) === red2.startLocation.toLowerCase() &&
    mirrorVertical(red1.endLocation) === red2.endLocation.toLowerCase()
  );
}

function isFlipped(step1: StepData, step2: StepData): boolean {
  // Flip horizontally (top↔bottom) = reflect across horizontal axis = n↔s swap
  const flipHorizontal = (loc: string) => {
    const map: Record<string, string> = {
      n: "s",
      s: "n",
      e: "e",
      w: "w",
      ne: "se",
      se: "ne",
      nw: "sw",
      sw: "nw",
    };
    return map[loc.toLowerCase()] || loc;
  };

  const blue1 = step1.motions.blue;
  const blue2 = step2.motions.blue;
  const red1 = step1.motions.red;
  const red2 = step2.motions.red;

  if (!blue1 || !blue2 || !red1 || !red2) {
    return false;
  }

  return (
    flipHorizontal(blue1.startLocation) ===
      blue2.startLocation.toLowerCase() &&
    flipHorizontal(blue1.endLocation) === blue2.endLocation.toLowerCase() &&
    flipHorizontal(red1.startLocation) === red2.startLocation.toLowerCase() &&
    flipHorizontal(red1.endLocation) === red2.endLocation.toLowerCase()
  );
}

function isInverted(step1: StepData, step2: StepData): boolean {
  // INVERTED means: same positions, but motion types swapped (pro↔anti)
  // Positions must be identical for strict inversion
  const invert = (type: MotionType) => {
    if (type === MotionType.PRO) return MotionType.ANTI;
    if (type === MotionType.ANTI) return MotionType.PRO;
    return type;
  };

  const blue1 = step1.motions.blue;
  const blue2 = step2.motions.blue;
  const red1 = step1.motions.red;
  const red2 = step2.motions.red;

  if (!blue1 || !blue2 || !red1 || !red2) {
    return false;
  }

  // Check positions are identical AND motion types are inverted
  return (
    blue1.startLocation === blue2.startLocation &&
    blue1.endLocation === blue2.endLocation &&
    red1.startLocation === red2.startLocation &&
    red1.endLocation === red2.endLocation &&
    invert(blue1.motionType) === blue2.motionType &&
    invert(red1.motionType) === red2.motionType
  );
}

// Combined transformation checks - apply transformations in sequence

function isRotatedThenSwapped(step1: StepData, step2: StepData): boolean {
  // Apply rotation to step1, then swap colors, check if matches step2
  const rotate180 = (loc: string) => {
    const map: Record<string, string> = {
      n: "s",
      s: "n",
      e: "w",
      w: "e",
      ne: "sw",
      sw: "ne",
      nw: "se",
      se: "nw",
    };
    return map[loc.toLowerCase()] || loc;
  };

  const blue1 = step1.motions.blue;
  const blue2 = step2.motions.blue;
  const red1 = step1.motions.red;
  const red2 = step2.motions.red;

  if (!blue1 || !blue2 || !red1 || !red2) {
    return false;
  }

  // After rotate: blue1 positions become rotate180(blue1), red1 becomes rotate180(red1)
  // After swap: the rotated blue1 becomes new red, rotated red1 becomes new blue
  // So: new blue = rotated red1, new red = rotated blue1
  return (
    rotate180(red1.startLocation) === blue2.startLocation.toLowerCase() &&
    rotate180(red1.endLocation) === blue2.endLocation.toLowerCase() &&
    red1.motionType === blue2.motionType &&
    rotate180(blue1.startLocation) === red2.startLocation.toLowerCase() &&
    rotate180(blue1.endLocation) === red2.endLocation.toLowerCase() &&
    blue1.motionType === red2.motionType
  );
}

function isRotatedThenInverted(step1: StepData, step2: StepData): boolean {
  // Apply rotation to step1, then invert motion types, check if matches step2
  const rotate180 = (loc: string) => {
    const map: Record<string, string> = {
      n: "s",
      s: "n",
      e: "w",
      w: "e",
      ne: "sw",
      sw: "ne",
      nw: "se",
      se: "nw",
    };
    return map[loc.toLowerCase()] || loc;
  };

  const invert = (type: MotionType) => {
    if (type === MotionType.PRO) return MotionType.ANTI;
    if (type === MotionType.ANTI) return MotionType.PRO;
    return type;
  };

  const blue1 = step1.motions.blue;
  const blue2 = step2.motions.blue;
  const red1 = step1.motions.red;
  const red2 = step2.motions.red;

  if (!blue1 || !blue2 || !red1 || !red2) {
    return false;
  }

  return (
    rotate180(blue1.startLocation) === blue2.startLocation.toLowerCase() &&
    rotate180(blue1.endLocation) === blue2.endLocation.toLowerCase() &&
    invert(blue1.motionType) === blue2.motionType &&
    rotate180(red1.startLocation) === red2.startLocation.toLowerCase() &&
    rotate180(red1.endLocation) === red2.endLocation.toLowerCase() &&
    invert(red1.motionType) === red2.motionType
  );
}

function isMirroredThenFlipped(step1: StepData, step2: StepData): boolean {
  // Mirror (e↔w) then flip (n↔s) = 180° rotation
  // This is equivalent to rotation, so check if it matches but rotation alone doesn't
  const mirrorThenFlip = (loc: string) => {
    // Mirror: e↔w, then flip: n↔s
    const mirrorMap: Record<string, string> = {
      n: "n",
      s: "s",
      e: "w",
      w: "e",
      ne: "nw",
      nw: "ne",
      se: "sw",
      sw: "se",
    };
    const flipMap: Record<string, string> = {
      n: "s",
      s: "n",
      e: "e",
      w: "w",
      ne: "se",
      se: "ne",
      nw: "sw",
      sw: "nw",
    };
    const mirrored = mirrorMap[loc.toLowerCase()] || loc;
    return flipMap[mirrored] || mirrored;
  };

  const blue1 = step1.motions.blue;
  const blue2 = step2.motions.blue;
  const red1 = step1.motions.red;
  const red2 = step2.motions.red;

  if (!blue1 || !blue2 || !red1 || !red2) {
    return false;
  }

  return (
    mirrorThenFlip(blue1.startLocation) ===
      blue2.startLocation.toLowerCase() &&
    mirrorThenFlip(blue1.endLocation) === blue2.endLocation.toLowerCase() &&
    mirrorThenFlip(red1.startLocation) === red2.startLocation.toLowerCase() &&
    mirrorThenFlip(red1.endLocation) === red2.endLocation.toLowerCase()
  );
}

function isMirroredThenSwapped(step1: StepData, step2: StepData): boolean {
  // Apply mirror (e↔w) to step1, then swap colors, check if matches step2
  const mirrorVertical = (loc: string) => {
    const map: Record<string, string> = {
      n: "n",
      s: "s",
      e: "w",
      w: "e",
      ne: "nw",
      nw: "ne",
      se: "sw",
      sw: "se",
    };
    return map[loc.toLowerCase()] || loc;
  };

  const blue1 = step1.motions.blue;
  const blue2 = step2.motions.blue;
  const red1 = step1.motions.red;
  const red2 = step2.motions.red;

  if (!blue1 || !blue2 || !red1 || !red2) {
    return false;
  }

  // After mirror: blue1 positions become mirror(blue1), red1 becomes mirror(red1)
  // After swap: the mirrored blue1 becomes new red, mirrored red1 becomes new blue
  // So: new blue = mirrored red1, new red = mirrored blue1
  return (
    mirrorVertical(red1.startLocation) ===
      blue2.startLocation.toLowerCase() &&
    mirrorVertical(red1.endLocation) === blue2.endLocation.toLowerCase() &&
    red1.motionType === blue2.motionType &&
    mirrorVertical(blue1.startLocation) ===
      red2.startLocation.toLowerCase() &&
    mirrorVertical(blue1.endLocation) === red2.endLocation.toLowerCase() &&
    blue1.motionType === red2.motionType
  );
}

function isFlippedThenSwapped(step1: StepData, step2: StepData): boolean {
  // Apply flip (n↔s) to step1, then swap colors, check if matches step2
  const flipHorizontal = (loc: string) => {
    const map: Record<string, string> = {
      n: "s",
      s: "n",
      e: "e",
      w: "w",
      ne: "se",
      se: "ne",
      nw: "sw",
      sw: "nw",
    };
    return map[loc.toLowerCase()] || loc;
  };

  const blue1 = step1.motions.blue;
  const blue2 = step2.motions.blue;
  const red1 = step1.motions.red;
  const red2 = step2.motions.red;

  if (!blue1 || !blue2 || !red1 || !red2) {
    return false;
  }

  // After flip: blue1 positions become flip(blue1), red1 becomes flip(red1)
  // After swap: the flipped blue1 becomes new red, flipped red1 becomes new blue
  // So: new blue = flipped red1, new red = flipped blue1
  return (
    flipHorizontal(red1.startLocation) ===
      blue2.startLocation.toLowerCase() &&
    flipHorizontal(red1.endLocation) === blue2.endLocation.toLowerCase() &&
    red1.motionType === blue2.motionType &&
    flipHorizontal(blue1.startLocation) ===
      red2.startLocation.toLowerCase() &&
    flipHorizontal(blue1.endLocation) === red2.endLocation.toLowerCase() &&
    blue1.motionType === red2.motionType
  );
}
