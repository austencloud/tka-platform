/**
 * Letter Derivation — plain function module.
 *
 * Derives TKA letters from motion data by comparing against known patterns.
 * Reverse-engineers the letter from motion parameters.
 */

import { Letter } from "../../../foundation/domain/models/letter";
import { GridMode } from "../../grid/domain/enums/grid-enums";
import { MotionType } from "../../shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../shared/domain/models/motion-data";
import type { PictographData } from "../../shared/domain/models/pictograph-data";

interface LetterDerivationResult {
  letter: Letter | null;
  confidence: "exact" | "partial" | "none";
  matchedParameters: string[];
}

// Module-level pattern map, built once at initialization
const letterPatterns: Map<string, Letter> = buildLetterPatterns();

function buildLetterPatterns(): Map<string, Letter> {
  const patterns = new Map<string, Letter>();

  patterns.set(
    "left:static|right:static|leftStart:south|leftEnd:south|rightStart:north|rightEnd:north|leftRot:no_rotation|rightRot:no_rotation|leftTurns:0|rightTurns:0|grid:diamond",
    Letter.ALPHA
  );
  patterns.set(
    "left:static|right:static|leftStart:south|leftEnd:south|rightStart:south|rightEnd:south|leftRot:no_rotation|rightRot:no_rotation|leftTurns:0|rightTurns:0|grid:diamond",
    Letter.BETA
  );
  patterns.set(
    "left:static|right:static|leftStart:south|leftEnd:south|rightStart:east|rightEnd:east|leftRot:no_rotation|rightRot:no_rotation|leftTurns:0|rightTurns:0|grid:diamond",
    Letter.GAMMA
  );

  return patterns;
}

function createMotionSignature(
  leftMotion: MotionData,
  rightMotion: MotionData,
  gridMode: GridMode
): string {
  return [
    `left:${leftMotion.motionType}`,
    `right:${rightMotion.motionType}`,
    `leftStart:${leftMotion.startLocation}`,
    `leftEnd:${leftMotion.endLocation}`,
    `rightStart:${rightMotion.startLocation}`,
    `rightEnd:${rightMotion.endLocation}`,
    `leftRot:${leftMotion.rotationDirection}`,
    `rightRot:${rightMotion.rotationDirection}`,
    `leftTurns:${leftMotion.turns}`,
    `rightTurns:${rightMotion.turns}`,
    `grid:${gridMode}`,
  ].join("|");
}

function isShiftMotion(motionType: MotionType): boolean {
  const shiftTypes: MotionType[] = [
    MotionType.PRO,
    MotionType.ANTI,
    MotionType.FLOAT,
  ];
  return shiftTypes.includes(motionType);
}

function findPartialMatch(
  leftMotion: MotionData,
  rightMotion: MotionData
): LetterDerivationResult | null {
  const matchedParams: string[] = [];

  if (
    leftMotion.motionType === MotionType.STATIC &&
    rightMotion.motionType === MotionType.STATIC
  ) {
    matchedParams.push("static_motions");
    const positionKey = `${leftMotion.startLocation}_${rightMotion.startLocation}`;
    const staticLetterMap: Record<string, Letter> = {
      south_north: Letter.ALPHA,
      south_south: Letter.BETA,
      south_east: Letter.GAMMA,
    };
    const letter = staticLetterMap[positionKey];
    if (letter) {
      matchedParams.push("position_mapping");
      return {
        letter,
        confidence: "partial",
        matchedParameters: matchedParams,
      };
    }
  }

  if (
    isShiftMotion(leftMotion.motionType) &&
    isShiftMotion(rightMotion.motionType)
  ) {
    matchedParams.push("dual_shift");
    if (
      leftMotion.motionType === MotionType.PRO &&
      rightMotion.motionType === MotionType.PRO
    ) {
      return {
        letter: Letter.A,
        confidence: "partial",
        matchedParameters: matchedParams,
      };
    }
  }

  return null;
}

export function deriveLetterFromMotions(
  leftMotion: MotionData,
  rightMotion: MotionData,
  gridMode: GridMode = GridMode.DIAMOND
): LetterDerivationResult {
  const signature = createMotionSignature(leftMotion, rightMotion, gridMode);
  const exactMatch = letterPatterns.get(signature);
  if (exactMatch) {
    return {
      letter: exactMatch,
      confidence: "exact",
      matchedParameters: ["all"],
    };
  }

  const partialMatch = findPartialMatch(leftMotion, rightMotion);
  if (partialMatch) return partialMatch;

  return { letter: null, confidence: "none", matchedParameters: [] };
}

export function deriveLetterFromPictograph(
  pictograph: PictographData
): LetterDerivationResult {
  if (!pictograph.motions.left || !pictograph.motions.right) {
    return { letter: null, confidence: "none", matchedParameters: [] };
  }
  return deriveLetterFromMotions(
    pictograph.motions.left,
    pictograph.motions.right
  );
}

export function validateLetterMatch(
  letter: Letter,
  leftMotion: MotionData,
  rightMotion: MotionData
): boolean {
  const result = deriveLetterFromMotions(leftMotion, rightMotion);
  return result.letter === letter && result.confidence === "exact";
}
