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
    "blue:static|red:static|blueStart:south|blueEnd:south|redStart:north|redEnd:north|blueRot:no_rotation|redRot:no_rotation|blueTurns:0|redTurns:0|grid:diamond",
    Letter.ALPHA
  );
  patterns.set(
    "blue:static|red:static|blueStart:south|blueEnd:south|redStart:south|redEnd:south|blueRot:no_rotation|redRot:no_rotation|blueTurns:0|redTurns:0|grid:diamond",
    Letter.BETA
  );
  patterns.set(
    "blue:static|red:static|blueStart:south|blueEnd:south|redStart:east|redEnd:east|blueRot:no_rotation|redRot:no_rotation|blueTurns:0|redTurns:0|grid:diamond",
    Letter.GAMMA
  );

  return patterns;
}

function createMotionSignature(
  blueMotion: MotionData,
  redMotion: MotionData,
  gridMode: GridMode
): string {
  return [
    `blue:${blueMotion.motionType}`,
    `red:${redMotion.motionType}`,
    `blueStart:${blueMotion.startLocation}`,
    `blueEnd:${blueMotion.endLocation}`,
    `redStart:${redMotion.startLocation}`,
    `redEnd:${redMotion.endLocation}`,
    `blueRot:${blueMotion.rotationDirection}`,
    `redRot:${redMotion.rotationDirection}`,
    `blueTurns:${blueMotion.turns}`,
    `redTurns:${redMotion.turns}`,
    `grid:${gridMode}`,
  ].join("|");
}

function isShiftMotion(motionType: MotionType): boolean {
  const shiftTypes: MotionType[] = [MotionType.PRO, MotionType.ANTI, MotionType.FLOAT];
  return shiftTypes.includes(motionType);
}

function findPartialMatch(
  blueMotion: MotionData,
  redMotion: MotionData
): LetterDerivationResult | null {
  const matchedParams: string[] = [];

  if (
    blueMotion.motionType === MotionType.STATIC &&
    redMotion.motionType === MotionType.STATIC
  ) {
    matchedParams.push("static_motions");
    const positionKey = `${blueMotion.startLocation}_${redMotion.startLocation}`;
    const staticLetterMap: Record<string, Letter> = {
      south_north: Letter.ALPHA,
      south_south: Letter.BETA,
      south_east: Letter.GAMMA,
    };
    const letter = staticLetterMap[positionKey];
    if (letter) {
      matchedParams.push("position_mapping");
      return { letter, confidence: "partial", matchedParameters: matchedParams };
    }
  }

  if (isShiftMotion(blueMotion.motionType) && isShiftMotion(redMotion.motionType)) {
    matchedParams.push("dual_shift");
    if (
      blueMotion.motionType === MotionType.PRO &&
      redMotion.motionType === MotionType.PRO
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
  blueMotion: MotionData,
  redMotion: MotionData,
  gridMode: GridMode = GridMode.DIAMOND
): LetterDerivationResult {
  const signature = createMotionSignature(blueMotion, redMotion, gridMode);
  const exactMatch = letterPatterns.get(signature);
  if (exactMatch) {
    return { letter: exactMatch, confidence: "exact", matchedParameters: ["all"] };
  }

  const partialMatch = findPartialMatch(blueMotion, redMotion);
  if (partialMatch) return partialMatch;

  return { letter: null, confidence: "none", matchedParameters: [] };
}

export function deriveLetterFromPictograph(
  pictograph: PictographData
): LetterDerivationResult {
  if (!pictograph.motions.blue || !pictograph.motions.red) {
    return { letter: null, confidence: "none", matchedParameters: [] };
  }
  return deriveLetterFromMotions(pictograph.motions.blue, pictograph.motions.red);
}

export function validateLetterMatch(
  letter: Letter,
  blueMotion: MotionData,
  redMotion: MotionData
): boolean {
  const result = deriveLetterFromMotions(blueMotion, redMotion);
  return result.letter === letter && result.confidence === "exact";
}
